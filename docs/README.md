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
- 2026-11-17 — City search fetches `viewport` (not `location`) and fits the map to it; suggestions include regions and natural features — areas like Lake Atitlán matter, not just cities.
- 2026-11-17 — Reddit API dropped as a source — Reddit closed new API access 2026-10-31; full public API shutdown March 2027.
- 2026-11-17 — Gemini Google-Search grounding not used as a data source — its terms forbid storing or analyzing grounded results.
- 2026-11-17 — GitHub repo `tymicruz/salsa-search` made public (owner's call) — keys were never committed; note: docs/brain/interviews are public too.
- 2026-11-17 — Work happens on the `dev` branch and merges to `main` via PRs — reviewable history.
- 2026-11-17 — Repo is for code-relevant files only; `docs/brain/` (interviews, pilots, method work) stays local and is never committed — it's personal dev material, not the app. Cleanup of what's already on GitHub (gitignore + history restart) is postponed until the owner says go.
- 2026-11-17 — No fictional places: the map uses live Google Places Text Search (Pro fields only) + SalsaVida schedules, searched only on user action, nothing stored — owner wants real data in the prototype.
- 2026-11-17 — Team: the 5 source-research agents merged into one, "sources" (files in `docs/brain/sources/`); "dev" is the frontend dev (frontend-dev); new "backend-dev" builds a small Node/TS service in `backend/` (`POST /classify`: LLM labels a place school / social / etc.; `POST /socials`: reads a venue website for Instagram/Facebook links); team-lead reviews both devs' steps — clearer ownership as the project grows.
- 2026-11-17 — /classify uses a paid, billing-linked Gemini key funded by the $300 Cloud trial credit, with a cheap model pinned (Flash-Lite level, minimal thinking) — paid tier doesn't train on prompts (Google Places content is sent), and proof-of-concept must protect the credit. Open: whether trial credit covers the AI Studio Gemini API or only Vertex; per-call token/cost logging and budget alerts being added by backend-dev.
- 2026-11-17 — LLM-first pipeline: backend `POST /synthesize` merges raw Google + SalsaVida results into readable venues (hosts, one-line AI summary, schedule copied by code from SalsaVida); replaces /classify. Default AI: Claude (claude-cli, Haiku) — faster/lighter than codex-cli. No cache in v1 (output contains Google place names). Website text later. Coordinates/addresses never go to non-Google models — owner wants digestible results, not raw rows.
- 2026-11-17 — Verified facts (from venue websites / Instagram: fact, source link, date, Google place ID) will be saved in a local SQLite file in `backend/`, gitignored; never Google content — so a city isn't re-researched on every search. Built with the website/Instagram step.
- 2026-11-17 — Google search uses only 2 queries ("salsa classes", "salsa dance school"); socials come from SalsaVida, not Google ("salsa social" on Google isn't reliable). SalsaVida socials Google misses get pinned by the planned per-venue SalsaVida address lookups. A third less Google cost per search. (Supersedes the "salsa social" replacement below.)
- 2026-11-17 — Google search looks only for salsa classes, schools and socials, not "salsa bar" — bars/restaurants were the main noise; a bar is fine if it comes up for a class or social. "No evidence, no pin" comes later, and the evidence (quote + link) must be shown to the user — owner found real evidence by hand that the app should surface.
- 2026-11-17 — Two more noise types to exclude (owner, from Ushuaia — examples of general patterns, not city rules): (1) kids'/general dance studios that aren't adult social salsa (e.g. "Crown Estudio": children's classes, visible in Google review photos/comments); (2) plain restaurants with no salsa event (e.g. "Volver"). Both should disappear under "no evidence, no pin" plus a category for "dance studio, not salsa".
- 2026-11-17 — Owner is getting an Apify token; use it sparingly (spending cap + per-search limits). No bulk crawling for now (Google key can't be used server-side). Instead, save verified facts to the SQLite file as searches happen — but only once the app visibly shows better-quality data.
- 2026-11-18 — Backend AI switches to codex-cli (owner's ChatGPT subscription) instead of claude-cli — owner's Claude usage is needed for development. Owner sets `LLM_PROVIDER=codex-cli` in backend/.env; backend-dev compares speed/quality on real requests.
- 2026-11-18 — Go: (1) SalsaVida address matching + pin lookups; (2) evidence step: no evidence of salsa → not shown (hidden, not grey); ~30 s waits OK for testing; "active/inactive" doesn't matter, only whether it's salsa. Defaults unless the owner says otherwise: Apify cap 30 profiles/day, image/highlight text later, Google website field via the 2 searches. Also test broader Google queries (e.g. "salsa school", "dance school") but filter hard: dance schools that aren't salsa, or are kids-only, must be dropped.
- 2026-11-18 — Apify/Instagram tested on Cusco only first (max ~15 profiles), to check we read Instagram data correctly before any wider use. Other test cities later (Puerto Escondido, Lima + 2).
- 2026-11-17 — Apify account will be created (owner) for reading Instagram profiles; Facebook skipped for now — Instagram is where schools post schedules; Facebook adds terms risk for less value.
- 2026-11-23 — Grey "unknown" pins are hidden (map and list); a venue appears once a schedule or a website/Instagram check shows salsa — owner called them noise. Venues outside the 15 check slots stay hidden.
- 2026-11-23 — Doubted or grey venues with no website stay hidden — owner: places without a website are most likely irrelevant.
