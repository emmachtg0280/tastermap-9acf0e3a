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
  photoUrls: string[];
}

interface SearchInput {
  cuisine: Cuisine;
  minRating: number;
}

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

// Toulouse city center
const TOULOUSE = { latitude: 43.6047, longitude: 1.4442 };
const TOULOUSE_RADIUS_M = 8000;

const CUISINE_QUERY: Record<Cuisine, string> = {
  any: "restaurants à Toulouse",
  italian: "restaurants italiens à Toulouse",
  french: "restaurants français à Toulouse",
  chinese: "restaurants chinois à Toulouse",
  japanese: "restaurants japonais à Toulouse",
  indian: "restaurants indiens à Toulouse",
  mexican: "restaurants mexicains à Toulouse",
  thai: "restaurants thaï à Toulouse",
  spanish: "restaurants espagnols à Toulouse",
  greek: "restaurants grecs à Toulouse",
  american: "restaurants américains à Toulouse",
  vegetarian: "restaurants végétariens à Toulouse",
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
  regularOpeningHours?: { openNow?: boolean };
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
  "places.regularOpeningHours.openNow",
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
      circle: { center: TOULOUSE, radius: TOULOUSE_RADIUS_M },
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

export const searchRestaurants = createServerFn({ method: "POST" })
  .inputValidator((input: SearchInput) => ({
    cuisine: (input?.cuisine ?? "any") as Cuisine,
    minRating: Math.max(0, Math.min(5, Number(input?.minRating ?? 0))),
  }))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps connector is not configured");
    }
    const auth = { lov: LOVABLE_API_KEY, key: GOOGLE_MAPS_API_KEY };
    const query = CUISINE_QUERY[data.cuisine];

    const seen = new Map<string, PlaceRaw>();
    let token: string | undefined = undefined;
    // Paginate up to 3 pages (Places caps at 60 total, 20/page).
    for (let i = 0; i < 3; i++) {
      const page: { places?: PlaceRaw[]; nextPageToken?: string } = await fetchPage(
        query,
        data.minRating,
        token,
        auth,
      );
      for (const p of page.places ?? []) if (p.id) seen.set(p.id, p);
      if (!page.nextPageToken || seen.size >= 60) break;
      token = page.nextPageToken;
    }

    // If still under 50 and cuisine is "any", broaden with a couple extra queries.
    if (data.cuisine === "any" && seen.size < 50) {
      for (const extra of ["meilleurs restaurants Toulouse", "bistrot Toulouse"]) {
        if (seen.size >= 60) break;
        const page = await fetchPage(extra, data.minRating, undefined, auth);
        for (const p of page.places ?? []) if (p.id) seen.set(p.id, p);
      }
    }

    const restaurants: Restaurant[] = Array.from(seen.values())
      .filter((p) => p.location)
      .map((p) => ({
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
        photoUrls: (p.photos ?? [])
          .slice(0, 6)
          .map(
            (ph) =>
              `/api/public/place-photo?name=${encodeURIComponent(ph.name)}`,
          ),
      }));

    return restaurants;
  });
