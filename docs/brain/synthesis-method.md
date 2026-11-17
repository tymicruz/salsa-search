# Synthesis Method: raw scraped material → app records

How the engine turns Instagram posts, flyers, grounded searches, Google Places results and websites into records the app can show. Design only: no stack chosen, nothing built.

Last updated: 2026-11-16. Builds on `city-data-model.md` (records), `strategy-library.md` (where to look) and `data-access.md` (what we may read and store).

Naming: `city-data-model.md` uses **Place** for searchable areas/towns and **Venue** for a dance spot. This doc keeps that. The app's "place" waypoint = a Venue.

## 0. Core idea: claims first, records second

Nothing goes straight into a record. Every extractor emits **claims**: one fact, one source, one quote. Records are **compiled** from claims by fixed rules (sections 4–5). This gives three things:
- conflicts are resolved by rule, not by whichever source was read last;
- re-running the compile after a new post updates everything, with no hand edits;
- every field the app shows can point back to its quote.

```
sources ──extract──▶ claims ──resolve entities──▶ claims attached to Venue/Host/Session
                         │                                   │
                         └──▶ leads (new names, handles)      └──compile──▶ app records + confidence
```

## 1. Output records

### 1.1 Venue (a waypoint)
`id, name, aliases[], town_id, lat/lng, address, kind` (school / bar_or_club / hostel / restaurant / park_or_street / beach / other), `links` (website, instagram handles[], google_place_id), `status` (active / probably_active / stale / inactive / unverified), `last_confirmed`, `sessions[]`.

Google content (name, address, rating, reviews) is **not** stored; only `google_place_id`. lat/lng comes from a non-Google source where possible (website, Instagram location tag, OSM), or is refreshed from Google within 30 days.

### 1.2 Host (new; the data model has `host` only as a field)
A school, instructor, band, DJ or collective that runs things, possibly at several venues. `id, name, kind` (school / instructor / band / dj / collective / hostel), `instagram, website, home_venue_id?`. A school with its own studio is both a Host and a Venue, linked by `home_venue_id`.

### 1.3 Session (an event or recurring night)
| Field | Values / rule |
|---|---|
| venue_id, host_id? | host optional; if the host moves around, each occurrence carries its own venue |
| type | social / class / live_music / club_salsa_hour / hostel_activity / workshop / festival |
| **music** | genres played: `["salsa","bachata","cumbia"]` |
| **partner_dancing** | yes / no / unclear. Independent of `music`: salsa music alone never sets this to yes |
| dance_styles | cali / on1 / on2 / cuban_casino / rueda / unknown |
| schedule | `{recurrence: weekly|monthly_nth|one_off|irregular, weekday, nth?, date?, start, end?, timezone}` |
| price | `{amount, currency, includes?, raw}` e.g. "100 MXN incl. 1 drink"; `free` allowed |
| level | open / beginner / intermediate / advanced / unknown |
| crowd | locals / tourists / mixed / unknown |
| linked_session | e.g. the 20:00 class that precedes the 21:00 social |
| vibe_notes[] | `{quote, lang, translation?, source_id, date}`; quotes only |
| status, last_confirmed, confidence | computed (section 4) |
| sources[] | source ids that support this session |

### 1.4 Claim (internal, not shown)
`{subject_ref, field, value, quote, source_id, published_at, seen_at, extractor, extractor_confidence}`. `subject_ref` is a loose reference (handle, name, place_id) until entity resolution attaches it.

### 1.5 Source
`{id, url, type, author_handle?, first_hand: bool, published_at, seen_at, access}` where `type` is instagram_post / instagram_bio / venue_website / listing_site / forum_post / grounded_answer / google_place / user_report, and `access` is full / snippet_only / blocked.

### 1.6 Lead
`{name_or_handle, origin_source_id, depth, reason, status: new|resolved|merged|dead|out_of_area|not_salsa}`.

### Example (FICTIONAL, shape only)

