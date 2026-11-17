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

### POST /socials
Fetches the website once and returns the Instagram, Facebook and Linktree links it finds.
```jsonc
// request
{ "url": "https://example-school.com" }
// response
{ "instagram": ["https://www.instagram.com/exampleschool"], "facebook": [], "linktree": [] }
```
- It obeys robots.txt, sends the User-Agent `SalsaSearchBot/0.1`, and gives up after 6 seconds.
- It never fetches instagram.com, facebook.com or linktr.ee. If the URL is one of those, it's returned as the link.
- Errors return `{ "error": "..." }` with status 400 (bad input) or 502 (site or LLM failed).

## Note
This API fetches any URL it's given, so it should only run locally for now. Before it's deployed, block private and internal addresses.
