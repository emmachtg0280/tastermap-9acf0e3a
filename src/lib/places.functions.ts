import { createServerFn } from "@tanstack/react-start";

export type Cuisine =
  | "any"
  | "italian"
  | "french"
  | "chinese"
  | "japanese"
  | "indian"
  | "mexican"
  | "thai"
  | "spanish"
  | "greek"
  | "american"
  | "vegetarian";

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  primaryType: string | null;
  primaryTypeKey: string | null;
  googleMapsUri: string | null;
  websiteUri: string | null;
  phone: string | null;
  summary: string | null;
  openNow: boolean | null;
  reservable: boolean | null;
  weekdayDescriptions: string[];
  photoUrls: string[];
  cuisines: Cuisine[];
}

// Kept exported for backwards compatibility with imports; unused now.
export const FRENCH_CITIES = [
  { key: "toulouse", label: "Toulouse", lat: 43.6047, lng: 1.4442 },
] as const;

export type CityKey = "toulouse";

const TOULOUSE = { lat: 43.6047, lng: 1.4442 };
const RADIUS_M = 9000;
const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const CUISINE_QUERIES: Record<Exclude<Cuisine, "any">, string> = {
  french: "restaurants français à Toulouse",
  italian: "restaurants italiens à Toulouse",
  chinese: "restaurants chinois à Toulouse",
  japanese: "restaurants japonais à Toulouse",
  indian: "restaurants indiens à Toulouse",
  mexican: "restaurants mexicains à Toulouse",
  thai: "restaurants thaï à Toulouse",
  spanish: "restaurants espagnols à Toulouse",
  greek: "restaurants grecs à Toulouse",
  american: "restaurants américains burgers à Toulouse",
  vegetarian: "restaurants végétariens à Toulouse",
};

// Broad queries to reach a large pool (~300).
const BROAD_QUERIES = [
  "meilleurs restaurants à Toulouse",
  "restaurants gastronomiques Toulouse",
  "bistrots Toulouse",
  "brasseries Toulouse",
  "restaurants centre-ville Toulouse",
  "restaurants Capitole Toulouse",
  "restaurants Saint-Cyprien Toulouse",
  "restaurants Carmes Toulouse",
];

// Map Google primaryType → our cuisine key.
const PRIMARY_TYPE_TO_CUISINE: Record<string, Cuisine> = {
  italian_restaurant: "italian",
  french_restaurant: "french",
  chinese_restaurant: "chinese",
  japanese_restaurant: "japanese",
  sushi_restaurant: "japanese",
  ramen_restaurant: "japanese",
  indian_restaurant: "indian",
  mexican_restaurant: "mexican",
  thai_restaurant: "thai",
  spanish_restaurant: "spanish",
  tapas_restaurant: "spanish",
  greek_restaurant: "greek",
  american_restaurant: "american",
  hamburger_restaurant: "american",
  steak_house: "american",
  vegetarian_restaurant: "vegetarian",
  vegan_restaurant: "vegetarian",
};

type PlaceRaw = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  editorialSummary?: { text: string };
  generativeSummary?: { overview?: { text: string } };
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  reservable?: boolean;
  photos?: Array<{ name: string }>;
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.editorialSummary",
  "places.generativeSummary",
  "places.regularOpeningHours",
  "places.reservable",
  "places.photos",
  "nextPageToken",
].join(",");

async function fetchPage(
  textQuery: string,
  minRating: number,
  pageToken: string | undefined,
  auth: { lov: string; key: string },
) {
  const body: Record<string, unknown> = {
    textQuery,
    includedType: "restaurant",
    pageSize: 20,
    locationBias: {
      circle: {
        center: { latitude: TOULOUSE.lat, longitude: TOULOUSE.lng },
        radius: RADIUS_M,
      },
    },
  };
  if (minRating > 0) body.minRating = minRating;
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.lov}`,
      "X-Connection-Api-Key": auth.key,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Places searchText failed [${res.status}]: ${text}`);
    throw new Error(`Places search failed: ${res.status}`);
  }
  return (await res.json()) as { places?: PlaceRaw[]; nextPageToken?: string };
}

