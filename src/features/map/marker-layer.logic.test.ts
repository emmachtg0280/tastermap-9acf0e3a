import { describe, expect, it } from "vitest";
import type { Restaurant } from "@/lib/places.shared";
import {
  clusterRestaurants,
  prioritizeRestaurants,
  restaurantsInViewport,
} from "./marker-layer.logic";

const restaurant = (id: string, lat: number, lng: number, reviews = 0): Restaurant => ({
  id, name: id, address: "", lat, lng, rating: null, userRatingCount: reviews,
  priceLevel: null, primaryType: null, primaryTypeKey: null, googleMapsUri: null,
  websiteUri: null, phone: null, summary: null, openNow: null, reservable: null,
  weekdayDescriptions: [], photoUrls: [], cuisines: [],
});

describe("marker layer decisions", () => {
  it("keeps viewport padding exactly as the map layer uses it", () => {
    const rows = [restaurant("inside", 1, 1), restaurant("padded", 1.1, 1), restaurant("outside", 1.3, 1)];
    expect(restaurantsInViewport(rows, { south: 0, north: 1, west: 0, east: 1 }).map((r) => r.id))
      .toEqual(["inside", "padded"]);
  });

  it("groups restaurants in the existing zoom-derived cells", () => {
    const groups = clusterRestaurants([restaurant("a", 43.6, 1.44), restaurant("b", 43.6001, 1.4401)], 12);
    expect([...groups.values()].some((group) => group.length === 2)).toBe(true);
  });

  it("keeps visited, saved, then popular restaurants when applying the marker cap", () => {
    const rows = [restaurant("plain", 0, 0), restaurant("popular", 0, 0, 301), restaurant("saved", 0, 0), restaurant("done", 0, 0)];
    expect(prioritizeRestaurants(rows, { saved: { done: false, favorite: true, comment: "" }, done: { done: true, favorite: false, comment: "" } }, 3).map((r) => r.id))
      .toEqual(["done", "saved", "popular"]);
  });
});
