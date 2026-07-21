/// <reference types="google.maps" />
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Star, MapPin, Search, Loader2 } from "lucide-react";

import { searchRestaurants, type Cuisine, type Restaurant } from "@/lib/places.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

const CUISINES: { value: Cuisine; label: string; emoji: string }[] = [
  { value: "any", label: "Tous", emoji: "🍽️" },
  { value: "french", label: "Français", emoji: "🥐" },
  { value: "italian", label: "Italien", emoji: "🍝" },
  { value: "chinese", label: "Chinois", emoji: "🥡" },
  { value: "japanese", label: "Japonais", emoji: "🍣" },
  { value: "indian", label: "Indien", emoji: "🍛" },
  { value: "mexican", label: "Mexicain", emoji: "🌮" },
  { value: "thai", label: "Thaï", emoji: "🍜" },
  { value: "spanish", label: "Espagnol", emoji: "🥘" },
  { value: "greek", label: "Grec", emoji: "🥙" },
  { value: "american", label: "Américain", emoji: "🍔" },
  { value: "vegetarian", label: "Végétarien", emoji: "🥗" },
];

declare global {
  interface Window {
    google?: typeof google;
    initGMap?: () => void;
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tastemap · Carte des restaurants en France" },
      {
        name: "description",
        content:
          "Explorez les restaurants de France sur une carte interactive. Filtrez par cuisine et par note, découvrez photos, avis et adresses.",
      },
      { property: "og:title", content: "Tastemap · Carte des restaurants en France" },
      {
        property: "og:description",
        content: "Carte interactive pour trouver les meilleurs restaurants en France.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useGoogleMaps() {
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

function Index() {
  const [cuisine, setCuisine] = useState<Cuisine>("any");
  const [minRating, setMinRating] = useState(4);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [results, setResults] = useState<Restaurant[]>([]);

  const mapReady = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const search = useServerFn(searchRestaurants);
  const mutation = useMutation({
    mutationFn: (vars: { cuisine: Cuisine; minRating: number }) =>
      search({ data: vars }),
    onSuccess: (data) => {
      setResults(data);
      setSelected(null);
    },
  });

  // init map
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google!.maps.Map(mapRef.current, {
      center: { lat: 46.6, lng: 2.5 },
      zoom: 6,
      disableDefaultUI: true,
      zoomControl: true,
      styles: mapStyle,
    });
  }, [mapReady]);

  // render markers
  useEffect(() => {
    if (!mapInstance.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (results.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    results.forEach((r) => {
      const marker = new window.google!.maps.Marker({
        position: { lat: r.lat, lng: r.lng },
        map: mapInstance.current!,
        title: r.name,
        icon: {
          path: window.google!.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#e11d48",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => setSelected(r));
      markersRef.current.push(marker);
      bounds.extend({ lat: r.lat, lng: r.lng });
    });
    mapInstance.current.fitBounds(bounds, 60);
  }, [results]);

  // initial + on filter change search
  useEffect(() => {
    mutation.mutate({ cuisine, minRating });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuisine, minRating]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold">
            T
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Tastemap</h1>
            <p className="text-xs text-muted-foreground">
              Les restaurants de France, filtrés à votre goût
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-4 py-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Filters + list */}
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-2">Type de cuisine</h2>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((c) => {
                  const active = c.value === cuisine;
                  return (
                    <button
                      key={c.value}
                      onClick={() => setCuisine(c.value)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent border-border"
                      }`}
                    >
                      <span className="mr-1">{c.emoji}</span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Note minimum</h2>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
                  {minRating.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[minRating]}
                min={0}
                max={5}
                step={0.5}
                onValueChange={(v) => setMinRating(v[0])}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => mutation.mutate({ cuisine, minRating })}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recherche...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" /> Rechercher
                </>
              )}
            </Button>
          </div>

          <div className="rounded-2xl border bg-card">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Résultats</h2>
              <Badge variant="secondary">{results.length}</Badge>
            </div>
            <div className="max-h-[420px] overflow-auto divide-y">
              {mutation.isPending && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Chargement...
                </div>
              )}
              {!mutation.isPending && results.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Aucun restaurant trouvé. Essayez d'assouplir les filtres.
                </div>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelected(r);
                    mapInstance.current?.panTo({ lat: r.lat, lng: r.lng });
                    mapInstance.current?.setZoom(14);
                  }}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-accent transition ${
                    selected?.id === r.id ? "bg-accent" : ""
                  }`}
                >
                  {r.photoUrl ? (
                    <img
                      src={r.photoUrl}
                      alt={r.name}
                      className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-muted grid place-items-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.primaryType ?? "Restaurant"}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      {r.rating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" />
                          {r.rating.toFixed(1)}
                          {r.userRatingCount != null && (
                            <span className="text-muted-foreground ml-1">
                              ({r.userRatingCount})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Map */}
        <main className="relative">
          <div
            ref={mapRef}
            className="w-full h-[70vh] lg:h-[calc(100vh-8rem)] rounded-2xl border overflow-hidden bg-muted"
          />
          {!mapReady && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="rounded-full bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement de la carte...
              </div>
            </div>
          )}

          {selected && (
            <div className="absolute left-4 right-4 bottom-4 lg:left-6 lg:right-auto lg:bottom-6 lg:w-96 rounded-2xl bg-card border shadow-lg overflow-hidden">
              {selected.photoUrl && (
                <img
                  src={selected.photoUrl}
                  alt={selected.name}
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{selected.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selected.primaryType ?? "Restaurant"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground text-lg leading-none"
                    aria-label="Fermer"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm">
                  {selected.rating != null && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 stroke-amber-400" />
                      <span className="font-medium">{selected.rating.toFixed(1)}</span>
                      {selected.userRatingCount != null && (
                        <span className="text-muted-foreground text-xs">
                          ({selected.userRatingCount})
                        </span>
                      )}
                    </span>
                  )}
                  {selected.priceLevel && (
                    <span className="text-xs text-muted-foreground">
                      {priceLabel(selected.priceLevel)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {selected.address}
                </p>
                {selected.googleMapsUri && (
                  <a
                    href={selected.googleMapsUri}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm text-primary font-medium hover:underline"
                  >
                    Voir sur Google Maps →
                  </a>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function priceLabel(level: string) {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Gratuit",
    PRICE_LEVEL_INEXPENSIVE: "€",
    PRICE_LEVEL_MODERATE: "€€",
    PRICE_LEVEL_EXPENSIVE: "€€€",
    PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
  };
  return map[level] ?? "";
}

const mapStyle: google.maps.MapTypeStyle[] = [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
