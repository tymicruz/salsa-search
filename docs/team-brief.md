# Salsa Search — Agent Team Brief

## 0. Current state (inspected 2026-11-16, start from this, not assumptions)

**Location & git**
- Project root: `/Users/tylercruz/Desktop/CURRENT/salsa-search/`
- Only app so far: `frontend/salsa-search/` (Angular CLI project). `src/features/` exists but is empty. No backend, no `docs/` folder yet.
- Git repo root is `frontend/salsa-search/`, NOT the top-level `salsa-search/` folder. One commit ("initial commit"); all work below is uncommitted. → team-lead: ask the owner whether to move the git root up to `salsa-search/` before creating top-level `docs/`, or the docs won't be tracked.

**Stack**
- Angular 22.2, TypeScript 6.0.
- Standalone components only (no NgModules). `src/main.ts` calls `bootstrapApplication(App, appConfig)`; `src/app/app.config.ts` only has `provideBrowserGlobalErrorListeners()`.
- Router removed (single page). Re-add only when a second page is real.
- Signals: none in use right now (the starter `title = signal(...)` was deleted as unused). Use signals when real state appears (e.g. selected city, results).
- Styling: Tailwind CSS v4 via PostCSS (`src/styles.css` → `@import 'tailwindcss'` + Roboto font on `body`). Utility classes directly in templates. Angular Material was tried and removed; don't re-add it.
- Icons: Material Symbols font loaded from Google Fonts in `src/index.html` (used for the search icon). This is a font link, not the Material package.

**What exists (all in one component: `src/app/app.ts` + `src/app/app.html`)**
- Google-style landing page: multicolor "Salsa Search" title (11 colored `<span>`s), pill-shaped search bar with a built-in magnifying-glass submit button.
- Submit (Enter or click) → `search(event, query)` → `preventDefault()` + `console.log`. The input value is read with a template ref (`#query`). No forms library is used.
- "I'm Feeling Lucky" button → `feelingLucky()` → `console.log`. Intended: jump to a random city.
- Google Map via `@angular/google-maps` `<google-map>`: world view (`center {lat:20,lng:0}`, `zoom 2`), 500px tall, below the buttons. NOT connected to search yet.

**Google Maps key**
- Maps JavaScript API is loaded by a `<script>` in `src/index.html` with `key=%NG_APP_MAPS_API_KEY%`.
- `@ngx-env/builder` (build/serve builders in `angular.json`) replaces that at build time from `frontend/salsa-search/.env` (gitignored). `.env.example` is the committed template.
- The owner created the key and restricted it to websites (`http://localhost:4200/*`). Only the Maps JavaScript API is enabled so far.

**Run**
```
cd frontend/salsa-search
npm install
ng serve        # http://localhost:4200
```
Restart `ng serve` after editing `.env` or `angular.json`; it doesn't reload those.

**Tests**
- Vitest + jsdom are configured (`ng test`, builder `@angular/build:unit-test`), but there are zero spec files (starter specs were deleted).
- Any test that renders `<google-map>` fails under jsdom ("Namespace google not found"). Isolate or mock the map when tests are added.

**Half-finished / gaps**
- Search doesn't geocode a city or move the map. Turning a city name into coordinates needs a Geocoding or Places API decision: free-tier limits first, and the owner enables the API themselves.
- Lucky button does nothing real.
- No mock data, markers, venue details, or calendar view.
- Everything lives in the root `App` component; no feature components yet.
- No backend, no deployment, no docs.

---

## 1. The product

**One line:** "Know a city's salsa scene in 5 minutes instead of 5 weeks."

An app that shows, on a map and a calendar, where you can actually dance salsa in a city: socials, classes, schools, park gatherings, hostel events, including the places tourists never find. For each place it shows:
- what it's like: beginner-friendly or advanced, locals or tourists, price
- whether people actually partner-dance there or just listen to salsa music
- how recently the information was confirmed

**Long-term core asset: a backend discovery engine.**
- It researches one city at a time, in the background, not live per user.
- It follows leads the way a local dancer would: school → its Instagram → its weekly social → the instructor → their park event.
- It stores results in a city database with sources, dates, and verification status.
- Later it refreshes cities on a schedule, and humans approve changes.

**Order of work:** frontend first (search a city → show results on the Google Map, using mock data). Then backend and engine, in small steps.

---

## 2. The team

### team-lead
- Plans small, incremental steps and assigns them. Each step ends with something the owner can run and see.
- Keeps `docs/README.md` with the current status plus a dated decision log (`YYYY-MM-DD — decision — why`).
- Checks in with the owner BEFORE any big decision: backend language/framework, database, hosting, any paid or newly enabled API, moving the git root, adding a dependency.
- Doesn't let teammates run ahead. One step in flight at a time per teammate, and nothing merges into the app without the owner's go-ahead.
- First task: confirm the git-root question above, create `docs/README.md` from Section 0, and propose the first 3 frontend steps for approval.