```json
{
  "_note": "FICTIONAL EXAMPLE. Not a real venue, handle or event.",
  "venue": {
    "id": "ven_mock_la_clave",
    "name": "La Clave Social Club (MOCK)",
    "aliases": ["La Clave", "Salón La Clave"],
    "town_id": "mock-town",
    "kind": "bar_or_club",
    "links": { "instagram": ["@mock_laclave"], "google_place_id": "ChIJ_MOCK123", "website": null },
    "status": "active",
    "last_confirmed": "2026-10-30"
  },
  "session": {
    "id": "ses_mock_la_clave_fri_social",
    "venue_id": "ven_mock_la_clave",
    "host_id": "host_mock_escuela_sabor",
    "type": "social",
    "music": ["salsa", "bachata"],
    "partner_dancing": "yes",
    "dance_styles": ["on1"],
    "schedule": { "recurrence": "weekly", "weekday": "fri", "start": "21:00", "end": "02:00", "timezone": "America/Mexico_City" },
    "price": { "amount": 100, "currency": "MXN", "includes": "1 drink", "raw": "$100 con bebida" },
    "level": "unknown",
    "crowd": "unknown",
    "linked_session": "ses_mock_la_clave_fri_class",
    "vibe_notes": [
      { "quote": "la pista se llena después de las 11", "lang": "es", "translation": "the floor fills up after 11", "source_id": "src_mock_fb_comment_7", "date": "2026-08-02" }
    ],
    "status": "active",
    "last_confirmed": "2026-10-30",
    "confidence": "high",
    "sources": ["src_mock_ig_post_44", "src_mock_ig_bio", "src_mock_listing_2"]
  },
  "conflict_log": [
    { "field": "weekday", "losing_value": "tue", "source_id": "src_mock_listing_2", "reason": "listing contradicted by newer complete schedule in venue bio" }
  ]
}
```

## 2. Extraction

All extraction is an LLM call with a fixed JSON schema (the claim list) and two hard rules: **every claim includes the verbatim text it came from**, and **"not stated" is a valid answer** for every field. A claim without a quote is dropped.

### 2.1 Flyer and image reading
Input: the image(s), the caption, the post timestamp, the account's bio and the town's timezone. Read every image in a carousel, not just the first.

Pull out:
- event title, venue name/handle, host, performers (band, DJ, instructors);
- each date or weekday, start/end times, recurrence words;
- price lines (cover, "consumo mínimo", "incluye bebida", "gratis", "preventa/taquilla");
- activity words: clase / social / taller / bootcamp / en vivo / orquesta / DJ / salsa hour;
- level words: básico, principiante, intermedio, avanzado, "todos los niveles", "no necesitas pareja";
- music/genre words, and dance-style words (en línea = on1/on2, casino, rueda, caleña);
- change words: CANCELADO, SE POSPONE, NUEVO HORARIO, ÚLTIMA, "nos cambiamos a", "cerrado".

Date rules:
- **No year:** anchor on the post timestamp. Pick the first matching date on or after the post date, up to ~10 months ahead. If the flyer gives a weekday too ("Viernes 30"), pick the month where the 30th is a Friday; if none fits within 10 months, keep the claim but flag `date_unresolved`.
- **Weekday + date mismatch** (flyer says Friday 30, but the 30th is a Saturday): keep both, flag, lower extractor confidence.
- **Relative words:** hoy = post date; mañana = +1 day; "este viernes" = next Friday after the post (one-off).
- **Recurrence:** "todos los / cada / every / los viernes" (plural weekday) → weekly. "primer sábado de cada mes" → monthly_nth. A dated flyer with no recurrence words → one_off, *even if* the same night repeats weekly (repetition is detected later, section 4.4).
- **Times:** normalize "8pm", "20:00", "20 hrs", "8 de la noche"; "de 10 a 3" ends the next day. A "+" end ("9pm en adelante", "más de 5 horas") → store start only plus the raw text.
- **Spanish:** extract in the original language, keep the quote, add an English translation. Don't translate before extracting.

