# Map UX plan: venues, events, calendar, rating

Planning only. No code has changed. Last updated: 2026-11-16.
Builds on `docs/brain/city-data-model.md`. **A pin on the map is a Venue** (the data model uses "Place" for searchable areas like "Lake Atitlán", so the UI says "place" but the code says `Venue`).

## 1. Layout

### Desktop (like Google Maps restaurant search)

```
+--------------------------------------------------------------------------------+
| [ Search city...      (o) | dice ]                               Salsa Search |
| +------------------------+                                                     |
| | Mo Tu We Th Fr Sa Su   |  <- week strip: tap a day to filter                 |
| | [All] ( We selected )  |                                                     |
| |------------------------|          (D)        (D)                             |
| | > Casa Salsa  (D) 4.5* |                 [3]  <- cluster                     |
| |   Social We 21:00      |      (M)                    +-------------------+   |
| |   confirmed 2 wk ago   |                (D)*  -----> | Casa Salsa  4.5*  |   |
| |------------------------|                             | DANCING: Wed soc. |   |
| |   Bar Latino   (M) --  |                             | confirmed Nov 2   |   |
| |   Live band Fr 22:00   |                             | [Details]         |   |
| |------------------------|                             +-------------------+   |
| |   Escuela Sol  (D) 4.0*|                             ^ preview (info window) |
| |   Class Mo/We 19:00    |                                                     |
| +------------------------+                         MAP                         |
+--------------------------------------------------------------------------------+
(D) = social dancing pin   (M) = music only pin   (?) = unclear   * = selected
```

Clicking **[Details]** or a list row twice swaps the list for the detail panel (same left column, "<- Back"):

```
+------------------------+
| <- Back                |
| Casa Salsa             |
| bar/club · San Pedro   |
| Rating 4.5 (12)  [1-5] |  <- tap stars to rate
|------------------------|
| Filter: [We]           |
| SOCIAL DANCING         |
|  Wed 21:00 Social  Q30 |
|  confirmed 2026-11-02  |
|  source: listing site  |
| CLASSES                |
|  Mon 19:00 Beginner    |
| MUSIC ONLY             |
|  Fri 22:00 Live band   |
| Links: web · IG · Maps |
+------------------------+
```

### Mobile (< 768px)

```
+----------------------+     +----------------------+     +----------------------+
| [Search...    |dice] |     | [Search...    |dice] |     | <- Back   Casa Salsa |
| Mo Tu We Th Fr Sa Su |     | Mo Tu We Th Fr Sa Su |     | Rating 4.5 [1-5]     |
|                      |     |                      |     | SOCIAL DANCING       |
|     (D)   (D)        |     |     (D)   (D)*       |     |  Wed 21:00 Social    |
|  (M)     [3]         |     |  (M)     [3]         |     |  confirmed Nov 2     |
|        MAP           |     |        MAP           |     | CLASSES ...          |
|======================|     |+--------------------+|     | MUSIC ONLY ...       |
|  ---  3 places       |     || Casa Salsa  4.5  > ||     |                      |
|  Casa Salsa (D) 4.5  |     || DANCING Wed 21:00  ||     |                      |
+----------------------+     |+--------------------+|     +----------------------+
 list = bottom sheet          tap pin = preview card       tap card = full-screen
 (drag/tap to expand)         (no info window on phone)    detail
```

### Interactions
- **Pin ↔ list:** one `selectedId` signal. Clicking a pin highlights and scrolls to its row. Hovering or clicking a row highlights the pin and pans to it.
- **List = what's in view.** The list shows venues inside the current map bounds (updated on `idle`), like Google Maps' "Search this area".
- **Day filter:** the week strip sets a `day` signal (or null for All). The list, the pins and the detail panel then show only events on that day. A venue with no events that day is hidden.
- **Dancing vs music:** pin color/icon, plus a text label (never color alone). Dancing = solid red pin with a dancer icon. Music only = hollow purple pin with a note icon. Unclear = grey "?".
- **Freshness:** every event row shows "confirmed <date>". Stale ones (older than the cutoff, not yet decided) are greyed and say "may be outdated".

