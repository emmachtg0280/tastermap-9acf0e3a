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
import { CITIES, type Cuisine, type Restaurant, type CityKey } from "@/lib/places.shared";
import {
  USER_DOT_SVG,
  clusterIcon,
  markerIcon,
  markerIconKey,
  type MarkerState,
} from "@/lib/map-markers";

import { getMyVisits, upsertVisit, mergeLocalVisits, type Visit } from "@/lib/visits.functions";
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
import { matchesCuisine } from "@/lib/cuisine";
import {
  haversineDistance,
  isNewRestaurant,
  priceValue,
  sortRestaurants,
  type SortBy,
} from "@/features/restaurants/restaurant-filters";
import { AuthButton, useAuthSession } from "@/features/auth/use-auth-session";
import { useGeolocation } from "@/features/map/use-geolocation";
import { useGoogleMaps } from "@/features/map/use-google-maps";
import { useVisits, type VisitEntry, type VisitMap } from "@/features/visits/use-visits";
import { ProfilePanel } from "@/features/profile/ProfilePanel";
import { QuickCard } from "@/features/restaurants/QuickCard";
import { DetailCard, type SheetSnap } from "@/features/restaurants/DetailCard";
import { Onboarding, hasSeenOnboarding } from "@/components/onboarding/Onboarding";

import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import newTabAsset from "@/assets/tabs/new.png.asset.json";