### 2.2 Caption, bio and website parsing
Same schema as flyers. Extras:
- **Bio schedules** ("Mié: Cumbia & Salsa | Vie: Salsa & Bachata") are a *complete-schedule statement* (flag `complete: true`); they matter for conflicts (4.2).
- **Tags and mentions:** record each `@handle` with its role words ("en @x" / "at @x" → venue; "con @y" / "clase por @y" → host or instructor; "live by @z" → band). Location tags → venue candidate.
- **Truncated text** ("... more"): record `access: snippet_only`; never infer the cut-off part.
- **Comments** on a post: only harvest (a) questions that signal doubt ("¿sigue?", "is this still on?") as recency signals, (b) first-hand vibe quotes, (c) answers by the account itself. Commenter text is never a schedule source.

### 2.3 Partner-dancing classification
Per session, decided from cues, never from genre alone:
- **yes:** "social", "pista", class + social, rueda, "bailar en pareja", "no necesitas pareja", photos of couples dancing.
- **no:** "party band" with crowd dancing solo, concert seating, club playlist with salsa as one genre among reggaeton/house, "salsa hour" with no social language.
- **unclear:** everything else. The app shows unclear as "salsa music, dancing not confirmed".

### 2.4 Grounded search answers (Gemini + Google Search)
A grounded answer is **never a source**. It is a lead generator.
1. Split the answer into atomic statements ("X has salsa on Thursdays").
2. Each statement with a cited URL → fetch that URL and re-extract from it. The claim's source is the URL, not Gemini. If the URL doesn't support the statement, drop it.
3. Statements with no citation, or whose citation can't be fetched (e.g. Reddit), → `Lead` with `reason: "grounded_uncited"` or `access: snippet_only`. They can create a *candidate* Venue but can't make a session show as more than `unverified`.
4. Two Gemini statements citing the same listing count as **one** source.

### 2.5 Google Places
Used for: discovery (Text Search: "salsa school", "clases de salsa", "salsa bar", "baile latino" in the town), `place_id` matching, `websiteUri` → website → Instagram link, and live display at view time. Review text can surface **names** of other places as leads (move 3), but under the terms in `data-access.md` we don't store review text or build claims from it. *Owner/legal to confirm that using names from reviews as leads is fine.*

## 3. Entity resolution

### 3.1 Venues
Match a new subject to an existing Venue by the first rule that fires:
1. **Hard keys:** same `google_place_id`, same Instagram handle, same website domain, same phone (normalized E.164). → merge.
2. **Linked keys:** website links to the handle, or bio links to the website, or the Instagram location tag resolves to the place_id. → merge.
3. **Name + location:** normalized names match (lowercase, strip accents, drop words like bar / club / escuela / academia / salsa / the / la / el, drop punctuation and emoji) **and** within 150 m (or same street when only an address is known). → merge.
4. **Name only, same town:** → *candidate* match. Needs one more signal (shared tag, same nights, same neighborhood word) to merge; otherwise keep separate and flag for review.

On merge, keep all names in `aliases`. Never merge across towns automatically.

Handles that fail ("profile isn't available") are kept as dead aliases on the venue they were listed for, so a listing's old handle doesn't spawn a ghost venue.

### 3.2 Hosts and venues
- A post by Host A that says "en @B" or carries B's location tag → the session's `venue_id` = B, `host_id` = A.
- If A posts the same night at different venues over time, the Session hangs off the Host, and each occurrence carries a venue. The map shows it at the latest venue.
- A Host with no venue in any evidence (private teacher, touring band) is kept as a Host but gets no waypoint.
- Bands and DJs are hosts of `live_music` sessions; they never make a venue `partner_dancing: yes` by themselves.

