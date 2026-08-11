import { createServerFn } from "@tanstack/react-start";
import type { CityKey } from "./places.shared";

export type {
  Cuisine,
  Restaurant,
  CityKey,
  CityDef,
} from "./places.shared";

interface SearchInput {
  city: CityKey;
  minRating: number;
  force?: boolean;
}

const CITY_KEYS: CityKey[] = [
  "toulouse",
  "montpellier",
  "paris",
  "lyon",
  "marseille",
  "bordeaux",
];

export const searchRestaurants = createServerFn({ method: "POST" })
  .inputValidator((input: SearchInput) => {
    const city = (input?.city ?? "toulouse") as CityKey;
    if (!CITY_KEYS.includes(city)) throw new Error(`Unknown city: ${city}`);
    return {
      city,
      minRating: Math.max(0, Math.min(5, Number(input?.minRating ?? 0))),
      force: Boolean(input?.force),
    };
  })
  .handler(async ({ data }) => {
    const { loadCityRestaurants } = await import("./places.server");
    return loadCityRestaurants(data.city, data.minRating, data.force);
  });

interface ViewportInput {
  south: number;
  west: number;
  north: number;
  east: number;
  minRating?: number;
}

/** Database-only read of the currently visible map area. */
export const searchViewport = createServerFn({ method: "POST" })
  .inputValidator((input: ViewportInput) => {
    const num = (v: unknown, min: number, max: number) => {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error("Invalid bounds");
      return Math.max(min, Math.min(max, n));
    };
    return {
      south: num(input?.south, -90, 90),
      north: num(input?.north, -90, 90),
      west: num(input?.west, -180, 180),
      east: num(input?.east, -180, 180),
      minRating: Math.max(0, Math.min(5, Number(input?.minRating ?? 0))),
    };
  })
  .handler(async ({ data }) => {
    const { loadViewportRestaurants } = await import("./places.server");
    return loadViewportRestaurants(
      { south: data.south, west: data.west, north: data.north, east: data.east },
      data.minRating,
    );
  });

