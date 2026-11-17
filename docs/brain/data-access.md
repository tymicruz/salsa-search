# Data access: Google reviews, Instagram, Reddit

Researched by team-lead, 2026-11-16, for discovery-strategist. "Verified" = read on the official page. "Unverified" = secondary sources only, or official page blocked from our tools. Nothing is enabled; the owner creates every account and key and approves anything paid.

## 1. Google reviews (Places API (New))

**What we can get (verified)**
- Place Details returns **up to 5 reviews** per place, plus an AI review summary. No parameter for more was found. ([place-details](https://developers.google.com/maps/documentation/places/web-service/place-details))
- Text Search ("salsa school in Cali") returns up to **60 results** (20 per page) and can include `rating`, `userRatingCount`, `websiteUri`, `googleMapsUri` and `reviews`. ([text-search](https://developers.google.com/maps/documentation/places/web-service/text-search))

**Price tiers (verified, [pricing](https://developers.google.com/maps/billing-and-pricing/pricing)).** The most expensive field you ask for sets the price of the whole call.

| Fields | Place Details: free/mo, then per 1,000 | Text Search: free/mo, then per 1,000 |
|---|---|---|
| IDs only | unlimited free | unlimited free |
| `googleMapsUri` (Pro) | 5,000, then $17 | 5,000, then $32 |
| `rating`, `userRatingCount`, `websiteUri`, `regularOpeningHours` (Enterprise) | 1,000, then $20 | 1,000, then $35 |
| `reviews` (Enterprise + Atmosphere) | 1,000, then $25 | 1,000, then $40 |

**Storage rules (policies page verified; full Terms page could not be fetched)** ([policies](https://developers.google.com/maps/documentation/places/web-service/policies))
- Don't store or index Places content (names, addresses, reviews, ratings). Fetch it fresh each time. Exceptions: **place IDs may be stored forever**, and **lat/lng up to 30 days**.
- "Don't create content based on Google Maps Content."
- When showing reviews: credit the author and link to the review on Google Maps (`googleMapsUri`), with Google Maps attribution.
- **What this means for us:** Google can be a discovery and lookup source, but it can't be our database. We could store our own facts (found from other sources) plus the place ID, and show live Google rating and reviews at view time. A lawyer or the owner should read [Terms §3.2.3](https://cloud.google.com/maps-platform/terms) and the [Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) before building anything that stores content.

**Third-party review APIs (unverified, secondary sources).** SerpApi (Google Maps Reviews): free 250 searches/mo; $25/mo for 1,000; $75/mo for 5,000; about 20 reviews per call. ([pricing](https://serpapi.com/pricing.md)) These scrape Google, so Google's terms don't cover us and the legal risk sits with us and the vendor. Not recommended without the owner's explicit decision.

## 2. Instagram

**Step 1: Google place → website (verified).** Place Details `websiteUri` gives the website. It's an Enterprise field (1,000 free/mo, then $20 per 1,000). The Instagram link is then read from the website itself (plain fetch, no API).

**Step 2: read a public account's posts. Instagram Graph API "Business Discovery" (verified)**
- Returns other **Business/Creator** accounts' public data: `media_count`, `followers_count`, and the media list with `caption`, `timestamp`, `permalink`. **Doesn't work for personal accounts** or age-gated ones. ([business-discovery](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery), [reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery))
- Requirements:
  - **the owner's own Instagram professional account**;
  - a Meta developer app;
  - with Facebook Login, a linked Facebook Page (with Unified Login, a business portfolio instead);
  - permissions `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`. ([overview](https://developers.facebook.com/docs/instagram-platform/overview))
- Access level: if the app is only used by the owner's own account, **Standard Access is enough, so no App Review and no Business Verification**. App Review, Advanced Access and Business Verification are needed only if other people's accounts log into our app. ([app-review](https://developers.facebook.com/docs/instagram-platform/app-review))
- Rate limits: Platform Rate Limits. For app tokens, "200 × number of users" calls per hour. The per-user limit isn't published. ([rate-limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting))
- Storage ([Platform Terms](https://developers.facebook.com/terms/), updated 2026-02-03): keep data only while needed for a legitimate purpose, and delete it on request or when no longer needed. Don't sell it or use it to build user profiles.
- Cost: **unverified.** No price was found on the docs read; widely reported as free.
- The old Basic Display API stopped working 2024-12-04 ([Meta](https://developers.secure.facebook.com/docs/instagram-basic-display-api)).

**Fallback if Business Discovery fails** (the account is personal, or setup is blocked):
- the venue's website, Facebook page or Linktree;
- Google-indexed captions;
- the owner checks by hand.

Scraping instagram.com: Meta's [scraping terms](https://www.facebook.com/apps/site_scraping_tos_terms.php) weren't read. Assume it's not allowed.

## 3. Reddit

> **Update 2026-11-17: the official API is no longer an option.** Reddit announced (2026-09-30) that new public API access requests stopped on **2026-10-31**, RSS ended **2026-11-13**, unregistered apps are cut off **2027-01-12**, and all public Data API access closes in **March 2027** (written partner agreements excepted). ([TechRepublic](https://www.techrepublic.com/article/news-reddit-rss-public-api-shutdown/), [PPC Land](https://ppc.land/reddit-to-halt-public-data-api-access-in-march-2027-as-14-000-apps-register/), [Decrypt](https://decrypt.co/379892/reddit-killing-rss-feeds-public-api-access-ai-scrapers)) The notes below are kept for history.

**Official API (unverified: reddit.com, redditinc.com and the Reddit help center all block our fetch tool)**
- **Since Nov 2025 (Responsible Builder Policy), self-service API keys are closed. New apps must request approval**, with roughly a 7-day target and mixed results reported. ([mirror of r/redditdev announcement](https://r.datuan.dev/r/redditdev/s/gquSJqMgrM), [data365](https://data365.co/blog/reddit-api-pricing))
- Free tier, once approved: 100 queries/min per OAuth client, **non-commercial only**. Commercial use needs an agreement; $0.24 per 1,000 calls was announced in 2023, and current pricing is unpublished. ([2023 announcement mirror](https://reddit.rtrace.io/r/redditdev/comments/13wsiks/api_update_enterprise_level_tier_for_large_scale/jmr7eu0/?context=3), [Xpoz](https://www.xpoz.ai/blog/guides/reddit-api-pricing-tiers-and-alternatives/))
- The API has subreddit and keyword post search (`/r/{sub}/search?q=…&restrict_sr=1`), and a thread with its comments comes from `/comments/{id}`. Unverified here because the docs are blocked.

**Why our search found no Reddit threads (verified by multiple news outlets):** since 2024-07-01, Reddit's robots.txt blocks every crawler except Google's: Bing, DuckDuckGo and others are out. Search tools that aren't Google-backed return few or no Reddit results. ([Search Engine Land](https://searchengineland.com/microsoft-confirms-reddit-blocked-bing-search-444385), [9to5Google](https://9to5google.com/2024/07/24/reddit-search-engine-block-google-deal/))
- Google's own Custom Search JSON API is **closed to new customers** and shuts down 2027-01-01. ([Firecrawl summary](https://www.firecrawl.dev/blog/google-search-json-api-alternative), [Brave](https://brave.com/learn/google-api-shutdown/))

**Simplest working way today:**
1. The owner searches Google with `site:reddit.com salsa <city>` and pastes the thread URLs or text.
2. Or the owner applies for Reddit API access (non-commercial research use) and we wait for approval.

Our fetch tool can't open reddit.com at all. Paid third-party Reddit data vendors exist but are unverified and carry terms risk.

## Summary for the playbook

| Source | Discovery | Read content | Store in our DB | Owner action needed |
|---|---|---|---|---|
| Google Places | Text Search, 1k free/mo at Enterprise | 5 reviews/place, 1k free/mo | Place ID only | Enable Places API (New) (done); set a budget alert |
| Instagram | via `websiteUri` → site link | Business Discovery (Business/Creator only) | While needed, delete on request | IG professional account + Meta app (+ Page) |
| Reddit | Google `site:reddit.com` by hand | Official API after approval | Unverified | Apply for API access, or paste threads |