## 2. Data (TypeScript)

Minimal subset of the data model. Everything in dev is MOCK.

```ts
// One pin on the map. data model §2
export interface Venue {
  id: string;
  name: string;            // "MOCK Casa Salsa" while mock
  kind: 'school' | 'bar_or_club' | 'hostel' | 'park_or_street' | 'beach' | 'other';
  town: string;            // display name, e.g. "San Pedro La Laguna"
  lat: number;
  lng: number;
  links?: { website?: string; instagram?: string; googleMaps?: string };
  events: SalsaEvent[];    // embedded for now; separate table in the backend
}

// A weekly night or a one-off/festival. data model §3
// (named SalsaEvent because "Event" is already a browser type)
export interface SalsaEvent {
  id: string;
  name: string;            // "Wednesday social"
  type: 'social' | 'class' | 'live_music' | 'club_salsa_hour' | 'hostel_activity' | 'festival';
  partnerDancing: 'yes' | 'no' | 'unclear';   // drives dancing vs music styling
  days: number[];          // 0 = Sun ... 6 = Sat; empty for one-off
  start: string;           // "21:00"
  dates?: { from: string; to: string };       // festivals / one-offs, ISO dates
  level?: 'everyone' | 'beginners' | 'advanced';
  price?: string;          // as the source says, e.g. "Q30"
  lastConfirmed: string;   // ISO date
  status: 'unverified_memory' | 'single_source' | 'confirmed' | 'stale' | 'human_approved';
  sourceUrl?: string;
}

// Summary shown in the UI (backend computes it)
export interface VenueRating {
  venueId: string;
  average: number;         // 1–5
  count: number;
  mine?: number;           // the current user's rating, if any
}
```

Derived in the component, not stored: a venue's pin style = "dancing" if any event has `partnerDancing: 'yes'`, else "music" if it has music events, else "unclear".

## 3. Google Maps pieces

| Piece | Angular component | Needs | Notes |
|---|---|---|---|
| Pins | `<map-advanced-marker>` | a **Map ID** + `marker` library in the script URL (`libraries=places,marker`) | Recommended. Pins can be any HTML (our dancer/music icons). Use `DEMO_MAP_ID` in dev; create a real Map ID (Cloud console → Map Management) before launch. |
| Pins (old) | `<map-marker>` | nothing extra | `google.maps.Marker` is **deprecated since Feb 2024** (v3.56). Not scheduled for removal, but don't start new work on it. |
| Clusters | `<map-marker-clusterer>` | npm `@googlemaps/markerclusterer` | Works with advanced markers. Only needed once a city has many pins (say 30+). |
| Preview | `<map-info-window>` | nothing extra | Desktop only. On phones use a Tailwind card at the bottom instead. |

Note: a Map ID means the JS `styles` option no longer applies; styling moves to the Cloud console. We don't use `styles` today.