function detectCuisines(p: PlaceRaw, sourceCuisine: Cuisine | null): Cuisine[] {
  const set = new Set<Cuisine>();
  if (sourceCuisine && sourceCuisine !== "any") set.add(sourceCuisine);
  const candidates = [p.primaryType, ...(p.types ?? [])].filter(Boolean) as string[];
  for (const t of candidates) {
    const c = PRIMARY_TYPE_TO_CUISINE[t];
    if (c) set.add(c);
  }
  return Array.from(set);
}

function toRestaurant(p: PlaceRaw, cuisines: Cuisine[]): Restaurant {
  return {
    id: p.id,
    name: p.displayName?.text ?? "Sans nom",
    address: p.formattedAddress ?? "",
    lat: p.location!.latitude,
    lng: p.location!.longitude,
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ?? null,
    primaryType: p.primaryTypeDisplayName?.text ?? null,
    primaryTypeKey: p.primaryType ?? null,
    googleMapsUri: p.googleMapsUri ?? null,
    websiteUri: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    summary:
      p.editorialSummary?.text ??
      p.generativeSummary?.overview?.text ??
      null,
    openNow: p.regularOpeningHours?.openNow ?? null,
    reservable: p.reservable ?? null,
    weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions ?? [],
    photoUrls: (p.photos ?? [])
      .slice(0, 6)
      .map(
        (ph) => `/api/public/place-photo?name=${encodeURIComponent(ph.name)}`,
      ),
    cuisines,
  };
}

// Module-level cache: minRating → { at, results }
const CACHE = new Map<number, { at: number; data: Restaurant[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SearchInput {
  minRating: number;
  force?: boolean;
}

export const searchRestaurants = createServerFn({ method: "POST" })
  .inputValidator((input: SearchInput) => ({
    minRating: Math.max(0, Math.min(5, Number(input?.minRating ?? 0))),
    force: Boolean(input?.force),
  }))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps connector is not configured");
    }
    const auth = { lov: LOVABLE_API_KEY, key: GOOGLE_MAPS_API_KEY };

    if (!data.force) {
      const cached = CACHE.get(data.minRating);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const pool = new Map<string, PlaceRaw>();
    const sources = new Map<string, Set<Cuisine>>();

    const tag = (p: PlaceRaw, src: Cuisine | null) => {
      if (!p.id) return;
      pool.set(p.id, p);
      if (src && src !== "any") {
        const s = sources.get(p.id) ?? new Set<Cuisine>();
        s.add(src);
        sources.set(p.id, s);
      }
    };

    const TARGET = 140;

    const runQuery = async (
      query: string,
      src: Cuisine | null,
      maxPages: number,
    ) => {
      let token: string | undefined;
      for (let i = 0; i < maxPages; i++) {
        try {
          const page = await fetchPage(query, data.minRating, token, auth);
          for (const p of page.places ?? []) tag(p, src);
          if (!page.nextPageToken) break;
          token = page.nextPageToken;
          await sleep(120);
        } catch (e) {
          console.error(`Query failed: "${query}"`, e);
          break;
        }
        if (pool.size >= TARGET) return;
      }
    };

    for (const q of BROAD_QUERIES) {
      if (pool.size >= TARGET) break;
      await runQuery(q, null, 2);
      await sleep(120);
    }

    for (const [cuisine, q] of Object.entries(CUISINE_QUERIES) as [
      Cuisine,
      string,
    ][]) {
      await runQuery(q, cuisine, 1);
      await sleep(120);
    }

    const restaurants = Array.from(pool.values())
      .filter((p) => p.location)
      .map((p) => {
        const src = sources.get(p.id) ?? new Set<Cuisine>();
        return toRestaurant(p, detectCuisines(p, null).concat(Array.from(src)));
      })
      .map((r) => ({ ...r, cuisines: Array.from(new Set(r.cuisines)) }))
      .sort((a, b) => {
        const score = (r: Restaurant) =>
          (r.rating ?? 0) * Math.log10((r.userRatingCount ?? 0) + 10);
        return score(b) - score(a);
      })
      .slice(0, 100);

    CACHE.set(data.minRating, { at: Date.now(), data: restaurants });
    return restaurants;
  });
