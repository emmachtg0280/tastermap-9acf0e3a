/// <reference types="google.maps" />
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Star, MapPin, Search, Loader2, X } from "lucide-react";

import { searchRestaurants, type Cuisine, type Restaurant } from "@/lib/places.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

const CUISINES: { value: Cuisine; label: string }[] = [
  { value: "any", label: "Tous" },
  { value: "french", label: "Français" },
  { value: "italian", label: "Italien" },
  { value: "chinese", label: "Chinois" },
  { value: "japanese", label: "Japonais" },
  { value: "indian", label: "Indien" },
  { value: "mexican", label: "Mexicain" },
  { value: "thai", label: "Thaï" },
  { value: "spanish", label: "Espagnol" },
  { value: "greek", label: "Grec" },
  { value: "american", label: "Américain" },
  { value: "vegetarian", label: "Végétarien" },
];

const TOULOUSE_CENTER = { lat: 43.6047, lng: 1.4442 };

declare global {
  interface Window {
    google?: typeof google;
    initGMap?: () => void;
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tastemap · Restaurants de Toulouse" },
      {
        name: "description",
        content:
          "Découvrez les restaurants de Toulouse sur une carte minimaliste. Filtrez par cuisine et par note, parcourez les photos des plats.",
      },
      { property: "og:title", content: "Tastemap · Restaurants de Toulouse" },
      {
        property: "og:description",
        content: "Carte des restaurants de Toulouse, filtrée à votre goût.",
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

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google!.maps.Map(mapRef.current, {
      center: TOULOUSE_CENTER,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      backgroundColor: "#f7f5f0",
      styles: minimalMapStyle,
    });
  }, [mapReady]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (results.length === 0) return;

    results.forEach((r) => {
      const active = selected?.id === r.id;
      const marker = new window.google!.maps.Marker({
        position: { lat: r.lat, lng: r.lng },
        map: mapInstance.current!,
        title: r.name,
        icon: {
          path: window.google!.maps.SymbolPath.CIRCLE,
          scale: active ? 9 : 6,
          fillColor: active ? "#111111" : "#c2410c",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: active ? 999 : 1,
      });
      marker.addListener("click", () => setSelected(r));
      markersRef.current.push(marker);
    });
  }, [results, selected]);

  useEffect(() => {
    mutation.mutate({ cuisine, minRating });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuisine, minRating]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-foreground" />
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">Tastemap</h1>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Toulouse
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {results.length} adresses
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-5 py-5 grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-5">
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3">
                Cuisine
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {CUISINES.map((c) => {
                  const active = c.value === cuisine;
                  return (
                    <button
                      key={c.value}
                      onClick={() => setCuisine(c.value)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        active
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background hover:bg-muted border-border/70 text-foreground"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Note minimum
                </h2>
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
              variant="outline"
              className="w-full"
              onClick={() => mutation.mutate({ cuisine, minRating })}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recherche…
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" /> Actualiser
                </>
              )}
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card">
            <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Résultats
              </h2>
              <Badge variant="secondary" className="rounded-full">
                {results.length}
              </Badge>
            </div>
            <div className="max-h-[520px] overflow-auto divide-y divide-border/50">
              {mutation.isPending && results.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Chargement…
                </div>
              )}
              {!mutation.isPending && results.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Aucun restaurant trouvé.
                </div>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelected(r);
                    mapInstance.current?.panTo({ lat: r.lat, lng: r.lng });
                    mapInstance.current?.setZoom(15);
                  }}
                  className={`w-full text-left px-5 py-3 flex gap-3 hover:bg-muted/60 transition ${
                    selected?.id === r.id ? "bg-muted/70" : ""
                  }`}
                >
                  {r.photoUrls[0] ? (
                    <img
                      src={r.photoUrls[0]}
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

        <main className="relative">
          <div
            ref={mapRef}
            className="w-full h-[65vh] lg:h-[calc(100vh-7rem)] rounded-xl border border-border/60 overflow-hidden"
            style={{ backgroundColor: "#f7f5f0" }}
          />
          {!mapReady && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="rounded-full bg-card/90 border border-border/60 px-4 py-2 text-sm text-muted-foreground shadow-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement de la carte…
              </div>
            </div>
          )}

          {selected && (
            <div className="absolute left-4 right-4 bottom-4 lg:left-6 lg:right-auto lg:bottom-6 lg:w-[420px] rounded-xl bg-card border border-border/70 shadow-xl overflow-hidden">
              {selected.photoUrls.length > 0 && (
                <div className="flex overflow-x-auto snap-x snap-mandatory">
                  {selected.photoUrls.map((url, i) => (
                    <img
                      key={url}
                      src={url}
                      alt={`${selected.name} — plat ${i + 1}`}
                      className="h-44 w-full flex-shrink-0 object-cover snap-start"
                    />
                  ))}
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold tracking-tight">{selected.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selected.primaryType ?? "Restaurant"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground p-1 -m-1"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
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
                  {selected.photoUrls.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {selected.photoUrls.length} photos
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
                    className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
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

// Minimalist monochrome map style — warm off-white land, muted roads, no POIs.
const minimalMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f7f5f0" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8578" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f7f5f0" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#eeeae0" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e8e3d6" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e2dcc9" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f7f5f0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d9e2e6" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
];