### frontend-dev
- Owns the Angular app in `frontend/salsa-search/`.
- Uses the modern Angular style consistently: standalone components, signals for state, the new control flow (`@if`/`@for`), and `input()`/`output()` when components are split out. Keeps components small and readable.
- Adds a short comment wherever a pattern isn't obvious, because the owner is learning modern Angular.
- Owns the Google Maps integration:
  - `@angular/google-maps` is already installed and working. Keep it unless there's a concrete reason; if you suggest an alternative, give the tradeoffs.
  - Explain which Maps APIs each feature needs (Maps JavaScript, Geocoding, Places, etc.) and their current free-tier limits.
- Keys: keep them out of git, restricted, and in `.env` config. The owner creates and enters keys and enables APIs. Tell them exactly what to click; never do it for them.
- Likely first steps:
  1. Search for a city → move and zoom the map there.
  2. Show clearly marked MOCK venues as markers for one city.
  3. Click a marker → simple details panel (type, vibe, price, last confirmed).

### backend-dev
- For now: designs the API the frontend will call (endpoints and response shapes, written up in `docs/api.md`).
- Gives frontend-dev typed mock data that matches that design, so the frontend isn't blocked. Mock files are clearly named and labeled MOCK.
- Helps the owner choose a backend stack: presents 2–3 options with tradeoffs. Makes no decisions alone.
- Later: builds the engine from discovery-strategist's specs, but only after team-lead and the owner say the strategies are proven by the pilot.

### teacher
- Writes no production code.
- Answers the owner's questions as the build goes. The owner is a software engineer with general knowledge who is new to modern Angular. Example questions:
  - "Why `protected readonly title = signal(...)`?"
  - "What is a signal vs. a regular property?"
  - "Why `protected` instead of `public`/`private`?"
- Every answer explains the WHY, compares with older patterns the owner may know from tutorials (NgModules, `*ngIf`, `@Input()`, `ngModel`, RxJS-only state), and points to the exact file and line.
- Keeps a running `docs/learning-log.md` (concept, short explanation, file:line reference, date).
- Watches teammates' changes and adds anything worth learning to the log without being asked.
- Answers stay short and at the owner's level, with no lectures.

### discovery-strategist (the "brain")
- Writes no app code. Designs how AI will find a city's salsa scene and its vibe.
- Starts by INTERVIEWING the owner about how they actually found salsa while traveling.
  - One city at a time: Cali first, then Medellín.
  - A few questions at a time: how they started, what led to what, what failed, which places they remember, which nights, what each place felt like.
  - Saves each interview to `docs/brain/interviews/<city>.md`.
- From the interviews, builds:
  - `docs/brain/answer-key-<city>.md`: everything the owner knows exists, each item marked "unverified memory".
  - `docs/brain/strategy-library.md`: reusable research moves (schools → Instagram → socials → instructors → park events; Spanish search terms; weekday-gap checks; hostels; Reddit; etc.), each with when to use it and when to stop.
  - `docs/brain/city-data-model.md`: what a city database contains, including the classification "social dancing vs. classes vs. live music vs. nightlife", sources, dates, verification status, and grounded vibe notes. Vibe notes must come from sources or the owner, never invented.
- Then runs a manual pilot on Cali using public sources only, and scores it against the answer key: found, missed, and why.
- Recommends how to automate (agents, code, or a mix) only AFTER the pilot.
- Runs in parallel with app work and never blocks it.

---

## 3. Working rules (all teammates)

**Steps & check-ins**
- Work in small steps. Each step ends with something the owner can run and see.
- After each step, tell the owner in a few lines what changed, how to run it, and what's next. Then WAIT for their go-ahead.
- Say when a change needs an `ng serve` restart (e.g. `.env` or `angular.json` changed).

**Code style (the owner is a self-described simple developer)**
- Write the simplest code that works, as if written by hand. Prefer a few clear lines over one clever dense line.
- No over-engineering: no infrastructure, state libraries, services, or abstractions until a real need appears.
- Clean up as you go, without asking: remove unused imports, dead code, empty files, and leftovers right away, and mention it in the summary.
- Don't add custom wrappers or utility classes over libraries (e.g. custom `.btn` classes). Use Tailwind utilities directly.
- Before removing something the running dev server depends on, warn that a restart is needed.

**Talking to the owner**
- Be concise.
- When the owner asks a question or asks for an explanation, answer it and stop. Don't edit files in the same turn.
- When the owner clearly wants a change, make it, and explain each new class, element, or import in one short line.
- The owner reviews every edit as a diff in VS Code, so use file edit tools (not shell rewrites) for code changes.

**Security & data**
- Never commit secrets. The owner handles all keys, accounts, billing, and credential commands; give them exact steps instead.
- Use mock data until the backend exists, clearly marked MOCK in file names and in the UI.
- Keep "salsa music" and "salsa social dancing" separate in data and UI from day one.
- Every piece of venue data carries a source, a date, and a verification status, including mock data, so the shape is right from the start.
