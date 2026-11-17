# Salsa Search backend

A small Node + TypeScript API used by the Angular app. It stores nothing: no database, no cache.

- **Express**: the most common Node web framework, so tutorials and answers are easy to find.
- **No build step**: Node 24 runs `.ts` files directly (it strips the types). `npm run check` runs `tsc` to type-check.
- **google-auth-library**: Google's official package. It reads your `gcloud` login (Application Default Credentials) and turns it into short-lived access tokens for Vertex AI. Doing that by hand would mean re-implementing token refresh.

## Run

```
cd backend
npm install
cp .env.example .env   # then put your key in .env
npm run dev            # http://localhost:3000, restarts on file changes
```

Restart `npm run dev` after editing `.env`; it doesn't reload that file.

## .env

| Name | What |
|---|---|
| `LLM_PROVIDER` | `claude-cli` (your Claude subscription, local only; the default), `codex-cli` (ChatGPT subscription, local only), `gemini` (AI Studio key), `vertex` (Google Cloud login, no key) or `openai` |
| `CLAUDE_MODEL`, `CLAUDE_BIN` | only for `claude-cli`: model alias (default `haiku`) and path to `claude` (default `claude`) |
| `CODEX_MODEL`, `CODEX_BIN` | only for `codex-cli`: model (empty = Codex's default) and path to `codex` (default `codex`) |
| `GEMINI_API_KEY` | only for `gemini`: from https://aistudio.google.com/apikey |
| `GOOGLE_CLOUD_PROJECT` | only for `vertex`: your Cloud project ID |
| `GOOGLE_CLOUD_LOCATION` | only for `vertex`: `global` (where Flash-Lite is offered). Other locations use the `{location}-aiplatform.googleapis.com` host, which is unverified |
| `GEMINI_MODEL` | default `gemini-3.5-flash-lite` (cheap, pinned), for `gemini` and `vertex`. If changed, update the prices in `src/llm.ts` |
| `OPENAI_API_KEY` | only for `openai`: from https://platform.openai.com/api-keys |
| `OPENAI_MODEL` | default `gpt-6-luna` (cheap, pinned). If changed, update the prices in `src/llm.ts` |
| `PORT` | default 3000 |

## Claude CLI (local prototyping only)
`LLM_PROVIDER=claude-cli` runs `claude -p --model haiku --output-format json` from Claude Code, using your Claude subscription. It needs no key, but `claude` must be installed and logged in.
- Tools are off (`--tools ""`), and project files, memory and MCP servers are ignored (`--safe-mode`). Chats aren't saved (`--no-session-persistence`). It times out after 120s.
- The log line shows a list-price equivalent: it counts against your subscription limits and isn't billed.
- It runs a program on this Mac, so it can't be used in a deployed product.
- It uses the owner's personal subscription, so it's for local, owner-only prototyping. Anything deployed or multi-user must switch to a paid API provider.

## Codex CLI (local prototyping only)
`LLM_PROVIDER=codex-cli` runs `codex exec --skip-git-repo-check --sandbox read-only --ephemeral --ignore-user-config --json --disable shell_tool --disable unified_exec … -` with your ChatGPT subscription. It needs no key, but you must log in first with `codex login`. It has the same local-only, owner-only rules as Claude CLI.
- **Security:** Codex normally has a shell tool, and "read-only" can still read your files. A web page in the prompt could trick it into printing something like `~/.ssh`. So its shell, browser, apps and image tools are turned off with `--disable`. Tested 2026-11-17: with them off it can't run a command, and with them on it can. If an answer shows a command ran anyway, the backend rejects it.
- Codex can't modify files (`--sandbox read-only`) and doesn't save the session (`--ephemeral`). It skips your Codex config file, but your login still works. It times out after 120s.
- Codex adds a ~15k-token system prompt to every call, so places are batched, 20 per call.
- The log line shows tokens in and out. Usage counts against your subscription and isn't billed.

**Data rule:** every provider gets only the place name, Google types and SalsaVida text, never addresses or coordinates. Name and types are still Google Places content. The owner accepted sending them to non-Google models (2026-11-17) for the LLM-first prototype.

## Vertex AI setup (no API key)
For Cloud organizations that block API keys. Do this once on your Mac:

1. Install the Google Cloud CLI: `brew install --cask gcloud-cli`, then open a new terminal.
2. Log in for local apps: `gcloud auth application-default login`. A browser opens; pick your Google account. This saves the "ADC" login file this backend uses.
3. Pick your project: `gcloud config set project YOUR_PROJECT_ID`, then `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.
4. Enable Vertex AI: `gcloud services enable aiplatform.googleapis.com`. Or in the Console: APIs & Services → Library → "Vertex AI API" → Enable.
5. In `.env`, set `LLM_PROVIDER=vertex`, `GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID` and `GOOGLE_CLOUD_LOCATION=global`, then restart `npm run dev`.

Your account needs the "Vertex AI User" role on the project. Project owners already have it.

## Endpoints

CORS allows only `http://localhost:4200` (the Angular dev server).

### POST /synthesize
Turns one search's raw rows into a short list of venues a person can read. For example, three "PM" Google pins plus "Flavia's Dance School at PM" on SalsaVida become one venue. It makes one LLM call per search and stores nothing.

```jsonc
// request: what the frontend already has after a search
{ "area": "Puerto Escondido",
  "places": [{ "id": "ChIJ...", "name": "PM", "types": ["dance_school"], "lat": 15.86, "lng": -97.07, "googleMapsUri": "..." }],
  "events": [{ "id": 123, "title": "Salsa social", "venue": "PM", "kind": "social", "days": [5], "time": "21:00–01:00",
               "price": "100 MXN", "url": "https://www.salsavida.com/...", "lastEdited": "2026-10-02", "status": "listed" }] }
// response
{ "venues": [{
    "id": "ChIJ...",                 // first placeId, or "sv-<eventId>" if there's no Google place
    "name": "PM", "hosts": ["Flavia's Dance School"],
    "placeIds": ["ChIJ...", "ChIJ..."], "lat": 15.86, "lng": -97.07, "googleMapsUri": "...",  // pin = first place
    "category": "salsa_school",      // salsa_school | social_venue | bar_club_with_salsa | unknown
    "offers": ["classes", "socials"],// classes | socials (partner dancing) | music
    "summary": "One plain sentence, at most 25 words, only facts from the data.",
    "schedule": [{ "eventId": 123, "title": "...", "kind": "social", "days": [5], "time": "...", "price": "...",
                   "url": "...", "lastEdited": "...", "status": "listed" }],
    "evidence": [{ "quote": "Salsa social", "source": "https://www.salsavida.com/..." }] }],
  "notSalsa": ["ChIJ..."] }          // placeIds to hide
```
How it stays honest:
- **The LLM sees** names, Google types, SalsaVida text and two hints computed by code. It never sees coordinates or addresses.
  - `near`: places within 150 m share a group.
  - `nameGroup`: rows whose names share a rare, specific word share a group. A word of 3 letters or fewer, like "PM", counts only if it's in at most 3 different names in that search, so a common short word can't chain unrelated places together.
  - Each run logs `[synthesize] hints: near groups X offered, Y merged, name groups …`, as counts only.
- **The LLM only decides** which rows belong together, plus name, hosts, category, offers, summary and evidence.
- **Code checks every answer:**
  - Each row ends up in exactly one venue or in `notSalsa`.
  - IDs the LLM made up are dropped. Rows it forgot come back as their own `unknown` venue.
  - A place may join a venue only if it's near the first place, has the same name, or shares a specific name word with it. Generic words like "salsa", "bar" or "academia" don't count as a shared word.
  - A SalsaVida event whose venue name matches a Google place's name (every word of the shorter name is in the longer one) always ends up with that place. If the LLM split them, code moves the event back. This keeps a pin from losing its own schedule, e.g. "Social Club Academia". Different branches like "Blood Dance Company (Laureles)" and "… Guayabal" don't match, so they stay apart.
  - Evidence quotes are kept only if they appear word for word in the cited row.
  - Schedule, times, prices, links and pin locations are copied from the input rows, never written by the LLM.

**Speed (2026-11-17, claude-cli Haiku):** about 30s for 60 places + 6 events (Puerto Escondido) and about 56s for 60 places + 23 events (Medellín). The events were real SalsaVida data; the places were synthetic test rows. Each call logs `[synthesize] <area>: N places + M events -> K venues in Xs`.

### POST /socials
Fetches the website once and returns the Instagram, Facebook and Linktree links it finds.
```jsonc
// request
{ "url": "https://example-school.com" }
// response
{ "instagram": ["https://www.instagram.com/exampleschool"], "facebook": [], "linktree": [] }
```
- It obeys robots.txt, sends the User-Agent `SalsaSearchBot/0.1`, gives up after 6 seconds, and reads at most 2 MB.
- No login and no guessing: it only returns links that are written in the page.

Try it (real output, 2026-11-17):
```
$ curl -s -X POST localhost:3000/socials -H 'Content-Type: application/json' -d '{"url":"https://www.salsavida.com"}'
{"instagram":["https://www.instagram.com/salsavida"],"facebook":["https://www.facebook.com/salsavida"],"linktree":[]}
```
- It never fetches instagram.com, facebook.com or linktr.ee. If the URL is one of those, it's returned as the link.
- Errors return `{ "error": "..." }` with status 400 (bad input) or 502 (site or LLM failed).

## Note
This API fetches any URL it's given, so it should only run locally for now. Before it's deployed, block private and internal addresses.
