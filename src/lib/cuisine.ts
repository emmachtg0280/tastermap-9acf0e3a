/**
 * Canonical Tastemap cuisine classification — the SINGLE source of truth.
 *
 * Everything downstream (filter, marker icon, detail card, profile stats)
 * must derive from `classifyCuisines()` / `pickCuisine()` defined here.
 * Never classify a restaurant anywhere else.
 */
import type { Cuisine } from "./places.shared";

export const CUISINE_KEYS: Exclude<Cuisine, "any">[] = [
  "italian",
  "french",
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

const KEY_SET = new Set<string>(CUISINE_KEYS);

/**
 * Google Places (New) type → Tastemap cuisine.
 * A restaurant may match several entries; every match is kept, so
 * multi-cuisine places (e.g. greek + mediterranean-ish) stay discoverable
 * from each relevant filter.
 */
export const GOOGLE_TYPE_TO_CUISINE: Record<string, Exclude<Cuisine, "any">> = {
  italian_restaurant: "italian",
  pizza_restaurant: "italian",
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
  barbecue_restaurant: "american",
  vegetarian_restaurant: "vegetarian",
  vegan_restaurant: "vegetarian",
};

/**
 * Classifies a place from its Google types. `primaryType` is considered
 * first so it lands first in the returned list (it drives the marker icon).
 */
export function classifyCuisines(
  primaryType: string | null | undefined,
  types: readonly string[] = [],
): Exclude<Cuisine, "any">[] {
  const out: Exclude<Cuisine, "any">[] = [];
  const candidates = [primaryType, ...types].filter(Boolean) as string[];
  for (const t of candidates) {
    const c = GOOGLE_TYPE_TO_CUISINE[t];
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** Drops anything that is not a canonical cuisine key. */
export function sanitizeCuisines(input: readonly unknown[] = []): Exclude<Cuisine, "any">[] {
  const out: Exclude<Cuisine, "any">[] = [];
  for (const v of input) {
    if (typeof v === "string" && KEY_SET.has(v) && !out.includes(v as never)) {
      out.push(v as Exclude<Cuisine, "any">);
    }
  }
  return out;
}

/** Fallback display order when no cuisine is being filtered on. */
const PRIORITY: Cuisine[] = [
  "italian", "japanese", "french", "chinese", "indian",
  "mexican", "thai", "spanish", "greek", "american", "vegetarian",
];

/**
 * Chooses the cuisine used to render a restaurant (marker icon, cards).
 *
 * When a cuisine filter is active and the restaurant matches it, the icon
 * MUST be that cuisine — otherwise a multi-cuisine place could show, say, a
 * pasta sticker while the Greek filter is on.
 */
export function pickCuisine(cs: readonly Cuisine[], preferred?: Cuisine | null): Cuisine {
  if (preferred && preferred !== "any" && cs.includes(preferred)) return preferred;
  for (const p of PRIORITY) if (cs.includes(p)) return p;
  return "any";
}

/** The filter predicate. One definition, used everywhere. */
export function matchesCuisine(cs: readonly Cuisine[], filter: Cuisine): boolean {
  return filter === "any" || cs.includes(filter);
}