### 3.3 Sessions
Two session claims are the same session if same venue (or host), same weekday, start times within 60 min, and compatible type. A class at 20:00 and a social at 21:00 at the same venue are **two** sessions linked by `linked_session`.

## 4. Conflicts, recency, confidence

### 4.1 Source tiers
| Tier | Sources | Notes |
|---|---|---|
| A: first-hand, dated | venue/host Instagram post, dated website page, in-app user report "I was there on <date>" | strongest |
| B: first-hand, undated | Instagram bio, undated website schedule page | current *as of seen_at*, may be forgotten |
| C: third-party first-person | forum/Facebook/Reddit comment by a dancer, dated | good for vibe and "still running", weak for times |
| D: listings | salsavida-type sites, aggregators, tour pages | leads; often copied and stale |
| — | grounded answers, Google content | not a tier; see 2.4, 2.5 |

**Independence:** sources are independent only if they have different authors. The venue's bio and its posts are one author. A listing that copies the venue is not independent of it (if the text matches closely, merge them).

### 4.2 Which value wins (per field)
1. A **cancellation/change** claim (tier A/B) beats everything older for that session.
2. Otherwise the **newest tier-A** claim wins.
3. A tier-B **complete schedule** (bio listing all nights) defines the set of nights unless a newer tier-A claim adds or removes one.
4. A single event post **adds** a night; it never removes other nights.
5. Tier C/D values that disagree with A/B **lose** and go to the conflict log. They are not shown.
6. Tier C/D nights with no A/B evidence either way are shown as **"listed, not confirmed"**, never as plain fact.
7. Ties at the same tier and same date: keep both, mark `conflict`, queue for review.

