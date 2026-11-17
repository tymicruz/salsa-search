# Data sources for Salsa Search

Researched 2026-11-16. Every claim has a link. **Verified** means it was read on the official page. **Unverified** means it comes from secondary sources, or the official page blocked our fetch tool. Nothing was signed up for or tested with keys. Builds on [../brain/data-access.md](../brain/data-access.md).

"Per city" costs assume about 20 searches, 30 venue/teacher Instagram profiles and 10 Places calls. They are estimates, not measured.

## Ranked summary

| # | Source | Gives us | Cost per city | Reliability | ToS risk | Owner setup |
|---|---|---|---|---|---|---|
| 1 | **Venue websites** (plain fetch) | places, weekly schedule, prices | ~$0 | medium (many are stale or JS-only) | low | none |
| 2 | **Google Places API (New)** Text Search | places, hours, rating, website, Maps link | ~$0 (1k free/mo Enterprise) | high | low *if* we store only place IDs | done (enabled); budget alert |
| 3 | **Apify `instagram-profile-scraper`** | bio, 12 latest posts (captions = event days/times, flyers), recency, pinned flag | ~$0.08 (30 profiles × $2.60/1k) | high (vendor-maintained) | medium (logged-out scraping; see §4) | Apify account; $5/mo free credit |
| 4 | **OpenAI web search tool** | discovery: venue names, socials, URLs with citations | ~$0.20 + tokens | high | low–medium (terms unverified) | OpenAI key + billing |
| 5 | **Gemini URL context** | read a given public page (venue site, maybe a Reddit listing) | token cost only; free on free tier | medium (flaky reports) | medium for Reddit | Gemini key |
| 6 | **Gemini Grounding with Google Search** | best discovery (Google index, Reddit-heavy citations) | ~$0.84 (60 queries × $14/1k) after 5k free/mo | high | **high for a database**: results may not be stored or used to find pages to crawl | Gemini key + billing |
| 7 | **Perplexity Search API** | ranked URLs + snippets | $0.02–0.10 | medium | medium (Reddit is suing Perplexity) | key + prepaid credit |
| 8 | **Apify highlights/stories actors** (3rd-party) | highlight stories (often "weekly schedule" images) | ~$1.90 (30 × ~20 items × $0.0031) | low–medium (community actors) | medium | same Apify account |
| 9 | **Meetup API** | events of Pro networks only | Pro subscription (price unverified) | — | low | Meetup Pro; not useful |
| 10 | **Facebook events** | — | — | **closed** (Marketing Partners only) | — | — |
| 11 | **Eventbrite API** | own org's events only; search shut 2019 | — | **closed** for search | — | — |

## 1. Gemini Grounding with Google Search

