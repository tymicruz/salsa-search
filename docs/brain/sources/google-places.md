# Source: Google Places + venue websites + link pages

src-google, 2026-11-17. "Verified" = read on the official page this session. "Unverified" = not checked on an official page. No API key was used, so no live Places call was made; the worked example uses public pages and marks the Places steps as the call we *would* make.

## 1. What the source gives

**Google Places API (New)** (verified: [text-search](https://developers.google.com/maps/documentation/places/web-service/text-search), [place-details](https://developers.google.com/maps/documentation/places/web-service/place-details), [place-types](https://developers.google.com/maps/documentation/places/web-service/place-types))
- **Text Search**: a query such as "salsa in Ho Chi Minh City" returns places. Useful params: `includedType` (one Table A type) + `strictTypeFiltering`, `locationBias` (circle ≤ 50 km) or `locationRestriction`, `languageCode`, `regionCode`, `pageSize` ≤ 20, `pageToken`. **Hard cap: 60 results per query.**
- **Place Details** fields that matter to us, with their price tier:

| Field | Tier | Why we want it |
|---|---|---|
| `id` | IDs only (free) | the one thing we may store |
| `types` | Essentials | filtering |
| `primaryType`, `businessStatus`, `googleMapsUri` | Pro | filtering, "closed permanently", link-out |
| `websiteUri`, `regularOpeningHours`, `rating`, `userRatingCount` | Enterprise | **the hand-off to website/socials**, rough popularity |
| `reviews` (max 5), `reviewSummary`, `editorialSummary`, `generativeSummary` | Enterprise + Atmosphere | vibe and "do they actually do salsa" |

- **No Instagram/Facebook field.** None found in the Place Details field lists (verified absent on that page; the full [data-fields](https://developers.google.com/maps/documentation/places/web-service/data-fields) page not checked). Socials only come through `websiteUri`, or the website field *is* a Facebook/Instagram URL (common for small venues).
- **Place types:** Table A has `dance_hall`, `night_club`, `bar`, `cafe`, `hostel`, `school`. **There is no `dance_school` type**, so "salsa school" can't be type-filtered; it's text matching only.

**Venue websites** (plain HTTP fetch): schedule, prices, styles taught, and the links to Instagram/Facebook/YouTube/WhatsApp in the header/footer.

**Link pages (Linktree and similar):** one page listing a venue's Instagram, WhatsApp, booking form, schedule PDF.

## 2. How to get it: costs, limits, terms

**Places pricing** (verified earlier in [data-access.md §1](../data-access.md), [pricing](https://developers.google.com/maps/billing-and-pricing/pricing)). The priciest field in the field mask sets the price of the whole call.
- Text Search, Enterprise fields: 1,000 free/mo, then $35 per 1,000. With `reviews`: $40.
- Place Details, Enterprise: 1,000 free/mo, then $20 per 1,000. With `reviews`: $25.
- IDs-only calls: unlimited free. **Cheap pattern:** Text Search with the smallest field mask that still gives name + types (exact tier of `displayName` in Text Search unverified), then Details (Enterprise) only on places that survive the name filter.
- Rough per-city cost: ~6 queries × 3 pages + ~30 Details ≈ 50 calls, inside the free tier for ~20 cities a month.

**Places storage rules** (verified, [policies](https://developers.google.com/maps/documentation/places/web-service/policies))
- Store **place IDs forever**; lat/lng **up to 30 days**. Don't "copy and save business names, addresses, or user reviews", or pre-fetch/index them.
- Showing reviews/photos: credit the author, link via `googleMapsUri`, Google Maps attribution. AI summaries need their `disclosureText` right below; review summaries need the heading "Review summary" + link.
- **Meaning:** Google is a *finder and live lookup*. Our DB stores the place ID plus facts we got from other sources (the website, IG, a flyer). Name/address/hours shown in the app are fetched fresh. Service Specific Terms not read (unverified): owner should read them.

**Venue websites:** free, no account. Respect robots.txt. Many are WordPress/Wix and JS-heavy; schedules are often images.

**Linktree** (verified, [terms](https://linktr.ee/s/terms) eff. 2026-07-05, [robots.txt](https://linktr.ee/robots.txt))
- Terms §13: visitors "must not … use scripts, bots, scraping tools or other automated means … to access, download, extract" content from Linktree profiles.
- robots.txt: `User-agent: *` → `Disallow: /` (named search/AI bots are allowed on profiles, but that doesn't override §13).
- No official public API (vendor claims, unverified).
- **Meaning:** don't fetch Linktree pages automatically. Treat a Linktree URL as a pointer: show it to the owner/user as a link, or get the same socials from Google, IG bio or Facebook instead. Other link-in-bio hosts (Beacons etc.): not checked.

## 3. What it's good for

| Job | Places | Website | Linktree |
|---|---|---|---|
| **Find** | Good for *dedicated* venues (studios, Latin bars). Misses the café/bar that hosts one salsa night, since nothing salsa is in its name/types. | Weak (you need the URL first). | No. |
| **Check** | `businessStatus` (closed?), address/pin, hours, `websiteUri`. Matches a listing-site venue name to a real place. | Best free check: styles taught, class days, prices. | Points to current socials. |
| **Vibe** | 5 reviews + review summary ("crowded", "friendly beginners", "mostly bachata"). Live only, not stored. | Photos, tone, prices. | Little. |

Best use: **resolve a venue name we already have (from Salsavida, IG, a flyer) into a place ID + website**, not open-ended "salsa school" discovery.

## 4. Noise and how to filter it

The owner's complaint (Workflow 2): "salsa school" returns tango, ballet, wedding-choreography studios; "salsa dancing" returns places that barely do salsa. Also: restaurants with "salsa" (the sauce) in the name, Zumba gyms, kids' dance academies.

Filter in this order (cheap → expensive):
1. **Query design.** Use several narrow queries, not one: "salsa class", "salsa bachata", "clases de salsa" / local-language term (e.g. "lớp salsa"), "latin dance social", "salsa night bar". Dedupe by place ID. `locationBias` on the city centre.
2. **Name/type rules (free, from search fields).** Keep if name contains salsa / bachata / latin / casino / son / rueda / timba. Drop if `types` include `restaurant`/`meal_*` *and* name has no dance word (sauce restaurants). Flag, don't drop, generic "dance studio/academy" names.
3. **Website text check (free).** Fetch `websiteUri`, count style words. Keep if salsa appears in a schedule/class context. Drop if the style list is ballet/contemporary/K-pop/hip-hop/tango/wedding/kids-only and salsa is absent or only in a long style menu. Watch out: page builders contain words like "social" in CSS class names (`xsalsa.vn` had 297 hits for "social", almost all code); match visible text only.
4. **Reviews check (Enterprise+Atmosphere, only for unclear ones).** Do reviews mention salsa classes/socials, partners, beginners?
5. **Corroboration rule.** A place is "salsa-confirmed" only when a second source agrees: a listing site, an IG post/flyer in the last ~60 days, or the venue's own schedule. Google alone never confirms salsa.
6. **Freshness.** `businessStatus != OPERATIONAL` → drop. Events move between venues (see Bangkok below), so a place that *used to* host is not proof.

## 5. Hand-offs

```
listing site / IG / flyer ── venue name ──► Text Search "<name> <city>" ──► place ID (store)
                                                   │
                                     Place Details: websiteUri, googleMapsUri, businessStatus, hours, reviews
                                                   │
                     websiteUri is ┌─ facebook.com/... ──► src-facebook (page → photos → flyer)
                                   ├─ instagram.com/... ──► src-instagram (Business Discovery / profile)
                                   ├─ linktr.ee/...     ──► don't fetch; show as link, find socials elsewhere
                                   └─ own site ──► fetch HTML, extract <a href> to instagram / facebook /
                                                    wa.me / zalo / youtube / linktr.ee ──► IG, FB sources
```
- **Into Google:** listing-site venue names and addresses; IG bio addresses; flyer text ("at Cocoon Rooftop, D1").
- **Out of Google:** place ID (the join key everyone can store), map pin, website → socials.
- **From Reddit:** venue names people mention → resolve via Text Search.
- Google is the **join key**, not the source of salsa truth.

## 6. Worked example: Ho Chi Minh City (+ Bangkok check)

Inputs from Salsavida HCMC ([guide](https://www.salsavida.com/guides/vietnam/ho-chi-minh-city/)), as the owner's Workflow 1 does.

| Venue (from listing) | Places query we'd run | What the public pages show | Hand-off |
|---|---|---|---|
| XSalsa Studio, 28 Ngô Thời Nhậm, D3 ([listing](https://www.salsavida.com/event/vietnam/ho-chi-minh-city/salsa-bachata-classes-at-xsalsa-studio/)) | "XSalsa Studio Ho Chi Minh City" | Listing gives website `xsalsa.vn`. Raw HTML (1.6 MB WordPress/Avada page) links **facebook.com/xsalsa** and **youtube.com/xsalsavn**; no direct IG link found (only IG widget CSS). "salsa" ×133, "bachata" ×5; no tango/ballet. Classes Mon–Sun except Fri, 600k VND / 8 sessions. | → FB page; IG must come from FB/IG search |
| Vela Dance Studio, 383 Võ Văn Tần, D3 ([listing](https://www.salsavida.com/event/vietnam/ho-chi-minh-city/sunday-salsa-bachata-classes-at-vela-dance-studio)) | "Vela Dance Studio Ho Chi Minh City" | The listing's "website" is a **Facebook photo URL** (login wall for us). Expect Google `websiteUri` to be a FB URL too (unverified). | → src-facebook directly |
| My House, 14 Tôn Thất Đạm, D1, "239 Salsa Thursdays" ([listing](https://www.salsavida.com/event/vietnam/ho-chi-minh-city/239-salsa-thursdays-at-my-house)) | "My House 14 Ton That Dam" | A non-salsa venue hosting one weekly social (owner's café/bar case). Google would never return it for "salsa". Organizer IG **@salsa.thursdays.cuban.vietnam** is in the listing text; FB event link given. | → src-instagram on organizer handle; Google only for pin + ID |
| Saigon Dance Center, 143 Nguyễn Du, D1 (from a "top dance schools" blog, [mytour](https://mytour.vn/en/blog/bai-viet/top-9-best-modern-dance-centers-in-ho-chi-minh-city.html)) | would appear for "dance school Ho Chi Minh City" | Modern/event-dance school; no salsa evidence found. | **Noise**: drop unless a second source mentions salsa |

Lessons: (1) the strongest leads are *organizers* (239 Boyz & Girlz), not places; Google only pins them. (2) Small studios' "website" is often Facebook, so Google → FB is the common path, as the owner found. (3) Website link extraction must read raw `<a href>`, ignoring CSS/JS.

**Bangkok check** ([Salsavida Bangkok](https://www.salsavida.com/guides/thailand/bangkok/)): "Latin Soul Tuesday" is listed at Assembly Point, then Red Door BKK, and a search summary puts it at Amber Bar ([1](https://www.salsavida.com/?p=25662), [2](https://www.salsavida.com/event/thailand/bangkok/latin-soul-tuesday-party-at-red-door-bkk/)). All three places would exist in Google and look fine. **The event, not the place, is the thing to verify**: check by the organizer's latest posts, not the place.

## Fit with other sources

When this was written, no other source files existed yet. I sent these proposals to src-listing, src-instagram, src-facebook and src-reddit. All four have now replied and agree with the points below. No disagreements are left:
- **The place ID is the shared join key.** It's the only Google data any source may store.
- **Google never confirms salsa on its own.** It needs a second source: a listing, a recent IG/FB post, or the venue's own schedule.
- **Socials come only through `websiteUri` or the venue site's links.** The common path is Google → Facebook (owner Workflow 1).
- **Linktree is shown as a link, never fetched.** Its terms (§13) and robots.txt forbid automated access.
- **We check the event and organizer, not the place.** Events move between venues (Bangkok example).
**Agreed with src-listing:**
- **Better input for Text Search.** Salsavida has an official free MCP with no login (`mcp.salsavida.com/mcp`). It gives each event's venue name and full street address, and the page's JSON-LD adds lat/lng. So we search "<venue> <address>" and put that lat/lng in `locationBias`, which should match more reliably than the name alone.
- **We may store Salsavida's lat/lng.** It isn't Google content, so Google's 30-day limit doesn't apply to it.
- **The main record is the night:** organizer + weekday + time at a venue. The place ID and the organizer's handle hang off the night, because nights move between venues (Bangkok example). This settles the earlier open question.
- **Listing sites are one of three cold-start seeds.** Google never confirms salsa alone, and Linktree is shown, not fetched.

**Agreed with src-facebook (2026-11-17):**
- **Facebook checks; Google pins.** Google gives the place and its place ID. Facebook proves an event is "still running" with a flyer or post under 60 days old, or an upcoming event date.
- **Facebook events give Google its input.** An FB event's address and lat/lng go back to Text Search to get a place ID.
- **We check the event and organizer, not the place.**
- **Storage.** We store the place ID plus our own facts from Facebook and Instagram. Google's name, hours and reviews are always fetched live.
- **Never plain-fetch a facebook.com URL from `websiteUri`.** facebook.com's robots.txt disallows all crawlers, and Meta's Automated Data Collection Terms require written permission. Route the URL to the Facebook source instead.

**Agreed with src-instagram:**
- If `websiteUri` is an instagram.com URL, that gives us the handle.
- Venue names and addresses from IG captions and flyers go to Text Search to get a place ID and pin.

- **The organizer's IG outranks the venue's** for checking whether a night still runs.
- **Linktree is shown, never fetched.** They first proposed fetching it; they agreed after I pointed to Linktree's terms §13 and robots.txt.

- **Cold start (now agreed).** Places is one of three seeds, alongside listing sites and organizer handles. Background: They want Google Places to be the cold-start source of venues, because IG has no location search (verified). I said only half-agree: Places finds dedicated studios and Latin bars, but misses hosted nights like "My House" in HCMC. Listing sites and organizer handles should seed alongside it, so Places is one seed, not *the* seed.

**Agreed with src-reddit:**
- Every place named on Reddit goes through Text Search before it is stored.
- We store the place ID, the thread permalink and our own facts, with no raw Reddit text.
- Fields I asked them to send: name, area/district, street if given, city, night/day, organizer name or handle, and the **comment date**. src-reddit added the date because threads go stale: a Reddit mention counts as a second "is it really salsa?" source only when the comment is recent. If a night has no fixed venue, we key it on the organizer and leave the place ID empty.
