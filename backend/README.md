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
| `LLM_PROVIDER` | `claude-cli` (your Claude subscription, local only), `gemini` (AI Studio key; the default if unset), `vertex` (Google Cloud login, no key) or `openai` |
| `CLAUDE_MODEL`, `CLAUDE_BIN` | only for `claude-cli`: model alias (default `haiku`) and path to `claude` (default `claude`) |
| `GEMINI_API_KEY` | only for `gemini`: from https://aistudio.google.com/apikey |
| `GOOGLE_CLOUD_PROJECT` | only for `vertex`: your Cloud project ID |
| `GOOGLE_CLOUD_LOCATION` | only for `vertex`: `global` (where Flash-Lite is offered). Other locations use the `{location}-aiplatform.googleapis.com` host, which is unverified |
| `GEMINI_MODEL` | default `gemini-3.5-flash-lite` (cheap, pinned), for `gemini` and `vertex`. If changed, update the prices in `src/llm.ts` |
| `OPENAI_API_KEY` | from https://platform.openai.com/api-keys (for `openai` or `npm run compare`) |
| `OPENAI_MODEL` | default `gpt-6-luna` (cheap, pinned). If changed, update the prices in `src/llm.ts` |
| `PORT` | default 3000 |

## Claude CLI (local prototyping only)
`LLM_PROVIDER=claude-cli` runs `claude -p --model haiku --output-format json` from Claude Code, using your Claude subscription. It needs no key, but `claude` must be installed and logged in.
- Tools are off (`--tools ""`), and project files, memory and MCP servers are ignored (`--safe-mode`). Chats aren't saved (`--no-session-persistence`). It times out after 120s.
- The log line shows a list-price equivalent: it counts against your subscription limits and isn't billed.
- It runs a program on this Mac, so it can't be used in a deployed product.
- It uses the owner's personal subscription, so it's for local, owner-only prototyping. Anything deployed or multi-user must switch to a paid API provider.

**Data rule (flagged for the owner):** Google's address is sent only to Google's models (`gemini`, `vertex`). `claude-cli` and `openai` get the place name, Google types and website/SalsaVida text. Name and types are still Google Places content, so the owner must accept sending them to a non-Google model.

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

### POST /classify
Sends place details to the LLM in batches of 20 and returns one result per place. The LLM may only use the text it's sent; with too little evidence the answer is `unknown`.

```jsonc
// request
{ "places": [{ "id": "ChIJ...", "name": "Salsa Academy", "types": ["dance_school"], "primaryType": "dance_school",
               "address": "...", "websiteText": "...", "eventText": "Tuesday salsa social" }] }
// response
{ "results": [{ "id": "ChIJ...", "category": "salsa_school", "offers": ["classes"],
                "reason": "The name \"Salsa Academy\" and type \"dance_school\" show it teaches salsa." }] }
```
- `category` is one of `salsa_school`, `social_venue`, `bar_club_with_salsa`, `not_salsa` or `unknown`.
- `offers` is any of `classes`, `socials` (partner dancing) or `music`.
- Only `id` and `name` are required.
- "music" (salsa is played) and "socials" (people partner-dance) are kept separate on purpose.
- **Cost:** thinking is set to `minimal`. Each Gemini call logs its tokens and estimated cost to the console, e.g. `[gemini] gemini-3.5-flash-lite: 4000 in, 1500 out, ~$0.00495`. At $0.30 / $2.50 per 1M tokens, 20 places cost about half a cent.

Try it (needs `GEMINI_API_KEY`):
```
curl -s -X POST localhost:3000/classify -H 'Content-Type: application/json' \
  -d '{"places":[{"id":"a","name":"Salsa Academy","types":["dance_school"]},{"id":"b","name":"Taco Salsa Grill","types":["restaurant"]}]}'
```

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

## Compare Gemini and OpenAI
```
npm run compare                 # classifies the made-up TEST places in compare-places.json with both
npm run compare -- my.json      # or your own list (same shape as /classify's "places")
```
**Data rule:** never send real Google Places results (names, types or addresses from Google) to OpenAI, whether through this script or `/classify` with `LLM_PROVIDER=openai`. Google's Maps terms don't allow sharing that content outside Google. For a real-data comparison, use only the name plus website and SalsaVida text, and ask the owner first.

This prints one `[gemini]` / `[openai]` line per call with tokens and estimated cost, then a table of both answers and each one's reasons. It needs both keys in `.env`.

## Note
This API fetches any URL it's given, so it should only run locally for now. Before it's deployed, block private and internal addresses.