- **Price (verified).** Gemini 3 and newer models bill **per search query the model runs** (a prompt can run several). 5,000 free per month, shared across all Gemini 3+ models, then **$14 per 1,000**. Default cap is 1,500 requests/day per project. Empty queries aren't billed. ([pricing](https://aistudio.google.com/docs/pricing), [google-search](https://aistudio.google.com/docs/google-search?generate-content=true))
- **Free tier (verified):** "Not available" for every Gemini 3+ text model. Gemini 2.5 Flash / Flash-Lite had 500 RPD free, but **2.5 Flash-Lite routes to 3.5 Flash-Lite on 2026-12-01** and 2.5 Pro to 3.8 Flash. ([pricing](https://aistudio.google.com/docs/pricing))
- **Model token prices (verified, per 1M in/out):** 3.1 Flash-Lite $0.25 / $1.50; 3.5 Flash-Lite $0.30 / $2.50; 3.6 and 3.8 Flash $0.75 / $3.75 until 2026-12-31, then $1.50 / $7.50. ([pricing](https://aistudio.google.com/docs/pricing))
- **Response (verified).** `groundingMetadata` contains:
  - `webSearchQueries`: the queries it ran;
  - `searchEntryPoint`: HTML/CSS for the required Search Suggestions;
  - `groundingChunks`: `web.uri` plus `title`. The uri is a **`vertexaisearch.cloud.google.com` redirect**, not the real URL. The title is often just the domain.
  - `groundingSupports`: text spans mapped to chunk indices.
  ([google-search](https://aistudio.google.com/docs/google-search?generate-content=true)) In the newer Interactions API the same data comes as `google_search_call`, `google_search_result` and `url_citation` annotations. ([google-search](https://aistudio.google.com/docs/google-search))
- **Does it cite reddit.com / instagram.com?** Reddit: very likely. Ahrefs puts reddit.com as the #1 cited domain in "Gemini" (29.9%, Nov 2026), but that's the Gemini app, not the API (**unverified for the API**). ([Ahrefs](https://ahrefs.com/blog/most-cited-domains-gemini/), [Dejan](https://dejan.ai/blog/reddit-ai/)) Instagram isn't in the top 50 (unverified either way). A forum report says `groundingChunks` is sometimes missing on newer models. ([forum](https://discuss.ai.google.dev/t/groundingchunks-missing-from-groundingmetadata-in-gemini-responses/131137))
- **Terms: the blocker (verified)** ([terms](https://aistudio.google.com/docs/terms)):
  - Results can only be shown, with their Search Suggestions, to the user who asked.
  - No "cache, frame, syndicate, resell, analyze, train on, or otherwise learn from Grounded Results".
  - Text can be stored up to 2 years **only** for display tuning, the user's chat history, or follow-up prompts.
  - Links can't be used "to identify pages to crawl or scrape".
  - **Meaning: fine as a live "ask about this city" feature, not allowed as our data-collection pipeline.**

## 2. Gemini URL context

- **Price (verified):** free on the free tier; on paid, the page content is charged as input tokens. ([pricing](https://aistudio.google.com/docs/pricing))
- **Limits (verified):**
  - up to **20 URLs per request** and 34 MB per URL;
  - public pages only;
  - **paywalled pages unsupported** (the docs advise against login pages), as are YouTube, Google Docs, and audio/video;
  - `url_context_metadata.url_metadata[].url_retrieval_status` is `…SUCCESS` or `…UNSAFE`. `…ERROR` also shows up in reports.
  ([url-context](https://aistudio.google.com/docs/url-context?generate-content=true))
- **Reddit:** one Feb 2026 blog read the listing `reddit.com/r/astrojs/new/` successfully. Thread comments weren't tested. ([Camden](https://www.raymondcamden.com/2026/02/09/creating-reddit-summaries-with-url-context-and-gemini)) **Unverified** for threads.
- **Instagram:** no report found. **Unverified, likely fails** because of the login wall.
- Flaky on some sites. Reuters returned ERROR, and the REST API sometimes returns empty metadata with made-up output. ([forum](https://discuss.ai.google.dev/t/url-context-via-rest-api-not-working-hallucinated-output-empty-metadata-but-works-in-ai-studio/125380), [forum](https://discuss.ai.google.dev/t/api-and-url-context-inconsistencies/92406))
- Reddit ToS risk: Reddit is suing scrapers, including SerpApi, over content taken via Google. ([Engadget](https://www.engadget.com/social-media/reddit-sues-perplexity-and-three-other-companies-for-allegedly-using-its-content-without-paying-205136436.html))

## 3. OpenAI web search and Perplexity

**OpenAI `web_search` tool (verified)** ([pricing](https://developers.openai.com/api/docs/pricing), [guide](https://developers.openai.com/api/docs/guides/tools-web-search))
- Price: **$10 per 1,000 calls**, plus search content tokens at model rates. On gpt-4o-mini / gpt-4.1-mini the search content is a fixed 8k input tokens per call. The older `web_search_preview` on non-reasoning models costs $25 per 1,000 calls, with search tokens free.
- Up to 100 `allowed_domains` (e.g. `reddit.com`), `user_location` (city), `url_citation` annotations, and the full source list via `include: web_search_call.action.sources`.
- Reddit: OpenAI has had a Reddit Data API deal since 2024 ([Tom's Guide](https://www.tomsguide.com/ai/openai-strikes-deal-with-reddit-what-this-means-for-chatgpt)). Whether API web search returns reddit.com today is **unverified**: test with `allowed_domains: ["reddit.com"]`.
- Storage terms for search output: **unverified** (openai.com/policies returned 403).

**Perplexity** ([pricing](https://docs.perplexity.ai/getting-started/pricing), [search](https://docs.perplexity.ai/docs/search/overview.md), [tiers](https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers.md))
- Search API (verified): **$5 per 1,000 requests**, or $1 per 1,000 with Fast. Up to 5 queries per request. Returns `title`, `url`, `snippet` and `date`. Up to 20 domains in `search_domain_filter`. No free tier; $50 in purchases unlocks Tier 1.
- Sonar chat models: per-token plus a $5–14 per 1,000 request fee by context size (**unverified**, third-party only; possibly being replaced by the Agent API). ([Puter](https://developer.puter.com/tutorials/perplexity-api-pricing/))
- Reddit: whether it's returned is **unverified**. Reddit sued Perplexity, and in Aug 2026 a judge refused to dismiss the core claims. ([Media Copilot](https://mediacopilot.ai/reddit-perplexity-data-scraping-lawsuit/))

## 4. Apify Instagram actors

**Free plan (verified):** **$5/month credit**. Runs are blocked once it's used up, until the next month. Starter is $19/mo. ([pricing](https://apify.com/pricing))

**`apify/instagram-profile-scraper` (verified)** ([page](https://apify.com/apify/instagram-profile-scraper), [pricing tab](https://apify.com/apify/instagram-profile-scraper/pricing))
- Price: **$2.60 per 1,000 results on Free**, $2.30 on Starter (headline "from $1.60 / 1,000 profiles").
- Output is **one item per profile**: `username`, `fullName`, `biography`, `externalUrl(s)`, `businessCategoryName`, `followersCount`, `postsCount`, `highlightReelCount` (a count only), `relatedProfiles`, `latestIgtvVideos`, and **`latestPosts` (the latest 12)**.
  - Each post has `caption`, `hashtags`, `mentions`, `url`, `timestamp`, `likesCount`, `commentsCount`, `type`, `displayUrl`, `images`, `alt`, `childPosts`, `taggedUsers`, and **`isPinned`**.
- **Is profile + 12 posts one result?** Very likely: billing is "per profile" and the posts are nested in the one item. **Not stated outright**; check with one test run.
- $5 free ≈ 1,900 profiles a month.

**`apify/instagram-scraper` (verified)** ([page](https://apify.com/apify/instagram-scraper))
- $2.70 per 1,000 on Free, $2.30 Starter, $1.90 Scale, $1.50 Business.
- "One result equals one scraped item (a post, reel, comment, profile…)", so **each post is billed separately**. `resultsType`: posts, comments, details (plus reels/mentions in the UI).
- `isPinned` is in the reels sample and in `latestPosts`, but not in the posts sample. There's a `skipPinnedPosts` option and `onlyPostsNewerThan`. Private profiles are skipped.

**Highlights/stories (no official `apify/` actor; community actors, verified pages only)**
- [`maximedupre/instagram-stories-highlights`](https://apify.com/maximedupre/instagram-stories-highlights):
  - no login needed;
  - **$0.0031 per story item on Free** (from $0.90 per 1,000 on top plans);
  - fields: `highlight.title`, `highlight.id`, `postedAt`, `imageUrl`, `videoUrl`;
  - **no caption or text/OCR field**, so the schedule text would need image OCR.
- Others: [khadinakbar](https://apify.com/khadinakbar/instagram-highlights-scraper), [memo23](https://apify.com/memo23/instagram-stories-highlights-scraper/api) (from $7 per 1,000 accounts).

**ToS:**
- In *Meta v. Bright Data* (Jan 2024), the court held that **logged-out** scraping of public data didn't breach Meta's terms. The ruling is narrow and the sources are secondary. ([TechCrunch](https://techcrunch.com/2024/01/24/court-rules-in-favor-of-a-web-scraper-bright-data-which-meta-had-used-and-then-sued), [Quinn Emanuel](https://www.quinnemanuel.com/the-firm/news-events/client-alert-what-does-the-meta-v-bright-data-summary-judgment-ruling-mean-for-web-scraping/))
- The legal alternative is still Business Discovery (see data-access.md §2).

## 5. Other event sources

- **Facebook events: closed.** "Access to Events on Users and Pages is only available to Facebook Marketing Partners." (verified, [event ref](https://developers.facebook.com/docs/graph-api/reference/event/))
  - Page Public Content Access covers "business metadata, public comments and posts". Events aren't listed. It needs App Review **and** Business Verification. ([PPCA](https://developers.facebook.com/docs/features-reference/page-public-content-access))
  - `/search?type=event` is gone (unverified, [SO archive](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/58943994/is-there-a-way-to-access-facebook-events-using-graphapi)).
- **Eventbrite: search closed.** `GET /events/search/` "was shut down … December 12, 2019". Only your own organization's events can be listed. API price isn't stated. ([Eventbrite API](https://www.eventbrite.com/platform/api))
- **Meetup: Pro only.**
  - GraphQL API with 500 points per 60 s ([guide](https://www.meetup.com/api/guide/)).
  - Creating an OAuth client needs an active **Meetup Pro** subscription, and access is revoked when it lapses. That comes from Meetup help pages seen in search results; our fetch got a 403, so it's **unverified** ([help](https://help.meetup.com/hc/en-us/articles/41467209211917-What-happens-to-my-API-access-when-my-Meetup-Pro-subscription-expires)).
  - `eventSearch` is only shown under `proNetwork`.
  - Low value for salsa.
- **Google Places reviews:** max 5 per place, can't be stored, only place IDs can be kept. Text Search returns up to 60 results per query, 1,000 free per month at the Enterprise tier. (verified earlier, [data-access.md §1](../brain/data-access.md))
  - **Grounding with Google Maps** in Gemini costs the same as Search grounding ($14 per 1,000 after 5,000 free per month on Gemini 3+). Results may be cached 90 days for display only, with no scraping or export. ([pricing](https://aistudio.google.com/docs/pricing), [terms](https://aistudio.google.com/docs/terms))
- **Venue websites:** plain HTTP fetch, free, no terms barrier for public pages (respect robots.txt). The schedule is often an image or an embedded Instagram feed (observation, unverified).

## 6. How they fit together

Discovery (which places exist) → Places Text Search (IDs) + OpenAI web search.
Facts (days, times, vibe) → venue website + Apify profile scraper (bio + 12 posts with `isPinned` and `timestamp` for recency).
Live "what do people say" at view time only → Gemini grounding (shown, not stored).
