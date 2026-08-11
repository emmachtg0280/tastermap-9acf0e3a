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

import { searchRestaurants, searchViewport } from "@/lib/places.functions";
import {
  CITIES,
  type Cuisine,
  type Restaurant,
  type CityKey,
} from "@/lib/places.shared";
import {
  USER_DOT_SVG,
  clusterIcon,
  markerIcon,
  markerIconKey,
  type MarkerState,
} from "@/lib/map-markers";


import {
  getMyVisits,
  upsertVisit,
  mergeLocalVisits,
  type Visit,
} from "@/lib/visits.functions";
import { toast } from "sonner";
import { haptic } from "@/lib/haptic";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

import {
  CUISINE_META,
  CuisineIcon,
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

const NewStickerIcon = ({ size = 20 }: { size?: number }) => (
  <img src={newTabAsset.url} alt="" width={size} height={size} loading="lazy" draggable={false}
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
/** Hard cap on simultaneously drawn markers — mobile DOM cost control. */
const MAX_MARKERS = 220;

/** Cuisine shortcuts kept visible; the full list lives behind “Plus”. */
const PRIMARY_CUISINES: Cuisine[] = ["italian", "japanese", "mexican"];


type VisitEntry = { done: boolean; comment: string; favorite: boolean; personalRating?: number };
type VisitMap = Record<string, VisitEntry>;
const VISITS_KEY = "tastemap.visits.v2";

/* ── Map state persistence: city, cuisine, center & zoom survive reloads ── */
const MAP_STATE_KEY = "tastemap.map.v1";
type MapState = {
  city?: CityKey | null;
  cuisine?: Cuisine;
  center?: { lat: number; lng: number };
  zoom?: number;
};

function readMapState(): MapState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MAP_STATE_KEY);
    return raw ? (JSON.parse(raw) as MapState) : null;
  } catch {
    return null;
  }
}

