# P0.2 — Architecture validation (no changes made)

## 1. Coherence with the current app

Verified against the code as it exists today:

- `src/lib/places.functions.ts` calls Google Places Text Search live on every city search, keeps results only in a 10-minute in-memory map (`CACHE`), and caps results at 100 per city. Nothing is persisted.
- `src/lib/visits.functions.ts` + the `restaurant_visits` table (place_id, done, favorite, personal_rating, comment) is the only durable data, keyed by `place_id`.
- `src/routes/index.tsx` (1613 lines) reads `r.lat` / `r.lng` directly for markers, clustering (`Math.floor(r.lat / cell)`), pan-to, distance and the "itinéraire" link.

Verdict: the proposed layering (persistent identity + expiring cache + Tastemap-owned data + user data) is coherent with this app and is additive — no rewrite of the UI or of the visit sync is required. Two caveats, both resolved below: the `lat_bucket/lng_bucket` idea, and the `restaurant_visits` → `user_places` rename.

## 2. Exact coordinates — the bucket approach is the wrong call

The map needs true coordinates at all times. A bucket grid (~1 km cells) would place markers off the actual restaurant, break distance, break "itinéraire", and break marker/detail alignment. Bucketing is not required for compliance either: Google's terms allow `place_id` to be stored indefinitely and other Places content — including `location` — to be cached temporarily (30 days is the accepted ceiling), as long as it is refreshed or deleted after that.

Recommended model instead:

- `places` (permanent): `place_id`, `city_id`, `neighborhood_id`, `geo_cell` (coarse cell, used only as an index/clustering key and as a fallback if the cache is empty), `first_seen_at`, `last_refreshed_at`, `status`.
- `places_cache` (expiring, ≤ 30 days): `place_id`, `payload jsonb` (name, address, **exact lat/lng**, rating, review count, price level, types, hours, maps URI, website, phone, summary), `fetched_at`, `expires_at`.
- Never stored: photo bytes, `open_now`, anything derived and re-published beyond the TTL.

How each interaction resolves:

| Interaction         | Data source                                                                                       | Google calls                                       |
| ------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Open a city         | one server read: `places` joined to fresh `places_cache` rows for that city                       | 0 if cache warm; only stale/missing rows refreshed |
| Pan                 | client-side filter on already-loaded city set; new area → bounds query against the DB             | 0, unless the area was never indexed               |
| Zoom                | clustering on the loaded set (same logic as today)                                                | 0                                                  |
| Select a restaurant | cached payload; photos fetched through the existing `/api/public/place-photo` proxy at click time | 0–1 (photo proxy only)                             |
| Return later        | same city read; rows past TTL refreshed in one batch job                                          | ~N_stale/30 per day                                |

Refresh rates: identity permanent; name/address/hours/location 30 days; rating and review count 24h–7 days (cheap Place Details field mask); `open_now` and photos always live.

## 3. Restaurant lifecycle

**New restaurant discovered** — Text Search returns a `place_id` → upsert into `places` (city, neighborhood via point-in-polygon, geo cell) → payload written to `places_cache` with `expires_at` → returned to the client. Identical to today's response shape, so the UI does not change.

**Returning user** — Tastemap DB: identity, city, neighborhood, tags, hype signals, and the user's own states. Cache: name, address, coordinates, rating, hours. Google live: photos, `open_now`, and any row whose TTL has expired.

**Google returns NOT_FOUND / place merged** — mark `places.status = 'gone'` (or store the replacement `place_id`), stop showing it on the map, but keep the row and the user's history intact; the profile shows it as an archived visit. User rows are never deleted by a Google response.

## 4. User state

`saved`, `visited`, `favorite`, `personal_rating`, `comment`, `visited_at` live in the user table only, keyed by `(user_id, place_id)` under RLS scoped to `auth.uid()`. They depend on nothing Google returns, so the same `place_id` holds fully independent state per user, and states survive cache expiry and NOT_FOUND. Migrating `restaurant_visits` → `user_places` is a rename plus two added columns (`saved`, `visited_at`); existing rows map 1:1 (`done` → `visited`).

## 5. Future product

Supported: 1,000+ places per city (DB reads instead of 100-result API caps), multiple cities, the three discovery states, neighborhood progression (real polygons + a per-user aggregate), recommendations (tags + signals + user history), Hype (already server-computed in `hype.functions.ts`, moves onto `place_signals`), profiles, and later social/sharing — sharing works because a shared map is a list of `place_id`s plus Tastemap-owned data, with Google content re-fetched by the viewer.

Not solved by this architecture alone: real-time availability/booking, and cross-city global search — both need extra work later.

## 6. Cost analysis (realistic, not a promise)

Today: every city selection with a cold 10-minute memory cache fires ~15 Text Search queries plus paging (~20–30 billed requests), per server instance, per user session. Cost scales with sessions.

Proposed: cost scales with places × refresh period, not with sessions.

- Initial indexing: ~50–150 Text Search requests per city, once.
- Steady state per city (≈1,000 places): full-field refresh ~1,000/30 days ≈ 33/day; rating refresh at 7 days ≈ 140/day. Roughly 100–200 requests/day/city.
- Photos stay per-view and are the item that keeps scaling with traffic.

Realistic reduction: 85–97% on search/details, assuming ≥ a few hundred sessions/day/city, a 30-day TTL, and field-masked detail refreshes. At very low traffic the saving is smaller; at high traffic it approaches the top of the range. Main remaining drivers, in order: photo requests, rating refresh frequency, and initial indexing of new cities.

## 7. Final decision

**GREEN — safe to implement, with one correction:** store exact `lat/lng` in the 30-day `places_cache`, not as permanent buckets. Everything else in the proposal stands.

### Final recommended schema

```text
cities(id, key, label, lat, lng, radius, default_zoom)                       persistent
neighborhoods(id, city_id, name, geometry, centroid)                         persistent
places(place_id PK, city_id, neighborhood_id, geo_cell, status,
       first_seen_at, last_refreshed_at)                                     persistent, no Google content
place_tags(place_id, tag, source, confidence)                                persistent, Tastemap-owned
place_signals(place_id, visits_30d, favorites_30d, hype_score, computed_at)  persistent, Tastemap-owned
profiles(id -> auth user, display_name, home_city_id, avatar_url)            persistent
user_places(user_id, place_id, saved, visited, favorite,
            personal_rating, comment, visited_at, created_at, updated_at)    persistent, RLS per user
places_cache(place_id PK, payload jsonb, fetched_at, expires_at)             expiring, ≤ 30 days
```

Never persisted: photo bytes, `open_now`, any Google content past its TTL.

### Migration order when you approve

1. `cities`, `places`, `places_cache` + grants/RLS; server function reads DB first, falls back to Google.
2. `restaurant_visits` → `user_places` (rename + `saved`, `visited_at`), UI wiring unchanged otherwise.
3. `neighborhoods`, `place_tags`, `place_signals`, then the refresh job.
