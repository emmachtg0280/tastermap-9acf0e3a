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
  photoUrl: string | null;
}

interface SearchInput {
  cuisine: Cuisine;
  minRating: number;
}

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const CUISINE_QUERY: Record<Cuisine, string> = {
  any: "restaurants in France",
  italian: "italian restaurants in France",
  french: "french restaurants in France",
  chinese: "chinese restaurants in France",
  japanese: "japanese restaurants in France",
  indian: "indian restaurants in France",
  mexican: "mexican restaurants in France",
  thai: "thai restaurants in France",
  spanish: "spanish restaurants in France",
  greek: "greek restaurants in France",
  american: "american restaurants in France",
  vegetarian: "vegetarian restaurants in France",
};

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

    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.location",
      "places.rating",
      "places.userRatingCount",
      "places.priceLevel",
      "places.primaryTypeDisplayName",
      "places.googleMapsUri",
      "places.photos",
    ].join(",");

    const body: Record<string, unknown> = {
      textQuery: CUISINE_QUERY[data.cuisine],
      includedType: "restaurant",
      maxResultCount: 20,
      locationBias: {
        rectangle: {
          low: { latitude: 41.0, longitude: -5.5 },
          high: { latitude: 51.5, longitude: 10.0 },
        },
      },
    };
    if (data.minRating > 0) body.minRating = data.minRating;

    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Places searchText failed [${res.status}]: ${text}`);
      throw new Error(`Places search failed: ${res.status}`);
    }

    const json = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
        primaryTypeDisplayName?: { text: string };
        googleMapsUri?: string;
        photos?: Array<{ name: string }>;
      }>;
    };

    const restaurants: Restaurant[] = (json.places ?? [])
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
        photoUrl: p.photos?.[0]?.name
          ? `/api/public/place-photo?name=${encodeURIComponent(p.photos[0].name)}`
          : null,
      }));

    return restaurants;
  });
