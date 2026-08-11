// Server-only place data layer.
// Reads Tastemap's persistent identity layer (`places`) + the expiring Google
// cache (`places_cache`), and only calls Google when the cache is cold.
import {
  type CityDef,
  type CityKey,
  type Cuisine,
  type Restaurant,
} from "./places.shared";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

/** Google content may be cached for at most 30 days. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Re-run the full city index when everything we hold is older than this. */
const INDEX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Max stale rows refreshed (Place Details) in a single request. */
const MAX_DETAIL_REFRESH = 60;
/** Result cap returned to the UI — unchanged from the previous behaviour. */
const RESULT_LIMIT = 100;

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

type Period = {
  open?: { day?: number; hour?: number; minute?: number };
  close?: { day?: number; hour?: number; minute?: number };
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
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
    periods?: Period[];
  };
  reservable?: boolean;
  photos?: Array<{ name: string }>;
};

/**
 * Cached Google content. `openNow` is never stored — it is derived from the
 * cached opening periods at read time. Photo bytes are never stored either;
 * only the resource name, which is proxied live.
 */
export interface CachePayload {
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
  reservable: boolean | null;
  weekdayDescriptions: string[];
  periods: Period[];
  photoNames: string[];
  cuisines: Cuisine[];
}

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "googleMapsUri",
  "websiteUri",
  "nationalPhoneNumber",
  "editorialSummary",
  "generativeSummary",
  "regularOpeningHours",
  "reservable",
  "photos",
];

const SEARCH_FIELD_MASK = [
  ...DETAIL_FIELDS.map((f) => `places.${f}`),
  "nextPageToken",
].join(",");

function auth() {
  const lov = process.env['LOVABLE_API_KEY'];
  const key = process.env['GOOGLE_MAPS_API_KEY'];
  if (!lov || !key) throw new Error("Google Maps connector is not configured");
  return { lov, key };
}

function broadQueries(cityLabel: string): string[] {
  return [
    `meilleurs restaurants à ${cityLabel}`,
    `restaurants gastronomiques ${cityLabel}`,
    `bistrots brasseries ${cityLabel}`,
  ];
}

async function fetchPage(
  textQuery: string,
  pageToken: string | undefined,
  city: CityDef,
) {
  const { lov, key } = auth();
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
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lov}`,
      "X-Connection-Api-Key": key,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
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

/** Returns the raw place, or `null` when Google reports it as gone. */
async function fetchPlaceDetails(placeId: string): Promise<PlaceRaw | null> {
  const { lov, key } = auth();
  const res = await fetch(
    `${GATEWAY}/places/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        Authorization: `Bearer ${lov}`,
        "X-Connection-Api-Key": key,
        "X-Goog-FieldMask": DETAIL_FIELDS.join(","),
      },
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    console.error(`Place details failed [${res.status}]: ${text}`);
    throw new Error(`Place details failed: ${res.status}`);
  }
  return (await res.json()) as PlaceRaw;
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

function toPayload(p: PlaceRaw): CachePayload | null {
  if (!p.location) return null;
  return {
    name: p.displayName?.text ?? "Sans nom",
    address: p.formattedAddress ?? "",
    lat: p.location.latitude,
    lng: p.location.longitude,
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ?? null,
    primaryType: p.primaryTypeDisplayName?.text ?? null,
    primaryTypeKey: p.primaryType ?? null,
    googleMapsUri: p.googleMapsUri ?? null,
    websiteUri: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    summary:
      p.editorialSummary?.text ?? p.generativeSummary?.overview?.text ?? null,
    reservable: p.reservable ?? null,
    weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions ?? [],
    periods: p.regularOpeningHours?.periods ?? [],
    photoNames: (p.photos ?? []).slice(0, 6).map((ph) => ph.name),
    cuisines: detectCuisines(p),
  };
}

/** Derives "open now" from cached opening periods (French local time). */
function computeOpenNow(periods: Period[]): boolean | null {
  if (!periods.length) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = days.indexOf(get("weekday"));
  if (day < 0) return null;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const now = day * 1440 + minutes;

  for (const p of periods) {
    if (p.open?.day == null) continue;
    const start = p.open.day * 1440 + (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0);
    if (p.close?.day == null) return true; // open 24/7
    let end = p.close.day * 1440 + (p.close.hour ?? 0) * 60 + (p.close.minute ?? 0);
    if (end <= start) end += 7 * 1440; // wraps past midnight / end of week
    if (now >= start && now < end) return true;
    if (now + 7 * 1440 >= start && now + 7 * 1440 < end) return true;
  }
  return false;
}