### Cost (verified 2026-11-16)
Source: [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [Maps JS usage & billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing).

| What | SKU | Free per month | Then per 1,000 |
|---|---|---|---|
| Showing the map (each page load) | Dynamic Maps (Essentials) | 10,000 | $7.00 |
| Typing in search | Places Autocomplete Requests (Essentials) | 10,000 | $2.83 |
| Fitting map to the picked city (`viewport`) | Place Details Essentials | 10,000 | $5.00 |
| Advanced markers, Map ID, info windows, clustering | none listed | — | runs in the browser on the already-billed map load |
| (avoid) Google's own place ratings/hours | Place Details Pro+, Nearby/Text Search Pro | 5,000 | $32.00 |

**Key point:** venue pins come from our own data, not from Google Places, so adding pins costs nothing extra. Don't fetch Google details per venue; that is where the cost would be.

(The pricing pages say nothing about charges for advanced markers, Map IDs, info windows or clustering on the web. So "none listed" means no separate SKU was found, not that Google promises it is free.)

## 4. Calendar: plain Tailwind (recommended)

Most of the scene is weekly ("every Wednesday"), so the main control is a **7-day week strip** (`All Mo Tu We Th Fr Sa Su`). That's about 10 lines of template: an `@for` over days and buttons that set a `day` signal.

| | Plain Tailwind week strip | Library (e.g. FullCalendar, angular-calendar) |
|---|---|---|
| Code | ~10 template lines, no new deps | New dependency + config + its CSS |
| Fits weekly data | Exactly | Built for dated events; weekly needs recurrence rules |
| Looks | Matches our Google-style UI | Its own look; theme fighting |
| Missing | Month view, festivals by date | Has it |

Later, if festivals matter: add a small month grid (also plain Tailwind, `@for` over 35 cells) only in the detail panel. Revisit a library only if drag/zoom/agenda views are needed.

## 5. Rating

**Real version needs:**
- A **backend** with a `ratings` table (`userId, venueId, stars, createdAt`; one per user per venue) and an endpoint that returns `VenueRating`.
- **User identity**, so one person = one vote. The simplest option is sign-in with Google (e.g. Firebase Auth), which also matches the Google project we already have. Anonymous device IDs are easy but trivial to game.
- Basic abuse checks (rate limit, edit instead of re-vote).

**Dev-time MOCK version (no backend):**
- `average` and `count` come from the mock venue file, labeled MOCK.
- Tapping stars sets `mine` in a signal and saves it to `localStorage` (this browser only). The average is not changed. A small "MOCK: not saved to a server" note sits under the stars.

## 6. Staged plan (each step = something visible)

All data in `src/app/mock-venues.ts`, every name prefixed `MOCK`, file header `// MOCK DATA: replace with backend`. Use 6–10 venues in one town (e.g. San Pedro La Laguna) so the dice/search can land there.

| # | Step | Owner sees | Files likely touched | Owner must enable |
|---|---|---|---|---|
| 1 | Mock data + pins | Pins on the map in San Pedro; dancing vs music look different | new `src/app/mock-venues.ts`, new `src/app/venue.ts` (interfaces), `app.ts`, `app.html`, `src/index.html` (`libraries=places,marker`) | Nothing (`DEMO_MAP_ID` for dev) |
| 2 | Results list | Left column lists venues in view; list updates on pan/zoom | `app.ts`, `app.html` (or new `src/features/venue-list/`) | — |
| 3 | Select sync + preview | Click pin → preview card + row highlighted; click row → pin highlighted, map pans | `app.ts`, `app.html` (`<map-info-window>`) | — |
| 4 | Detail panel | "Details" opens the panel: events grouped Social / Classes / Music only, "confirmed <date>", source link | new `src/features/venue-panel/` | — |
| 5 | Week strip filter | Tap "We" → only Wednesday pins/rows/events remain | `app.ts`, `app.html` (or `src/features/week-strip/`) | — |
| 6 | MOCK rating | Stars on list rows and panel; tapping saves "my rating" in this browser | `venue-panel`, `mock-venues.ts` | — |
| 7 | Mobile layout | On a phone: bottom-sheet list, bottom preview card, full-screen detail | `app.html`, `venue-panel` (Tailwind `md:` classes) | — |
| 8 | Real Map ID + clustering | Real Map ID in `.env`; nearby pins merge into numbered clusters when zoomed out | `.env`, `.env.example`, `app.html`, `package.json` (`@googlemaps/markerclusterer`) | Create a Map ID (Cloud console → Map Management); add it to `.env` |

Backend steps (real data, real ratings, sign-in) come after these and need separate decisions.

## Open questions for the owner
1. Is rating **per venue** or **per event** (a venue's Wednesday social can be great while its Friday is dead)?
2. Stars 1–5, or something simpler (thumbs up / "went here")?
3. Should music-only venues show by default, or be hidden behind a "show music-only" toggle?
4. Do festivals (dated, multi-day) matter now, or is the weekly strip enough for v1?
5. Stale cutoff for "may be outdated": 3 months? 6?
6. Which town should the mock data use (San Pedro La Laguna, or a city you know well)?
