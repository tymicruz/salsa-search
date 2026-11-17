# Source: Facebook (pages, photos/flyers, events, groups)

Researched by src-facebook, 2026-11-16. **Verified** = read on the official page. **Unverified** = secondary sources or general knowledge. I did not open facebook.com itself: its robots.txt disallows all crawlers (see §2), so logged-out visibility below is unverified and should be checked by hand by the owner.

## 1. What the source gives

| Part | What's there for salsa | Notes |
|---|---|---|
| **Business pages** | name, category, address, phone, website, Instagram link, intro text, rating, followers | Venue pages (bars, cafés, schools). Many organizers use a profile (`profile.php?id=…`) instead of a Page. |
| **Photos / flyers** | weekly flyers ("Salsa every Thursday 9pm"), class timetables, crowd photos | The owner's Workflow 1 ends here. Images need AI that reads images (OCR/vision). |
| **Posts** | captions with day/time/price, "tonight!" posts, cancellations | Best recency signal: is the night still running? |
| **Events** | name, start/end time, venue + lat/lng, host(s), going/interested counts, ticket link, recurring occurrences | Strongest structured signal where organizers use them. Recurring weekly nights show up as one event with per-date occurrences (e.g. `/events/<id>/<occurrence-id>/`). |
| **Groups** | city groups ("Salsa Bangkok", "Saigon Latin Dance") where organizers post weekly flyers and locals ask "where to dance tonight?" | Best single source of *who's active in the scene* and vibe; mostly human chatter. Many are private. |

## 2. How to get it: costs, limits, terms

