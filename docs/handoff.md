# Handoff — 2026-11-17

Read this first if the Claude session ended. Full original brief: `docs/team-brief.md`. Status + decision log: `docs/README.md`.

## How the team ran
- Main Claude session = coordinator (relays between owner and agents).
- Background agents: **lead** (plans, docs, research), **dev** (owns frontend code), **discovery-strategist** (interviews, playbook, scoring). Blind test agents are started fresh per run and never see interviews.
- Rules that stuck:
  - dev shows each code change (file, lines, before/after) and waits for the owner's yes.
  - Only the owner creates accounts/keys and approves anything paid.
  - No git writes by agents.
- To restart: start lead, dev and discovery-strategist from `docs/team-brief.md` + this file.

## Frontend (frontend/salsa-search)
Done:
- Full-page Google map.
- Floating search bar with city/region suggestions (Places API (New), `AutocompleteSuggestion`, session tokens, arrow keys, `fitBounds` to the place's viewport).
- Search covers towns, states, counties, lakes and informal areas.
- Dice button (`src/features/dice-button/`) picks a random city from `src/app/lucky-cities.json`.

Open:
- Optional cleanup: `center`/`zoom` signals in `app.ts` are only the starting view and could be plain values (owner hasn't decided).
- Markers/venue details wait for the discovery work.

## Discovery engine ("brain") — docs/brain/
- Interviews: Cali (complete), Puerto Escondido, Cusco, Mexico City, `owner-workflows.md`.
- `strategy-library.md`: the playbook. On hold; change it only with real data, and only with general lessons.
- `city-data-model.md`: Places (towns + areas), venues, events, sources, verification.
- Pilots:
  - Blind Puerto Escondido test: `puerto-escondido.md`, scored in `puerto-escondido-score.md`. Found 4/5 places, missed the main school, mislabeled one club.
  - Browser tests: `puerto-escondido-browser.md`, `ho-chi-minh-city-browser.md`.
- **Rule:** Puerto Escondido is no longer a benchmark (overfitting). Future tests use blind cities the owner scores.

## Core problem: getting raw data
Details: `docs/research/data-sources.md` (newest) and `docs/brain/data-access.md`.
- **Gemini Google Search grounding is NOT usable as a pipeline.** Its terms allow showing results only to the asker: no storing, analyzing or crawling. It's only usable as a live "ask about this city" feature.
- **Top routes:**
  1. Google Places text search (store place IDs only) plus venue websites.
  2. Apify instagram-profile-scraper: bio plus 12 latest posts with isPinned, ~$0.08/city; $5/month free credit. Highlights need a separate tool and come back as images only.
  3. OpenAI web search for discovery ($10 per 1k); Reddit coverage untested.
- **Reddit:** unsolved. The official API is closing (no new requests since 2026-10-31).
- **Ruled out:** Facebook events, Eventbrite, Meetup.
- **Google reviews:** Places API, 5 per place, live display only; can't be stored.
- **Other design docs:** `docs/brain/synthesis-method.md` (raw → clean data), `docs/product/map-ux.md` (map/app design + 8 dev steps).

## Next steps (each needs the owner's yes)
- **Small blind-city test:** Google Places finds schools/venues → Apify pulls their Instagram profiles → owner scores. Needs a free Apify account (owner creates it; token goes in `.env`).
- **Answer the open questions** in map-ux.md and synthesis-method.md.
- **Browser** (Claude desktop app or Claude in Chrome) as ground truth.

## Other
- GitHub: `gh` is installed; owner must run `gh auth login`, then create a private repo `salsa-search` and push.
- Future idea: research cities on demand, show "as of [date]", and refresh stale data in the background (stale-while-revalidate).
