# Source: Instagram

Researched by src-instagram, 2026-11-17. **Verified** = read on the official page (or tested by a plain logged-out fetch). **Unverified** = secondary source or not read. Nothing was signed up for. Builds on [../data-access.md §2](../data-access.md) and [../../research/data-sources.md §4](../../research/data-sources.md).

## 1. What the source gives

For each salsa organizer, school or venue account:
- **Bio**: often names the days, the venue, a WhatsApp number and a Linktree.
- **Recent posts**: the weekly flyer (an image), a caption with day, time, price and address, `timestamp` (to see if the account is still active), and the pinned flag (pinned posts are often "our weekly schedule").
- **Highlights**: titled reels like "Schedule", "Classes" or "Prices". These are images with no text field.
- **Video and photos of the floor**: the best vibe signal. They show how many people come, how good the dancers are and what kind of room it is.
- **Tags and mentions**: who teaches, which DJ plays, and which other accounts they work with. This is how you find the rest of the local scene.

In many smaller scenes, Instagram is the only place where the schedule is kept up to date. Ho Chi Minh City is an example (§6).

## 2. How to get it: costs, limits, terms

### A. Meta Business Discovery API (official)

Verified on [business-discovery](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery) and [IG Media reference](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media).

- **Call**: `GET /<our IG user id>?fields=business_discovery.username(<name>){followers_count,media_count,media{caption,media_type,media_url,permalink,timestamp,children,like_count,comments_count}}`.
- **Media fields**: `caption`, `media_type` (IMAGE/VIDEO/CAROUSEL_ALBUM), `media_url`, `permalink`, `timestamp`, `like_count`, `comments_count`, `children`, `thumbnail_url` (video only), `view_count`.
  - `media_url` is missing for reels with copyrighted audio or with downloads turned off.
