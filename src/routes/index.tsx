/// <reference types="google.maps" />
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Navigation,
  DollarSign,
  Utensils,
  SlidersHorizontal,
  Heart,
  LogIn,
  LogOut,
  User,
} from "lucide-react";

import {
  searchRestaurants,
  CITIES,
  type Cuisine,
  type Restaurant,
  type CityKey,
} from "@/lib/places.functions";
import {
  getMyVisits,
  upsertVisit,
  type Visit,
} from "@/lib/visits.functions";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const CUISINES: { value: Cuisine; label: string; emoji: string }[] = [
  { value: "any", label: "Tous", emoji: "🍽️" },
  { value: "french", label: "Français", emoji: "🥖" },
  { value: "italian", label: "Italien", emoji: "🍕" },
  { value: "chinese", label: "Chinois", emoji: "🥟" },
  { value: "japanese", label: "Japonais", emoji: "🍣" },
  { value: "indian", label: "Indien", emoji: "🍛" },
  { value: "mexican", label: "Mexicain", emoji: "🌮" },
  { value: "thai", label: "Thaï", emoji: "🍜" },
  { value: "spanish", label: "Espagnol", emoji: "🥘" },
  { value: "greek", label: "Grec", emoji: "🥙" },
  { value: "american", label: "Américain", emoji: "🍔" },
  { value: "vegetarian", label: "Végétarien", emoji: "🥗" },
];

function cuisineEmoji(cs: Cuisine[]): string {
  const priority: Cuisine[] = ["italian","japanese","french","chinese","indian","mexican","thai","spanish","greek","american","vegetarian"];
  for (const p of priority) if (cs.includes(p)) return CUISINES.find(c => c.value === p)!.emoji;
  return "🍽️";
}

const DEFAULT_CENTER = { lat: 43.6047, lng: 1.4442 }; // Toulouse
const DEFAULT_ZOOM = 13;
const CITY_ZOOM = 13;


type Tab = "all" | "todo" | "done" | "favorites";

