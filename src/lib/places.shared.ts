// Client-safe shared types and city configuration.
// No server code, no env reads — safe to import from components.

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

export type CityKey = "toulouse" | "montpellier" | "paris" | "lyon" | "marseille" | "bordeaux";

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
  { key: "lyon", label: "Lyon", lat: 45.764, lng: 4.8357, radius: 9000 },
  { key: "marseille", label: "Marseille", lat: 43.2965, lng: 5.3698, radius: 10000 },
  { key: "bordeaux", label: "Bordeaux", lat: 44.8378, lng: -0.5792, radius: 8000 },
];

export const CITY_BY_KEY: Record<CityKey, CityDef> = Object.fromEntries(
  CITIES.map((c) => [c.key, c]),
) as Record<CityKey, CityDef>;