function writeMapState(patch: MapState) {
  if (typeof window === "undefined") return;
  try {
    const current = readMapState() ?? {};
    localStorage.setItem(MAP_STATE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    /* ignore */
  }
}


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
  const serverMerge = useServerFn(mergeLocalVisits);
  const mergedRef = useRef(false);

  // Load localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISITS_KEY);
      if (raw) setLocalVisits(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Anonymous -> account: push localStorage states into the user's records,
  // then (and only then) clear the local copy.
  useEffect(() => {
    if (!userId || mergedRef.current) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(VISITS_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let parsed: VisitMap;
    try {
      parsed = JSON.parse(raw) as VisitMap;
    } catch {
      return;
    }
    const entries = Object.entries(parsed ?? {}).map(([place_id, v]) => ({
      place_id,
      done: !!v.done,
      favorite: !!v.favorite,
      saved: !!v.favorite && !v.done,
      personal_rating: v.personalRating ?? null,
      comment: v.comment?.trim() ? v.comment : null,
    }));
    if (!entries.length) return;

    mergedRef.current = true;
    serverMerge({ data: { entries } })
      .then(() => {
        try {
          localStorage.removeItem(VISITS_KEY);
        } catch {
          /* ignore */
        }
        setLocalVisits({});
        queryClient.invalidateQueries({ queryKey: ["my-visits"] });
      })
      .catch((e: unknown) => {
        // Keep localStorage intact so nothing is lost; retry on next sign-in.
        mergedRef.current = false;
        console.error("[useVisits] merge failed", e);
      });
  }, [userId, serverMerge, queryClient]);


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

  // Optimistic overlay: the map reacts instantly, the server catches up after.
  const [pending, setPending] = useState<VisitMap>({});

  const visits = useMemo<VisitMap>(
    () => ({ ...(userId ? cloudMap : localVisits), ...pending }),
    [userId, cloudMap, localVisits, pending],
  );

  const update = async (id: string, patch: Partial<VisitEntry>) => {
    const current = visits[id] ?? { done: false, comment: "", favorite: false };
    const next = { ...current, ...patch };

    if (userId) {
      setPending((p) => ({ ...p, [id]: next })); // optimistic
      try {
        await serverUpsert({
          data: {
            place_id: id,
            done: next.done,
            favorite: next.favorite,
            comment: next.comment.trim() || null,
            personal_rating: next.personalRating ?? null,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["my-visits"] });
      } catch (e) {
        console.error("[useVisits] update failed", e);
        toast.error("Impossible d'enregistrer. Réessayez.");
      } finally {
        setPending((p) => {
          const rest = { ...p };
          delete rest[id];
          return rest;
        });
      }
    } else {
      setLocalVisits((prev) => {
        const base = prev[id] ?? { done: false, comment: "", favorite: false };
        const merged = { ...prev, [id]: { ...base, ...patch } };
        const entry = merged[id];
        if (!entry.done && !entry.favorite && !entry.comment.trim() && !entry.personalRating) {
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
  const restored = useMemo(() => readMapState(), []);

  const [city, setCity] = useState<CityKey | null>(restored?.city ?? "toulouse");

  const [cuisine, setCuisine] = useState<Cuisine>(restored?.cuisine ?? "any");
  const [minRating, setMinRating] = useState(4);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  /** Tapping a marker shows a quick-action card; details are opt-in. */
  const [detailOpen, setDetailOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("half");
  const [showLegend, setShowLegend] = useState(false);

  const [results, setResults] = useState<Restaurant[]>([]);
  const [searchText, setSearchText] = useState("");
  const [onlyOpenNow, setOnlyOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [showFilters, setShowFilters] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [listMode, setListMode] = useState<null | "all" | "done" | "favorites" | "new" | "profile" | "mymap">(null);
  const [neighborhood, setNeighborhood] = useState<string | null>(null);
  const { user } = useAuthSession();
  const { visits, update } = useVisits(user?.id ?? null);

  /**
   * Every personal-map write goes through here: the marker repaints instantly
   * (optimistic state) and a tiny, self-dismissing confirmation tells the user
   * what just happened to *their* map. No modal, no map interruption.
   */
  const applyVisit = (id: string, patch: Partial<VisitEntry>) => {
    const current = visits[id] ?? { done: false, comment: "", favorite: false };
    if (patch.done !== undefined && patch.done !== current.done) {
      toast[patch.done ? "success" : "message"](
        patch.done ? "Découvert · ajouté à ta carte ✨" : "Retiré de tes découvertes",
        { duration: 1600 },
      );
    } else if (patch.favorite !== undefined && patch.favorite !== current.favorite) {
      toast[patch.favorite ? "success" : "message"](
        patch.favorite ? "Enregistré sur ta carte ✨" : "Retiré de ta carte",
        { duration: 1600 },
      );
    }
    return update(id, patch);
  };
  const userLocation = useGeolocation();

  const mapReady = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef(new Map<string, { marker: google.maps.Marker; key: string }>());
  const clusterMarkersRef = useRef<google.maps.Marker[]>([]);
  const restaurantsByIdRef = useRef(new Map<string, Restaurant>());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const loadedCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const cuisineDataUrls = useCuisineDataUrls();


  // Reset the bottom sheet to its middle snap for each new restaurant.
  useEffect(() => {
    if (selected) setSheetSnap("half");
  }, [selected?.id]);

  /* Compact legend: shown until the user has put anything on their own map. */
  const personalCount = useMemo(
    () => Object.values(visits).filter((v) => v.done || v.favorite).length,
    [visits],
  );
  const hasPersonalPins = personalCount > 0;
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("tastemap.legend.v1") === "1";
    } catch {
      /* ignore */
    }
    setShowLegend(!dismissed && !hasPersonalPins);
  }, [hasPersonalPins]);
  const dismissLegend = () => {
    try {
      localStorage.setItem("tastemap.legend.v1", "1");
    } catch {
      /* ignore */
    }
    setShowLegend(false);
  };

  const currentCity = useMemo(
    () => CITIES.find((c) => c.key === city) ?? null,
    [city],
  );

  const visibleCuisines = useMemo(() => {
    const list = [...PRIMARY_CUISINES];
    if (cuisine !== "any" && !list.includes(cuisine)) list.unshift(cuisine);
    return list;
  }, [cuisine]);

  const search = useServerFn(searchRestaurants);
  const mutation = useMutation({
    mutationFn: (vars: { city: CityKey; minRating: number; force?: boolean }) =>
      search({ data: vars }),
    onSuccess: (data) => {
      setResults(data);
      setShowSearchArea(false);
      const c = mapInstance.current?.getCenter();
      loadedCenterRef.current = c
        ? { lat: c.lat(), lng: c.lng() }
        : currentCity
          ? { lat: currentCity.lat, lng: currentCity.lng }
          : null;
    },
  });

  // Viewport reads never touch Google — database only.
  const searchArea = useServerFn(searchViewport);
  const viewportMutation = useMutation({
    mutationFn: (vars: { south: number; west: number; north: number; east: number; minRating: number }) =>
      searchArea({ data: vars }),
    onSuccess: (data) => {
      // Merge: already-loaded restaurants are never refetched or duplicated.
      setResults((prev) => {
        const byId = new Map(prev.map((r) => [r.id, r]));
        data.forEach((r) => byId.set(r.id, r));
        return Array.from(byId.values());
      });
      setShowSearchArea(false);
      const c = mapInstance.current?.getCenter();
      if (c) loadedCenterRef.current = { lat: c.lat(), lng: c.lng() };
    },
  });

  const isLoadingRestaurants = mutation.isPending || viewportMutation.isPending;
  const loadError = mutation.isError || viewportMutation.isError;

  const searchThisArea = () => {
    const map = mapInstance.current;
    const b = map?.getBounds();
    if (!b) return;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    viewportMutation.mutate({
      south: sw.lat(),
      west: sw.lng(),
      north: ne.lat(),
      east: ne.lng(),
      minRating,
    });
  };

  // Hype is intentionally not exposed in the UI for now (signals are too
  // sparse to be useful). The backend logic in `hype.functions.ts` stays.



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


  const filtered = useMemo(() => {
    return [...baseFiltered].sort((a, b) => sortRestaurants(a, b, sortBy, userLocation, currentCity));
  }, [baseFiltered, sortBy, userLocation, currentCity]);


  // Refs let the map layer read fresh data without re-rendering React on pan.
  const visitsRef = useRef(visits);
  visitsRef.current = visits;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;
  const cuisineUrlsRef = useRef(cuisineDataUrls);
  cuisineUrlsRef.current = cuisineDataUrls;
  const rebuildRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return;
    const map = new window.google!.maps.Map(mapRef.current, {
      center: restored?.center ?? DEFAULT_CENTER,
      zoom: restored?.zoom ?? DEFAULT_ZOOM,
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
    mapInstance.current = map;
    map.addListener("click", () => { setSelected(null); setDetailOpen(false); });
    map.addListener("idle", () => {
      // Redraw markers directly — no React state update, so panning the map
      // never re-renders the whole screen.
      rebuildRef.current();

      const z = map.getZoom() ?? DEFAULT_ZOOM;
      const c = map.getCenter();
      const b = map.getBounds();
      if (!c) return;
      writeMapState({ center: { lat: c.lat(), lng: c.lng() }, zoom: z });
      resolveNeighborhood({ lat: c.lat(), lng: c.lng() }, z);

      const from = loadedCenterRef.current;
      if (from && b) {
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        const spanKm = haversineDistance(
          { lat: sw.lat(), lng: sw.lng() },
          { lat: ne.lat(), lng: ne.lng() },
        );
        const moved = haversineDistance(from, { lat: c.lat(), lng: c.lng() });
        // setState with an identical boolean is a no-op for React.
        setShowSearchArea(moved > Math.max(1.2, spanKm * 0.45));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // Persist the product-level choices, not the transient ones.
  useEffect(() => {
    writeMapState({ city, cuisine });
  }, [city, cuisine]);

  // Recenter only when the *city* actually changes — never on state updates.
  const lastCityRef = useRef<CityKey | null>(restored?.city ?? "toulouse");
  useEffect(() => {
    if (!mapInstance.current || !currentCity) return;
    if (lastCityRef.current === currentCity.key && restored?.center) {
      lastCityRef.current = currentCity.key;
      return;
    }
    lastCityRef.current = currentCity.key;
    mapInstance.current.panTo({ lat: currentCity.lat, lng: currentCity.lng });
    mapInstance.current.setZoom(CITY_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCity, mapReady]);

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
          scaledSize: new window.google.maps.Size(44, 44),
          anchor: new window.google.maps.Point(22, 22),
        },
      });
    }
    userMarkerRef.current.setPosition(userLocation);
  }, [userLocation, mapReady]);

  /* ── Lightweight neighbourhood cue (reverse geocode, heavily throttled) ── */
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const geoTimerRef = useRef<number | null>(null);
  const lastGeoRef = useRef<{ lat: number; lng: number } | null>(null);
  const resolveNeighborhood = (center: { lat: number; lng: number }, zoom: number) => {
    if (!window.google) return;
    if (zoom < 14) {
      setNeighborhood(null);
      return;
    }
    const last = lastGeoRef.current;
    if (last && haversineDistance(last, center) < 0.35) return;
    if (geoTimerRef.current) window.clearTimeout(geoTimerRef.current);
    geoTimerRef.current = window.setTimeout(() => {
      lastGeoRef.current = center;
      geocoderRef.current ??= new window.google!.maps.Geocoder();
      geocoderRef.current.geocode({ location: center }, (res, status) => {
        if (status !== "OK" || !res?.length) return;
        const wanted = ["neighborhood", "sublocality", "sublocality_level_1"];
        for (const r of res) {
          const comp = r.address_components?.find((c) =>
            c.types.some((t) => wanted.includes(t)),
          );
          if (comp) {
            setNeighborhood(comp.long_name);
            return;
          }
        }
        setNeighborhood(null);
      });
    }, 700);
  };

  /* ── Marker layer ───────────────────────────────────────────────────────
   * Markers are created once and afterwards only patched. Selecting a
   * restaurant or flipping one state patches a single marker; panning never
   * touches React state. Icon data-URIs are memoized in `map-markers.ts`.
   */
  const iconFor = (r: Restaurant, active: boolean) => {
    const v = visitsRef.current[r.id];
    const state: MarkerState = v?.done ? "done" : v?.favorite ? "saved" : "new";
    const cuisineKey = pickCuisine(r.cuisines);
    return {
      cuisine: cuisineKey,
      state,
      active,
      isNew: isNewRestaurant(r),
      dataUrl: cuisineUrlsRef.current?.[cuisineKey],
      inner: cuisineInnerSvg(r.cuisines),
    };
  };

  const paintMarker = (id: string) => {
    const g = window.google;
    const entry = markersRef.current.get(id);
    const r = restaurantsByIdRef.current.get(id);
    if (!entry || !r || !g) return;
    const active = selectedIdRef.current === id;
    const input = iconFor(r, active);
    const key = markerIconKey(input);
    if (entry.key === key) return;
    const visual = markerIcon(input);
    entry.marker.setIcon({
      url: visual.url,
      scaledSize: new g.maps.Size(visual.size, visual.height),
      anchor: new g.maps.Point(visual.size / 2, visual.size / 2),
    });
    const v = visitsRef.current[id];
    entry.marker.setZIndex(active ? 999 : v?.done ? 40 : v?.favorite ? 20 : 1);
    entry.key = key;
  };

  useEffect(() => {
    rebuildRef.current = () => {
      const map = mapInstance.current;
      const g = window.google;
      if (!map || !g) return;

      restaurantsByIdRef.current = new Map(filtered.map((r) => [r.id, r]));
      const zoom = map.getZoom() ?? DEFAULT_ZOOM;
      const visits = visitsRef.current;

      // Only draw what is (roughly) on screen: keeps 1000+ restaurants usable.
      const b = map.getBounds();
      let visible = filtered;
      if (b) {
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        const padLat = (ne.lat() - sw.lat()) * 0.2;
        const padLng = (ne.lng() - sw.lng()) * 0.2;
        const south = sw.lat() - padLat;
        const north = ne.lat() + padLat;
        const west = sw.lng() - padLng;
        const east = ne.lng() + padLng;
        visible = filtered.filter(
          (r) => r.lat >= south && r.lat <= north && r.lng >= west && r.lng <= east,
        );
      }

      // ── Clusters (low zoom) ──
      const clusterPool = clusterMarkersRef.current;
      let singles: Restaurant[] = [];
      let usedClusters = 0;

      if (zoom < CLUSTER_ZOOM && visible.length > 0) {
        const cell = 360 / Math.pow(2, Math.max(4, Math.round(zoom)) + 3);
        const groups = new Map<string, Restaurant[]>();
        visible.forEach((r) => {
          const key = `${Math.floor(r.lat / cell)}:${Math.floor(r.lng / cell)}`;
          const arr = groups.get(key) ?? [];
          arr.push(r);
          groups.set(key, arr);
        });
        groups.forEach((group) => {
          if (group.length === 1) {
            singles.push(group[0]);
            return;
          }
          const lat = group.reduce((s, r) => s + r.lat, 0) / group.length;
          const lng = group.reduce((s, r) => s + r.lng, 0) / group.length;
          const discovered = group.filter((r) => visits[r.id]?.done).length;
          const visual = clusterIcon(group.length, discovered / group.length);
          let m = clusterPool[usedClusters];
          if (!m) {
            m = new g.maps.Marker({ map, zIndex: 10, optimized: false });
            clusterPool[usedClusters] = m;
          }
          m.setPosition({ lat, lng });
          m.setIcon({
            url: visual.url,
            scaledSize: new g.maps.Size(visual.size, visual.size),
            anchor: new g.maps.Point(visual.size / 2, visual.size / 2),
          });
          m.setMap(map);
          g.maps.event.clearListeners(m, "click");
          m.addListener("click", () => {
            map.panTo({ lat, lng });
            map.setZoom(Math.min(17, Math.round(zoom) + 2));
          });
          usedClusters += 1;
        });
      } else {
        singles = visible;
      }
      for (let i = usedClusters; i < clusterPool.length; i++) clusterPool[i].setMap(null);

      // Hard cap the DOM cost on mobile: personal states always win.
      if (singles.length > MAX_MARKERS) {
        const score = (r: Restaurant) => {
          const v = visits[r.id];
          if (v?.done) return 3;
          if (v?.favorite) return 2;
          return (r.userRatingCount ?? 0) > 300 ? 1 : 0;
        };
        singles = [...singles]
          .sort((a, b) => score(b) - score(a))
          .slice(0, MAX_MARKERS);
      }

      // ── Individual restaurant markers ──
      const pool = markersRef.current;
      const wanted = new Set<string>();

      singles.forEach((r) => {
        wanted.add(r.id);
        const active = selectedIdRef.current === r.id;
        const entry = pool.get(r.id);
        if (entry) {
          if (!entry.marker.getMap()) entry.marker.setMap(map);
          paintMarker(r.id);
          return;
        }
        const input = iconFor(r, active);
        const visual = markerIcon(input);
        const v = visits[r.id];
        const marker = new g.maps.Marker({
          position: { lat: r.lat, lng: r.lng },
          map,
          title: r.name,
          icon: {
            url: visual.url,
            scaledSize: new g.maps.Size(visual.size, visual.height),
            anchor: new g.maps.Point(visual.size / 2, visual.size / 2),
          },
          zIndex: active ? 999 : v?.done ? 40 : v?.favorite ? 20 : 1,
          optimized: false,
        });
        marker.addListener("click", () => {
          const target = restaurantsByIdRef.current.get(r.id);
          if (!target) return;
          haptic(12);
          // Quick decision first: the full detail sheet stays one tap away.
          setDetailOpen(false);
          setSelected(target);
        });
        pool.set(r.id, { marker, key: markerIconKey(input) });
      });

      pool.forEach((entry, id) => {
        if (!wanted.has(id)) {
          entry.marker.setMap(null);
          pool.delete(id);
        }
      });
    };
    rebuildRef.current();
    // `visits` and `selected` are handled by the incremental effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, cuisineDataUrls, mapReady]);

  // Selection: repaint only the two markers involved.
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    const next = selected?.id ?? null;
    prevSelectedRef.current = next;
    if (prev && prev !== next) paintMarker(prev);
    if (next) paintMarker(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  /** Tiny, calm reward: the marker scales up once when its state flips. */
  const bumpMarker = (id: string) => {
    const g = window.google;
    const entry = markersRef.current.get(id);
    if (!g || !entry) return;
    const icon = entry.marker.getIcon() as google.maps.Icon | null;
    if (!icon?.scaledSize) return;
    const w = icon.scaledSize.width;
    const h = icon.scaledSize.height;
    entry.marker.setIcon({
      ...icon,
      scaledSize: new g.maps.Size(w * 1.22, h * 1.22),
      anchor: new g.maps.Point((w * 1.22) / 2, (w * 1.22) / 2),
    });
    window.setTimeout(() => {
      if (markersRef.current.get(id) === entry) entry.marker.setIcon(icon);
    }, 190);
  };

  // Visit changes: repaint only the restaurants whose state actually changed.
  const prevVisitsRef = useRef<VisitMap>({});
  useEffect(() => {
    const prev = prevVisitsRef.current;
    prevVisitsRef.current = visits;
    const sig = (v?: VisitEntry) => `${v?.done ? 1 : 0}${v?.favorite ? 1 : 0}`;
    const ids = new Set([...Object.keys(prev), ...Object.keys(visits)]);
    ids.forEach((id) => {
      if (sig(prev[id]) !== sig(visits[id])) {
        paintMarker(id);
        bumpMarker(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits]);

  // Bring the selected restaurant into a useful position: on mobile the sheet
  // covers the lower half, so nudge the marker into the upper area only when
  // it would otherwise be hidden. The map is never recentred otherwise.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !selected) return;
    const b = map.getBounds();
    if (!b) return;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    const latSpan = ne.lat() - sw.lat();
    const hiddenBelow = sw.lat() + latSpan * 0.5;
    const outside = !b.contains(new window.google!.maps.LatLng(selected.lat, selected.lng));
    if (outside || (window.innerWidth < 1024 && selected.lat < hiddenBelow)) {
      map.panTo({ lat: selected.lat - latSpan * 0.18, lng: selected.lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);


  // City load — the only path allowed to reach Google
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

      {/* Map-level loading indicator */}
      {mapReady && isLoadingRestaurants && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex justify-center pointer-events-none">
          <div className="rounded-full bg-card/90 backdrop-blur border border-border/60 shadow-sm px-3.5 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement des restaurants…
          </div>
        </div>
      )}

      {/* “Search this area” — only after a significant move */}
      {mapReady && showSearchArea && !isLoadingRestaurants && (
        <div className="absolute inset-x-0 top-[190px] z-20 flex justify-center px-4 pointer-events-none">
          <button
            type="button"
            onClick={() => { haptic(20); searchThisArea(); }}
            className="pointer-events-auto rounded-full bg-card/95 backdrop-blur border border-border/60 shadow-md px-4 h-11 text-sm font-bold text-foreground inline-flex items-center gap-2 tap-bounce transition animate-pop-in"
          >
            <Search className="h-4 w-4" />
            Rechercher dans cette zone
          </button>
        </div>
      )}

      {/* Server / API error: never leave the map silently empty */}
      {mapReady && loadError && results.length === 0 && (
        <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-md px-4 py-3 text-sm text-foreground flex items-center gap-3 max-w-[340px]">
            <span>Impossible de charger les restaurants pour le moment.</span>
            <button
              type="button"
              className="rounded-full bg-[color:var(--duo-green)] text-white font-extrabold text-xs px-3 py-2 shadow-sm active:translate-y-[1px]"
              onClick={() => city && mutation.mutate({ city, minRating, force: true })}
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Genuinely empty result set — distinct from an error */}
      {mapReady && !loadError && !isLoadingRestaurants && city && results.length > 0 && filtered.length === 0 && (
        <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-md px-4 py-3 text-sm text-muted-foreground max-w-[320px] text-center">
            Aucun restaurant ici. Déplacez la carte ou changez vos filtres.
          </div>
        </div>
      )}




      {/* Floating top bar — auth only, top right */}
      <div className="absolute top-0 right-0 z-30 pt-[env(safe-area-inset-top)] px-3">
        <div className="pt-0.5 rounded-full bg-card/80 backdrop-blur border border-white/40 shadow-sm px-2 py-1">
          <AuthButton />
        </div>
      </div>

      {/* Top bar — city, neighbourhood context, Discover, cuisine shortcuts */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-3xl px-2 pt-1">
          <div className="flex items-center gap-2 pl-1 pr-14">
            <button
              onClick={() => { haptic(); setShowCities((v) => !v); }}
              className="inline-flex items-center gap-1 h-11 pl-3 pr-2.5 rounded-full bg-white/85 backdrop-blur border border-white/70 shadow-sm text-sm font-extrabold text-foreground tap-bounce transition hover:bg-white"
              aria-label="Changer de ville"
            >
              <MapPin className="h-4 w-4 text-[color:var(--duo-green-dark)]" />
              {currentCity?.label ?? "Choisir une ville"}
              <ChevronDown className={`h-4 w-4 transition-transform ${showCities ? "rotate-180" : ""}`} />
            </button>

            {/* Primary: the user's own map. Discovery is the secondary action. */}
            <button
              onClick={() => { haptic(20); setShowFilters(false); setListMode("mymap"); }}
              className="inline-flex items-center gap-1.5 h-11 pl-3 pr-4 rounded-full bg-[color:var(--duo-green)] text-white text-sm font-extrabold btn-pop hover:brightness-105 tap-bounce transition"
            >
              <MapPin className="h-4 w-4" />
              Ma carte food
              {personalCount > 0 && (
                <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-xs font-extrabold">
                  {personalCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { haptic(20); setShowFilters(false); setListMode("new"); }}
              className="inline-flex items-center gap-1.5 h-11 pl-2 pr-3.5 rounded-full bg-white/85 backdrop-blur border border-white/70 shadow-sm text-sm font-extrabold text-foreground tap-bounce transition hover:bg-white"
            >
              <NewStickerIcon size={20} />
              Découvrir
            </button>


            {neighborhood && (
              <span className="hidden sm:inline-flex items-center h-9 px-3 rounded-full bg-white/60 backdrop-blur border border-white/60 text-xs font-bold text-foreground/70 truncate max-w-[160px]">
                {neighborhood}
              </span>
            )}
          </div>

          {showCities && (
            <div className="mt-1 ml-1 inline-flex flex-wrap gap-1.5 max-w-full rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-lg p-2 animate-pop-in">
              {CITIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => { haptic(20); setCity(c.key); setShowCities(false); }}
                  className={`h-11 px-4 rounded-full text-sm font-bold transition ${
                    c.key === city
                      ? "bg-[color:var(--duo-green)] text-white"
                      : "bg-muted/60 text-foreground/80 hover:bg-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Cuisine shortcuts — compact, full list behind “+” */}
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto no-scrollbar px-1 pb-1 -mx-1">
            <button
              onClick={() => { haptic(); setCuisine("any"); }}
              className={`shrink-0 inline-flex items-center h-10 px-4 rounded-full text-[13px] font-bold backdrop-blur shadow-sm tap-bounce transition ${
                cuisine === "any"
                  ? "bg-white text-foreground border-2 border-white ring-2 ring-white/80"
                  : "bg-white/45 border border-white/50 text-foreground/75 hover:bg-white/65"
              }`}
            >
              Tout
            </button>
            {visibleCuisines.map((value) => {
              const meta = CUISINE_META[value];
              const active = value === cuisine;
              return (
                <button
                  key={value}
                  onClick={() => { haptic(); setCuisine(active ? "any" : value); }}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-10 pl-1.5 pr-3.5 rounded-full text-[13px] font-bold backdrop-blur shadow-sm tap-bounce transition ${
                    active
                      ? "bg-white text-foreground border-2 border-white ring-2 ring-white/80"
                      : "bg-white/45 border border-white/50 text-foreground/75 hover:bg-white/65"
                  }`}
                >
                  <img
                    src={meta.image}
                    alt=""
                    width={26}
                    height={26}
                    loading="lazy"
                    draggable={false}
                    className="object-contain select-none pointer-events-none"
                    style={{ width: 26, height: 26 }}
                  />
                  {meta.label}
                </button>
              );
            })}
            <button
              onClick={() => { haptic(); setShowAllCuisines((v) => !v); }}
              aria-label="Toutes les cuisines"
              className="shrink-0 inline-flex items-center gap-1 h-10 px-3.5 rounded-full bg-white/45 backdrop-blur border border-white/50 text-[13px] font-bold text-foreground/75 shadow-sm hover:bg-white/65 tap-bounce transition"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showAllCuisines ? "rotate-180" : ""}`} />
              {showAllCuisines ? "Moins" : "Plus"}
            </button>
          </div>

          {showAllCuisines && (
            <div className="mx-1 rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-lg p-2 grid grid-cols-4 sm:grid-cols-6 gap-1.5 animate-pop-in">
              {CUISINE_ORDER.map((value) => {
                const meta = CUISINE_META[value];
                const active = value === cuisine;
                return (
                  <button
                    key={value}
                    onClick={() => { haptic(); setCuisine(active ? "any" : value); setShowAllCuisines(false); }}
                    className={`inline-flex flex-col items-center justify-center gap-0.5 h-[70px] rounded-xl transition ${
                      active ? "bg-[color:var(--duo-green)]/15 ring-1 ring-[color:var(--duo-green)]" : "hover:bg-muted/60"
                    }`}
                  >
                    <img
                      src={meta.image}
                      alt={meta.label}
                      width={30}
                      height={30}
                      loading="lazy"
                      draggable={false}
                      className="object-contain select-none pointer-events-none"
                      style={{ width: 30, height: 30 }}
                    />
                    <span className="text-[11px] leading-tight">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightweight geographic cue on mobile */}
      {neighborhood && !selected && (
        <div className="sm:hidden absolute inset-x-0 bottom-4 z-20 flex justify-center pointer-events-none">
          <span className="rounded-full bg-white/80 backdrop-blur border border-white/60 shadow-sm px-3.5 py-1.5 text-xs font-bold text-foreground/70">
            {neighborhood}
          </span>
        </div>
      )}

      {/* Compact map legend — disappears as soon as the map becomes personal */}
      {mapReady && showLegend && !selected && (
        <div className="absolute left-3 bottom-3 z-20 pb-[env(safe-area-inset-bottom)]">
          <div className="rounded-2xl bg-white/85 backdrop-blur border border-white/70 shadow-sm px-3 py-2 flex items-center gap-3 animate-pop-in">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-foreground/60">
              <span className="h-2.5 w-2.5 rounded-full bg-white border border-[#ded3bf]" />
              À explorer
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-500">
              <Heart className="h-3 w-3 fill-rose-500" />
              Enregistré
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--duo-green-dark)]">
              <span className="h-3.5 w-3.5 rounded-full bg-[color:var(--duo-green)] grid place-items-center">
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
              </span>
              Découvert
            </span>
            <button
              onClick={dismissLegend}
              aria-label="Masquer la légende"
              className="text-foreground/40 hover:text-foreground/70 -mr-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating action buttons — bottom right */}
      <div
        className={`absolute right-3 z-30 flex flex-col gap-2 pb-[env(safe-area-inset-bottom)] transition-[bottom] duration-300 ease-out ${
          selected
            ? !detailOpen
              ? "bottom-[184px] lg:bottom-3"
              : sheetSnap === "collapsed"
                ? "bottom-[142px] lg:bottom-3"
                : sheetSnap === "expanded"
                  ? "bottom-[calc(86vh+16px)] lg:bottom-3"
                  : "bottom-[calc(52vh+16px)] lg:bottom-3"
            : "bottom-3"
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
          aria-label="Enregistrés"
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
      {listMode && listMode !== "profile" && (() => {
        const listItems =
          listMode === "done"
            ? filtered.filter((r) => visits[r.id]?.done)
            : listMode === "favorites"
              ? filtered.filter((r) => visits[r.id]?.favorite)
              : listMode === "mymap"
                ? results
                    .filter((r) => visits[r.id]?.done || visits[r.id]?.favorite)
                    // Discovered first, then saved: the map's own hierarchy.
                    .sort(
                      (a, b) =>
                        Number(!!visits[b.id]?.done) - Number(!!visits[a.id]?.done),
                    )
                : listMode === "new"
                  ? [...baseFiltered]
                      .filter((r) => isNewRestaurant(r))
                      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                  : filtered;
        const titleIcon = listMode === "new" ? <NewStickerIcon size={20} /> : null;
        const listTitle =
          listMode === "done"
            ? "Faits"
            : listMode === "favorites"
              ? "Enregistrés"
              : listMode === "mymap"
                ? "Ma carte food"
                : listMode === "new"
                  ? "Découvrir"
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
                      setDetailOpen(true);
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
                          applyVisit(r.id, { favorite: !favorite });
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
            setDetailOpen(true);
            mapInstance.current?.panTo({ lat: r.lat, lng: r.lng });
            mapInstance.current?.setZoom(15);
          }}
        />
      )}

      {/* Quick actions — the primary way to build the personal map */}
      {selected && !detailOpen && (
        <QuickCard
          key={`quick-${selected.id}`}
          restaurant={selected}
          visit={visits[selected.id] ?? { done: false, comment: "", favorite: false }}
          onUpdate={(patch) => applyVisit(selected.id, patch)}
          onDetails={() => { haptic(); setDetailOpen(true); }}
          onClose={() => { haptic(); setSelected(null); }}
        />
      )}

      {/* Detail sheet — secondary, opt-in */}
      {selected && detailOpen && (
        <DetailCard
          key={selected.id}
          restaurant={selected}
          visit={visits[selected.id] ?? { done: false, comment: "", favorite: false }}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          distanceKm={
            userLocation || currentCity
              ? haversineDistance(userLocation ?? { lat: currentCity!.lat, lng: currentCity!.lng }, selected)
              : null
          }
          fromUser={!!userLocation}
          onUpdate={(patch) => applyVisit(selected.id, patch)}
          onClose={() => { setDetailOpen(false); setSelected(null); }}
        />
      )}


      <Mascot />

    </div>
  );
}

/**
 * QuickCard — what a marker tap opens.
 *
 * One glance, one decision: add this place to my map (saved) or mark it as
 * already discovered. Restaurant research lives one tap further, in the
 * detail sheet.
 */
function QuickCard({
  restaurant: r,
  visit,
  onUpdate,
  onDetails,
  onClose,
}: {
  restaurant: Restaurant;
  visit: VisitEntry;
  onUpdate: (patch: Partial<VisitEntry>) => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  const saved = visit.favorite;
  const done = visit.done;

  return (
    <div className="absolute left-3 right-3 bottom-3 lg:left-4 lg:right-auto lg:bottom-4 lg:w-[360px] z-40 rounded-3xl bg-card/95 backdrop-blur border border-border/60 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-pop-in">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 border border-white/60">
          <CuisineIcon cuisines={r.cuisines} size={34} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-extrabold text-[15px] leading-tight truncate">{r.name}</h3>
          <p className="text-[13px] text-muted-foreground truncate">
            {done ? "Sur ta carte · Découvert" : saved ? "Sur ta carte · À tester" : (r.primaryType ?? "Restaurant")}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="h-9 w-9 -mr-1 grid place-items-center rounded-full text-muted-foreground hover:text-foreground tap-bounce"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => { haptic(saved ? 12 : 24); onUpdate({ favorite: !saved }); }}
          className={`flex-1 h-12 rounded-2xl inline-flex items-center justify-center gap-2 text-[15px] font-extrabold tap-bounce transition ${
            saved
              ? "bg-rose-50 text-rose-600 border-2 border-rose-300"
              : "bg-white text-foreground border-2 border-border/70 hover:bg-muted/60"
          }`}
        >
          <Heart className={`h-5 w-5 ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
        <button
          onClick={() => { haptic(done ? 12 : 24); onUpdate({ done: !done }); }}
          className={`flex-1 h-12 rounded-2xl inline-flex items-center justify-center gap-2 text-[15px] font-extrabold tap-bounce transition ${
            done
              ? "bg-[color:var(--duo-green)] text-white btn-pop"
              : "bg-white text-foreground border-2 border-border/70 hover:bg-muted/60"
          }`}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
          {done ? "Découvert" : "J'y suis allé"}
        </button>
      </div>

      <button
        onClick={onDetails}
        className="mt-2 w-full h-9 rounded-xl text-[13px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
      >
        Voir les détails
      </button>
    </div>
  );
}

/**
 * Welcome mascot. Its only job is to explain the concept — it never picks a
 * cuisine for the user and never blocks the map for more than one tap.
 */
function Mascot() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem("tastemap.welcome.v3") === "1";
    } catch {
      /* ignore */
    }
    if (seen) return;
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    haptic();
    try {
      localStorage.setItem("tastemap.welcome.v3", "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <button
        aria-label="Fermer"
        onClick={close}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-mascot-backdrop"
      />
      <div className="relative pointer-events-auto flex flex-col items-center gap-3 w-full max-w-[340px]">
        <div className="animate-mascot-enter">
          <div className="animate-mascot-hop">
            <ChefBuddy />
          </div>
        </div>
        <div className="relative w-full rounded-3xl bg-white/95 backdrop-blur border border-white/70 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)] px-5 py-4 animate-mascot-bubble">
          <span
            aria-hidden
            className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rotate-45 bg-white/95 border-l border-t border-white/70 rounded-sm"
          />
          <p className="text-lg font-extrabold text-foreground text-center leading-snug">
            Ta ville. Ta carte food.
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground text-center leading-snug">
            Touche un resto sur la carte : enregistre ceux qui te tentent,
            marque « J'y suis allé » ceux que tu as goûtés. Ta carte se colore
            au fil de tes découvertes.
          </p>
          <button
            onClick={close}
            className="mt-4 w-full h-12 rounded-full bg-[color:var(--duo-green)] text-white text-sm font-extrabold btn-pop hover:brightness-105 tap-bounce transition"
          >
            Commencer l’exploration
          </button>
        </div>
      </div>
    </div>
  );
}







function ProfilePanel({
  restaurants,
  visits,
  cityLabel,
  onClose,
  onSelect,
}: {
  restaurants: Restaurant[];
  visits: VisitMap;
  cityLabel: string;
  onClose: () => void;
  onSelect: (r: Restaurant) => void;
}) {
  const done = restaurants.filter((r) => visits[r.id]?.done);
  const saved = restaurants.filter((r) => visits[r.id]?.favorite && !visits[r.id]?.done);

  // Neighbourhoods are approximated with a geographic grid (~1 km cells) so
  // exploration is measured per area, not globally.
  const CELL = 0.012;
  const cellKey = (r: Restaurant) => `${Math.floor(r.lat / CELL)}:${Math.floor(r.lng / CELL)}`;
  const areas = new Map<string, { total: number; done: number }>();
  restaurants.forEach((r) => {
    const k = cellKey(r);
    const a = areas.get(k) ?? { total: 0, done: 0 };
    a.total += 1;
    if (visits[r.id]?.done) a.done += 1;
    areas.set(k, a);
  });
  const exploredAreas = Array.from(areas.values()).filter((a) => a.done > 0).length;

  const cuisineCount = new Map<Cuisine, number>();
  done.forEach((r) => {
    const c = pickCuisine(r.cuisines);
    cuisineCount.set(c, (cuisineCount.get(c) ?? 0) + 1);
  });
  const topCuisines = Array.from(cuisineCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const cityProgress = restaurants.length ? Math.round((done.length / restaurants.length) * 100) : 0;

  const Stat = ({ value, label }: { value: string; label: string }) => (
    <div className="rounded-2xl bg-muted/50 px-3 py-3 text-center">
      <div className="font-display font-extrabold text-xl leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );

  return (
    <>
      <div className="absolute inset-0 z-30 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute z-40 left-2 right-2 bottom-2 top-20 sm:left-4 sm:right-auto sm:top-4 sm:bottom-4 sm:w-[360px] rounded-2xl bg-card border border-border/70 shadow-2xl overflow-hidden flex flex-col animate-pop-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <h2 className="font-display font-bold text-sm">Ma carte food{cityLabel ? ` · ${cityLabel}` : ""}</h2>
          <button
            onClick={() => { haptic(); onClose(); }}
            className="p-1 -m-1 text-muted-foreground hover:text-foreground tap-bounce"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={String(done.length)} label="Restaurants découverts" />
            <Stat value={`${exploredAreas}/${areas.size || 0}`} label="Quartiers explorés" />
            <Stat value={String(cuisineCount.size)} label="Cuisines goûtées" />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {cityLabel || "Ville"} explorée
              </h3>
              <span className="text-sm font-bold">{cityProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[color:var(--duo-green)] transition-[width] duration-700 ease-out"
                style={{ width: `${cityProgress}%` }}
              />
            </div>
          </div>

          {topCuisines.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
                Mes cuisines préférées
              </h3>
              <div className="flex flex-wrap gap-2">
                {topCuisines.map(([c, n]) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 pl-1 pr-3 py-1 text-sm">
                    <CuisineIcon cuisines={[c]} size={26} />
                    {CUISINE_META[c].label}
                    <span className="text-muted-foreground">· {n}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <ProfileList title="Mes découvertes récentes" items={done.slice(0, 6)} empty="Marquez un restaurant « Fait » pour démarrer votre carte." onSelect={onSelect} />
          <ProfileList title="À découvrir" items={saved.slice(0, 6)} empty="Aucun restaurant enregistré pour l'instant." onSelect={onSelect} />
        </div>
      </div>
    </>
  );
}

function ProfileList({
  title,
  items,
  empty,
  onSelect,
}: {
  title: string;
  items: Restaurant[];
  empty: string;
  onSelect: (r: Restaurant) => void;
}) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1">
          {items.map((r) => (
            <button
              key={r.id}
              onClick={() => { haptic(); onSelect(r); }}
              className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-muted/60 transition text-left"
            >
              {r.photoUrls[0] ? (
                <img src={r.photoUrls[0]} alt={r.name} loading="lazy" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.primaryType ?? "Restaurant"}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export type SheetSnap = "collapsed" | "half" | "expanded";

function DetailCard({
  restaurant: r,
  visit,
  distanceKm,
  fromUser,
  snap,
  onSnapChange,
  onUpdate,
  onClose,
}: {
  restaurant: Restaurant;
  visit: VisitEntry;
  distanceKm?: number | null;
  fromUser?: boolean;
  snap: SheetSnap;
  onSnapChange: (s: SheetSnap) => void;
  onUpdate: (patch: Partial<VisitEntry>) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState(visit.comment);
  const [showHours, setShowHours] = useState(false);
  useEffect(() => setComment(visit.comment), [visit.comment, r.id]);

  const heightClass =
    snap === "collapsed"
      ? "h-[118px]"
      : snap === "expanded"
        ? "h-[86vh]"
        : "h-[52vh]";

  const cycle = () => {
    haptic(12);
    onSnapChange(snap === "collapsed" ? "half" : snap === "half" ? "expanded" : "collapsed");
  };

  return (
    <div
      className={`absolute left-3 right-3 bottom-3 lg:left-4 lg:right-auto lg:bottom-4 lg:w-[360px] rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col transition-[height] duration-300 ease-out lg:h-auto lg:max-h-[70vh] ${heightClass}`}
    >
      <button
        type="button"
        onClick={cycle}
        aria-label={snap === "expanded" ? "Réduire la fiche" : "Agrandir la fiche"}
        className="lg:hidden shrink-0 h-6 w-full grid place-items-center touch-manipulation"
      >
        <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
      </button>
      {r.photoUrls.length > 0 && snap !== "collapsed" && (
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
      <div className={`px-4 pb-4 ${snap === "collapsed" ? "pt-0" : "pt-4"} overflow-y-auto`}>

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
          <button
            onClick={() => { haptic(); onClose(); }}
            className="text-muted-foreground hover:text-foreground p-1 -m-1 tap-bounce flex-shrink-0"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Personal actions stay the primary content of the sheet */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => { haptic(visit.favorite ? 12 : 24); onUpdate({ favorite: !visit.favorite }); }}
            className={`flex-1 h-11 rounded-2xl inline-flex items-center justify-center gap-2 text-sm font-extrabold tap-bounce transition ${
              visit.favorite
                ? "bg-rose-50 text-rose-600 border-2 border-rose-300"
                : "bg-white text-foreground border-2 border-border/70 hover:bg-muted/60"
            }`}
          >
            <Heart className={`h-4.5 w-4.5 ${visit.favorite ? "fill-rose-500 text-rose-500" : ""}`} />
            {visit.favorite ? "Enregistré" : "Enregistrer"}
          </button>
          <button
            onClick={() => { haptic(visit.done ? 12 : 24); onUpdate({ done: !visit.done }); }}
            className={`flex-1 h-11 rounded-2xl inline-flex items-center justify-center gap-2 text-sm font-extrabold tap-bounce transition ${
              visit.done
                ? "bg-[color:var(--duo-green)] text-white btn-pop"
                : "bg-white text-foreground border-2 border-border/70 hover:bg-muted/60"
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            {visit.done ? "Découvert" : "J'y suis allé"}
          </button>
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
          {distanceKm != null && (
            <span className="text-muted-foreground font-medium inline-flex items-center gap-1">
              <Navigation className="h-3.5 w-3.5" />
              {formatDistance(distanceKm)}{fromUser ? "" : " du centre"}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${
              visit.done
                ? "bg-[color:var(--duo-green)]/10 text-[color:var(--duo-green-dark)]"
                : visit.favorite
                  ? "bg-rose-50 text-rose-600"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {visit.done ? "Découvert" : visit.favorite ? "À découvrir" : "Pas encore exploré"}
          </span>
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
