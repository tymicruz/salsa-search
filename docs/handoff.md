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

## Core problem: getting raw data (details: docs/brain/data-access.md)
- **Google search:** use Gemini API "Grounding with Google Search" (owner has keys). Price/free limit not yet checked.
- **Reddit:** official API closing (no new requests since 2026-10-31). Use Gemini grounding to find and summarize threads. Untested whether Gemini "URL context" can read full threads.
- **Instagram:** owner prefers Apify (scraping; owner's call). Meta Business Discovery is the allowed fallback. Avoid instagrapi on the owner's account.
- **Google reviews:** Places API, 5 per place, live display only; can't be stored.

## Next steps (each needs the owner's yes)
- **A.** Gemini grounding test on 2 blind cities (owner picks; answers stay with owner). Also test URL context on one Reddit thread and one Instagram post.
- **B.** Apify Instagram test on ~5 accounts in a blind city: which fields come back, real cost.
- **C.** Browser (Claude desktop app or Claude in Chrome) as ground truth.

## Other
- GitHub: `gh` is installed; owner must run `gh auth login`, then create a private repo `salsa-search` and push.
- Future idea: research cities on demand, show "as of [date]", and refresh stale data in the background (stale-while-revalidate).
