import type { Restaurant } from "@/lib/places.shared";
import type { VisitMap } from "@/features/visits/use-visits";

export type MapBounds = { south: number; north: number; west: number; east: number };

export function restaurantsInViewport(restaurants: Restaurant[], bounds: MapBounds | null) {
  if (!bounds) return restaurants;
  const padLat = (bounds.north - bounds.south) * 0.2;
  const padLng = (bounds.east - bounds.west) * 0.2;
  const south = bounds.south - padLat;
  const north = bounds.north + padLat;
  const west = bounds.west - padLng;
  const east = bounds.east + padLng;
  return restaurants.filter(
    (r) => r.lat >= south && r.lat <= north && r.lng >= west && r.lng <= east,
  );
}

export function clusterRestaurants(restaurants: Restaurant[], zoom: number) {
  const cell = 360 / Math.pow(2, Math.max(4, Math.round(zoom)) + 3);
  const groups = new Map<string, Restaurant[]>();
  restaurants.forEach((r) => {
    const key = `${Math.floor(r.lat / cell)}:${Math.floor(r.lng / cell)}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  });
  return groups;
}

export function prioritizeRestaurants(restaurants: Restaurant[], visits: VisitMap, limit: number) {
  if (restaurants.length <= limit) return restaurants;
  const score = (r: Restaurant) => {
    const v = visits[r.id];
    if (v?.done) return 3;
    if (v?.favorite) return 2;
    return (r.userRatingCount ?? 0) > 300 ? 1 : 0;
  };
  return [...restaurants].sort((a, b) => score(b) - score(a)).slice(0, limit);
}
