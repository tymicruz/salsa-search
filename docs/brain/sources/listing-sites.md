# Source: event listing sites (Salsavida and similar)

Researched by src-listing, 2026-11-17. **Verified** means read on the site's own page or tested against its public endpoint. **Unverified** means secondary sources only, or the page blocked us. No accounts, keys, or paid services were used. Practice cities: Ho Chi Minh City (HCMC) and Medellín.

## TL;DR
- **Salsavida is the only listing site that matters for socials and classes worldwide.** It also has an **official, free, no-auth MCP server** (`https://mcp.salsavida.com/mcp`) built for exactly this kind of lookup. Use it, not scraping.
- The other sites are festival-only, Europe-only, US-only, or blocked. They add little for "where can I dance this week".
- Listings are a **lead list, not truth**. Salsavida says itself that recurring dates are "scheduled from recorded data, not organizer confirmed". Each listing has to be checked against Google, Facebook, and Instagram.

## 1. What the source gives

| Site | What it lists | Coverage | HCMC | Medellín | Notes |
|---|---|---|---|---|---|
| **[Salsavida](https://www.salsavida.com/guides/)** | socials, classes, festivals, by city | worldwide; "6,500+ events", 129+ countries (site claim) | 7 distinct events (6 weekly + 1 festival) | 12+ distinct events (68 occurrences / 30 days) | Best by far. Official MCP. JSON-LD in HTML. |
| [Latin Dance Calendar](https://latindancecalendar.com/) | festivals ("400+"), schools ("500+") | worldwide | only Saigon Latin Festival (page text says Vung Tau) | none ("Medellín On Fire" linked, not read) | festival-focused; past events stay listed |
| [GO&DANCE](https://www.goandance.com/) | festivals, parties, venues, schools | Europe in practice | none | none (Colombia school category only) | terms ban automated extraction |
| [DancePlace](https://www.danceplace.com/) | events, schools, classes, socials | worldwide, thin | none | 1 zouk festival (not salsa) | terms ban scraping |
| [DanceUS](https://www.danceus.org/) | city calendars, studios | US + ~9 big EU/CA cities | none | none | event details need sign-in |
| [Social Dance Live](https://www.socialdancelive.com/) | socials, classes, festivals by city | search snippets suggest Korea/Vietnam-heavy (unverified) | unknown | unknown | **blocked**: HTTP 429 + Vercel bot checkpoint |
| salsabachata.events | festivals, dance nights | worldwide (search snippet: 68 salsa events) | unknown | unknown | **DNS fails**, appears dead |

**Salsavida fields per event (verified via MCP `get_event` and page JSON-LD):** title, summary, event types (`social` / `lesson` / `festival`), dances (`salsa` / `bachata`), salsa style tags (often empty), **venue name, street address, lat/lng** (JSON-LD), price text, start/end time, recurrence, `source_modified_at` (last edit of the listing), canonical URL. The HTML JSON-LD also has **organizer name + URL** (a Facebook page/event or an Instagram link), which the MCP output did not include in our test.

## 2. How to get it: costs, limits, terms

### Salsavida (recommended: MCP)
- **Official MCP** ([docs](https://www.salsavida.com/developers/mcp/), verified + tested 2026-11-17):
  - Endpoint `https://mcp.salsavida.com/mcp`, Streamable HTTP, **no auth, free, read-only**.
  - Tools: `search_locations`, `search_events` (location, dates up to 1 year, dance, event_type, salsa_style, language; 50/page, 10 pages), `get_event`, `get_guide`.
  - Limits: ~120 calls/min per IP; responses capped at 128 KB, then paginated with `next_cursor`.
  - Freshness: the index checks Salsavida for changes about every 5 minutes. Each response carries `source_checked_at` and a `freshness` flag, and results are withheld after 24 h without a check.
  - **Terms on that page:** credit Salsa Vida and link to the event; "Public access does not grant permission to republish the entire Salsa Vida database or reproduce protected descriptions at scale"; "Avoid … bulk replication". Don't present recurring info as verified.
  - **What this means for us:** OK to query per city, store our *own* facts plus the Salsavida event ID/URL as a lead, and link back. Not OK to mirror the whole catalog or copy their descriptions into our UI.
- **Website:** [robots.txt](https://www.salsavida.com/robots.txt) is `Disallow:` (nothing blocked), with sitemaps. But the [Terms of Service](https://www.salsavida.com/terms-of-service/) (updated 2026-09-15) ban "scrape or copy the Service at scale without permission". **Use the MCP, not page scraping.**
- City pages render the first ~6 cards server-side plus a JSON-LD `ItemList` of `Event`s. The rest load by JS ("Load More"). Event pages have a full `Event` JSON-LD with `Place`, `geo`, `organizer`.
- Per-event "Add to calendar" (Google/Outlook links). The `?sv_calendar=ics` URL seen in search returned HTML, not an `.ics` file (tested).

### Others (verified on each site's own pages)
- **GO&DANCE:** [terms](https://www.goandance.com/es/legal/terminos-de-uso) §7 ban "cualquier procedimiento automatizado para extraer, recolectar o raspar". robots.txt blocks `/api/*`. **Don't automate.**
- **DancePlace:** [terms](https://www.danceplace.com/pages/terms) §2.2 ban "automated scraping, data mining". **Don't automate.**
- **DanceUS:** [terms](https://www.danceus.org/about/terms/) §2.1 ban reuse of content without permission. robots.txt blocks `/api/`, `/rss2s/`, `/search-events/`. Details need sign-in. **Not useful.**
- **Latin Dance Calendar:** no terms page found. robots.txt leaves festival pages open. Festival-only, so low value; manual check at most.
- **Social Dance Live:** couldn't read (429 + bot checkpoint), so terms unknown. **Unverified.** The owner could look by hand.

## 3. What it's good for

- **Finding: strong.** One call per city gives venue names, addresses, days, and times. That is the seed list for Google Places. It's the owner's Workflow 1 step 1, automated.
- **Checking: weak alone.** Dates are generated from a stored recurrence rule. `source_modified_at` shows how stale a listing is (HCMC: 3 of 7 listings untouched since 2025-07-24, which looks like a bulk import). Checking has to come from Facebook/Instagram recency.
- **Vibe: some.** Summaries give hints ("rooftop", "house-party setting", "live orchestra", "free"), plus price and "Live music"/"Free" features. No photos of real nights (default image), no reviews.

## 4. Noise and how to filter it

| Noise | Example | Filter |
|---|---|---|
| Stale recurring listings | 4 HCMC events last edited 2025 still produce weekly dates | Flag `source_modified_at` older than ~6 months as "needs checking"; require a recent FB/IG post to confirm |
| Same event repeated per date | 41 HCMC results = 7 events | Dedupe on `event_id` |
| Same event per language | `?p=23435` vs `?p=34261` (es) vs `?p=71764` (it) | MCP shares one event ID across translations; prefer `language: en` |
| Mixed-style nights | "Afro Latin Tuesday" opens with an Urban Kiz workshop | Keep but tag; read the summary for what the salsa part actually is |
| Bachata-heavy "SBK" nights | "Saturday SBK Party" | Keep; salsa share is unknown, so check flyers/IG |
| Festivals ≠ weekly scene | Saigon Latin Festival, venue "TBA" | Separate `festival` type from socials/classes |
| Venue only in the title | city cards show "Ho Chi Minh City" only | Use the `venue`/`address` fields (MCP) or JSON-LD `location` |
| Tourist events | Medellín "Caribbean Night Pub Crawl" | Tag as tourist; still a real place to dance |
| Missing places | Salsa-only clubs that never submit listings | Expected: other sources fill gaps (listing = seed, not complete) |

## 5. Hand-off to other sources

```
Salsavida search_events(city)
  ├─ venue + address + lat/lng ──► Google Places Text Search "<venue> <address>" → place ID → website, hours, FB/IG links
  ├─ organizer URL (from event-page JSON-LD) ──► Facebook page/event → photos/flyers (recency check)
  │                                          └► Instagram profile → latest posts (recency + vibe)
  └─ event title + city ──► Reddit (by hand) for "is it still on / what's it like"
```
- **To Google:** venue name + street address + coordinates are enough to match a place reliably (better than searching "salsa" in Maps, which the owner found noisy).
- **To Facebook/Instagram:** organizer links come from the page JSON-LD, not the MCP. In HCMC they pointed to a FB video share, a FB event, and `instagram.com/saigondancecollab`. These are often post/share links, not profile links, so resolve them to the page/profile.
- **From others back to listings:** when Google/IG finds a venue Salsavida lacks, that's a coverage gap, not an error. Salsavida has "+ Add Event" for organizers. We don't submit.

## 6. Worked example: Ho Chi Minh City (and Medellín)

**HCMC**, MCP `search_events(location="Ho Chi Minh City", 2026-11-16 → 2026-12-15)`: `freshness: fresh`, 41 occurrences → **7 events**:

| Event | Type | Venue | Price | Last edited |
|---|---|---|---|---|
| Afro Latin Tuesday at Cocoon Rooftop | social + lesson | Cocoon Rooftop, Fl 8, 105 Co Giang, D1 | 100K VND | 2025-07-24 ⚠ |
| 239 Salsa Thursdays at My House | social + lesson | My House (bar), D1 | Free | 2026-09-21 |
| Saturday SBK Party at FSC Garden | social | FSC Garden | 100K VND incl. drink | 2025-07-24 ⚠ |
| Salsa & Bachata Classes at XSalsa Studio | lesson | 28 Ngô Thời Nhiệm, D3 | 600K VND / 8 sessions | 2025-07-24 ⚠ |
| Weekly Salsa Classes at La Danza Saigon | lesson (Sat & Sun 2–5 PM) | LYS Studio, 121 Bui Huu Nghia, Binh Thanh | Varies | 2026-04-11 |
| Sunday Salsa & Bachata Classes at Vela | lesson | Vela Dance Studio, D3 | Varies | 2026-07-09 |
| Saigon Latin Festival 2026 (Dec 3–6) | festival | TBA | from US$140 | 2026-08-13 |

- **Read:** 3 social nights (Tue/Thu/Sat), 3 class schools, 1 festival. This matches the owner's Workflow 1 example (a bar like My House hosting one weekly salsa night).
- **Next step per row:** the Thursday night is fresh and free, so check FB event `239 Boyz & Girlz` for this week's flyer. Tuesday and Saturday are ⚠ stale, so they need a recent FB/IG post before we show them as "on".
- The site's headline count is inconsistent: the guide said "17 upcoming events in the next 30 days", while search snippets showed 50 (es: 13). Use MCP counts, not page text.
- Other sites: none had HCMC socials (Latin Dance Calendar has only the festival).

**Medellín** (website page, 2026-11-17): 68 occurrences / 30 days, 12 distinct, e.g. Son Havana (Wed timba, Thu/Sat/Sun live bands), Posada León live orchestra, Casa Ritmo Latino (free class + social), Nueva Guardia, Timbalé practice, Comfama Sunday family salsa, plus a tourist pub crawl. Much denser than HCMC and heavy on live-music venues, a strong vibe signal. Other sites: only a zouk festival (DancePlace).

## Open questions
- Whether `search_events` MCP output can include organizer links (not seen in our test). If not, fetch the event page's JSON-LD once per event (small, polite, within ToS spirit), or ask Salsavida.
- Social Dance Live: worth a manual look by the owner for Asian cities.
- Exact storage limits: the MCP terms forbid mass republishing but don't define "at scale". Keeping ID + URL + our own checked facts looks safe; **unverified with Salsavida**.

## Fit with other sources
Read google-places.md, instagram.md, facebook.md, and reddit.md (2026-11-17), and sent proposals to all four. **All four replied and agreed** (2026-11-17).

**Agreed in replies:**
- **The main record is the night** (organizer + weekday + time at a venue). The place ID and handles hang off it (google, instagram).
- **Stale rule:** a listing with `source_modified_at` over ~6 months old stays "unconfirmed" until FB/IG shows a post under 60 days old or a future event occurrence (instagram, facebook).
- **Listing → Google:** Text Search `"<venue> <address>"` with the listing's lat/lng as `locationBias`. Salsavida's coordinates aren't Google content, so Google's 30-day limit doesn't apply to them (google).
- **Listing → Instagram, skipping Google:** take any instagram.com URL or @handle from `organizer.url` **and from the description text**. 239 Thursdays' handle appears only in its text (instagram).
- **Listing → Facebook:** resolve share/occurrence URLs to the Page or event (facebook).
- **Second finder:** Apify FB events search "salsa <city>" (~10–30 events) works alongside listings. It's subject to the owner's Apify decision (facebook).
- **Forums (expat.com etc.) belong to the Reddit pass**, read by the owner the same way (reddit).
- Extra noise from src-facebook: listing contact details can be wrong (the FSC listing's email is a bellydance address). Treat listing contacts as hints only.

**Agreed (already stated in their files):**
- **Listings are a seed, not proof.** google-places.md and facebook.md both name listings as the first hand-off for HCMC. Cold start uses three seeds: listings, Google Places, and organizer handles (google ↔ facebook agreement).
- **Listings hand over social links directly.** instagram.md found IG handles for 2 of 3 HCMC events from Salsavida. facebook.md uses the listed FB recurring-event URL for 239 Salsa Thursdays.
- **Checking belongs to FB/IG**: a post or flyer under 60 days old, or a future FB event occurrence. **Google pins** the place with a place ID. **Reddit adds vibe** and finds places listings miss. It cross-checks against us and is never proof alone.
- **Verify the event/organizer, not the place.** Nights move between venues (Bangkok "Latin Soul Tuesday" across 3 venues).

- Use Salsavida's **MCP** for the cross-checks src-reddit asks for, and read organizer links from event-page JSON-LD.

**Disagreements:** none. One addition to the others' files: they read Salsavida by fetching pages. The official MCP is the cleaner, terms-friendly route for that step.
