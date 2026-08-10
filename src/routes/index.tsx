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
  Phone,
  CalendarClock,
  Clock,
  ChevronDown,
  Navigation,
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
import { getHypeStats, type HypeStats } from "@/lib/hype.functions";
import { haptic } from "@/lib/haptic";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

import {
  CUISINE_META,
  CuisineIcon,
  SparkleIcon,
  FlameIcon,
  cuisineInnerSvg,
  pickCuisine,
  useCuisineDataUrls,
} from "@/components/icons/CuisineIcons";
import { ChefBuddy } from "@/components/mascot/ChefBuddy";


import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import newTabAsset from "@/assets/tabs/new.png.asset.json";
import hypeTabAsset from "@/assets/tabs/hype.png.asset.json";

const NewStickerIcon = ({ size = 20 }: { size?: number }) => (
  <img src={newTabAsset.url} alt="" width={size} height={size} loading="lazy" draggable={false}
    className="object-contain select-none pointer-events-none"
    style={{ width: size, height: size, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }} />
);
const HypeStickerIcon = ({ size = 20 }: { size?: number }) => (
  <img src={hypeTabAsset.url} alt="" width={size} height={size} loading="lazy" draggable={false}
    className="object-contain select-none pointer-events-none"
    style={{ width: size, height: size, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }} />
);

const CUISINE_ORDER: Cuisine[] = [
  "french", "italian", "chinese", "japanese", "indian",
  "mexican", "thai", "spanish", "greek", "american", "vegetarian",
];


// Google Places API does not expose an opening date. We use a low review count
// as a proxy for "opened in the last rolling year".
function isNewRestaurant(r: Restaurant): boolean {
  const count = r.userRatingCount ?? 0;
  return count > 0 && count < 80;
}

const DEFAULT_CENTER = { lat: 43.6047, lng: 1.4442 }; // Toulouse
const DEFAULT_ZOOM = 13;
const CITY_ZOOM = 13;
// Below this zoom level, restaurant markers are clustered to keep the map readable.
const CLUSTER_ZOOM = 12.5;

// Elegant, minimal personal location indicator with a very subtle pulse.
const USER_DOT_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
  <circle cx='24' cy='24' r='8' fill='none' stroke='#3B82F6' stroke-width='2' stroke-opacity='0.4'>
    <animate attributeName='r' values='8;19' dur='3s' repeatCount='indefinite'/>
    <animate attributeName='stroke-opacity' values='0.4;0' dur='3s' repeatCount='indefinite'/>
  </circle>
  <circle cx='24' cy='24' r='9' fill='#3B82F6' fill-opacity='0.16'/>
  <circle cx='24' cy='24' r='6' fill='#3B82F6' stroke='#ffffff' stroke-width='2.5'/>