const NewStickerIcon = ({ size = 20 }: { size?: number }) => (
  <img
    src={newTabAsset.url}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    draggable={false}
    className="object-contain select-none pointer-events-none"
    style={{ width: size, height: size, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
  />
);

const CUISINE_ORDER: Cuisine[] = [
  "french",
  "italian",
  "chinese",
  "japanese",
  "indian",
  "mexican",
  "thai",
  "spanish",
  "greek",
  "american",
  "vegetarian",
];

const DEFAULT_CENTER = { lat: 43.6047, lng: 1.4442 }; // Toulouse
const DEFAULT_ZOOM = 13;
const CITY_ZOOM = 13;
// Below this zoom level, restaurant markers are clustered to keep the map readable.
const CLUSTER_ZOOM = 12.5;
/** Hard cap on simultaneously drawn markers — mobile DOM cost control. */
const MAX_MARKERS = 220;

/** Cuisine shortcuts kept visible; the full list lives behind “Plus”. */
const PRIMARY_CUISINES: Cuisine[] = ["italian", "japanese", "mexican"];

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
  const [listMode, setListMode] = useState<
    null | "all" | "done" | "favorites" | "new" | "profile" | "mymap"
  >(null);
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

  const currentCity = useMemo(() => CITIES.find((c) => c.key === city) ?? null, [city]);

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
    mutationFn: (vars: {
      south: number;
      west: number;
      north: number;
      east: number;
      minRating: number;
    }) => searchArea({ data: vars }),
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
      list = list.filter((r) => matchesCuisine(r.cuisines, cuisine));
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
    return [...baseFiltered].sort((a, b) =>
      sortRestaurants(a, b, sortBy, userLocation, currentCity),
    );
  }, [baseFiltered, sortBy, userLocation, currentCity]);

  // Refs let the map layer read fresh data without re-rendering React on pan.
  const visitsRef = useRef(visits);
  visitsRef.current = visits;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;
  const cuisineRef = useRef<Cuisine>(cuisine);
  cuisineRef.current = cuisine;
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
    map.addListener("click", () => {
      setSelected(null);
      setDetailOpen(false);
    });
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
          const comp = r.address_components?.find((c) => c.types.some((t) => wanted.includes(t)));
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
    // Icon derives from the SAME classification the filter uses; when a
    // cuisine is active and this place matches it, the icon is that cuisine.
    const cuisineKey = pickCuisine(r.cuisines, cuisineRef.current);
    return {
      cuisine: cuisineKey,
      state,
      active,
      isNew: isNewRestaurant(r),
      dataUrl: cuisineUrlsRef.current?.[cuisineKey],
      inner: cuisineInnerSvg(r.cuisines, cuisineRef.current),
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
        singles = [...singles].sort((a, b) => score(b) - score(a)).slice(0, MAX_MARKERS);
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
    <div className="tm-map-home h-dvh w-full relative overflow-hidden bg-background">
      <h1 className="sr-only">Tastemap — votre carte des meilleurs restaurants en France</h1>

      {/* Full-screen map background */}
      <div
        ref={mapRef}
        className="absolute inset-0 touch-pan-y touch-pan-x"
        style={{ backgroundColor: "#f5f5f0" }}
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
            onClick={() => {
              haptic(20);
              searchThisArea();
            }}
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
              className="rounded-full bg-primary text-primary-foreground font-extrabold text-xs px-3 py-2 shadow-sm active:translate-y-[1px]"
              onClick={() => city && mutation.mutate({ city, minRating, force: true })}
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Genuinely empty result set — distinct from an error */}
      {mapReady &&
        !loadError &&
        !isLoadingRestaurants &&
        city &&
        results.length > 0 &&
        filtered.length === 0 && (
          <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-md px-4 py-3 text-sm text-muted-foreground max-w-[320px] text-center">
              Aucun restaurant ici. Déplacez la carte ou changez vos filtres.
            </div>
          </div>
        )}

      {/* Top bar — city, neighbourhood context, Discover, cuisine shortcuts */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-[env(safe-area-inset-top)] pointer-events-none">
        <div className="mx-auto max-w-3xl px-3 pt-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                haptic();
                setShowCities((v) => !v);
              }}
              className="tm-chip min-w-0 flex-1 sm:flex-none shadow-float"
              aria-label="Changer de ville"
              aria-expanded={showCities}
            >
              <MapPin className="h-4 w-4 text-brand-ink" />
              <span className="truncate">{currentCity?.label ?? "Choisir une ville"}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showCities ? "rotate-180" : ""}`}
              />
            </button>

            {/* Primary: the user's own map. Discovery is the secondary action. */}
            <button
              onClick={() => {
                haptic(20);
                setShowFilters(false);
                setListMode("mymap");
              }}
              className="tm-chip border-transparent bg-primary text-primary-foreground hover:bg-primary/90 shadow-float"
            >
              <MapPin className="h-4 w-4" />
              Ma carte<span className="hidden sm:inline"> food</span>
              {personalCount > 0 && (
                <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-xs font-extrabold">
                  {personalCount}
                </span>
              )}
            </button>

            <div className="tm-auth shrink-0 rounded-full bg-card border border-border shadow-float sm:ml-auto">
              <AuthButton />
            </div>

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
                  onClick={() => {
                    haptic(20);
                    setCity(c.key);
                    setShowCities(false);
                  }}
                  className={`h-11 px-4 rounded-full text-sm font-bold transition ${
                    c.key === city
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-foreground/80 hover:bg-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Cuisine shortcuts — compact, full list behind “+” */}
          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar px-1 py-1 -mx-1">
            <button
              onClick={() => {
                haptic(20);
                setShowFilters(false);
                setListMode("new");
              }}
              className="tm-chip"
            >
              <NewStickerIcon size={20} />
              Découvrir
            </button>

            <button
              onClick={() => {
                haptic();
                setCuisine("any");
              }}
              aria-pressed={cuisine === "any"}
              className="tm-chip"
            >
              Tout
            </button>
            {visibleCuisines.map((value) => {
              const meta = CUISINE_META[value];
              const active = value === cuisine;
              return (
                <button
                  key={value}
                  onClick={() => {
                    haptic();
                    setCuisine(active ? "any" : value);
                  }}
                  aria-pressed={active}
                  className="tm-chip pl-2"
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
              onClick={() => {
                haptic();
                setShowAllCuisines((v) => !v);
              }}
              aria-label="Toutes les cuisines"
              aria-expanded={showAllCuisines}
              className="tm-chip"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showAllCuisines ? "rotate-180" : ""}`}
              />
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
                    onClick={() => {
                      haptic();
                      setCuisine(active ? "any" : value);
                      setShowAllCuisines(false);
                    }}
                    className={`inline-flex flex-col items-center justify-center gap-0.5 h-[70px] rounded-xl transition ${
                      active
                        ? "bg-saved-surface ring-1 ring-saved-foreground text-saved-foreground"
                        : "hover:bg-muted/60"
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
      {neighborhood && !selected && !showLegend && (
        <div className="sm:hidden absolute left-3 right-28 bottom-4 z-20 flex justify-center pointer-events-none">
          <span className="rounded-full bg-white/80 backdrop-blur border border-white/60 shadow-sm px-3.5 py-1.5 text-xs font-bold text-foreground/70">
            {neighborhood}
          </span>
        </div>
      )}

      {/* Compact map legend — disappears as soon as the map becomes personal */}
      {mapReady && showLegend && !selected && (
        <div className="absolute left-3 right-28 sm:right-auto bottom-3 z-20 pb-[env(safe-area-inset-bottom)]">
          <div className="tm-card px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 animate-pop-in">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-white border border-[#85887d]" />À
              explorer
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-saved-foreground">
              <Heart className="h-3.5 w-3.5 fill-saved stroke-saved-foreground" />
              Enregistré
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-visited-foreground">
              <span className="h-3.5 w-3.5 rounded-full bg-visited grid place-items-center">
                <Check className="h-2.5 w-2.5 text-visited-foreground" strokeWidth={4} />
              </span>
              Découvert
            </span>
            <button
              onClick={dismissLegend}
              aria-label="Masquer la légende"
              className="h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:bg-muted -mr-1 ml-auto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating action buttons — bottom right */}
      <div
        className={`absolute right-3 z-30 grid grid-cols-2 gap-1.5 pb-[env(safe-area-inset-bottom)] transition-[bottom] duration-300 ease-out ${
          selected
            ? !detailOpen
              ? "bottom-[calc(212px+env(safe-area-inset-bottom))] lg:bottom-3"
              : sheetSnap === "collapsed"
                ? "bottom-[142px] lg:bottom-3"
                : sheetSnap === "expanded"
                  ? "bottom-[calc(86vh+16px)] lg:bottom-3"
                  : "bottom-[calc(52vh+16px)] lg:bottom-3"
            : "bottom-3"
        }`}
      >
        <button
          onClick={() => {
            haptic(20);
            setShowFilters(false);
            setListMode("profile");
          }}
          aria-label="Mon profil food"
          className="tm-map-action shadow-float"
        >
          <User className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            haptic(20);
            const target =
              userLocation ?? (currentCity ? { lat: currentCity.lat, lng: currentCity.lng } : null);
            if (!target || !mapInstance.current) return;
            mapInstance.current.panTo(target);
            mapInstance.current.setZoom(userLocation ? 15 : CITY_ZOOM);
          }}
          aria-label="Ma position"
          className="tm-map-action shadow-float"
        >
          <Navigation className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            haptic(20);
            setListMode(null);
            setShowFilters(true);
          }}
          aria-label="Filtres"
          className="tm-map-action shadow-float bg-primary text-primary-foreground border-transparent hover:bg-primary/90"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            haptic(20);
            setShowFilters(false);
            setListMode("favorites");
          }}
          aria-label="Enregistrés"
          className="tm-map-action shadow-float text-saved-foreground"
        >
          <Heart className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            haptic(20);
            setShowFilters(false);
            setListMode("done");
          }}
          aria-label="Restaurants faits"
          className="tm-map-action shadow-float text-visited-foreground"
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>
        <button
          onClick={() => {
            haptic(20);
            setShowFilters(false);
            setListMode("all");
          }}
          aria-label="Liste des restaurants"
          className="tm-map-action shadow-float"
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
                onClick={() => {
                  haptic();
                  setShowFilters(false);
                }}
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
                    aria-label="Rechercher un restaurant"
                    className="pl-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Ville
                </h3>
                <select
                  aria-label="Choisir une ville"
                  value={city ?? ""}
                  onChange={(e) => setCity((e.target.value || null) as CityKey | null)}
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
                  aria-label="Trier par"
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
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Recherche…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Actualiser
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  haptic(20);
                  setShowFilters(false);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-primary text-primary-foreground btn-pop hover:brightness-105 tap-bounce transition"
              >
                Voir la carte
              </button>
            </div>
          </div>
        </>
      )}

      {/* List overlay */}
      {listMode &&
        listMode !== "profile" &&
        (() => {
          const listItems =
            listMode === "done"
              ? filtered.filter((r) => visits[r.id]?.done)
              : listMode === "favorites"
                ? filtered.filter((r) => visits[r.id]?.favorite)
                : listMode === "mymap"
                  ? results
                      .filter((r) => visits[r.id]?.done || visits[r.id]?.favorite)
                      // Discovered first, then saved: the map's own hierarchy.
                      .sort((a, b) => Number(!!visits[b.id]?.done) - Number(!!visits[a.id]?.done))
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
                    {titleIcon}
                    {listTitle}{" "}
                    <span className="text-muted-foreground font-semibold">
                      · {listItems.length}
                    </span>
                  </h2>
                  <button
                    onClick={() => {
                      haptic();
                      setListMode(null);
                    }}
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
                            : listMode === "mymap"
                              ? "Ta carte est encore vierge. Touche un resto sur la carte et enregistre-le."
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
                            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-visited text-visited-foreground grid place-items-center ring-2 ring-card animate-pop-in">
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
                                favorite
                                  ? "fill-saved text-saved-foreground"
                                  : "text-muted-foreground"
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

      {/* Profile — who I am as an explorer. No map, no restaurant lists here. */}
      {listMode === "profile" && (
        <ProfilePanel
          restaurants={results}
          visits={visits}
          cityLabel={currentCity?.label ?? ""}
          email={user?.email ?? null}
          onClose={() => setListMode(null)}
          onOpenMap={() => setListMode("mymap")}
        />
      )}

      {/* Quick actions — the primary way to build the personal map */}
      {selected && !detailOpen && (
        <QuickCard
          preferredCuisine={cuisine}
          key={`quick-${selected.id}`}
          restaurant={selected}
          visit={visits[selected.id] ?? { done: false, comment: "", favorite: false }}
          onUpdate={(patch) => applyVisit(selected.id, patch)}
          onDetails={() => {
            haptic();
            setDetailOpen(true);
          }}
          onClose={() => {
            haptic();
            setSelected(null);
          }}
        />
      )}

      {/* Detail sheet — secondary, opt-in */}
      {selected && detailOpen && (
        <DetailCard
          preferredCuisine={cuisine}
          key={selected.id}
          restaurant={selected}
          visit={visits[selected.id] ?? { done: false, comment: "", favorite: false }}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          distanceKm={
            userLocation || currentCity
              ? haversineDistance(
                  userLocation ?? { lat: currentCity!.lat, lng: currentCity!.lng },
                  selected,
                )
              : null
          }
          fromUser={!!userLocation}
          onUpdate={(patch) => applyVisit(selected.id, patch)}
          onClose={() => {
            setDetailOpen(false);
            setSelected(null);
          }}
        />
      )}

      <WelcomeGate />
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
/**
 * First-run gate: a 3-screen concept intro, skippable, shown once. It never
 * picks a cuisine and never gates the map beyond the intro.
 */
function WelcomeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (hasSeenOnboarding()) return;
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;
  return <Onboarding onDone={() => setShow(false)} />;
}

/**
 * Profile — "who I am as a food explorer": identity and statistics only.
 * The exploration itself (map + saved/discovered places) lives in Ma carte.
 */
// Restrained map geography: food markers and personal states carry the color.
const minimalMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f0" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#62645c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f0" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative.neighborhood",
    elementType: "labels.text.fill",
    stylers: [{ color: "#71746b" }, { visibility: "on" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#33362e" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e6eddf" }, { visibility: "on" }],
  },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e3e5dd" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f0" }, { visibility: "simplified" }],
  },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "on" }] },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#71746b" }],
  },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#eeede5" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#d8dacf" }] },
  { featureType: "road.highway", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#62645c" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f0" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#eef0e8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dcecf2" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
];
