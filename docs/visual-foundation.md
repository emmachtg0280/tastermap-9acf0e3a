# Playful visual foundation — phase 1

Reference: https://cursor-ash-65242962.figma.site/

Playful supplies the personality; Clean supplies spacing and map restraint.
Urban is not used. This phase changes presentation, not restaurant data or product logic.

## Small shared vocabulary

`src/styles.css` owns the semantic tokens. Existing Button, Badge and Card components
remain the component foundation. `tm-chip` provides selectable pill controls through
`aria-pressed`; `tm-card` supplies a floating white card; `tm-map-action` supplies a
44px map control. Use normal Tailwind utilities for layout rather than adding variants
for individual screens.

| Role               | Value / convention                                          |
| ------------------ | ----------------------------------------------------------- |
| Background / card  | White `#FFFFFF`                                             |
| Secondary surface  | `#F5F5F0`                                                   |
| Signature / saved  | Lime `#A8EB12`                                              |
| Primary text       | `#1A1A1A`                                                   |
| Supporting text    | `#62645C`                                                   |
| Brand text / focus | `#426500`                                                   |
| Visited            | Yellow `#FFD426`, surface `#FFF8D6`, ink `#715500`          |
| Selected marker    | Orange `#FF8642`, dark outline `#9B3C00`                    |
| Destructive        | `#B42318`, reserved for actual errors/destructive actions   |
| Typography         | Plus Jakarta Sans; body 400–600, controls 700, headings 800 |
| Spacing            | Existing 4px Tailwind scale; gaps 8/12/16px, map edge 12px  |
| Radius             | 16px controls, 24px cards, full pills                       |
| Elevation          | One restrained floating-surface shadow                      |

Do not use signature lime as text on white: contrast is only 1.44:1. Dark ink on
lime is 12.06:1; brand ink on white is 6.79:1; supporting text on white is 6.01:1;
visited ink on its pale surface is 6.55:1. The contrast tests enforce AA normal-text
contrast for nine semantic pairings. Focus outlines and checkbox/radio/slider
boundaries use dark colors. Saved and visited markers retain heart/check shapes,
so their distinction does not rely exclusively on color.

Legacy `duo-*` aliases are retained for deferred screens. In particular, legacy
green stays dark enough for the white foreground those screens already use.
New components should use semantic tokens, not these compatibility aliases.

## Map and QuickCard

- Food artwork and cuisine taxonomy are reused unchanged.
- Undiscovered/saved/visited markers are 28/36/40px; selection adds 6px and an
  orange ring with a dark outer boundary. Personal badges remain visible when selected.
- Marker pooling, caching keys, clustering, priority/cap rules, hit handlers,
  persistence and server calls remain unchanged. Existing cluster progress remains,
  now using yellow to match the visited state; this is not neighborhood progress.
- Map geography is neutral with subdued water and parks. No neighborhood polygons
  or completion calculations are added.
- City, personal map and sign-in share one responsive row. Discover stays available
  in the scrollable shortcut row. All six existing map actions remain, arranged in
  two columns to occupy less vertical space. The current navigation model is retained.
- QuickCard retains independent save/visited toggles, details and close callbacks.
  Toggles expose `aria-pressed`, and controls have 44–48px targets.

DetailCard, Profile and onboarding receive shared tokens/font changes only; their
components and flows are not redesigned. Their older state presentation can still
differ until their own design pass.

## Deliberately deferred

Taste matching, wait times, recommendations, challenges, achievements, neighborhood
completion/coloring, personalization and the four-destination Figma navigation.
No API or database changes are required.

## Validation and remaining limits

Final checks: lint passed with 14 existing warnings and no errors; typecheck passed;
all 29 tests passed; client and SSR production build passed. The build retains
existing dependency deprecation and large-chunk warnings. No package manifest or
lockfile change is included. Build-generated route churn was discarded.

The actual Home controls were checked at 320px, 390px and 1280px widths. QuickCard
was exercised in an isolated local fixture: save/unsave, visited/unvisited, details
and close callbacks all worked; its two main buttons fit at 320px. The fixture is
not shipped. Marker tests cover selected-state identity, artwork retention, caching
and cluster distinctions; existing cuisine and marker-layer tests remain.

Live map tiles and authenticated persistence require the deployment's Google Maps
and Supabase configuration, which is absent locally.

The cuisine-image investigation confirmed that all 12 existing manifest URLs return
HTTP 200, `image/png`, and valid PNG signatures on `https://tastermap.lovable.app`.
Their paths are relative Lovable asset routes (`/__l5e/assets-v1/...`), not bundled
files. The installed Vite configuration only proxies these paths when the process
environment contains `LOVABLE_PREVIEW_HOST` (host only, for example
`tastermap.lovable.app`). That variable was absent in the local review setup;
the standalone component fixture also had no asset proxy. This explains the local
failures and does not indicate missing assets on the current deployed site.

A branch preview must still provide the Lovable asset route; a generic static host
will not automatically serve it. Verify image decoding in chips, QuickCard and map
markers on the actual preview origin. Existing PNGs are approximately 0.6–1.0 MB
each, and the loader fetches all cuisines together; inspect loading on slow mobile
networks. Its existing loader does not validate response status/MIME before making
data URLs, so an HTML fallback response can become an invalid marker image. These
pre-existing delivery/robustness concerns are documented, not redesigned here.

A deployment smoke test should also check map density, selection and saves with
the configured services. Pre-commit review removed a stray comment fragment that
had accidentally become an at-rule above the theme block; no new visual feature
was added.

The Windows MCP build adapter normalizes only the root passed to the plugin's
configuration hook; containment checks and route generation remain enabled.
Formatting changes to generated Supabase TypeScript declarations are whitespace/
parentheses only, with no schema or API changes.
