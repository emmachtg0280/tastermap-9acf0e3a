import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

type AuthorizationDetails = {
  client?: { name?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  head: () => ({
    meta: [
      { title: "Autorisation d'accès — Tastemap" },
      {
        name: "description",
        content:
          "Autorisez ou refusez l'accès d'une application tierce à votre compte Tastemap et à votre carte food personnelle.",
      },
      { property: "og:title", content: "Autorisation d'accès — Tastemap" },
      {
        property: "og:description",
        content:
          "Page de consentement Tastemap : validez les autorisations demandées par une application tierce.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,

  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
  },
  loader: async ({ location }) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { needsAuth: true as const, details: null };

    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;

    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });

    return { needsAuth: false as const, details: data };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <p>
        Impossible de charger cette demande d'autorisation :{" "}
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const loaded = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Aucune redirection renvoyée par le serveur d'autorisation.");
      return;
    }
    window.location.href = target;
  }

  async function signIn() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.href,
    });
    if ("error" in result && result.error) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    window.location.reload();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border bg-card p-6 text-center shadow-lg">
        {loaded.needsAuth ? (
          <>
            <h1 className="text-xl font-bold">Connexion requise</h1>
            <p className="text-sm text-muted-foreground">
              Connecte-toi pour autoriser cette application à accéder à ta carte food.
            </p>
            <button
              className="w-full rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
              disabled={busy}
              onClick={signIn}
            >
              Se connecter avec Google
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">
              Connecter {loaded.details?.client?.name ?? "une application"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {loaded.details?.client?.name ?? "Cette application"} pourra lire et modifier tes
              restaurants faits et favoris, en ton nom.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-full border px-4 py-2 font-semibold disabled:opacity-50"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Refuser
              </button>
              <button
                className="flex-1 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                disabled={busy}
                onClick={() => decide(true)}
              >
                Autoriser
              </button>
            </div>
          </>
        )}
        {loaded.needsAuth && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