</svg>`;

/** Cluster bubble: ring fills green in proportion to discovered restaurants. */
function clusterSvg(size: number, count: number, discoveredRatio: number) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, discoveredRatio)) * c;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${size * 2}' height='${size * 2}' viewBox='0 0 ${size} ${size}'>
  <circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='#ffffff' fill-opacity='0.94'/>
  <circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='none' stroke='#e3d8c4' stroke-width='2.5'/>
  <circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='none' stroke='#58CC02' stroke-width='2.5' stroke-linecap='round'
    stroke-dasharray='${filled} ${c}' transform='rotate(-90 ${size / 2} ${size / 2})'/>
  <text x='${size / 2}' y='${size / 2 + 4}' text-anchor='middle' font-family='Nunito, system-ui, sans-serif' font-size='${size * 0.34}' font-weight='800' fill='#4a3f30'>${count}</text>
</svg>`;
}




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
  const [selected, setSelected] = useState<Restaurant | null>(null);

  const [results, setResults] = useState<Restaurant[]>([]);
  const [searchText, setSearchText] = useState("");
  const [onlyOpenNow, setOnlyOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [showFilters, setShowFilters] = useState(false);
  const [listMode, setListMode] = useState<null | "all" | "done" | "favorites" | "new" | "hype" | "profile">(null);
  const { user } = useAuthSession();
  const { visits, update } = useVisits(user?.id ?? null);
  const userLocation = useGeolocation();

  const mapReady = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const cuisineDataUrls = useCuisineDataUrls();

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

  const serverHype = useServerFn(getHypeStats);
  const hypeQuery = useQuery({
    queryKey: ["hype-stats"],
    queryFn: () => serverHype(),
    staleTime: 60 * 1000,
  });
  const hypeStats: HypeStats = hypeQuery.data ?? {};


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

  const doneInScope = useMemo(
    () => baseFiltered.filter((r) => visits[r.id]?.done).length,
    [baseFiltered, visits],
  );

  const filtered = useMemo(() => {
    return [...baseFiltered].sort((a, b) => sortRestaurants(a, b, sortBy, userLocation, currentCity));
  }, [baseFiltered, sortBy, userLocation, currentCity]);


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
      isFractionalZoomEnabled: true,
      mapTypeId: "roadmap",
      maxZoom: 18,
      minZoom: 4,
      styles: minimalMapStyle,
    });
    mapInstance.current.addListener("click", () => setSelected(null));
    mapInstance.current.addListener("idle", () => {
      const z = mapInstance.current?.getZoom();
      if (typeof z === "number") setZoomLevel((prev) => (Math.round(z) === Math.round(prev) ? prev : z));
    });
  }, [mapReady]);


  // Recenter map when city changes
  useEffect(() => {
    if (!mapInstance.current || !currentCity) return;
    mapInstance.current.panTo({ lat: currentCity.lat, lng: currentCity.lng });
    mapInstance.current.setZoom(CITY_ZOOM);
  }, [currentCity]);

  // Subtle personal location indicator
  useEffect(() => {
    if (!mapInstance.current || !window.google || !userLocation) return;
    if (!userMarkerRef.current) {
      userMarkerRef.current = new window.google.maps.Marker({
        map: mapInstance.current,
        zIndex: 500,
        clickable: false,
        optimized: false,
        icon: {
          url: `data:image/svg+xml;utf8,${encodeURIComponent(USER_DOT_SVG)}`,
          scaledSize: new window.google.maps.Size(48, 48),
          anchor: new window.google.maps.Point(24, 24),
        },
      });
    }
    userMarkerRef.current.setPosition(userLocation);
  }, [userLocation, mapReady]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (filtered.length === 0) return;

    const g = window.google!;

    // --- Clustering when zoomed out: keeps the map readable ---
    if (zoomLevel < CLUSTER_ZOOM) {
      const cell = 360 / Math.pow(2, Math.max(4, Math.round(zoomLevel)) + 3);
      const groups = new Map<string, Restaurant[]>();
      filtered.forEach((r) => {
        const key = `${Math.floor(r.lat / cell)}:${Math.floor(r.lng / cell)}`;
        const arr = groups.get(key) ?? [];
        arr.push(r);
        groups.set(key, arr);
      });
      groups.forEach((group) => {
        if (group.length === 1) {
          markersRef.current.push(makeRestaurantMarker(group[0]));
          return;
        }
        const lat = group.reduce((s, r) => s + r.lat, 0) / group.length;
        const lng = group.reduce((s, r) => s + r.lng, 0) / group.length;
        const discovered = group.filter((r) => visits[r.id]?.done).length;
        const size = Math.min(56, 34 + Math.round(Math.log2(group.length + 1) * 7));
        const marker = new g.maps.Marker({
          position: { lat, lng },
          map: mapInstance.current!,
          icon: {
            url: `data:image/svg+xml;utf8,${encodeURIComponent(clusterSvg(size, group.length, discovered / group.length))}`,
            scaledSize: new g.maps.Size(size, size),
            anchor: new g.maps.Point(size / 2, size / 2),
          },
          zIndex: 10,
          optimized: false,
        });
        marker.addListener("click", () => {
          mapInstance.current?.panTo({ lat, lng });
          mapInstance.current?.setZoom(Math.min(17, Math.round(zoomLevel) + 2));
        });
        markersRef.current.push(marker);
      });
      return;
    }

    filtered.forEach((r) => {
      markersRef.current.push(makeRestaurantMarker(r));
    });

    function makeRestaurantMarker(r: Restaurant) {
      const active = selected?.id === r.id;
      const done = !!visits[r.id]?.done;
      const favorite = !!visits[r.id]?.favorite;
      const isNew = isNewRestaurant(r);
      // Visual hierarchy: DISCOVERED > SAVED > UNDISCOVERED
      const state: "done" | "saved" | "new" = done ? "done" : favorite ? "saved" : "new";
      const base = state === "done" ? 40 : state === "saved" ? 37 : 31;
      const size = active ? base + 6 : base;
      const iconOpacity = state === "new" ? 0.62 : 1;
      const bgOpacity = state === "new" ? 0.72 : 1;
      const ring =
        state === "done"
          ? { color: "#58CC02", width: 2.4 }
          : state === "saved"
            ? { color: "#F2789F", width: 2 }
            : { color: "#d9cdb6", width: 1 };
      const cuisineKey = pickCuisine(r.cuisines);
      const dataUrl = cuisineDataUrls?.[cuisineKey];
      const iconSize = size * 0.68;
      const iconOffset = (size - iconSize) / 2;
      const imageTag = dataUrl
        ? `<image href='${dataUrl}' x='${iconOffset}' y='${iconOffset}' width='${iconSize}' height='${iconSize}' opacity='${iconOpacity}' preserveAspectRatio='xMidYMid meet'/>`
        : `<g opacity='${iconOpacity}' transform='translate(${iconOffset} ${iconOffset}) scale(${iconSize / 24})'>${cuisineInnerSvg(r.cuisines)}</g>`;
      const newBadge = isNew && state !== "new"
        ? `<g><circle cx='7' cy='8' r='6' fill='#FFC94A'/><path d='M7 5.3 l0.8 1.6 l1.8 0.25 l-1.3 1.2 l0.35 1.8 l-1.65 -0.85 l-1.65 0.85 l0.35 -1.8 l-1.3 -1.2 l1.8 -0.25 z' fill='#ffffff' stroke-linejoin='round'/></g>`
        : "";
      const scale = 2;
      const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='${size * scale}' height='${(size + 4) * scale}' viewBox='0 0 ${size} ${size + 4}'>
  <circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 2}' fill='#ffffff' fill-opacity='${bgOpacity}' stroke='${ring.color}' stroke-width='${ring.width}'/>
  ${imageTag}
  ${newBadge}
  ${done ? `<circle cx='${size - 7}' cy='8' r='6' fill='#58CC02' stroke='#ffffff' stroke-width='1.5'/><path d='M${size - 9.5} 8 l2 2 L${size - 5} 6' stroke='#ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/>` : ""}
  ${state === "saved" ? `<circle cx='${size - 7}' cy='8' r='6' fill='#ffffff' stroke='#F2789F' stroke-width='1.2'/><path d='M${size - 7} 10.4 c-2.4 -1.6 -3.2 -2.7 -3.2 -3.8 a1.7 1.7 0 0 1 3.2 -0.7 a1.7 1.7 0 0 1 3.2 0.7 c0 1.1 -0.8 2.2 -3.2 3.8 z' fill='#F2789F'/>` : ""}
</svg>`.trim();
      const marker = new g.maps.Marker({
        position: { lat: r.lat, lng: r.lng },
        map: mapInstance.current!,
        title: r.name,
        icon: {
          url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          scaledSize: new g.maps.Size(size, size + 4),
          anchor: new g.maps.Point(size / 2, size / 2),
        },
        zIndex: active ? 999 : done ? 40 : favorite ? 20 : 1,
        optimized: false,
        animation: null,
      });
      marker.addListener("click", () => setSelected(r));
      return marker;
    }
  }, [filtered, selected, visits, cuisineDataUrls, zoomLevel]);

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

      {/* Floating top bar — auth only, top right */}
      <div className="absolute top-0 right-0 z-30 pt-[env(safe-area-inset-top)] px-3">
        <div className="pt-0.5 rounded-full bg-card/80 backdrop-blur border border-white/40 shadow-sm px-2 py-1">
          <AuthButton />
        </div>
      </div>

      {/* Top tabs: Nouveautés / Hype / Cuisines — pushed to very top */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-3xl px-2 pt-0.5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pb-1 -mx-1">
            {/* Discovery tabs */}
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => { haptic(); setShowFilters(false); setListMode("new"); }}
                className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold pl-1.5 pr-3 py-1 rounded-full bg-white/40 backdrop-blur border border-white/50 text-foreground/80 shadow-sm hover:bg-white/60 tap-bounce transition"
              >
                <NewStickerIcon size={20} /> Nouveautés
              </button>
              <button
                onClick={() => { haptic(); setShowFilters(false); setListMode("hype"); }}
                className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold pl-1.5 pr-3 py-1 rounded-full bg-white/40 backdrop-blur border border-white/50 text-foreground/80 shadow-sm hover:bg-white/60 tap-bounce transition"
              >
                <HypeStickerIcon size={20} /> Hype
              </button>
            </div>

            {/* Divider */}
            <div className="w-px bg-foreground/15 self-stretch my-1 shrink-0" />

            {/* Cuisine chips — big appetizing PNG, small label */}
            {CUISINE_ORDER.map((value) => {
              const meta = CUISINE_META[value];
              const active = value === cuisine;
              return (
                <button
                  key={value}
                  onClick={() => { haptic(); setCuisine(active ? "any" : value); }}
                  className={`shrink-0 inline-flex flex-col items-center justify-center gap-0.5 w-[70px] h-[74px] rounded-2xl backdrop-blur shadow-sm tap-bounce transition ${
                    active
                      ? "bg-white text-foreground font-semibold border-2 border-white ring-2 ring-white/80 shadow-md scale-105"
                      : "bg-white/40 border border-white/50 text-foreground/80 hover:bg-white/60"
                  }`}
                >
                  <img
                    src={meta.image}
                    alt={meta.label}
                    width={36}
                    height={36}
                    loading="lazy"
                    draggable={false}
                    className="object-contain select-none pointer-events-none"
                    style={{ width: 36, height: 36 }}
                  />
                  <span className="text-[10px] leading-tight">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>



      {/* Floating action buttons — bottom right */}
      <div
        className={`absolute right-3 z-30 flex flex-col gap-2 pb-[env(safe-area-inset-bottom)] transition-[bottom] duration-300 ease-out ${
          selected ? "bottom-[calc(52vh+16px)] lg:bottom-3" : "bottom-3"
        }`}
      >
        <button
          onClick={() => { haptic(20); setShowFilters(false); setListMode("profile"); }}
          aria-label="Mon profil food"
          className="h-12 w-12 rounded-full bg-white/40 backdrop-blur border border-white/50 shadow-sm text-foreground/80 grid place-items-center hover:bg-white/60 tap-bounce transition"
        >
          <User className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            haptic(20);
            const target = userLocation ?? (currentCity ? { lat: currentCity.lat, lng: currentCity.lng } : null);
            if (!target || !mapInstance.current) return;
            mapInstance.current.panTo(target);
            mapInstance.current.setZoom(userLocation ? 15 : CITY_ZOOM);
          }}
          aria-label="Ma position"
          className="h-12 w-12 rounded-full bg-white/40 backdrop-blur border border-white/50 shadow-sm text-[#3B82F6] grid place-items-center hover:bg-white/60 tap-bounce transition"
        >
          <Navigation className="h-5 w-5" />
        </button>
        <button
          onClick={() => { haptic(20); setListMode(null); setShowFilters(true); }}
          aria-label="Filtres"
          className="h-12 w-12 rounded-full bg-[color:var(--duo-green)] text-white btn-pop grid place-items-center hover:brightness-105 tap-bounce transition"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
        <button
          onClick={() => { haptic(20); setShowFilters(false); setListMode("favorites"); }}
          aria-label="Favoris"
          className="h-12 w-12 rounded-full bg-white/40 backdrop-blur border border-white/50 shadow-sm text-rose-500 grid place-items-center hover:bg-white/60 tap-bounce transition"
        >
          <Heart className="h-5 w-5" />
        </button>
        <button
          onClick={() => { haptic(20); setShowFilters(false); setListMode("done"); }}
          aria-label="Restaurants faits"
          className="h-12 w-12 rounded-full bg-white/40 backdrop-blur border border-white/50 shadow-sm text-[color:var(--duo-green-dark)] grid place-items-center hover:bg-white/60 tap-bounce transition"
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>
        <button
          onClick={() => { haptic(20); setShowFilters(false); setListMode("all"); }}
          aria-label="Liste des restaurants"
          className="h-12 w-12 rounded-full bg-card border border-border/70 shadow-md text-foreground grid place-items-center hover:bg-muted tap-bounce transition"
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
                onClick={() => { haptic(); setShowFilters(false); }}
                className="p-1 -m-1 text-muted-foreground hover:text-foreground tap-bounce"
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
                onClick={() => {
                  haptic(20);
                  if (city) mutation.mutate({ city, minRating, force: true });
                }}
                disabled={mutation.isPending || !city}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-card border border-border/70 hover:bg-muted tap-bounce transition disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Recherche…</>
                ) : (
                  <><Search className="h-4 w-4" /> Actualiser</>
                )}
              </button>
              <button
                onClick={() => { haptic(20); setShowFilters(false); }}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-[color:var(--duo-green)] text-white btn-pop hover:brightness-105 tap-bounce transition"
              >
                Voir la carte
              </button>
            </div>
          </div>
        </>
      )}

      {/* List overlay */}
      {listMode && (() => {
        const listItems =
          listMode === "done"
            ? filtered.filter((r) => visits[r.id]?.done)
            : listMode === "favorites"
              ? filtered.filter((r) => visits[r.id]?.favorite)
                : listMode === "new"
                  ? [...baseFiltered]
                      .filter((r) => isNewRestaurant(r))
                      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                : listMode === "hype"
                  ? [...baseFiltered]
                      .filter((r) => (hypeStats[r.id]?.score ?? 0) > 0)
                      .sort((a, b) => (hypeStats[b.id]?.score ?? 0) - (hypeStats[a.id]?.score ?? 0))
                  : filtered;
        const titleIcon =
          listMode === "new" ? <NewStickerIcon size={20} /> :
          listMode === "hype" ? <HypeStickerIcon size={20} /> : null;
        const listTitle =
          listMode === "done"
            ? "Faits"
            : listMode === "favorites"
              ? "Favoris"
              : listMode === "new"
                ? "Nouveautés"
                : listMode === "hype"
                  ? "Hype"
                  : "Restaurants";

        return (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => setListMode(null)}
          />
          <div className="absolute z-40 left-2 right-2 bottom-2 top-20 sm:left-4 sm:right-auto sm:top-4 sm:bottom-4 sm:w-[360px] rounded-2xl bg-card border border-border/70 shadow-2xl overflow-hidden flex flex-col animate-pop-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <h2 className="font-display font-bold text-sm inline-flex items-center gap-1.5">
                {titleIcon}{listTitle} <span className="text-muted-foreground font-semibold">· {listItems.length}</span>
              </h2>
              <button
                onClick={() => { haptic(); setListMode(null); }}
                className="p-1 -m-1 text-muted-foreground hover:text-foreground tap-bounce"
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
              {!mutation.isPending && listItems.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {!city
                    ? "Sélectionnez une ville pour lancer la recherche."
                    : listMode === "done"
                      ? "Aucun restaurant marqué fait pour l'instant."
                      : listMode === "favorites"
                        ? "Aucun restaurant en favori pour l'instant."
                        : listMode === "new"
                          ? "Aucune nouveauté pour l'instant."
                          : listMode === "hype"
                            ? "Pas encore de restos hype. Marquez-en pour lancer la tendance !"
                            : "Aucun restaurant trouvé."}

                </div>
              )}

              {listItems.map((r) => {
                const done = !!visits[r.id]?.done;
                const favorite = !!visits[r.id]?.favorite;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelected(r);
                      mapInstance.current?.panTo({ lat: r.lat, lng: r.lng });
                      mapInstance.current?.setZoom(15);
                      setListMode(null);
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
                          {isNewRestaurant(r) && (
                            <span className="inline-flex items-center gap-0.5 text-sky-600 font-medium">
                              <NewStickerIcon size={14} /> Nouveau
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
                          haptic(favorite ? 12 : 20);
                          update(r.id, { favorite: !favorite });
                        }}
                        className="p-1.5 rounded-full hover:bg-muted tap-bounce transition flex-shrink-0"
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
        );
      })()}

      {/* Personal food map profile */}
      {listMode === "profile" && (
        <ProfilePanel
          restaurants={results}
          visits={visits}
          cityLabel={currentCity?.label ?? ""}
          onClose={() => setListMode(null)}
          onSelect={(r) => {
            setListMode(null);
            setSelected(r);
            mapInstance.current?.panTo({ lat: r.lat, lng: r.lng });
            mapInstance.current?.setZoom(15);
          }}
        />
      )}

      {/* Detail card */}
      {selected && (
        <DetailCard
          key={selected.id}
          restaurant={selected}
          visit={visits[selected.id] ?? { done: false, comment: "" }}
          distanceKm={
            userLocation || currentCity
              ? haversineDistance(userLocation ?? { lat: currentCity!.lat, lng: currentCity!.lng }, selected)
              : null
          }
          fromUser={!!userLocation}
          onUpdate={(patch) => update(selected.id, patch)}
          onClose={() => setSelected(null)}
        />
      )}

      <Mascot
        onPickCuisine={(c) => setCuisine(c)}
        onShowAll={() => setCuisine("any")}
      />
    </div>
  );
}

function Mascot({
  onPickCuisine,
  onShowAll,
}: {
  onPickCuisine: (c: Cuisine) => void;
  onShowAll: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"ask" | "pick">("ask");

  useEffect(() => {
    try {
      const last = localStorage.getItem("tastemap.mascot.lastSeen");
      const now = Date.now();
      if (last && now - Number(last) < 6 * 60 * 60 * 1000) return;
      localStorage.setItem("tastemap.mascot.lastSeen", String(now));
    } catch {
      /* ignore */
    }
    const t1 = setTimeout(() => setVisible(true), 900);
    return () => { clearTimeout(t1); };
  }, []);

  if (!visible) return null;

  const quickPicks: Cuisine[] = ["italian", "japanese", "french", "american", "mexican", "thai"];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <button
        aria-label="Fermer"
        onClick={() => { haptic(); setVisible(false); }}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-mascot-backdrop"
      />
      <div className="relative pointer-events-auto flex flex-col items-center gap-3 w-full max-w-[340px]">
        <div className="animate-mascot-enter">
          <div className="animate-mascot-hop">
            <ChefBuddy />
          </div>
        </div>
        <div className="relative w-full rounded-3xl bg-white/90 backdrop-blur border border-white/70 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)] px-4 py-3 animate-mascot-bubble">
          <span
            aria-hidden
            className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rotate-45 bg-white/90 border-l border-t border-white/70 rounded-sm"
          />
          <button
            onClick={() => { haptic(); setVisible(false); }}
            className="absolute -top-2.5 -right-2.5 h-6 w-6 rounded-full bg-white border border-border/60 grid place-items-center shadow-md tap-bounce"
            aria-label="Fermer"
          >
            <X className="h-3 w-3" />
          </button>
          {step === "ask" ? (
            <>
              <p className="text-sm font-extrabold text-foreground text-center">
                Coucou&nbsp;! Tu veux manger un truc en particulier&nbsp;?
              </p>
              <div className="mt-3 flex gap-2 justify-center">
                <button
                  onClick={() => { haptic(); onShowAll(); setVisible(false); }}
                  className="inline-flex items-center text-xs font-extrabold px-4 py-1.5 rounded-full bg-white hover:bg-muted/60 border border-border/70 shadow-sm active:translate-y-[1px] tap-bounce"
                >
                  Non
                </button>
                <button
                  onClick={() => { haptic(20); setStep("pick"); }}
                  className="inline-flex items-center text-xs font-extrabold px-4 py-1.5 rounded-full bg-[color:var(--duo-green)] text-white shadow-md active:translate-y-[1px] tap-bounce"
                >
                  Oui
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold text-foreground text-center">
                Choisis ton envie&nbsp;!
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                {quickPicks.map((value) => {
                  const meta = CUISINE_META[value];
                  return (
                    <button
                      key={value}
                      onClick={() => { haptic(); onPickCuisine(value); setVisible(false); }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold pl-1.5 pr-3 py-1 rounded-full bg-white hover:bg-muted/60 border border-border/70 shadow-sm active:translate-y-[1px] tap-bounce"
                    >
                      <img
                        src={meta.image}
                        alt=""
                        width={22}
                        height={22}
                        loading="lazy"
                        draggable={false}
                        className="object-contain select-none pointer-events-none"
                        style={{ width: 22, height: 22 }}
                      />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
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
    <div className="absolute left-3 right-3 bottom-3 lg:left-4 lg:right-auto lg:bottom-4 lg:w-[360px] rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.12)] overflow-hidden max-h-[52vh] lg:max-h-[70vh] flex flex-col">
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
              className="h-32 lg:h-44 w-full flex-shrink-0 object-cover snap-start"
            />
          ))}
        </div>
      )}
      <div className="p-4 overflow-y-auto">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60 backdrop-blur border border-white/50">
            <CuisineIcon cuisines={r.cuisines} size={32} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-base leading-tight">{r.name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {r.primaryType ?? "Restaurant"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => { haptic(visit.done ? 12 : 20); onUpdate({ done: !visit.done }); }}
              className={`inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-full text-sm font-extrabold tap-bounce transition ${
                visit.done
                  ? "bg-white text-[color:var(--duo-green)] border border-[color:var(--duo-green)] shadow-sm"
                  : "bg-white/40 backdrop-blur border border-white/50 text-foreground/80 hover:bg-white/60"
              }`}
              aria-label={visit.done ? "Marquer non fait" : "Marquer fait"}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
              Fait
            </button>
            <button
              onClick={() => { haptic(visit.favorite ? 12 : 20); onUpdate({ favorite: !visit.favorite }); }}
              className={`inline-flex items-center justify-center h-8 w-8 rounded-full tap-bounce transition ${
                visit.favorite
                  ? "bg-white text-rose-500 border border-rose-200 shadow-sm"
                  : "bg-white/40 backdrop-blur border border-white/50 text-foreground/80 hover:text-foreground"
              }`}
              aria-label={visit.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Heart className={`h-4 w-4 ${visit.favorite ? "fill-rose-500 text-rose-500" : ""}`} />
            </button>
            <button
              onClick={() => { haptic(); onClose(); }}
              className="text-muted-foreground hover:text-foreground p-1 -m-1 tap-bounce"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {r.rating != null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
              <Star className="h-4 w-4 fill-amber-400 stroke-amber-400" />
              {r.rating.toFixed(1)}
              {r.userRatingCount != null && (
                <span className="text-amber-600/70 font-normal">
                  ({r.userRatingCount})
                </span>
              )}
            </span>
          )}
          {r.priceLevel && (
            <span className="text-muted-foreground font-medium">
              {priceLabel(r.priceLevel)}
            </span>
          )}
          {isNewRestaurant(r) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-medium">
              <NewStickerIcon size={16} /> Nouveau
            </span>
          )}
          {r.openNow === true && (
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" /> Ouvert
            </span>
          )}
          {r.openNow === false && (
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" /> Fermé
            </span>
          )}
        </div>

        {r.summary && (
          <p className="mt-3 text-sm text-foreground/80 leading-relaxed line-clamp-2">
            {r.summary}
          </p>
        )}

        <p className="mt-3 text-sm text-muted-foreground flex items-start gap-1.5">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{r.address}</span>
        </p>

        {r.weekdayDescriptions.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => { haptic(); setShowHours((v) => !v); }}
              className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground bg-muted/60 px-2.5 py-1.5 rounded-full tap-bounce transition"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Horaires
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showHours ? "rotate-180" : ""}`}
              />
            </button>
            {showHours && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground leading-tight bg-muted/30 rounded-lg p-2.5">
                {r.weekdayDescriptions.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {r.googleMapsUri && (
            <a
              href={r.googleMapsUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-[color:var(--duo-green)] text-white font-semibold btn-pop hover:brightness-105 tap-bounce transition"
            >
              <MapPin className="h-3.5 w-3.5" /> Google Maps
            </a>
          )}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-semibold tap-bounce transition"
          >
            <Navigation className="h-3.5 w-3.5" /> Itinéraire
          </a>
          {r.phone && (
            <a
              href={`tel:${r.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-semibold tap-bounce transition"
            >
              <Phone className="h-3.5 w-3.5" /> {r.phone}
            </a>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border/50">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onUpdate({ comment })}
            placeholder="Un petit mot sur ce resto ?"
            rows={2}
            className="resize-none text-sm border-border/40 bg-muted/30 focus:bg-card"
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

// Playful "board game" light map — cream land, pastel water & parks, minimal roads.
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
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#FFF9F0" }, { visibility: "simplified" }] },
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
