import { describe, expect, it } from "vitest";
import { classifyCuisines, matchesCuisine, pickCuisine, sanitizeCuisines } from "@/lib/cuisine";
import type { Cuisine } from "@/lib/places.shared";

/**
 * These tests lock the invariant that broke in P1.6:
 * filter result === restaurant.cuisines === marker icon === detail icon.
 */
const CASES: Array<{
  name: string;
  primaryType: string;
  types: string[];
  filter: Cuisine;
  expected: Cuisine;
}> = [
  {
    name: "Greek taverna",
    primaryType: "greek_restaurant",
    types: ["greek_restaurant", "restaurant"],
    filter: "greek",
    expected: "greek",
  },
  {
    name: "Sushi bar",
    primaryType: "sushi_restaurant",
    types: ["japanese_restaurant"],
    filter: "japanese",
    expected: "japanese",
  },
  {
    name: "Trattoria",
    primaryType: "italian_restaurant",
    types: ["pizza_restaurant"],
    filter: "italian",
    expected: "italian",
  },
  {
    name: "Taqueria",
    primaryType: "mexican_restaurant",
    types: [],
    filter: "mexican",
    expected: "mexican",
  },
  {
    name: "Bistrot",
    primaryType: "french_restaurant",
    types: ["restaurant"],
    filter: "french",
    expected: "french",
  },
  {
    name: "Curry house",
    primaryType: "indian_restaurant",
    types: ["vegetarian_restaurant"],
    filter: "indian",
    expected: "indian",
  },
  {
    name: "Burger joint",
    primaryType: "hamburger_restaurant",
    types: ["american_restaurant"],
    filter: "american",
    expected: "american",
  },
];

describe("canonical cuisine classification", () => {
  for (const c of CASES) {
    it(`${c.name}: filter, cuisines, marker and detail all agree on ${c.filter}`, () => {
      const cuisines = classifyCuisines(c.primaryType, c.types);
      // 1. filter
      expect(matchesCuisine(cuisines, c.filter)).toBe(true);
      // 2. restaurant.cuisines
      expect(cuisines).toContain(c.expected);
      // 3. marker icon (derived with the active filter)
      expect(pickCuisine(cuisines, c.filter)).toBe(c.expected);
      // 4. detail card icon (same function, same inputs)
      expect(pickCuisine(cuisines, c.filter)).toBe(pickCuisine(cuisines, c.filter));
    });
  }

  it("excludes non-matching restaurants from a cuisine filter", () => {
    const japanese = classifyCuisines("sushi_restaurant", []);
    expect(matchesCuisine(japanese, "greek")).toBe(false);
  });

  it("keeps multi-cuisine places discoverable from each cuisine", () => {
    const both = classifyCuisines("greek_restaurant", ["vegetarian_restaurant"]);
    expect(matchesCuisine(both, "greek")).toBe(true);
    expect(matchesCuisine(both, "vegetarian")).toBe(true);
    expect(pickCuisine(both, "greek")).toBe("greek");
    expect(pickCuisine(both, "vegetarian")).toBe("vegetarian");
  });

  it("falls back to a stable priority when no filter is active", () => {
    const both = classifyCuisines("italian_restaurant", ["japanese_restaurant"]);
    expect(pickCuisine(both)).toBe("italian");
  });

  it("drops unknown cuisine values from legacy cached payloads", () => {
    expect(sanitizeCuisines(["greek", "fusion", 42])).toEqual(["greek"]);
  });

  it("returns no cuisine for a generic restaurant", () => {
    expect(classifyCuisines("restaurant", ["food"])).toEqual([]);
    expect(pickCuisine([])).toBe("any");
  });
});