### 4.3 Recency and status (per session; venue status = best of its sessions)
Based on `last_confirmed` = date of the newest tier A/B/C claim that the session still runs (bio counts with its `seen_at` only when the account has posted within 90 days; a bio on a dormant account doesn't prove anything).

| Status | Rule |
|---|---|
| active | last_confirmed ≤ 90 days |
| probably_active | 90–180 days, and no ending signal |
| stale | 180–365 days, or doubt comments with no answer |
| inactive | > 365 days, or an explicit ending ("última clase", "cerrado", "nos mudamos"), or the account posts regularly but hasn't mentioned this night in 6 months after mentioning it often before |
| unverified | only tier D or grounded leads |

One-off sessions become `past` the day after their date. The thresholds are starting values; the pilots should tune them (the data model left the stale cutoff open).

### 4.4 Promoting one-offs to weekly
If dated one-off flyers for the same venue, weekday and time appear on ≥3 different weeks within 8 weeks, create a weekly session with those flyers as sources.

### 4.5 Confidence (shown as high / medium / low; maps to the data model's verification status)
| Confidence | Rule | Data-model status |
|---|---|---|
| high | tier A ≤ 90 days, **or** 2+ independent sources incl. one A/B ≤ 180 days | confirmed |
| medium | one tier A/B source ≤ 180 days, or 2+ independent C/D sources ≤ 365 days | single_source |
| low | only tier D, only snippets, or newest evidence > 180 days | single_source / stale |
| (override) | an owner or reviewer checked it | human_approved |

Confidence is per **field group**, not just per session: a night can be high while its price is low (price from a 2-year-old listing). Fields below medium are shown with "unconfirmed" or hidden; the owner decides which (open question).

## 5. Lead-following loop

```
seeds (depth 0) ─▶ read ─▶ extract ─▶ new handles/names ─▶ depth 1 ─▶ read ─▶ extract ─▶ record tags, stop
```
- **Seeds (depth 0):** listing-site entries, Google Text Search results, grounded-search leads, owner-supplied names.
- **Depth 1:** every account or name tagged/mentioned by a depth-0 **first-hand** source, with a venue/host/instructor role. Read its profile and recent posts; extract claims. Its own tags are recorded as leads with `depth: 2` but **not followed**.
- **Exception (one rule):** a depth-2 name mentioned by **2+ independent** sources is promoted to depth 1. This catches the main school that no seed listed, without opening the whole graph.
- **Skip without reading:** account bio places it in another town/country; personal account with no teaching/organizing words; brands, photographers, drink sponsors; a handle already resolved.
- **Stop rules (per town):** whichever comes first:
  - the last 10 reads produced no new venue or host;
  - budget reached (starting values: 40 account reads, 300 posts, 20 fetched web pages, 10 grounded queries, Places within the free tier);
  - no lead left at depth ≤ 1.
- **Log** every lead's final status, so a validation run can show what was found, skipped and why.

## 6. Ratings

Three layers, kept apart in storage and on screen.
1. **Source-derived facts (ours):** counts, not opinions. Nights per week, class before social, partner dancing yes/no, level words seen, last_confirmed, and quoted vibe notes. These are the "why" behind any badge.
2. **Google rating:** fetched live at view time and shown with Google attribution. Never stored, never blended into our score (terms).
3. **In-app user ratings:** per **session**, not per venue (a bar's Wednesday social and its Saturday club hour are different things). Short, structured:
   - "Was it on when you went?" (yes / no / changed) → a dated tier-A `user_report` claim that feeds recency and conflict rules;
   - partner dancing? level felt? crowd (locals / tourists / mixed)? did people ask you to dance?
   - 1–5 stars, plus an optional sentence.

Rules:
- A star average is shown only after ≥5 ratings, with the count. Use a damped average (pull toward the town's mean with weight ~5) and only ratings from the last 18 months.
- Structured answers (level, crowd) become the shown value once ≥3 users agree and nothing tier-A contradicts them; until then, show source quotes.
- **Vibe text is never generated.** The app shows quotes (from sources or users), each with author type and date. A summary line is allowed only if every phrase in it maps to a quote it links to; otherwise no summary.
- One rating per user per session per 30 days. Ratings from users who were never in the town (no location check) are labeled, not dropped, for now (open question).

## 7. Validation on blind test cities

Goal: cheap, honest numbers on whether the method works before scaling.

**Setup**
- 3 cities the method was never tuned on: one large city, one tourist town, one area search (lake/region with several towns). The owner chooses them and, **before** the run, privately writes the places and nights they know or can check with a local contact (the answer key). The run never sees that list.
- Freeze the prompts, thresholds and budgets before the run. Any change after scoring means new blind cities for the next round.
- Log cost per city: API calls, tokens, account reads, wall time.

**Output for scoring:** one sheet per city, one row per session shown in the app: venue, type, nights, time, partner dancing, status, confidence, top source link. Plus the list of leads marked `not_salsa` or `out_of_area`.

**Owner scores each row (target ≤30 min per city):**
- correct / partly correct (venue right, night or time wrong) / wrong / not partner dancing / closed;
- spot-check 10 random quotes: does the quote appear at the link?

**Metrics**
| Metric | Starting pass bar |
|---|---|
| Precision of shown sessions (correct ÷ shown) | ≥ 80% |
| Precision among `high` confidence | ≥ 90% (checks that confidence means something) |
| Recall vs the owner's key (key sessions found ÷ key sessions) | ≥ 60% |
| Partner-dancing label accuracy | ≥ 90% |
| Status accuracy (active vs closed) | ≥ 80% |
| Quotes that don't match their source | 0 |
| Cost per city | owner sets a ceiling |

For each miss, record why: never found (discovery), found but filtered (rules), or found but wrong (extraction). That tells which section of this method to fix.

## Open questions for the owner
1. Show `low` confidence fields as "unconfirmed", or hide them?
2. Is a tagged account in another town ever worth following (touring instructors, festivals)?
3. OK to use names seen in Google reviews as leads only (legal check)?
4. Should user ratings require being in the town (location check)?
5. Who reviews `conflict` and `candidate match` items, and how often?
6. Status thresholds (90/180/365 days) are guesses; keep until pilots tune them?
