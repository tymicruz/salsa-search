# Blind Pilot: Run Instructions

You are researching one city's salsa scene from public sources only. You are testing a research playbook, so follow it and log everything.

## Rules
- **Do not open anything under `docs/brain/` except this file.** In particular, do not open `interviews/`, `answer-key-*`, `strategy-library.md` or other pilot results. They contain the answers and would spoil the test.
- Use only web search and public web pages. No logins, no paid APIs, no API keys.
- Report only places you found in a source you can link. Never add a place from memory or general knowledge.
- Every vibe note must quote or closely paraphrase a source. Don't invent one.
- If a page is blocked (login wall, needs JavaScript, error), log it as blocked and move on.

## Playbook (run the steps in order)

1. **Event listing sites.** Search "salsa <city>", "salsa social <city>", "clases de salsa <city>", "bailar salsa <city>". Open the city guides on salsa event sites, such as salsavida.com. Treat each listing as a lead, not a fact. Stop when you've collected every listing.
2. **Salsa schools on Google Maps.** Search "salsa school <city>", "escuela de salsa <city>", "academia de baile <city>". Note each school's rating, review count and recent reviews. Stop after the top 5–10 schools, or when reviews stop adding anything new.
3. **Places named in reviews.** In the reviews from step 2, note any other school, social, bar, beach or park that gets named. Add each one as a lead. Stop when new names stop appearing.
4. **Instagram and websites.** For each school and venue, find its website and Instagram. Read the event posts visible without logging in (day, time, price, which school hosts). Follow tagged instructors and venues one level deep. Stop when the accounts lead back to places already found.
5. **Hostels.** Search "<city> hostel salsa night" and "<city> hostel salsa class". Label these as hostel activities unless a source shows real social dancing.
6. **Reddit and forums.** Search Reddit for "salsa <city>" and "<city> salsa dancing". Record place names and short vibe quotes, with each thread's date. Stop when threads stop naming new places.
7. **Festivals.** Search "<city> salsa festival" and "festival de salsa <city>". Record the names and dates.

## Output: `docs/brain/pilots/<city>.md`

### A. Search log
A table with one row per search or page: step number, query or URL, what it gave you (places found, nothing, or blocked).

### B. Places
One entry per place:
- Name
- Kind: social dancing / classes / live music / club with a salsa hour / hostel activity / street or park
- Partner dancing: yes / no / unclear
- Day and time, if a source gives it
- Who it suits: everyone / beginners / advanced, if a source says
- Crowd: locals / tourists / mixed, if a source says
- Vibe note with a quote from a source
- Sources (links), the date each was checked, and which step found it
- Status: "found in 1 source" or "confirmed by 2+ sources"

### C. Step report
For each step, record what it found, what was blocked, and roughly how long it took.

### D. Blind spots
Anything you suspect exists but couldn't confirm from public sources.
