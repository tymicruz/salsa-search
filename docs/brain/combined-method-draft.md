# Combined Method: DRAFT for owner review

Date: 2026-11-17
Status: **draft, not tested, not in the playbook.** Built from the 5 source files in `sources/` and the owner's workflows (`interviews/owner-workflows.md`). Nothing here has run on real data through the official routes yet.

## The core idea

**The main record is a "night"**: organizer + weekday + time, at a venue. Nights move between venues, and many hosts are cafés or bars that aren't salsa places. So we check the night and its organizer, not the building.

Each source has one main job:

| Source | Main job | Never used for |
|---|---|---|
| Salsavida (official MCP) | **Find** nights: venue, address, lat/lng, day, time, price | Proof that a night still runs (its dates are generated, not confirmed by organizers) |
| Google Places | **Pin** each venue: place ID, website, open/closed | Confirming salsa (it has no dance-school type and its searches are noisy) |
| Instagram | **Check** that a night still runs; **vibe** from floor videos; find new accounts through tags | Starting a city from scratch (it has no location search) |
| Facebook | **Check** through flyers and events; find organizers through groups and event search | The map |
| Reddit (owner pass by hand, monthly) | **Vibe**, and **finding** the hosted nights and plazas that listings miss | Checking |

## The method, per city

**1. Seed: three starting lists, merged**
- a. **Salsavida MCP**: run `search_events(city, next 30 days)`, then remove repeats by event ID. Read each event page's JSON-LD once to get the organizer's FB or IG link, and pull @handles from the description.
- b. **Google Places Text Search**: run several narrow queries ("salsa class", "salsa bachata", local-language terms, "latin dance social") and remove repeats by place ID.
- c. **Reddit pass** (owner pastes 3–5 recent threads) and, if approved, **Facebook event search**. Extract place names, nights, handles, groups and the comment dates.

**2. Resolve: turn every venue into a place ID**
- Search "<venue> <address>" near the source's lat/lng to get the place ID (stored).
- Place Details gives `websiteUri`. If it's a facebook.com or instagram.com URL, it goes straight to that source. If it's the venue's own site, read its links to find IG and FB.
- Linktree links are shown in the app but never opened by the system.

**3. Filter noise** (the owner's Workflow 2)
- Keep a candidate only if salsa appears in a class or social context on its own pages (website schedule, captions, flyers).
- Drop tango, ballet, wedding-choreography and kids-only studios, Zumba, reggaeton-only "Latin nights", and restaurants with "salsa" (the sauce) in the name.
- **Google never confirms salsa alone.** A second source has to agree.

**4. Expand: follow the organizers**
- Go through organizer IG accounts, their tags and mentions (teachers, DJs, venues), and the people who post in FB groups. One level deep.
- Each new handle or venue goes back through steps 2–3. Stop when the leads only point to nights already found.

**5. Check: is the night still running?** (the owner's Workflow 1)
- The organizer's IG comes first (it outranks the venue's account), then FB.
- An AI that reads images extracts day, time, price, styles, venue, and whether it's weekly from each flyer, using the caption as context. Pinned posts give the schedule but don't count for recency.
- **Running:** a post or flyer under 60 days old, or an upcoming event date.
- **Needs checking:** a Salsavida listing not edited for more than 6 months, or with no recent post.
- **Probably closed:** a Reddit "closed" hint or Google's `businessStatus`. Each is only a signal until a checker agrees.

**6. Classify each night**
- Type: social / class / live music / club with a salsa hour / hostel activity / park or street / festival.
- **Partner dancing: yes** only with first-hand evidence: a floor video, a flyer saying "social", or a recent comment from a dancer.
- Style (Cuban/casino, LA/On1, On2, SBK mix), level, and crowd (locals vs tourists): only when a source says so.

**7. Vibe**
- Reddit paraphrases plus at most one short quote with its permalink, IG floor videos and captions, and the Salsavida summary.
- Google reviews are **shown live only, never stored**.

**8. Store vs. fetch live**
- **Store:** the night, organizer, handles, place ID, Salsavida event ID/URL, our own extracted facts, every source link, the date checked, and the status.
- **Fetch live:** Google's name, hours, rating and reviews.
- **Never store:** raw Reddit text, or Salsavida descriptions in bulk.

**9. Refresh**
- Re-run the check (step 5) monthly for cities people search. Run the Reddit pass monthly too.
- Re-seed (step 1) less often.

## Decisions for the owner (nothing is enabled)
1. **Google Places API key.** About 50 calls per city, so the free tier covers roughly 20 cities a month.
2. **Instagram Business Discovery**: needs your professional IG account and a Meta app. Whether it's free is unverified.
3. **Apify for FB/IG** (about $3 per city for FB, about $2.60 per 1,000 IG profiles). This breaks Meta's terms unless Meta gives permission. One decision covers both.
4. **Reddit**: a monthly pass by hand (about 10 min per city), and optionally an AI web search limited to reddit.com (under $5 a month) after checking OpenAI's storage terms.
5. **Read Google's full terms (§3.2.3)** before relying on the storage rules above.

## Small calls I made (change if you disagree)
- Forums like expat.com are handled with the Reddit pass, the same way.
- When a night has no fixed venue, it's keyed on its organizer and the place ID stays empty.

## What still has to be proven
- Whether the 3 seeds together find what a local would find. **Test: blind cities, scored by the owner.**
- Whether the image-reading AI reads flyers reliably (dates, mixed languages).
- How often Reddit threads name handles or groups (the first by-hand pass will tell).
- The cost and time per city end to end.
- Where Salsavida's "no bulk replication" line falls for our storage.
