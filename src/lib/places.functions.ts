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

export type CityKey =
  | "toulouse"
  | "montpellier"
  | "paris"
  | "lyon"
  | "marseille"
  | "bordeaux";

export interface CityDef {
  key: CityKey;
  label: string;
  lat: number;
  lng: number;
  radius: number;
}

export const CITIES: CityDef[] = [
  { key: "toulouse", label: "Toulouse", lat: 43.6047, lng: 1.4442, radius: 9000 },
  { key: "montpellier", label: "Montpellier", lat: 43.6108, lng: 3.8767, radius: 8000 },
  { key: "paris", label: "Paris", lat: 48.8566, lng: 2.3522, radius: 10000 },
  { key: "lyon", label: "Lyon", lat: 45.7640, lng: 4.8357, radius: 9000 },
  { key: "marseille", label: "Marseille", lat: 43.2965, lng: 5.3698, radius: 10000 },
  { key: "bordeaux", label: "Bordeaux", lat: 44.8378, lng: -0.5792, radius: 8000 },
];

const CITY_BY_KEY: Record<CityKey, CityDef> = Object.fromEntries(
  CITIES.map((c) => [c.key, c]),
) as Record<CityKey, CityDef>;

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const CUISINE_LABEL: Record<Exclude<Cuisine, "any">, string> = {
  french: "français",
  italian: "italiens",
  chinese: "chinois",
  japanese: "japonais",
  indian: "indiens",
  mexican: "mexicains",
  thai: "thaï",
  spanish: "espagnols",
  greek: "grecs",
  american: "américains burgers",
  vegetarian: "végétariens",
};

function broadQueries(cityLabel: string): string[] {
  return [
    `meilleurs restaurants à ${cityLabel}`,
    `restaurants gastronomiques ${cityLabel}`,
    `bistrots brasseries ${cityLabel}`,
  ];
}

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
  city: CityDef,
  auth: { lov: string; key: string },
) {
  const body: Record<string, unknown> = {
    textQuery,
    includedType: "restaurant",
    pageSize: 20,
    locationBias: {
      circle: {
        center: { latitude: city.lat, longitude: city.lng },
        radius: city.radius,
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

function detectCuisines(p: PlaceRaw): Cuisine[] {
  const set = new Set<Cuisine>();
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

// Module-level cache keyed by `${city}:${minRating}`
const CACHE = new Map<string, { at: number; data: Restaurant[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

interface SearchInput {
  city: CityKey;
  minRating: number;
  force?: boolean;
}

export const searchRestaurants = createServerFn({ method: "POST" })
  .inputValidator((input: SearchInput) => {
    const cityKey = (input?.city ?? "toulouse") as CityKey;
    if (!CITY_BY_KEY[cityKey]) {
      throw new Error(`Unknown city: ${cityKey}`);
    }
    return {
      city: cityKey,
      minRating: Math.max(0, Math.min(5, Number(input?.minRating ?? 0))),
      force: Boolean(input?.force),
    };
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps connector is not configured");
    }
    const auth = { lov: LOVABLE_API_KEY, key: GOOGLE_MAPS_API_KEY };
    const city = CITY_BY_KEY[data.city];

    const cacheKey = `${data.city}:${data.minRating}`;
    if (!data.force) {
      const cached = CACHE.get(cacheKey);
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

    const runQuery = async (
      query: string,
      src: Cuisine | null,
      maxPages: number,
    ) => {
      let token: string | undefined;
      for (let i = 0; i < maxPages; i++) {
        try {
          const page = await fetchPage(query, data.minRating, token, city, auth);
          for (const p of page.places ?? []) tag(p, src);
          if (!page.nextPageToken) break;
          token = page.nextPageToken;
        } catch (e) {
          console.error(`Query failed: "${query}"`, e);
          break;
        }
      }
    };

    const runBatch = async (
      jobs: Array<{ q: string; src: Cuisine | null; pages: number }>,
      concurrency = 5,
    ) => {
      let i = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (i < jobs.length) {
          const job = jobs[i++];
          await runQuery(job.q, job.src, job.pages);
        }
      });
      await Promise.all(workers);
    };

    const jobs: Array<{ q: string; src: Cuisine | null; pages: number }> = [
      ...broadQueries(city.label).map((q) => ({
        q,
        src: null as Cuisine | null,
        pages: 2,
      })),
      ...(Object.entries(CUISINE_LABEL) as [Cuisine, string][]).map(
        ([cuisine, label]) => ({
          q: `restaurants ${label} à ${city.label}`,
          src: cuisine,
          pages: 1,
        }),
      ),
    ];
    await runBatch(jobs, 5);

    const restaurants = Array.from(pool.values())
      .filter((p) => p.location)
      .map((p) => {
        const src = sources.get(p.id) ?? new Set<Cuisine>();
        return toRestaurant(p, detectCuisines(p).concat(Array.from(src)));
      })
      .map((r) => ({ ...r, cuisines: Array.from(new Set(r.cuisines)) }))
      .sort((a, b) => {
        const score = (r: Restaurant) =>
          (r.rating ?? 0) * Math.log10((r.userRatingCount ?? 0) + 10);
        return score(b) - score(a);
      })
      .slice(0, 100);

    CACHE.set(cacheKey, { at: Date.now(), data: restaurants });
    return restaurants;
  });