export function payloadToRestaurant(placeId: string, payload: CachePayload): Restaurant {
  return {
    id: placeId,
    name: payload.name,
    address: payload.address,
    lat: payload.lat,
    lng: payload.lng,
    rating: payload.rating,
    userRatingCount: payload.userRatingCount,
    priceLevel: payload.priceLevel,
    primaryType: payload.primaryType,
    primaryTypeKey: payload.primaryTypeKey,
    googleMapsUri: payload.googleMapsUri,
    websiteUri: payload.websiteUri,
    phone: payload.phone,
    summary: payload.summary,
    openNow: computeOpenNow(payload.periods ?? []),
    reservable: payload.reservable,
    weekdayDescriptions: payload.weekdayDescriptions ?? [],
    photoUrls: (payload.photoNames ?? []).map(
      (name) => `/api/public/place-photo?name=${encodeURIComponent(name)}`,
    ),
    cuisines: payload.cuisines ?? [],
  };
}

function geoCell(lat: number, lng: number): string {
  return `${Math.floor(lat / 0.01)}:${Math.floor(lng / 0.01)}`;
}

type Admin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function cityRow(db: Admin, key: CityKey) {
  const { data, error } = await db
    .from("cities")
    .select("id, key, label, lat, lng, radius")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Persists identity + expiring cache for a batch of Google results. */
async function persist(db: Admin, cityId: string, raws: PlaceRaw[]) {
  const now = new Date();
  const placeRows: Array<{
    place_id: string;
    city_id: string;
    geo_cell: string;
    status: string;
    last_refreshed_at: string;
  }> = [];
  const cacheRows: Array<{
    place_id: string;
    payload: CachePayload;
    fetched_at: string;
    expires_at: string;
    rating_fetched_at: string;
  }> = [];
  const tagRows: Array<{
    place_id: string;
    tag: string;
    source: string;
    confidence: number;
  }> = [];

  for (const raw of raws) {
    const payload = toPayload(raw);
    if (!payload || !raw.id) continue;
    placeRows.push({
      place_id: raw.id,
      city_id: cityId,
      geo_cell: geoCell(payload.lat, payload.lng),
      status: "active",
      last_refreshed_at: now.toISOString(),
    });
    cacheRows.push({
      place_id: raw.id,
      payload,
      fetched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
      rating_fetched_at: now.toISOString(),
    });
    for (const tag of payload.cuisines) {
      tagRows.push({ place_id: raw.id, tag, source: "google_types", confidence: 1 });
    }
  }
  if (!placeRows.length) return;

  const { error: pErr } = await db.from("places").upsert(placeRows, { onConflict: "place_id" });
  if (pErr) throw new Error(pErr.message);
  const { error: cErr } = await db
    .from("places_cache")
    .upsert(
      cacheRows.map((r) => ({ ...r, payload: r.payload as unknown as never })),
      { onConflict: "place_id" },
    );
  if (cErr) throw new Error(cErr.message);
  if (tagRows.length) {
    await db.from("place_tags").upsert(tagRows, { onConflict: "place_id,tag,source" });
  }
}

/** Full Google index of a city (text search sweep). */
async function indexCity(db: Admin, cityId: string, city: CityDef) {
  const pool = new Map<string, PlaceRaw>();

  const runQuery = async (query: string, maxPages: number) => {
    let token: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      try {
        const page = await fetchPage(query, token, city);
        for (const p of page.places ?? []) if (p.id) pool.set(p.id, p);
        if (!page.nextPageToken) break;
        token = page.nextPageToken;
      } catch (e) {
        console.error(`Query failed: "${query}"`, e);
        break;
      }
    }
  };

  const jobs: Array<{ q: string; pages: number }> = [
    ...broadQueries(city.label).map((q) => ({ q, pages: 2 })),
    ...Object.values(CUISINE_LABEL).map((label) => ({
      q: `restaurants ${label} à ${city.label}`,
      pages: 1,
    })),
  ];

  let i = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (i < jobs.length) {
        const job = jobs[i++];
        await runQuery(job.q, job.pages);
      }
    }),
  );

  if (!pool.size) throw new Error("Google returned no results for this city");
  await persist(db, cityId, Array.from(pool.values()));
}

