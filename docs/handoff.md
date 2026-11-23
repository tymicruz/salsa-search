# Handoff — 2026-11-19

Read this first when restarting the team. Original brief: `docs/team-brief.md`. Decision log: `docs/README.md`. Work log: `docs/overnight-log.md` (local only, never commit: it has real venue names/addresses).

## Team
- Main Claude session = coordinator (relays between owner and agents; agents address it as "team-lead").
- **lead**: plans, reviews every commit, keeps docs/README.md + overnight-log.md, sends the owner short plans and "ready to try" notes.
- **dev**: full-stack (frontend Angular + backend Node). Shows each change for review; commits by file name on `dev`.
- **discovery-strategist**: the "brain" — interviews, strategy, blind-city tests the owner scores. No code.

## Rules that stuck
- Owner approves anything paid, any new direction, keys/accounts. Owner edits `.env` files; agents tell them the line.
- Never commit: `.env`, `docs/brain/`, `docs/overnight-log.md`, scraped content.
- No Google content (names, addresses, ratings, reviews) in code, tests, comments, docs or commit messages — only place IDs and invented examples.
- No git history rewrites/force-push without the owner. Repo `tymicruz/salsa-search` is PUBLIC (owner hasn't decided to make it private).
- Fixes must be general, never tuned to one city (Puerto Escondido is not a benchmark).
- Owner wants concise answers; explain new Angular pieces in one line; simplest code.
- Usage: the Claude 5-hour limit has been hit repeatedly. Keep messages short, avoid idle chatter, don't re-run expensive tests without need.

## What works (on `dev`, last commit 17e4d90)
- **Frontend** (`frontend/salsa-search`, `ng serve` → :4200): map, city search, dice; Google Places text search (2 queries: classes + dance school, with websiteUri); SalsaVida MCP events resolved by city + country (retry once, visible error, city→province fallback); per-SalsaVida-venue Google lookups for pins; AI-merged venues swap in after the raw list; background website/Instagram evidence check (15 slots, 3 reserved for AI "not salsa" places); no-evidence places hidden; quotes + links in details.
- **Backend** (`backend`, `npm run dev` → :3000, `npm test` = 45 address tests):
  - `/synthesize`: one LLM call merges Google + SalsaVida rows; code enforces merges (≤150 m + shared word or same address), address-first event binding, address-beats-name, word-for-word quotes; schedules copied by code.
  - `/evidence/website`, `/evidence/instagram` (Apify, `APIFY_MAX_PER_DAY`=30), `/socials`.
  - LLM providers: `claude-cli` (current default, owner's subscription), `codex-cli` (ChatGPT subscription; same quality, ~35–45% slower). Optional `CLAUDE_EFFORT=low` (~25% faster, not set).
- Owner keys in `.env` (gitignored): Maps key (frontend), APIFY_TOKEN, LLM_PROVIDER.

## Open / next
1. Recheck Medellín after 17e4d90: Timbalé should show its own name (not a preschool's); report wrong pins and hidden counts. Then send the owner a "ready to try" note.
2. Owner decisions pending: switch to codex-cli to save Claude usage; email SalsaVida about using event-page coordinates (draft in chat); make the repo private.
3. Later: add "escuela de baile" query once evidence filtering proves itself; reading text in flyer images; SQLite cache of verified facts (only after evidence visibly improves quality); Facebook later.
