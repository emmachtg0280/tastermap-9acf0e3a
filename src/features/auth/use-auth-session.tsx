import { useEffect, useState } from "react";
import { LogIn, LogOut, Loader2, User } from "lucide-react";

import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export function useAuthSession() {
  const [user, setUser] = useState<null | { id: string; email?: string }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function AuthButton() {
  const { user, loading } = useAuthSession();
  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  const signIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      console.error("Sign in error", result.error);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (user) {
    return (
      <button
        onClick={signOut}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        aria-label="Déconnexion"
      >
        <User className="h-3.5 w-3.5" />
        <LogOut className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={signIn}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
      aria-label="Connexion"
    >
      <LogIn className="h-3.5 w-3.5" />
    </button>
  );
}
