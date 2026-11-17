# Source: Reddit

Researched by src-reddit, 2026-11-16. "Verified" means I read it on the official page. "Unverified" means only secondary sources, or the official page blocked our fetch tool. **Every reddit.com, redditinc.com and reddithelp.com page blocked our tool** (refused or HTTP 403), so none of Reddit's own terms are verified here. The owner should read those pages before we rely on any route.

Volume assumed: one pass per city at first, then about once a month for cities people search. Never per user request.

## 1. What the source gives

- Threads where travelers and locals answer "where can I dance salsa in X?" They name venues, nights, schools and teachers, often with opinions ("great on Thursdays", "mostly tourists", "closed now").
- **Vibe:** beginner-friendly or not, locals vs. tourists, level, crowd, safety, cover price.
- **Leads:** Instagram handles, Facebook group names, WhatsApp/Telegram groups, school names, and festival names.
- **Weaknesses:** threads are often years old, sparse for small cities, and anecdotal. Reddit is a lead and vibe source, not proof that a night is still running.

## 2. How to get it: every route checked

### Route A. Official Data API (closed to us)
- Reddit announced on 2026-09-30 that new requests for public API access stopped on **2026-10-31**. RSS ended **2026-11-13**. Apps that haven't registered lose access from **2027-01-12**, and all public API access closes in **March 2027**. ([TechCrunch](https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/), read; [TechRepublic](https://www.techrepublic.com/article/news-reddit-rss-public-api-shutdown/))
- Registering for the transition ([developers.reddit.com/app-registration](https://developers.reddit.com/app-registration), cited by TechCrunch, unread) is for apps that were **already approved**. We have none.
- No exception for research or non-commercial use was found. ([TechCrunch](https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/))
- **Cost:** n/a. **Lifespan:** zero. **Verdict: not available.**

### Route B. Paid data licensing or commercial agreement
- After March 2027 the only programmatic access is a written partner deal. TechCrunch: AI tools "will need commercial deals with Reddit."
- **Pricing is not published.** Blogs report a roughly $12,000/month minimum, enterprise deals of $50K–$500K+ a year, and 2–4 week reviews with no guarantee. GummySearch, a funded tool, failed to get a license. ([prowlo](https://prowlo.com/blog/reddit-api-pricing), [data365](https://data365.co/blog/reddit-api-pricing), [karmatools](https://karmatools.xyz/blog/reddit-api-licensing/), all unverified)
- The contact or application page on redditinc.com couldn't be fetched (blocked).
- **Cost:** far beyond our volume, which is a few dozen threads a month. **Setup:** weeks of negotiation. **Lifespan:** the length of the contract. **Verdict: not worth it at our volume.** Revisit only if the app grows a lot.

### Route C. Reddit Developer Platform (Devvit)
- Apps built on it run inside Reddit (in subreddits). It isn't a way to export data to our database. (Unverified: the docs were blocked.) **Verdict: not fit.**

### Route D. Search engines and search APIs
Context: since July 2024 Reddit's robots.txt blocks every crawler except Google's, so most non-Google indexes carry little or stale Reddit content. ([Search Engine Land](https://searchengineland.com/microsoft-confirms-reddit-blocked-bing-search-444385), [9to5Google](https://9to5google.com/2024/07/24/reddit-search-engine-block-google-deal/)) **Our own search tool returned zero Reddit threads** for both practice cities (see §6), which matches this.

| API | Status / price | Reddit coverage | Can we store results? | Verdict |
|---|---|---|---|---|
| Google Custom Search JSON API | Closed to new customers; ends 2027-01-01 ([Brave summary](https://brave.com/learn/google-api-shutdown/)) | Best | n/a | Dead |
| Gemini grounding with Google Search | ~$14/1k after the free tier | Strong | **No**: no caching, and results can't be used to find pages to crawl ([AI Studio terms](https://aistudio.google.com/docs/terms), verified in data-sources.md) | Not for our database |
| Bing Web Search API | **Retired 2025-08-11**; replaced by "Grounding with Bing" in Azure AI Agents ([Microsoft Learn](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement), verified) | Blocked by Reddit since 2024 | Grounding terms unread | Dead / weak |
| Brave Search API | $5 per 1k requests; free credit is $5 or $20/mo, the two Brave pages conflict ([brave.com/search/api](https://brave.com/search/api/)) | Weak (Reddit blocks Brave's crawler) | **No**: §3(b)(i) bars "store, cache, or create a database of Search Results", except transient storage ([ToS, updated 2026-09-01](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service), verified) | Weak |
| **OpenAI `web_search` tool** | $10 per 1k calls plus search tokens ([pricing](https://developers.openai.com/api/docs/pricing)) | Likely good: OpenAI has had a Reddit data deal since 2024 ([Tom's Guide](https://www.tomsguide.com/ai/openai-strikes-deal-with-reddit-what-this-means-for-chatgpt)). Unverified until tested | Guide is silent. It requires inline clickable citations when results are displayed, and `allowed_domains` (up to 100) can be set to `reddit.com` ([guide](https://developers.openai.com/api/docs/guides/tools-web-search), verified). Service terms blocked (403), so **storage is unverified** | **Best automated candidate**, after a test and a terms check |
| Perplexity Search API | $5 per 1k, or $1 per 1k for Fast ([pricing](https://docs.perplexity.ai/getting-started/pricing), verified) | Unverified | Unverified | **Avoid**: Reddit is suing Perplexity, and core claims survived dismissal ([Media Copilot](https://mediacopilot.ai/reddit-perplexity-data-scraping-lawsuit/)) |
| SerpApi and other Google scrapers | $75/mo for 5k ([serpapi.com](https://serpapi.com/)) | Good (scrapes Google) | Their own terms | **Avoid**: Reddit is suing SerpApi and Oxylabs for scraping Reddit via Google (case 25-cv-8736, SDNY; [PPC Land](https://ppc.land/serpapi-pushes-to-kill-reddits-dmca-suit-over-google-scraping/)) |
| Exa | $4–7 per 1k, $10/mo free ([pricing](https://exa.ai/pricing), verified) | Not stated | Terms not found | Unclear; don't rely on it |

**Key rule for every search API:** at most, a search result is a pointer to a thread. Search-result text must not go into our database. Under Brave and Gemini terms, it can't. The thread itself also can't be fetched by our code, because reddit.com blocks automated fetching and Reddit is suing scrapers. So what we can store is **our own facts** (a venue name, the fact that "people recommend it for Thursdays", the thread permalink), written down by a person who read the thread.

### Route E. Third-party Reddit data providers (scrapers and archives)
- **Apify Reddit actors, Oxylabs, Bright Data and similar** scrape reddit.com without a Reddit license. Reddit is actively suing this class of vendor (above). Their terms put the legal risk on us. **Avoid.**
- **Pushshift** has been limited to Reddit moderators for moderation work since 2023. **Arctic Shift / PullPush** are community archives built from dumps. The Academic Torrents dumps were reportedly taken down at Reddit's request in July 2026 (single source, [bigideasdb](https://bigideasdb.com/reddit-api-alternatives), unverified). Not licensed for our use, and their uptime isn't guaranteed. **Avoid.**

### Route F. Reddit's own tools, used by a person (allowed, unverified details)
- **reddit.com search, and Reddit Answers** (Reddit's AI answers that cite threads) are normal site use in a browser. Free. Nothing to set up.
- **Reddit Pro Trends** is reported free for businesses, with instant approval. It tracks keywords across subreddits and gives a feed of matching threads, plus a weekly email. ([TechCrunch 2025](https://techcrunch.com/2025/01/07/reddit-intros-new-trends-tools-for-businesses-and-an-ama-ad-format/), [Search Engine Land](https://searchengineland.com/reddit-business-analytics-tools-ama-ads-450270)) It could alert the owner to new "salsa" threads, but one report says keywords can't be edited after setup (unverified). It's optional and worth a 10-minute look.

### Route G. By hand, about monthly (recommended core)
The owner, in their own browser, for each city in the batch:
1. Searches Google for `site:reddit.com salsa <city>`, plus `site:reddit.com "salsa" <city> dance OR social OR class`. Also searches reddit.com for `salsa <city>`, or asks Reddit Answers "where to dance salsa in <city>".
2. Opens the **3–5 newest relevant threads** (skips anything older than about 3 years unless the city has nothing newer).
3. Pastes into our intake each thread's **permalink, date and the relevant comment text**. Our LLM step turns the pasted text into the fields in §5. The pasted text is a working copy only: we keep the extracted facts and the permalink, then discard the raw text.
- **Cost:** $0, plus a few cents of LLM tokens per city. **Time:** about 10 min per city. That's roughly 5 hours for a first batch of 30 cities, then about 1–2 hours a month for about 10 searched cities.
- **Terms:** ordinary reading by a human. Storing **long verbatim comments** for public display is a copyright and User Agreement question (unverified; the agreement page was blocked). The safe default: store a paraphrase, at most one short quote (under about 25 words) with the username and permalink, and link out.
- **Lifespan:** as long as reddit.com and Google search work. This is the most durable route.
- **Browser-assisted variant:** a browser AI agent such as Claude in Chrome reading threads on the owner's behalf is **automated access**. Reddit's terms likely forbid it without permission (unverified), and Reddit is litigating this exact behavior. Allow it only for summarizing text the owner has already copied, not for having an agent crawl reddit.com.

### Recommendation
1. **Route G (by hand, monthly), using Google `site:reddit.com` and Reddit's own search.** It's free, clearly allowed, durable, and fits a few dozen threads a month.
2. **Route D with the OpenAI `web_search` tool (`allowed_domains: ["reddit.com"]`)** to speed up step 1 by finding thread URLs and a cited summary. Use it only after (a) one test call confirms it returns Reddit threads, and (b) the owner reads OpenAI's service terms on storing search output. Store only facts plus permalinks, and keep citations clickable wherever they're shown. Cost is about $0.05–0.10 per city (about 5 calls), so under $5/month.
- Skip licensing, scrapers, archives, Perplexity and SerpApi.

## 3. What it's good for

| Use | Strength | Why |
|---|---|---|
| Finding | **Medium.** It catches places the listing sites and Google Maps miss: bars with one salsa night, hostel nights, "the plaza on Sunday" | Locals name them in passing |
| Checking | **Weak.** Threads go stale fast | Only as a "still running?" hint when a comment is recent; confirm through Facebook, Instagram or listing sites |
| Vibe | **Strong**, the best of our sources | Candid opinions about crowd, level, tourists, beginners, safety and price |

## 4. Noise and how to filter it

- **Stale threads:** keep the thread date and comment date. Mark anything over 2 years old as "historical" until another source confirms it.
- **Generic nightlife:** reggaeton clubs and "Latin night" bars recommended without partner salsa. Keep a place only if the comment mentions salsa dancing, a social, a class or partner dancing.
- **Other dances only:** threads about bachata, kizomba or tango alone. Tag the dance and drop it if there's no salsa.
- **Same-name places:** Cali (Colombia) vs. California, Santiago (Chile vs. Dominican Republic), and similar. Check the subreddit (`r/<city>`, `r/<country>`, `r/solotravel`, `r/Salsa`) and context.
- **Jokes, sarcasm, one-off events and self-promotion** (a teacher plugging their own class): keep self-promotion as a lead but mark it "self-reported".
- **Closed venues:** "RIP X" or "X closed after covid". Record these as **negative evidence** and pass them to the checkers.

## 5. Hand-off to the other sources

Each thread becomes rows like these (our own words plus a permalink):

| Field | Example shape | Goes to |
|---|---|---|
| `place_name` + area/district + street (if given) + city + organizer | "a bar in District 1", "MyHouse" | **src-google**: Places Text Search (`<name> <city>`), then place ID, then website, then Linktree, Instagram or Facebook |
| `night` / `activity` | "Thursday social", "free class before" | **src-listing**: cross-check against Salsavida and similar sites; **src-facebook**: find the event or flyer |
| `handle` | "@somesalsaschool" | **src-instagram**: Business Discovery or profile check |
| `group` | "the Facebook group 'Salsa <city>'", WhatsApp groups | **src-facebook**: groups and pages (WhatsApp only as a note) |
| `school` / `teacher` | "classes with X at Y studio" | **src-google**, then the website; **src-instagram** |
| `vibe` | paraphrase plus at most one short quote, username, permalink | stored on the place as vibe evidence |
| `status_hint` | "still going as of <date>" / "closed" | checkers: a positive or negative signal, never proof alone |
| `thread_url`, `thread_date`, `comment_date` | | provenance |

Reverse hand-off: when other sources find a place with no vibe information, the monthly pass can search `site:reddit.com "<place name>" <city>`.

## 6. Worked example (practice cities)

**Ho Chi Minh City.** Run on 2026-11-16 with our web search tool (a non-Google index).
- The query "reddit salsa dancing Ho Chi Minh City Saigon where to dance" returned **0 reddit.com results**. It returned Salsavida pages (for example, *239 Salsa Thursdays at My House* and *XSalsa Studio*, 28 Ngô Thì Nhậm, District 3) and expat.com forum threads ("latin music and dancing weekly", "where to learn dancing in ho chi minh"). This shows the robots.txt problem first-hand: **only Google-backed search finds Reddit threads**, so step 1 of Route G must be the owner's Google search, or a tested OpenAI `web_search` call.
- Expat.com forum threads are a Reddit-like vibe source that ordinary search *does* index. They're worth handling the same way, though dated (owner's call; not in anyone's brief yet).
- What the owner's Route G pass would look like (**not run**: I can't open reddit.com and have no logins):
  1. Google: `site:reddit.com salsa saigon`, `site:reddit.com salsa "ho chi minh"`, and the same on `r/saigon`, `r/VietNam`, `r/solotravel`, `r/Salsa`.
  2. From each thread, extract names such as "My House" or "XSalsa". Each one goes to src-google for a place ID, and is checked against Salsavida's *239 Salsa Thursdays at My House* listing. Any @handle goes to src-instagram. Any "Saigon Salsa" Facebook group goes to src-facebook.
  3. Vibe to keep: whether the Thursday night is mostly locals or expats, and whether it's beginner-friendly, as a paraphrase plus a permalink.

**Medellín** (second city). Same search, same result: **0 reddit.com results**. Blogs and Salsavida named Dancefree (El Poblado), El Tibiri (La 70), Son Havana, El Eslabón Prendido and Salón Social La 98. Those names are exactly what a Route G pass would then check on Reddit for vibe (for example, `site:reddit.com "Tibiri" medellin`), and for missing places.

**Bottom line from the example:** Reddit content can't be reached by our tools at all. The working pipeline is *the owner finds threads (Google or Reddit search) → pastes text → we extract facts plus permalinks → hand off*.

## Fit with other sources

**Agreed**
- **src-google:** every place Reddit names is resolved with Places Text Search "<name> <city>" to a place ID, pin and website before it's stored. Reddit points to the place; Google pins it. Google adds one more use: Reddit is a second "is it really salsa?" signal for Google results, because Google alone never confirms salsa. I agree, with one caveat: it's a dated signal, so the comment date travels with it. Fields src-google needs from each Reddit row: name, area/district, street (if given), city, night/day, and organizer name or handle. A night with no fixed venue is keyed on its organizer, with an empty place ID.
- **src-instagram:** Reddit and forum threads hand over @handles and venue names. Instagram checks whether a place is still active (latest post date, flyers). Each handle lead includes: the handle, the place or night it belongs to, the city, the thread URL, the post date, and a self-reported flag.
- **src-facebook:** Reddit and Facebook groups play the same role: vibe plus organizer and venue names, handed to Google and Instagram. Neither proves a night is still running. That's what flyers and events do. src-facebook confirms a night is "still running" if it has a flyer or event from the last 60 days, or an upcoming event date.
- **Shared rule:** Reddit is never the checker. Proof that a night is "still running" comes from Facebook flyers or events, Instagram post dates, or listing sites.

**Open**
- How often threads name @handles or Facebook groups is **unknown**: no thread could be opened in practice (§6). The `handle` and `group` fields stay in the extraction anyway, since they cost nothing. Count them in the owner's first by-hand pass.
- Forums like expat.com: src-listing didn't claim them. **Proposed: the Reddit pass owns them**, handled the same way (owner-read, facts plus permalink). Waiting on discovery-strategist.

**Agreed with src-listing**
- Reddit `night`/`activity` mentions are cross-checked for free with Salsavida's official MCP (`search_events` by city, date and type; no auth; about 120 calls/min).
- A Reddit-named place missing from Salsavida is a **coverage gap, not a red flag**.
- Reddit's best contribution is the hosted nights and plazas that listings miss, plus vibe, which listings barely have.