/** Refreshes expired rows one by one; NOT_FOUND marks the place as gone. */
async function refreshStale(db: Admin, cityId: string, placeIds: string[]) {
  const ids = placeIds.slice(0, MAX_DETAIL_REFRESH);
  const fresh: PlaceRaw[] = [];
  const gone: string[] = [];

  let i = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (i < ids.length) {
        const id = ids[i++];
        try {
          const raw = await fetchPlaceDetails(id);
          if (raw === null) gone.push(id);
          else fresh.push({ ...raw, id });
        } catch (e) {
          console.error(`[refreshStale] ${id}`, e);
        }
      }
    }),
  );

  if (gone.length) {
    // Never delete: the place and every user's history are preserved.
    await db
      .from("places")
      .update({ status: "gone", last_refreshed_at: new Date().toISOString() })
      .in("place_id", gone);
  }
  if (fresh.length) await persist(db, cityId, fresh);
}

function rank(list: Restaurant[]): Restaurant[] {
  const hiddenGems = list
    .filter(
      (r) =>
        (r.rating ?? 0) >= 4.5 &&
        r.userRatingCount != null &&
        r.userRatingCount > 0 &&
        r.userRatingCount < 80,
    )
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const gemIds = new Set(hiddenGems.map((r) => r.id));
  const popular = list
    .filter((r) => !gemIds.has(r.id))
    .sort((a, b) => {
      const score = (r: Restaurant) =>
        (r.rating ?? 0) * Math.log10((r.userRatingCount ?? 0) + 10);
      return score(b) - score(a);
    })
    .slice(0, RESULT_LIMIT - hiddenGems.length);

  return [...popular, ...hiddenGems];
}

async function readCity(db: Admin, cityId: string) {
  const { data: places, error } = await db
    .from("places")
    .select("place_id, last_refreshed_at")
    .eq("city_id", cityId)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const ids = (places ?? []).map((p) => p.place_id);
  const cacheByPlace = new Map<string, CachePayload>();
  if (ids.length) {
    const nowIso = new Date().toISOString();
    for (let i = 0; i < ids.length; i += 500) {
      const { data: rows, error: cErr } = await db
        .from("places_cache")
        .select("place_id, payload")
        .in("place_id", ids.slice(i, i + 500))
        .gt("expires_at", nowIso);
      if (cErr) throw new Error(cErr.message);
      for (const row of rows ?? []) {
        cacheByPlace.set(row.place_id, row.payload as unknown as CachePayload);
      }
    }
  }

  const newest = (places ?? []).reduce<number>((max, p) => {
    const t = p.last_refreshed_at ? Date.parse(p.last_refreshed_at) : 0;
    return t > max ? t : max;
  }, 0);

  return {
    ids,
    cacheByPlace,
    stale: ids.filter((id) => !cacheByPlace.has(id)),
    indexAgeMs: newest ? Date.now() - newest : Infinity,
  };
}

export async function loadCityRestaurants(
  cityKey: CityKey,
  minRating: number,
  force: boolean,
): Promise<Restaurant[]> {
  const db = await admin();
  const city = await cityRow(db, cityKey);
  if (!city) throw new Error(`Unknown city: ${cityKey}`);
  const cityDef: CityDef = {
    key: cityKey,
    label: city.label,
    lat: city.lat,
    lng: city.lng,
    radius: city.radius,
  };

  let state = await readCity(db, city.id);

  const needsIndex =
    force || state.ids.length === 0 || state.indexAgeMs > INDEX_TTL_MS;

  if (needsIndex || state.stale.length > 0) {
    try {
      if (needsIndex) await indexCity(db, city.id, cityDef);
      else await refreshStale(db, city.id, state.stale);
      state = await readCity(db, city.id);
    } catch (e) {
      // Google is down or misconfigured: serve whatever is still valid rather
      // than an empty map. With nothing valid, surface the error.
      console.error("[loadCityRestaurants] Google refresh failed", e);
      if (state.cacheByPlace.size === 0) {
        throw new Error(
          "Impossible de charger les restaurants pour le moment. Réessayez dans un instant.",
        );
      }
    }
  }

  const restaurants: Restaurant[] = [];
  for (const [placeId, payload] of state.cacheByPlace) {
    const r = payloadToRestaurant(placeId, payload);
    if (minRating > 0 && (r.rating ?? 0) < minRating) continue;
    restaurants.push(r);
  }

  if (!restaurants.length) {
    throw new Error(
      "Impossible de charger les restaurants pour le moment. Réessayez dans un instant.",
    );
  }

  return rank(restaurants);
}