### Official Graph API (Meta) — mostly closed to us
- **Events: closed.** "Access to Events on Users and Pages is only available to Facebook Marketing Partners." Group events need an event admin's token plus the Groups API. (verified, [Event reference](https://developers.facebook.com/docs/graph-api/reference/event/)). The `/page/events` reference page now returns 404 (verified 2026-11-16).
- **Groups: closed.** Groups API, `publish_to_groups` and `groups_access_member_info` were deprecated in v19.0 (Jan 2024) and "removed April 22, 2024" for all versions. (verified, [v19.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version19.0/))
- **Page posts/metadata: possible but heavy.** [Page Public Content Access (PPCA)](https://developers.facebook.com/docs/features-reference/page-public-content-access) (verified):
  - Gives "business metadata, public comments and posts" of Pages we don't manage, plus the Pages Search API. Endpoints: `/page/feed`, `/page-post`, comments. Allowed use: "Analyze and/or display posts and engagement on Pages."
  - Needs **App Review and Business Verification**. Before review, only Pages whose admin has a role on our app work. Says nothing about events.
  - Third-party reports say PPCA approval is strict and often refused (unverified, [Datashake](https://www.datashake.com/blog/facebook-social-data-api-in-2026)). Business Verification needs a registered business — a blocker for a solo owner (unverified).
- **[Page Public Metadata Access](https://developers.facebook.com/docs/features-reference/page-public-metadata-access)** (verified): likes/followers and "about" info across many Pages; also App Review + Business Verification; "superseded by" PPCA.
- **Page photos** (`/page/photos`): needs a Page token from an admin, or PPCA for other Pages. (verified, [page/photos](https://developers.facebook.com/docs/graph-api/reference/page/photos/))
- **[Pages Search API](https://developers.facebook.com/docs/pages-api/search-pages)** (verified): `GET /pages/search?q=` returns id, name, location (incl. lat/lng), link. Needs PPCA or Page Public Metadata Access for app tokens. "Alias-based searches … might not return pages that have a low fan following" — small salsa pages are exactly these.
- Cost: no price on the docs; Graph API is generally free (unverified). Rate limits: Platform Rate Limits ([rate-limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)).
- **Verdict:** only PPCA is realistically open, it needs a verified business and review, and it still gives no events or groups. Not worth it at our stage.

### Scraping facebook.com — forbidden by Meta's terms
- [Automated Data Collection Terms](https://www.facebook.com/apps/site_scraping_tos_terms.php) (effective 2024-10-07, verified): "You will not engage in Automated Data Collection without first obtaining Meta's express written permission". Allowed purposes are only search-engine results or link previews.
- [robots.txt](https://www.facebook.com/robots.txt) (verified): "Collection of data on Facebook through automated means is prohibited unless you have express written permission"; `User-agent: *` → `Disallow: /` (ClaudeBot, GPTBot etc. also disallowed).
- Legal context: in *Meta v. Bright Data* (N.D. Cal., Jan 2024) the court held Facebook's terms did not bar **logged-out** scraping of public data; Meta later dropped the case (unverified, law-firm summaries: [FBM](https://www.fbm.com/post/102kqw7/), [MediaPost](https://www.mediapost.com/publications/article/392920/judge-sides-against-meta-in-battle-over-scraping-p.html)). That lowers but doesn't remove risk; the ruling predates the Oct 2024 terms. Not legal advice — owner decides.

### Logged-out viewing (by hand) — unverified
From general knowledge, not tested: a logged-out browser usually sees a Page's header/intro, some recent posts and some photos before a login wall; public event pages usually show title, time, venue and description; public groups show "About" and sometimes a few posts; private groups show only name and member count. Meta changes this often. **Owner should check one venue page, one event and one group logged out.**

### Third-party: Apify official Facebook actors (unverified prices; read on Apify store pages 2026-11-16)
All run logged-out (no cookies) through Apify proxies. Apify Free plan = **$5 platform credit/month**, no rollover ([pricing](https://apify.com/pricing)).

| Actor | Input | Key output | Price (Free plan → best tier) | Limits |
|---|---|---|---|---|
| [facebook-pages-scraper](https://apify.com/apify/facebook-pages-scraper) | Page URLs | intro, categories, website, email, phone, address, rating, followers | $12 → $5.40 / 1k pages | no search |
| [facebook-photos-scraper](https://apify.com/apify/facebook-photos-scraper) | Page/profile URLs | image URL, photo URL, **`ocrText`** | from $1.10 / 1k photos | ~5,000 results avg. |
| [facebook-posts-scraper](https://apify.com/apify/facebook-posts-scraper) | Page/profile URLs, date filter | text, time, likes/comments, media with **`ocrText`**, links | $5 → $2 / 1k posts (+$2/1k with date filter) | public only |
| [facebook-events-scraper](https://apify.com/apify/facebook-events-scraper) | **keyword + place search** ("salsa Bangkok"), event URLs, page `/upcoming_hosted_events`, group `/events` | name, description, utcStartDate, address, lat/lng, going/interested, organizers, ticket/external links, isCanceled, isPast, imageUrl | $13 → $7 / 1k events | logged-out search gives ~10–30 events per keyword; page/group lists only recent events |
| [facebook-groups-scraper](https://apify.com/apify/facebook-groups-scraper) | group URLs, date filter | post text, time, author, comments, media | $5 → $2.60 / 1k posts | **public groups only** |

- Community actors exist at $0.80–$6 / 1k events (e.g. [scrapesmith](https://apify.com/scrapesmith/facebook-events-scraper), [s-r](https://apify.com/s-r/facebook-events)) — less reliable, unverified.
- Terms risk: **medium–high**. These violate Meta's Automated Data Collection Terms as written; liability sits with us and Apify. Group posts carry personal data (author names) — store none of it.
- Rough cost per city (estimate): 30 pages ($0.36) + 30×20 photos ($0.66) + 3 event searches × 30 ($1.17) + 2 groups × 100 posts ($1) ≈ **$3**, near the whole $5 free credit. At paid tiers about half.

## 3. What it's good for

- **Finding:** Events keyword search ("salsa <city>") is the only Facebook path that *finds* unknown places; groups reveal organizers and venues nobody lists. Pages don't find anything on their own (Pages Search is closed and weak for small pages).
- **Checking (strongest use):** a flyer posted in the last 2–4 weeks, or an upcoming event occurrence, proves the night still runs. This is exactly the owner's Workflow 1. `isCanceled` / `isPast` and post dates give recency.
- **Vibe:** crowd photos, "going/interested" counts, group chatter ("great social, friendly beginners"), flyer style (SBK vs Cuban/casino vs salsa on2).

## 4. Noise and how to filter it

- **Salsa the food/sauce, Zumba, "Latin night" with reggaeton only, bachata-only/kizomba-only nights.** Filter: require partner-dance words in text or OCR (salsa + social/clase/class/SBK/on1/on2/casino/rueda) and drop reggaeton/Zumba-only.
- **Stale content:** pages with 2019 flyers; recurring events with no future occurrence. Rule: trust only posts/events dated in the last ~60 days; drop `isPast` events.
- **One-off events vs weekly nights:** festivals and workshops are noise for "where can I dance this week" — keep separately. Detect weekly via recurrence or "every Thursday / todos los jueves".
- **Duplicates:** the same night posted by venue, organizer and DJ. Merge on venue + weekday + start time.
- **Other cities:** group posts and event search leak nearby cities; check event address/lat-lng against the city.
- **Flyer OCR errors / mixed languages** (Vietnamese, Thai, Spanish): use a vision model, not plain OCR, and keep the image link for human review.
- **Profiles vs Pages:** many organizers use personal profiles (e.g. `profile.php?id=…`). Treat as organizers, store no personal data.

## 5. Handoffs

- **In:** Google Places (`websiteUri` or the website's footer often links the Facebook page) → Facebook page. Listing sites (Salsavida) often give the organizer's Facebook event/profile URL directly. Instagram bios sometimes link Facebook.
- **Out:**
  - Page → website, Instagram, phone (from intro/about) → src-google / src-instagram.
  - Event → venue name + address + lat/lng → Google Places to get a place ID and mark the place.
  - Event hosts / group posters → organizer names → Instagram handle lookup.
  - Group posts → new venue names → Google Places check.
- **Role:** Facebook is a *checker and organizer-finder*, not a primary map. Google gives the place; Facebook (or Instagram) proves the salsa night is live.

## 6. Worked example: Ho Chi Minh City (plus Bangkok)

Done without opening facebook.com (robots.txt) and without Apify (no account). It shows what the handoff gives and where Facebook would come in.

1. **Salsavida → organizer links** (fetched 2026-11-16):
   - *Saturday SBK Party at FSC Garden*, 1B Pham Ngoc Thach, D1; every Sat 9pm–1am, 100k VND; organizer Saigon Dance Collab. Link given is **Instagram** (`instagram.com/saigondancecollab`), no Facebook. → hand to src-instagram. ([listing](https://www.salsavida.com/event/vietnam/ho-chi-minh-city/saturday-sbk-party-at-fsc-garden/))
   - *239 Salsa Thursdays at My House*, 14 Ton That Dam, D1, 3rd floor; every Thu, free class 8:45pm then social. Organizer link is a **Facebook recurring event occurrence**: `facebook.com/events/1646598616243627/1684242382479250/`. ([listing](https://www.salsavida.com/event/vietnam/ho-chi-minh-city/239-salsa-thursdays-at-my-house))
2. **What Facebook would do next (not run):** feed that event URL to the Apify events actor → expect upcoming occurrences, venue lat/lng, hosts, going counts. If a future Thursday occurrence exists and isn't cancelled → night confirmed. Venue "My House" → Google Places for a place ID. Hosts → Instagram (`@salsa.thursdays.cuban.vietnam` is named in the listing).
3. **Discovery check:** an events search "salsa Ho Chi Minh City" would be the finding step; logged-out it returns ~10–30 events (per Apify docs), enough for one city.
4. **Web search can't see Facebook well:** `site:facebook.com salsa Ho Chi Minh` returned no facebook.com results in our search tool; only old Facebook event links inside Saigoneer listings (e.g. [Saigon Outcast Latin night](https://saigoneer.com/saigon-events/3767-cuba-libre-latin-night-saigon-outcast)). So we can't use web search as a free stand-in for Facebook.
5. **Bangkok:** *Latin Soul Tuesday at The Red Door BKK* (Sukhumvit 24; class 8:15pm, SBK party 9:15pm; 150/300 THB) links to a Facebook **profile** `profile.php?id=61557689370104`, not a Page — the Pages scraper may return fewer fields; the posts/photos scrapers would be the check. ([listing](https://www.salsavida.com/event/thailand/bangkok/latin-soul-tuesday-party-at-red-door-bkk/))

**Takeaway:** in both cities, listing sites already hand us the Facebook (or Instagram) URL. Facebook's job is to confirm "still running this week" from a recent flyer or a future event occurrence. Organizers split between Facebook and Instagram, so we need both, and the choice per venue follows whichever link we're handed.

## Open questions for the owner
- Accept Apify's Facebook actors given Meta's written-permission terms? (Same decision as Instagram scraping.)
- Check by hand, logged out: one venue page, one event, one group — what's visible?
- Business Verification for PPCA: worth it later? (Only gives page posts, no events/groups.)

## Fit with other sources
Proposals sent to src-google, src-instagram, src-listing, src-reddit on 2026-11-16. All four agents replied.
- **Agreed with src-google:** `websiteUri` that is a facebook.com URL → src-facebook; own website → extract FB/IG `<a href>`s → us. Small studios' "website" is often Facebook (Vela Dance Studio). "The event/organizer, not the place, is the thing to verify." Google won't plain-fetch facebook.com URLs. FB event address/lat-lng go back to Google for a place ID. Storage: we keep the place ID plus facts from FB/IG, and fetch Google's name, hours and reviews live.
- **Agreed with src-instagram:** FB page About → IG link is a handoff. FB events are cross-checked against IG flyers. One shared vision prompt reads flyers from both (styles, day, time, venue, price, recurring yes/no). Which is fresher is unmeasured: in HCMC 2 of 3 organizers use IG as their "website", so IG first; FB is better for structured events.
- **Agreed with src-reddit:** Reddit passes FB group/page names and hints ("Thursday social", "closed after covid"). Facebook confirms "still running" from flyers and events. Hints alone are never proof. How often Reddit names FB groups is unknown, because src-reddit couldn't open any thread. The owner's first pass by hand will count it.
- **Proposed roles:** listing sites + FB events search = finders; Google = map pin + place ID; Facebook and Instagram = checkers ("still running": flyer/post <60 days or a future event occurrence); FB groups + Reddit = vibe and organizer names, not proof.
- **IG vs FB (agreed with src-instagram):** follow whichever link we are handed; if both, Instagram first (official Business Discovery; no published price, so "free" is unverified), Facebook for structured events and city groups. Both use the 60-day rule.
- **One owner decision for both Meta sources:** Apify scraping of Facebook and Instagram carries the same Automated Data Collection Terms risk.
- **Agreed with src-listing:** listings hand us the organizer's FB URL (`organizer.url` in event-page JSON-LD). These are often share or occurrence links (`facebook.com/share/v/…`, `/events/<id>/<occurrence>/`), not Page URLs, so they need resolving first; the Apify events actor takes event URLs directly. A Salsavida listing whose `source_modified_at` is older than ~6 months counts as unconfirmed until FB/IG shows a flyer or post <60 days old, or a future occurrence. Salsavida itself labels its dates "scheduled_from_recorded_data_not_organizer_confirmed".
- **Disagreements:** none.