- **No pinned flag.** `is_pinned` is not in the field list.
- **No location field.** Location fields are listed only as "not supported".
- **Only Business and Creator accounts.** Personal accounts and age-gated accounts return nothing.
- **What the owner must set up**: his own IG professional account, a Meta app, a linked Page (or business portfolio), and the permissions listed in data-access.md. Standard Access is enough if only his account uses the app.
- **Cost**: no price is published (**unverified**, widely reported as free). Rate limit: Platform Rate Limits; the per-user number isn't published.
- **Storage**: allowed only while there is a legitimate need; delete on request ([Platform Terms](https://developers.facebook.com/terms/)).

### B. Meta Hashtag Search (official, but gated)

Verified on [ig-hashtag-search](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search), [recent-media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag/recent-media) and [top-media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag/top-media).

- **Needs App Review** for the *Instagram Public Content Access* feature, so the owner can't use it with Standard Access alone.
- **30 unique hashtags per rolling 7 days.**
- `recent_media` only returns posts from the **last 24 hours**. `top_media` is ranked by popularity. Both return up to 50 per page.
- **Returns no `username` or owner**, only caption, media, permalink and timestamp. The account still has to be guessed from the caption's @mentions.
- Weak for discovery. Not recommended.

### C. Other official options

- **No place or location search exists** in the Graph API (verified: hashtag search is the only search endpoint).
- **oEmbed** ([docs](https://developers.facebook.com/docs/instagram-platform/oembed)): returns embed HTML only, 1,000 calls per hour. Using its content "for any purpose other than providing a front-end view … is strictly prohibited."
  - So it can show a post in our app. It can't be used to collect data.

### D. Apify actors (third-party, logged-out scraping)

Pages verified 2026-11-17. The free plan gives **$5/month** of credit; when it's used up, runs are blocked until next month ([pricing](https://apify.com/pricing)).

| Actor | Gives | Pinned flag | Free-plan price |
|---|---|---|---|
| [`apify/instagram-profile-scraper`](https://apify.com/apify/instagram-profile-scraper) | One item per profile: `biography`, `externalUrl(s)`, `businessCategoryName`, `isBusinessAccount`, `followersCount`, `postsCount`, `highlightReelCount` (count only), `relatedProfiles`, **`latestPosts` (12)**. Each post has `caption`, `hashtags`, `mentions`, `taggedUsers`, `timestamp`, `displayUrl`, `images`, `childPosts`, `type`, `likesCount`. | **yes, `isPinned` in `latestPosts`** | $2.60 / 1k results. Profile + 12 posts is *probably* one result (**unverified**; check with one run). |
| [`apify/instagram-scraper`](https://apify.com/apify/instagram-scraper) | Posts, reels, comments, details or mentions for profile/hashtag/**location URLs** (`/explore/locations/<id>/`). `onlyPostsNewerThan`, `skipPinnedPosts`. Posts include `ownerUsername`. | in reels and latestPosts samples, not in the posts sample | $2.70 / 1k. **Each post is one result.** |
| [`apify/instagram-hashtag-scraper`](https://apify.com/apify/instagram-hashtag-scraper) | Recent posts for a hashtag or keyword: `caption`, `ownerUsername`, `locationName`, `locationId`, `taggedUsers`, `isPinned`. The free plan gets only the first page. | yes | $2.60 / 1k |
| [`apify/instagram-search-scraper`](https://apify.com/apify/instagram-search-scraper) | Keyword search for **places**, users or hashtags, up to 250 per keyword. A place comes with address, lat/lng, `media_count` and its 12 latest posts. | — | $2.70 / 1k |
| [`maximedupre/instagram-stories-highlights`](https://apify.com/maximedupre/instagram-stories-highlights) (community) | Highlight items: `highlight.title`, `imageUrl`, `videoUrl`, `postedAt`. **No text**, so the images need OCR. | — | $0.0031 per item |

**Terms (verified):**
- [instagram.com/robots.txt](https://www.instagram.com/robots.txt) says "Collection of data on Instagram through automated means is prohibited unless you have express written permission". It ends with `User-agent: * Disallow: /`.
- [Meta Automated Data Collection Terms](https://www.facebook.com/apps/site_scraping_tos_terms.php) §2 requires "Meta's express written permission".
- Against that, *Meta v. Bright Data* (2024) held that **logged-out** scraping didn't breach Meta's terms (secondary sources, see data-sources.md §4). That ruling is narrow.
- **Using Apify is a legal-risk decision for the owner. It is not a default.**

### E. What's readable publicly, without login (tested 2026-11-17)

- A plain fetch of `instagram.com/salsa.thursdays.cuban.vietnam/` and `/explore/tags/salsasaigon/` returns HTTP 200, but only a JavaScript shell: **no bio, no counts, no captions, no og:description**.
  - In practice nothing is readable without a browser, and robots.txt forbids it anyway.
- What *is* readable without Instagram:
  - handles and post links printed on other sites (listing sites, venue websites, Facebook "About");
  - Google-indexed snippets of profiles and posts. Google is allowed in robots.txt; this is **unverified** as a reliable source.

## 3. What it's good for

| Job | Strength | Why |
|---|---|---|
| **Finding** | medium | Good for *expanding* from one known account (tags, mentions, `relatedProfiles`). Weak for a cold start: no location search, and hashtags are noisy. |
| **Checking** | **high** | The latest post `timestamp` shows whether the night is still running. Flyers and captions give the day, time and price. A pinned post or "Schedule" highlight gives the weekly plan. |
| **Vibe** | **high** | Floor videos: crowd size, level, style (Cuban/LA/On2), and how much is salsa vs bachata/kizomba. |

## 4. Noise and how to filter it

- **Bachata/kizomba-heavy nights** ("SBK"): count salsa vs other mentions in the captions and flyers. Keep the night if salsa is at least one of the named styles.
- **Choreo, ladies-styling and wedding studios** (owner's Workflow 2): drop accounts whose posts are all performance or classes, with no "social", "party" or "fiesta".
- **Dead accounts**: if the latest non-pinned post is older than 60 days and no future event is announced, mark the account stale (same rule as facebook.md). Pinned posts are often old, so **ignore `isPinned` posts for recency** but read them for the schedule.
- **Travelling teachers and festivals**: one-off events, not weekly places. Tag them as events with a date.
- **Hashtag spam** (#salsa means food too, and generic Latin promo): only keep posts where the caption names the city or a known venue.
- **Wrong city**: check the bio, `locationName`, or the venue address in the caption.

## 5. Hand-offs to other sources

- **In** (how we get the handle):
  - **Listing site** event page → organizer link or a handle in the text (§6: 2 of 3 HCMC events had one).
  - **Google place** → `websiteUri` → website → IG link (from the raw `<a href>`). Sometimes `websiteUri` *is* an instagram.com URL.
  - **Facebook page** "About" → IG link.
  - **Reddit/forum** threads → handles mentioned in comments.
- **Out** (what Instagram gives the others):
  - Venue names and addresses from captions or location tags → **Google Places** Text Search to get the place ID and pin.
  - Bio link → website. A Linktree is shown as a link, not fetched (its terms and robots.txt ban automated access, per google-places.md).
  - @mentions and tags of DJs, teachers and other venues → new handles to run through the same loop.
  - Event names → check them against **listing sites** and **Facebook events**.

**Reading flyers with AI:**
1. Give `displayUrl`/`images` (Apify) or `media_url` (Business Discovery) plus the caption to a vision model. Ask for JSON: `{styles[], day_of_week, start_time, end_time, venue, address, price, recurring|one-off, date}`.
2. Carousels: read every `childPosts`/`children` image.
3. Highlights have no text, so the vision model is the only way to read them.
4. Download the image right away: the Instagram CDN URLs are signed and expire (**unverified** timing).
5. Always use the caption as context. Flyers often leave out the year or use a "THIS SAT" style date.

The vision model's cost is token-based per image and isn't priced here.

## 6. Worked example: Ho Chi Minh City (plus a Bangkok check)

**HCMC**: started from the [Salsavida HCMC guide](https://www.salsavida.com/guides/vietnam/ho-chi-minh-city/) (3 weekly events).

| Event | IG hand-off found | How |
|---|---|---|
| [239 Salsa Thursdays at My House](https://www.salsavida.com/event/vietnam/ho-chi-minh-city/239-salsa-thursdays-at-my-house), Thu 8:45 PM, free class then social | **@salsa.thursdays.cuban.vietnam** | Plain-text handle in the description ("party footage on Instagram"). Its "Website" link is a Facebook event. |
| [Saturday SBK Party at FSC Garden](https://www.salsavida.com/event/vietnam/ho-chi-minh-city/saturday-sbk-party-at-fsc-garden/), Sat 9 PM, 100k VND | **instagram.com/saigondancecollab/** | The organizer's "Website" field *is* the IG profile. No website, no Facebook. |
| [La Danza Saigon classes](https://www.salsavida.com/it/event/vietnam/ho-chi-minh-city/weekly-salsa-classes-at-la-danza-saigon/), Sat–Sun | an **IG post URL** (`/p/DLteIMHTfiQ/`), no handle | The handle would come from that post's owner, which can only be read through Apify or a browser. |
| Afro Latin Tuesday at Cocoon Rooftop | not checked | — |

What it shows:
- For HCMC, Instagram is the **main official channel**: 2 of the 3 organizers use an IG link as their "website".
- Our logged-out fetch of @salsa.thursdays.cuban.vietnam returned only the JavaScript shell. Confirming that the night is still active (latest post date, flyer) would take Business Discovery (if it's a Business/Creator account, **unknown**), Apify, or the owner opening it by hand.
- Next steps would be:
  1. Profile scraper on these 3 handles.
  2. Read the latest flyers.
  3. Follow `taggedUsers`/`mentions` to find the DJs, teachers and other venues (e.g. Cocoon).
  4. Send the venue names to Google Places.

**Bangkok (second city)**:
- Listings ([Salsavida](https://www.salsavida.com/?p=25666), [Time Out](https://www.timeout.com/bangkok/bars/havana-social)) name Salsa Sundays at Havana Social. Time Out credits photos to **havanasocialbkk**, which is a likely handle (**unverified**).
- Web search found no direct instagram.com links for Bangkok organizers. The handle hand-off there depends on the venue website, Google, or Facebook, more than on the listings.

## Fit with other sources

Agreed with each agent on 2026-11-17:

- **src-google** (agreed):
  - Places has no IG field. Get the handle from `websiteUri`: either it *is* an instagram.com URL, or fetch the site and pull IG links from the raw `<a href>`.
  - **Linktree is shown, never fetched**, because its terms and robots.txt ban it.
  - IG captions and flyers send venue names to Text Search for the place ID.
  - Google is **one** cold-start seed, not the only one (src-google's correction, which I accept). Places misses hosted nights: HCMC's "239 Salsa Thursdays" at My House doesn't come up for "salsa". Listing sites and organizer handles seed alongside it, and IG has no location search.
  - **The organizer's IG outranks the venue's IG** for "is this night still running". Venues host many things, and the organizer posts the salsa night.
  - In HCMC, the organizer's handle came from Salsavida, not Google: xsalsa.vn links only to FB and YouTube.
- **src-facebook** (agreed):
  - Follow whichever link we're handed. When both exist, check **IG first for recency**, then **FB for structured events and city groups** (finding new organizers).
  - Shared "still running" rule: a flyer or post less than 60 days old, or a future event.
  - FB and IG use the same vision prompt for flyers.
  - FB and IG scraping are **one owner decision** under the same Meta Automated Data Collection Terms.
  - Caveat from me: "Business Discovery is free" is still **unverified**.
- **src-reddit** (agreed):
  - Reddit is for finding places and vibe, never for checking.
  - It hands off `handle` leads, marked "self-reported" when a teacher plugs their own class.
  - I asked for each lead to come with handle, place or night name, city, thread URL and post date.
  - How often threads name handles is **unknown**, because no thread could be reached. The owner's first by-hand pass will tell us.
- **src-listing** (agreed):
  - Instagram links come from each Salsavida event page's JSON-LD `organizer.url`, read once per event. The Salsavida MCP doesn't return them.
  - My addition: also pull out @handles from the description text, because 239 Thursdays' handle is only there.
  - A listing older than about 6 months (by `source_modified_at`) counts as "needs checking" until IG or FB shows a post less than 60 days old.
  - The organizer's IG outranks the venue's.
  - Main record: **the night** (organizer + weekday + venue), with the IG handle and the Google place ID attached.
- **Disagreements**: none.
