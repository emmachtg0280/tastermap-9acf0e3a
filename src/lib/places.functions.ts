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
