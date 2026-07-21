/// <reference types="google.maps" />
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Star,
  MapPin,
  Search,
  Loader2,
  X,
  Check,
  Globe,
  Phone,
  CalendarClock,
  Clock,
  ChevronDown,
} from "lucide-react";

import {
  searchRestaurants,
  type Cuisine,
  type Restaurant,
} from "@/lib/places.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

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
const TOULOUSE_ZOOM = 13;


type Tab = "all" | "todo" | "done";

type VisitEntry = { done: boolean; comment: string };
type VisitMap = Record<string, VisitEntry>;
const VISITS_KEY = "tastemap.visits.v1";

declare global {
  interface Window {
    google?: typeof google;
    initGMap?: () => void;
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tastemap · Restaurants de France" },
      {
        name: "description",
        content:
          "Explorez les meilleurs restaurants des 20 plus grandes villes de France sur une carte minimaliste. Filtrez, marquez et commentez.",
      },
      { property: "og:title", content: "Tastemap · Restaurants de France" },
      {
        property: "og:description",
        content: "Carte des meilleurs restaurants de France, filtrée à votre goût.",
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

function useVisits() {
  const [visits, setVisits] = useState<VisitMap>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISITS_KEY);
      if (raw) setVisits(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const update = (id: string, patch: Partial<VisitEntry>) => {
    setVisits((prev) => {
      const current = prev[id] ?? { done: false, comment: "" };
      const next = { ...current, ...patch };
      const merged = { ...prev, [id]: next };
      if (!next.done && !next.comment.trim()) delete merged[id];
      try {
        localStorage.setItem(VISITS_KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    });
  };
  return { visits, update };
}

function Index() {
  const [cuisine, setCuisine] = useState<Cuisine>("any");
  const [minRating, setMinRating] = useState(4);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [results, setResults] = useState<Restaurant[]>([]);
  const { visits, update } = useVisits();

  const mapReady = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const search = useServerFn(searchRestaurants);
  const mutation = useMutation({
    mutationFn: (vars: { minRating: number }) => search({ data: vars }),
    onSuccess: (data) => {
      setResults(data);
      setSelected(null);
    },
  });

  const filtered = useMemo(() => {
    let list = results;
    if (cuisine !== "any") {
      list = list.filter((r) => r.cuisines.includes(cuisine));
    }
    if (tab === "done") return list.filter((r) => visits[r.id]?.done);
    if (tab === "todo") return list.filter((r) => !visits[r.id]?.done);
    return list;
  }, [results, cuisine, tab, visits]);

  // Counts scoped to the current cuisine filter (ignoring tab).
  const cuisineScoped = useMemo(
    () =>
      cuisine === "any"
        ? results
        : results.filter((r) => r.cuisines.includes(cuisine)),
    [results, cuisine],
  );
  const doneInScope = cuisineScoped.filter((r) => visits[r.id]?.done).length;
  const todoCount = cuisineScoped.length - doneInScope;

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google!.maps.Map(mapRef.current, {
      center: TOULOUSE_CENTER,
      zoom: TOULOUSE_ZOOM,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      backgroundColor: "#1a1d21",
      gestureHandling: "greedy",
      styles: minimalMapStyle,
    });
  }, [mapReady]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (filtered.length === 0) return;

    filtered.forEach((r) => {
      const active = selected?.id === r.id;
      const done = !!visits[r.id]?.done;
      const color = active ? "#111111" : done ? "#16a34a" : "#e11d48";
      const marker = new window.google!.maps.Marker({
        position: { lat: r.lat, lng: r.lng },
        map: mapInstance.current!,
        title: r.name,
        icon: {
          path: window.google!.maps.SymbolPath.CIRCLE,
          scale: active ? 9 : 6.5,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: active ? 999 : done ? 5 : 1,
      });
      marker.addListener("click", () => setSelected(r));
      markersRef.current.push(marker);
    });
  }, [filtered, selected, visits]);

  useEffect(() => {
    mutation.mutate({ minRating });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minRating]);


  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <h1 className="text-sm font-semibold tracking-tight truncate">
              Tastemap
              <span className="text-muted-foreground font-normal ml-1.5">· France</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
            <span className="tabular-nums">{filtered.length}</span>
            {doneInResults > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-500">
                <Check className="h-3 w-3" strokeWidth={3} />
                <span className="tabular-nums">{doneInResults}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-5 py-5 grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-5">
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-5">
            <div>
              <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
                Ville
              </h2>
              <div className="relative">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value as CityKey)}
                  className="w-full appearance-none text-sm bg-background border border-border/70 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CITY_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

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
                step={0.1}
                onValueChange={(v) => setMinRating(v[0])}
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => mutation.mutate({ cuisine, minRating, city })}
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
            <div className="px-2 pt-2 border-b border-border/60">
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { key: "all", label: "Tous", count: results.length },
                    { key: "todo", label: "À faire", count: todoCount },
                    { key: "done", label: "Faits", count: doneInResults },
                  ] as { key: Tab; label: string; count: number }[]
                ).map((t) => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`text-xs py-2 rounded-md transition flex items-center justify-center gap-1.5 ${
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                      <span className="tabular-nums text-[10px] opacity-70">
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto divide-y divide-border/50">
              {mutation.isPending && results.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Chargement…
                </div>
              )}
              {!mutation.isPending && filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {tab === "done"
                    ? "Aucun restaurant marqué comme fait."
                    : tab === "todo"
                      ? "Vous avez tout fait ! 🎉"
                      : "Aucun restaurant trouvé."}
                </div>
              )}
              {filtered.map((r) => {
                const done = !!visits[r.id]?.done;
                return (
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
                    <div className="relative flex-shrink-0">
                      {r.photoUrls[0] ? (
                        <img
                          src={r.photoUrls[0]}
                          alt={r.name}
                          className="h-14 w-14 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-muted grid place-items-center">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      {done && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-white grid place-items-center ring-2 ring-card">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </div>
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
                        {r.openNow === true && (
                          <span className="text-emerald-600">Ouvert</span>
                        )}
                        {r.openNow === false && (
                          <span className="text-muted-foreground">Fermé</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="relative min-w-0">
          <div
            ref={mapRef}
            className="w-full h-[65vh] lg:h-[calc(100vh-7rem)] rounded-xl border border-border/60 overflow-hidden touch-pan-y touch-pan-x"
            style={{ backgroundColor: "#1a1d21" }}
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
            <DetailCard
              key={selected.id}
              restaurant={selected}
              visit={visits[selected.id] ?? { done: false, comment: "" }}
              onUpdate={(patch) => update(selected.id, patch)}
              onClose={() => setSelected(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function DetailCard({
  restaurant: r,
  visit,
  onUpdate,
  onClose,
}: {
  restaurant: Restaurant;
  visit: VisitEntry;
  onUpdate: (patch: Partial<VisitEntry>) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState(visit.comment);
  const [showHours, setShowHours] = useState(false);
  useEffect(() => setComment(visit.comment), [visit.comment, r.id]);

  return (
    <div className="absolute left-3 right-3 bottom-3 lg:left-4 lg:right-auto lg:bottom-4 lg:w-[340px] rounded-xl bg-card border border-border/70 shadow-xl overflow-hidden max-h-[65vh] flex flex-col">
      {r.photoUrls.length > 0 && (
        <div
          className="flex overflow-x-auto snap-x snap-mandatory flex-shrink-0"
          style={{ overscrollBehaviorX: "contain", touchAction: "pan-x" }}
        >
          {r.photoUrls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`${r.name} — plat ${i + 1}`}
              className="h-28 w-full flex-shrink-0 object-cover snap-start"
            />
          ))}
        </div>
      )}
      <div className="p-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold tracking-tight truncate text-sm">{r.name}</h3>
            <p className="text-xs text-muted-foreground">
              {r.primaryType ?? "Restaurant"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 -m-1"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {r.rating != null && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
              <span className="font-medium">{r.rating.toFixed(1)}</span>
              {r.userRatingCount != null && (
                <span className="text-muted-foreground">
                  ({r.userRatingCount})
                </span>
              )}
            </span>
          )}
          {r.priceLevel && (
            <span className="text-muted-foreground">
              {priceLabel(r.priceLevel)}
            </span>
          )}
          {r.openNow === true && (
            <span className="text-emerald-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Ouvert
            </span>
          )}
          {r.openNow === false && (
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Fermé
            </span>
          )}
        </div>

        {r.summary && (
          <p className="mt-2 text-xs text-foreground/80 leading-relaxed line-clamp-3">
            {r.summary}
          </p>
        )}

        <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1.5">
          <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{r.address}</span>
        </p>

        {r.weekdayDescriptions.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowHours((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground"
            >
              <Clock className="h-3.5 w-3.5" />
              Horaires d'ouverture
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showHours ? "rotate-180" : ""}`}
              />
            </button>
            {showHours && (
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                {r.weekdayDescriptions.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.websiteUri && (
            <a
              href={r.websiteUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-border/70 hover:bg-muted transition"
            >
              <Globe className="h-3 w-3" /> Site
            </a>
          )}
          {r.reservable && r.websiteUri && (
            <a
              href={r.websiteUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-foreground text-background hover:opacity-90 transition"
            >
              <CalendarClock className="h-3 w-3" /> Réserver
            </a>
          )}
          {r.phone && (
            <a
              href={`tel:${r.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-border/70 hover:bg-muted transition"
            >
              <Phone className="h-3 w-3" /> {r.phone}
            </a>
          )}
          {r.googleMapsUri && (
            <a
              href={r.googleMapsUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-border/70 hover:bg-muted transition"
            >
              <MapPin className="h-3 w-3" /> Maps
            </a>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Mon carnet
            </h4>
            <button
              onClick={() => onUpdate({ done: !visit.done })}
              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition ${
                visit.done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-border/70 hover:bg-muted"
              }`}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
              {visit.done ? "Fait" : "Marquer fait"}
            </button>
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onUpdate({ comment })}
            placeholder="Un petit commentaire ?"
            rows={2}
            className="mt-2 resize-none text-xs"
          />
        </div>
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

// Dark, minimalist map style — muted land, subtle parks/water, hidden POIs.
const minimalMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1d21" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b8f96" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1d21" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1f2a24" }, { visibility: "on" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2e34" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2f333a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3020" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1a1d21" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1c26" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
];
