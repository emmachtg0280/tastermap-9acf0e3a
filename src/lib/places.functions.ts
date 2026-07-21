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
  googleMapsUri: string | null;
  websiteUri: string | null;
  phone: string | null;
  summary: string | null;
  openNow: boolean | null;
  reservable: boolean | null;
  weekdayDescriptions: string[];
  photoUrls: string[];
}

// Top 20 French cities (by population).
export const FRENCH_CITIES = [
  { key: "paris", label: "Paris", lat: 48.8566, lng: 2.3522 },
  { key: "marseille", label: "Marseille", lat: 43.2965, lng: 5.3698 },
  { key: "lyon", label: "Lyon", lat: 45.7640, lng: 4.8357 },
  { key: "toulouse", label: "Toulouse", lat: 43.6047, lng: 1.4442 },
  { key: "nice", label: "Nice", lat: 43.7102, lng: 7.2620 },
  { key: "nantes", label: "Nantes", lat: 47.2184, lng: -1.5536 },
  { key: "montpellier", label: "Montpellier", lat: 43.6108, lng: 3.8767 },
  { key: "strasbourg", label: "Strasbourg", lat: 48.5734, lng: 7.7521 },
  { key: "bordeaux", label: "Bordeaux", lat: 44.8378, lng: -0.5792 },
  { key: "lille", label: "Lille", lat: 50.6292, lng: 3.0573 },
  { key: "rennes", label: "Rennes", lat: 48.1173, lng: -1.6778 },
  { key: "reims", label: "Reims", lat: 49.2583, lng: 4.0317 },
  { key: "saint-etienne", label: "Saint-Étienne", lat: 45.4397, lng: 4.3872 },
  { key: "toulon", label: "Toulon", lat: 43.1242, lng: 5.9280 },
  { key: "le-havre", label: "Le Havre", lat: 49.4944, lng: 0.1079 },
  { key: "grenoble", label: "Grenoble", lat: 45.1885, lng: 5.7245 },
  { key: "dijon", label: "Dijon", lat: 47.3220, lng: 5.0415 },
  { key: "angers", label: "Angers", lat: 47.4784, lng: -0.5632 },
  { key: "nimes", label: "Nîmes", lat: 43.8367, lng: 4.3601 },
  { key: "villeurbanne", label: "Villeurbanne", lat: 45.7719, lng: 4.8902 },
] as const;

export type CityKey = (typeof FRENCH_CITIES)[number]["key"] | "all";

interface SearchInput {
  cuisine: Cuisine;
  minRating: number;
  city: CityKey;
}

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const CUISINE_LABEL: Record<Cuisine, string> = {
  any: "restaurants",
  italian: "restaurants italiens",
  french: "restaurants français",
  chinese: "restaurants chinois",
  japanese: "restaurants japonais",
  indian: "restaurants indiens",
  mexican: "restaurants mexicains",
  thai: "restaurants thaï",
  spanish: "restaurants espagnols",
  greek: "restaurants grecs",
  american: "restaurants américains",
  vegetarian: "restaurants végétariens",
};

type PlaceRaw = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text: string };
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
  "places.primaryTypeDisplayName",
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
  center: { lat: number; lng: number },
  radiusM: number,
  pageToken: string | undefined,
  auth: { lov: string; key: string },
) {
  const body: Record<string, unknown> = {
    textQuery,
    includedType: "restaurant",
    pageSize: 20,
    locationBias: {
      circle: {
        center: { latitude: center.lat, longitude: center.lng },
        radius: radiusM,
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

function toRestaurant(p: PlaceRaw): Restaurant {
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
  };
}

export const searchRestaurants = createServerFn({ method: "POST" })
  .inputValidator((input: SearchInput) => ({
    cuisine: (input?.cuisine ?? "any") as Cuisine,
    minRating: Math.max(0, Math.min(5, Number(input?.minRating ?? 0))),
    city: (input?.city ?? "toulouse") as CityKey,
  }))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps connector is not configured");
    }
    const auth = { lov: LOVABLE_API_KEY, key: GOOGLE_MAPS_API_KEY };
    const cuisineLabel = CUISINE_LABEL[data.cuisine];

    // "all" → top 10 of each of the 20 largest French cities.
    if (data.city === "all") {
      const seen = new Map<string, PlaceRaw>();
      const results = await Promise.all(
        FRENCH_CITIES.map((c) =>
          fetchPage(
            `meilleurs ${cuisineLabel} à ${c.label}`,
            data.minRating,
            { lat: c.lat, lng: c.lng },
            15000,
            undefined,
            auth,
          ).catch((e) => {
            console.error(`City fetch failed for ${c.label}`, e);
            return { places: [] as PlaceRaw[] };
          }),
        ),
      );
      results.forEach((page) => {
        const top = (page.places ?? [])
          .filter((p) => p.location)
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, 10);
        for (const p of top) if (p.id) seen.set(p.id, p);
      });
      return Array.from(seen.values()).map(toRestaurant);
    }

    // Single city: paginate up to 3 pages for a broader set.
    const cityEntry =
      FRENCH_CITIES.find((c) => c.key === data.city) ?? FRENCH_CITIES[3];
    const query = `${cuisineLabel} à ${cityEntry.label}`;
    const seen = new Map<string, PlaceRaw>();
    let token: string | undefined;
    for (let i = 0; i < 3; i++) {
      const page: { places?: PlaceRaw[]; nextPageToken?: string } =
        await fetchPage(
          query,
          data.minRating,
          { lat: cityEntry.lat, lng: cityEntry.lng },
          8000,
          token,
          auth,
        );
      for (const p of page.places ?? []) if (p.id) seen.set(p.id, p);
      if (!page.nextPageToken || seen.size >= 60) break;
      token = page.nextPageToken;
    }

    return Array.from(seen.values())
      .filter((p) => p.location)
      .map(toRestaurant);
  });
