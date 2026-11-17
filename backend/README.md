# Salsa Search backend

A small Node + TypeScript API used by the Angular app. It stores nothing: no database, no cache.

- **Express**: the most common Node web framework, so tutorials and answers are easy to find.
- **No build step**: Node 24 runs `.ts` files directly (it strips the types). `npm run check` runs `tsc` to type-check.

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
| `LLM_PROVIDER` | `gemini` (default) or `openai` |
| `GEMINI_API_KEY` | from https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | default `gemini-3.5-flash-lite` (cheap, pinned). If changed, update the prices in `src/llm.ts` |
| `OPENAI_API_KEY` | from https://platform.openai.com/api-keys (for `openai` or `npm run compare`) |
| `OPENAI_MODEL` | default `gpt-6-luna` (cheap, pinned). If changed, update the prices in `src/llm.ts` |
| `PORT` | default 3000 |

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