type VisitEntry = { done: boolean; comment: string; favorite: boolean; personalRating?: number };
type VisitMap = Record<string, VisitEntry>;
const VISITS_KEY = "tastemap.visits.v2";

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
          "Explorez les meilleurs restaurants des grandes villes de France sur une carte minimaliste. Filtrez, marquez, commentez et synchronisez.",
      },
      { property: "og:title", content: "Tastemap · Restaurants de France" },
      {
        property: "og:description",
        content: "Explorez les meilleurs restaurants des grandes villes de France sur une carte minimaliste. Filtrez, marquez, commentez et synchronisez.",
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

function useAuthSession() {
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

function useVisits(userId: string | null) {
  const [localVisits, setLocalVisits] = useState<VisitMap>({});
  const queryClient = useQueryClient();
  const serverGetVisits = useServerFn(getMyVisits);
  const serverUpsert = useServerFn(upsertVisit);

  // Load localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISITS_KEY);
      if (raw) setLocalVisits(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Cloud visits
  const cloudQuery = useQuery({
    queryKey: ["my-visits"],
    queryFn: () => serverGetVisits(),
    enabled: !!userId,
    staleTime: 0,
  });

  const cloudMap = useMemo<VisitMap>(() => {
    const map: VisitMap = {};
    (cloudQuery.data ?? []).forEach((v) => {
      map[v.place_id] = {
        done: v.done,
        favorite: v.favorite,
        comment: v.comment ?? "",
        personalRating: v.personal_rating ?? undefined,
      };
    });
    return map;
  }, [cloudQuery.data]);

  const visits = userId ? cloudMap : localVisits;

  const update = async (id: string, patch: Partial<VisitEntry>) => {
    if (userId) {
      const current = visits[id] ?? { done: false, comment: "", favorite: false };
      const next = { ...current, ...patch };
      await serverUpsert({
        data: {
          place_id: id,
          done: next.done,
          favorite: next.favorite,
          comment: next.comment.trim() || null,
          personal_rating: next.personalRating ?? null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["my-visits"] });
    } else {
      setLocalVisits((prev) => {
        const current = prev[id] ?? { done: false, comment: "", favorite: false };
        const next = { ...current, ...patch };
        const merged = { ...prev, [id]: next };
        if (!next.done && !next.favorite && !next.comment.trim() && !next.personalRating) {
          delete merged[id];
        }
        try {
          localStorage.setItem(VISITS_KEY, JSON.stringify(merged));
        } catch {
          /* ignore */
        }
        return merged;
      });
    }
  };

  return { visits, update, isLoading: cloudQuery.isLoading };
}

type SortBy = "score" | "rating" | "reviews" | "price" | "distance";

function AuthButton() {
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

function useGeolocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, []);
  return location;
}

function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function priceValue(level: string) {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[level] ?? 9;
}

function sortRestaurants(
  a: Restaurant,
  b: Restaurant,
  sortBy: SortBy,
  userLocation: { lat: number; lng: number } | null,
  city: { lat: number; lng: number } | null,
) {
  const origin = userLocation ?? city;
  const score = (r: Restaurant) =>
    (r.rating ?? 0) * Math.log10((r.userRatingCount ?? 1) + 1);
  switch (sortBy) {
    case "rating":
      return (b.rating ?? 0) - (a.rating ?? 0);
    case "reviews":
      return (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0);
    case "price":
      return priceValue(a.priceLevel ?? "") - priceValue(b.priceLevel ?? "");
    case "distance":
      if (!origin) return 0;
      return (
        haversineDistance(origin, a) - haversineDistance(origin, b)
      );
    case "score":
    default:
      return score(b) - score(a);
  }
}

function Index() {
  const [city, setCity] = useState<CityKey | null>("toulouse");

  const [cuisine, setCuisine] = useState<Cuisine>("any");
  const [minRating, setMinRating] = useState(4);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [results, setResults] = useState<Restaurant[]>([]);
  const [searchText, setSearchText] = useState("");
  const [onlyOpenNow, setOnlyOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [showFilters, setShowFilters] = useState(false);
  const [showList, setShowList] = useState(false);
  const { user } = useAuthSession();
  const { visits, update } = useVisits(user?.id ?? null);
  const userLocation = useGeolocation();

  const mapReady = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const currentCity = useMemo(
    () => CITIES.find((c) => c.key === city) ?? null,
    [city],
  );

  const search = useServerFn(searchRestaurants);
  const mutation = useMutation({
    mutationFn: (vars: { city: CityKey; minRating: number; force?: boolean }) =>
      search({ data: vars }),
    onSuccess: (data) => {
      setResults(data);
    },
  });

  const baseFiltered = useMemo(() => {
    let list = results;
    if (cuisine !== "any") {
      list = list.filter((r) => r.cuisines.includes(cuisine));
    }
    const q = searchText.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q) ||
          (r.primaryType ?? "").toLowerCase().includes(q),
      );
    }
    if (onlyOpenNow) {
      list = list.filter((r) => r.openNow === true);
    }
    return list;
  }, [results, cuisine, searchText, onlyOpenNow]);

  const cuisineScoped = baseFiltered;
  const doneInScope = useMemo(
    () => cuisineScoped.filter((r) => visits[r.id]?.done).length,
    [cuisineScoped, visits],
  );
  const todoCount = cuisineScoped.length - doneInScope;
  const favoritesInScope = useMemo(
    () => cuisineScoped.filter((r) => visits[r.id]?.favorite).length,
    [cuisineScoped, visits],
  );

  const filtered = useMemo(() => {
    let list = baseFiltered;
    if (tab === "done") list = list.filter((r) => visits[r.id]?.done);
    if (tab === "todo") list = list.filter((r) => !visits[r.id]?.done);
    if (tab === "favorites") list = list.filter((r) => visits[r.id]?.favorite);
    return [...list].sort((a, b) => sortRestaurants(a, b, sortBy, userLocation, currentCity));
  }, [baseFiltered, tab, visits, sortBy, userLocation, currentCity]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google!.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      disableDefaultUI: true,
      zoomControl: false,
      clickableIcons: false,
      backgroundColor: "#FFF9F0",
      gestureHandling: "greedy",
      styles: minimalMapStyle,
    });
  }, [mapReady]);

  // Recenter map when city changes
  useEffect(() => {
    if (!mapInstance.current || !currentCity) return;
    mapInstance.current.panTo({ lat: currentCity.lat, lng: currentCity.lng });
    mapInstance.current.setZoom(CITY_ZOOM);
  }, [currentCity]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (filtered.length === 0) return;

    filtered.forEach((r) => {
      const active = selected?.id === r.id;
      const done = !!visits[r.id]?.done;
      const favorite = !!visits[r.id]?.favorite;
      const borderColor = done ? "#58CC02" : favorite ? "#FFC800" : active ? "#1CB0F6" : "#2b2b2b";
      const emoji = cuisineEmoji(r.cuisines);
      const size = active ? 46 : 38;
      const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size + 6}' viewBox='0 0 ${size} ${size + 6}'>
  <ellipse cx='${size / 2}' cy='${size + 2}' rx='${size / 3}' ry='2.5' fill='rgba(0,0,0,0.18)'/>
  <circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 3}' fill='#ffffff' stroke='${borderColor}' stroke-width='3'/>
  <text x='${size / 2}' y='${size / 2}' text-anchor='middle' dominant-baseline='central' font-size='${size * 0.5}' font-family='Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif'>${emoji}</text>
  ${done ? `<circle cx='${size - 8}' cy='9' r='7' fill='#58CC02' stroke='#ffffff' stroke-width='2'/><path d='M${size - 11} 9 l2.5 2.5 L${size - 5} 6.5' stroke='#ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' fill='none'/>` : ""}
</svg>`.trim();
      const marker = new window.google!.maps.Marker({
        position: { lat: r.lat, lng: r.lng },
        map: mapInstance.current!,
        title: r.name,
        icon: {
          url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          scaledSize: new window.google!.maps.Size(size, size + 6),
          anchor: new window.google!.maps.Point(size / 2, size / 2),
        },
        zIndex: active ? 999 : done ? 5 : favorite ? 3 : 1,
        optimized: true,
      });
      marker.addListener("click", () => setSelected(r));
      markersRef.current.push(marker);
    });
  }, [filtered, selected, visits]);

  // Fetch whenever city or minRating change — only if a city is selected
  useEffect(() => {
    if (!city) {
      setResults([]);
      setSelected(null);
      return;
    }
    mutation.mutate({ city, minRating });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, minRating]);


  return (
    <div className="h-screen w-screen relative overflow-hidden bg-background">
      {/* Full-screen map background */}
      <div
        ref={mapRef}
        className="absolute inset-0 touch-pan-y touch-pan-x"
        style={{ backgroundColor: "#FFF9F0" }}
      />
      {!mapReady && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none z-10">
          <div className="rounded-full bg-card/90 border border-border/60 px-4 py-2 text-sm text-muted-foreground shadow-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de la carte…
          </div>
        </div>
      )}

      {/* Floating top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto px-3 pt-3 flex items-center justify-between gap-2 max-w-3xl">
          <div className="flex items-center gap-2 rounded-full bg-card/95 backdrop-blur border border-border/70 shadow-sm pl-3 pr-2 py-1.5 min-w-0">
            <span className="text-base leading-none">🍽️</span>
            <h1 className="font-display text-sm font-extrabold tracking-tight truncate">
              Tastemap
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] text-foreground/80 font-semibold tabular-nums">
              {filtered.length}
            </span>
            {doneInScope > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[color:var(--duo-green)]/15 text-[color:var(--duo-green-dark)] text-[11px] font-semibold">
                <Check className="h-3 w-3" strokeWidth={3} />
                <span className="tabular-nums">{doneInScope}</span>
              </span>
            )}
          </div>
          <div className="rounded-full bg-card/95 backdrop-blur border border-border/70 shadow-sm">
            <AuthButton />
          </div>
        </div>

        {/* Small pill tabs */}
        <div className="mx-auto px-3 mt-2 flex justify-center">
          <div className="inline-flex rounded-full bg-card/95 backdrop-blur border border-border/70 shadow-sm p-0.5 gap-0.5">
            {(
              [
                { key: "all", label: "Tous", count: cuisineScoped.length },
                { key: "todo", label: "À faire", count: todoCount },
                { key: "done", label: "Faits", count: doneInScope },
                { key: "favorites", label: "Favoris", count: favoritesInScope },
              ] as { key: Tab; label: string; count: number }[]
            ).map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition flex items-center gap-1 whitespace-nowrap ${
                    active
                      ? "bg-[color:var(--duo-green)] text-white font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <span className={`tabular-nums text-[10px] ${active ? "opacity-90" : "opacity-60"}`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuisine strip */}
        <div className="mx-auto px-2 mt-2 max-w-3xl">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-1 pb-1 -mx-1">
            {CUISINES.filter((c) => c.value !== "any").map((c) => {
              const active = c.value === cuisine;
              return (
                <button
                  key={c.value}
                  onClick={() => setCuisine(active ? "any" : c.value)}
                  className={`shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border backdrop-blur shadow-sm transition ${
                    active
                      ? "bg-[color:var(--duo-green)] border-[color:var(--duo-green)] text-white font-semibold"
                      : "bg-card/95 border-border/70 text-foreground/80 hover:bg-muted"
                  }`}
                >
                  <span className="text-sm leading-none">{c.emoji}</span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>


      {/* Floating action buttons — bottom right */}
      <div className="absolute right-3 bottom-3 z-30 flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={() => { setShowList(false); setShowFilters(true); }}
          aria-label="Filtres"
          className="h-12 w-12 rounded-full bg-[color:var(--duo-green)] text-white btn-pop grid place-items-center hover:brightness-105 transition"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
        <button
          onClick={() => { setShowFilters(false); setShowList(true); }}
          aria-label="Liste"
          className="h-12 w-12 rounded-full bg-card border border-border/70 shadow-md text-foreground grid place-items-center hover:bg-muted transition"
        >
          <Utensils className="h-5 w-5" />
        </button>
      </div>

      {/* Filters overlay (backdrop + sheet) */}
      {showFilters && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowFilters(false)}
          />
          <div className="absolute z-40 left-2 right-2 bottom-2 sm:left-auto sm:right-4 sm:bottom-4 sm:top-4 sm:w-[360px] rounded-2xl bg-card border border-border/70 shadow-2xl overflow-hidden flex flex-col animate-pop-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <h2 className="font-display font-bold text-sm">Filtres</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1 -m-1 text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-5 overflow-y-auto">
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Rechercher
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Nom, adresse, type…"
                    className="pl-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Ville
                </h3>
                <select
                  value={city ?? ""}
                  onChange={(e) =>
                    setCity((e.target.value || null) as CityKey | null)
                  }
                  className="w-full text-sm px-3 py-2 rounded-md border border-border/60 bg-background/60 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                >
                  <option value="">Sélectionnez une ville…</option>
                  {CITIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>


              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Note minimum
                  </h3>
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

              <div className="flex items-center gap-2">
                <Checkbox
                  id="open"
                  checked={onlyOpenNow}
                  onCheckedChange={(v) => setOnlyOpenNow(v === true)}
                />
                <label htmlFor="open" className="text-xs text-foreground/80">
                  Ouvert maintenant
                </label>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                  Trier par
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full text-xs px-2 py-2 rounded-md border border-border/60 bg-background/60 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                >
                  <option value="score">Pertinence</option>
                  <option value="rating">Note</option>
                  <option value="reviews">Avis</option>
                  <option value="distance">Distance</option>
                </select>
              </div>
            </div>
            <div className="p-3 border-t border-border/60 flex gap-2">
              <button
                onClick={() =>
                  city && mutation.mutate({ city, minRating, force: true })
                }
                disabled={mutation.isPending || !city}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-card border border-border/70 hover:bg-muted transition disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Recherche…</>
                ) : (
                  <><Search className="h-4 w-4" /> Actualiser</>
                )}
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-[color:var(--duo-green)] text-white btn-pop hover:brightness-105 transition"
              >
                Voir la carte
              </button>
            </div>
          </div>
        </>
      )}

      {/* List overlay */}
      {showList && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowList(false)}
          />
          <div className="absolute z-40 left-2 right-2 bottom-2 top-20 sm:left-4 sm:right-auto sm:top-4 sm:bottom-4 sm:w-[360px] rounded-2xl bg-card border border-border/70 shadow-2xl overflow-hidden flex flex-col animate-pop-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <h2 className="font-display font-bold text-sm">
                Restaurants <span className="text-muted-foreground font-semibold">· {filtered.length}</span>
              </h2>
              <button
                onClick={() => setShowList(false)}
                className="p-1 -m-1 text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-border/50">
              {mutation.isPending && results.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Chargement…
                </div>
              )}
              {!mutation.isPending && filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {!city
                    ? "Sélectionnez une ville pour lancer la recherche."
                    : tab === "done"
                      ? "Aucun restaurant marqué comme fait."
                      : tab === "todo"
                        ? "Vous avez tout fait ! 🎉"
                        : tab === "favorites"
                          ? "Aucun favori pour le moment."
                          : "Aucun restaurant trouvé."}
                </div>
              )}
              {filtered.map((r) => {
                const done = !!visits[r.id]?.done;
                const favorite = !!visits[r.id]?.favorite;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelected(r);
                      mapInstance.current?.panTo({ lat: r.lat, lng: r.lng });
                      mapInstance.current?.setZoom(15);
                      setShowList(false);
                    }}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/60 transition ${
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
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[color:var(--duo-green)] text-white grid place-items-center ring-2 ring-card animate-pop-in">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          update(r.id, { favorite: !favorite });
                        }}
                        className="p-1.5 rounded-full hover:bg-muted transition flex-shrink-0"
                        aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <Heart
                          className={`h-4 w-4 transition ${
                            favorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Detail card */}
      {selected && (
        <DetailCard
          key={selected.id}
          restaurant={selected}
          visit={visits[selected.id] ?? { done: false, comment: "" }}
          onUpdate={(patch) => update(selected.id, patch)}
          onClose={() => setSelected(null)}
        />
      )}
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
    <div className="absolute left-2 right-2 bottom-2 lg:left-4 lg:right-auto lg:bottom-4 lg:w-[360px] rounded-xl bg-card border border-border/70 shadow-xl overflow-hidden max-h-[55vh] lg:max-h-[70vh] flex flex-col">
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
              loading="lazy"
              className="h-36 lg:h-48 w-full flex-shrink-0 object-cover snap-start"
            />
          ))}
        </div>
      )}
      <div className="p-3 overflow-y-auto">
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
              className="flex items-center gap-1 text-[11px] text-foreground/80 hover:text-foreground"
            >
              <Clock className="h-3 w-3" />
              Horaires
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showHours ? "rotate-180" : ""}`}
              />
            </button>
            {showHours && (
              <ul className="mt-1 space-y-0 text-[10px] text-muted-foreground leading-tight">
                {r.weekdayDescriptions.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[color:var(--duo-green)] text-white font-semibold btn-pop hover:brightness-105 transition"
          >
            <Navigation className="h-3 w-3" /> Itinéraire
          </a>
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdate({ favorite: !visit.favorite })}
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-semibold btn-pop transition ${
                  visit.favorite
                    ? "bg-[color:var(--duo-coral)] border-[color:var(--duo-coral)] text-white"
                    : "border-border/70 hover:bg-muted"
                }`}
              >
                <Heart className={`h-3 w-3 ${visit.favorite ? "fill-white" : ""}`} />
                {visit.favorite ? "Favori" : "Favori"}
              </button>
              <button
                onClick={() => onUpdate({ done: !visit.done })}
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-semibold btn-pop transition ${
                  visit.done
                    ? "bg-[color:var(--duo-green)] border-[color:var(--duo-green)] text-white"
                    : "border-border/70 hover:bg-muted"
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
                {visit.done ? "Fait" : "Marquer fait"}
              </button>
            </div>
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

// Playful "board game" light map — cream land, pastel water & parks, soft roads.
const minimalMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#FFF9F0" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a6a55" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FFF9F0" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#8a7a63" }, { visibility: "on" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#4a3f30" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#CDECC3" }, { visibility: "on" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e8dfcc" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#8a7a63" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FFE0A6" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e8c47a" }] },
  { featureType: "road.highway", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#6a5236" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#FFF9F0" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#F7EFDD" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#B8E3F5" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
];
