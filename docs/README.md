# Salsa Search

Know a city's salsa scene in 5 minutes instead of 5 weeks.

## Current status (2026-11-16)

- Git root: `salsa-search/` (top level). Move not committed yet.
- App: `frontend/salsa-search/`, Angular 22.2, standalone components, Tailwind v4. No backend yet.
- Everything lives in the root `App` component (`src/app/app.ts` + `app.html`). `src/features/` is empty.
- Landing page: "Salsa Search" title, pill search bar with a cities-only suggestion list (`AutocompleteSuggestion` data API), "I'm Feeling Lucky" button, world map (`@angular/google-maps`).
- Picking a city moves and zooms the map. Lucky only `console.log`s.
- Maps key: in `frontend/salsa-search/.env` (gitignored, template in `.env.example`). Script loads `libraries=places`. Needs Maps JavaScript API + Places API (New) enabled and in the key's restrictions.
- Tests: Vitest configured, no spec files yet. `<google-map>` must be mocked in tests (jsdom has no `google`).

## How to run

```
cd frontend/salsa-search
npm install
ng serve        # http://localhost:4200
```

Restart `ng serve` after changing `.env` or `angular.json`.

## Decision log

- 2026-11-16 — Git root moved up from `frontend/salsa-search/` to `salsa-search/` — so `docs/` and a future backend are tracked in the same repo.
- 2026-11-16 — Angular Material removed; Tailwind used for styling — simpler, utility classes directly in templates.
- 2026-11-16 — Router removed — single page for now; re-add when a second page is real.
- 2026-11-16 — Team runs as separate background agents — owner talks to the main session; agents report back through it.
- 2026-11-16 — City search uses Places Autocomplete (New), cities only; Geocoder removed — picking a full city name avoids typos and same-name cities.
- 2026-11-16 — Only `location` fetched for a picked city — keeps Place Details on the cheap Essentials tier.
- 2026-11-16 — Own search bar + `AutocompleteSuggestion` instead of Google's `<gmp-place-autocomplete>` element — Google's element can't be styled to match our Google-style pill.
- 2026-11-16 — Map markers deferred — wait until the discovery strategy is defined.
- 2026-11-16 — Frontend agent "dev" added; lead no longer edits app code — one owner per area.
- 2026-11-16 — Agents show proposed code changes in chat and wait for the owner's yes before editing — background agents' edits land immediately, and nothing is committed yet to diff against.
