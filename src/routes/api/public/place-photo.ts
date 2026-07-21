import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

export const Route = createFileRoute("/api/public/place-photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name");
        const maxHeightPx = url.searchParams.get("h") ?? "400";

        if (!name || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) {
          return new Response("Invalid photo name", { status: 400 });
        }

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
        if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
          return new Response("Not configured", { status: 500 });
        }

        const upstream = await fetch(
          `${GATEWAY}/places/v1/${name}/media?maxHeightPx=${encodeURIComponent(
            maxHeightPx,
          )}&skipHttpRedirect=true`,
          {
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
            },
          },
        );

        if (!upstream.ok) {
          const text = await upstream.text();
          console.error(`Place photo failed [${upstream.status}]: ${text}`);
          return new Response("Photo unavailable", { status: upstream.status });
        }

        // With skipHttpRedirect=true, response is JSON { photoUri }
        const json = (await upstream.json()) as { photoUri?: string };
        if (!json.photoUri) return new Response("No photo URI", { status: 502 });

        const imgRes = await fetch(json.photoUri);
        if (!imgRes.ok) return new Response("Photo fetch failed", { status: 502 });

        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const buf = await imgRes.arrayBuffer();
        return new Response(buf, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
