import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: typeof google;
    initGMap?: () => void;
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Carte des meilleurs restaurants en France · Tastemap" },
      {
        name: "description",
        content:
          "Découvrez et marquez les meilleurs restaurants de Toulouse, Paris, Lyon, Marseille, Bordeaux et Montpellier sur une carte food interactive.",
      },
      { property: "og:title", content: "Carte des meilleurs restaurants en France · Tastemap" },
      {
        property: "og:description",
        content:
          "Découvrez et marquez les meilleurs restaurants de Toulouse, Paris, Lyon, Marseille, Bordeaux et Montpellier sur une carte food interactive.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://tastermap.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://tastermap.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Carte des meilleurs restaurants en France",
          url: "https://tastermap.lovable.app/",
          description:
            "Carte food interactive des meilleurs restaurants des grandes villes de France.",
          about: CITIES.map((c) => ({ "@type": "City", name: c.label })),
        }),
      },
    ],
  }),

  component: Index,
});

export function useGoogleMaps() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.google?.maps) {
      setReady(true);
      return;
    }
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return;
    window.initGMap = () => setReady(true);
    const existing = document.getElementById("gmaps-script") as HTMLScriptElement | null;
    if (existing) return;
    const s = document.createElement("script");
    s.id = "gmaps-script";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=initGMap${
      channel ? `&channel=${channel}` : ""
    }`;
    document.head.appendChild(s);
  }, []);
  return ready;
}
