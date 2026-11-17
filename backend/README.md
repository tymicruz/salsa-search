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
| `GEMINI_MODEL` | default `gemini-flash-latest` (Google's newest Flash) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | only if `LLM_PROVIDER=openai` |
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
- **Cost (estimate, not yet measured):** one call of 20 places is about 4k input + 1.5k output tokens. At Gemini 3.8 Flash's listed $0.75 / $3.75 per 1M tokens (introductory price until 2026-12-31), that's about $0.01 per 20 places. "Thinking" tokens on newer models can add more.

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

## Note
This API fetches any URL it's given, so it should only run locally for now. Before it's deployed, block private and internal addresses.
