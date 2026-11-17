# City Data Model

What the discovery engine stores and what the app reads. Design only, with no stack or database chosen yet.

Last updated: 2026-11-16

## Rules that apply everywhere
- Every fact carries a **source**, a **date checked**, and a **verification status**. This includes mock data.
- **Salsa music ≠ salsa social dancing.** Every venue and event says whether people partner-dance there.
- **Vibe notes come from a source or the owner.** Never invent them.

## 1. Places: what a user can search

A search can be a city, a town, a state, a lake, or a loose area like "Bay Area". All of these are **Places**.

| Field | Example | Notes |
|---|---|---|
| id | `atitlan` | |
| name | Lake Atitlán | |
| kind | `area` or `town` | `town` covers cities, towns and neighborhoods we research. `area` covers lakes, regions, states, counties and colloquial areas. |
| google_place_id | `ChIJ...` | Links a Google search result to our Place. |
| center, viewport | lat/lng, bounding box | Taken from Google when the place is added. |
| scene_summary | see section 5 | |

**Membership: towns belong to areas (many-to-many)**
- An area lists its towns, for example Atitlán → San Pedro La Laguna, Panajachel, San Marcos La Laguna, Santiago Atitlán.
- A town can belong to several areas, for example San Francisco → Bay Area, California.
- An area can contain smaller areas, for example California → Bay Area.

## 2. Venues

A venue belongs to exactly one **town** and has its own coordinates.

| Field | Notes |
|---|---|
| name, town_id, lat/lng, address | |
| kind | `school` / `bar_or_club` / `hostel` / `park_or_street` / `beach` / `other` |
| links | website, Instagram, Google Maps |
| sources | list of sources (see 4) |

## 3. Events: what actually happens at a venue

Most of the scene is weekly nights, so an event is a recurring night (or a one-off date).

| Field | Notes |
|---|---|
| venue_id, name | e.g. "Thursday social" |
| type | `social` / `class` / `live_music` / `club_salsa_hour` / `hostel_activity` / `festival` |
| partner_dancing | yes / no / unclear |
| schedule | weekly day and time, or a date range for festivals |
| price | if a source says |
| level | everyone / beginners / advanced, if a source says |
| crowd | locals / tourists / mixed, if a source says |
| style | e.g. Cali style, on1, on2, if a source says |
| host | the school that runs it, if any |
| vibe_notes | short notes, each pointing to its source |
| last_confirmed | date of the newest source showing it still runs |

## 4. Sources and verification

Each source records: URL or "owner interview", source type (listing site / Google review / Instagram / Reddit / website / owner), date published, date checked, and a short quote.

Verification status:
- `unverified_memory`: from the owner's interviews only
- `single_source`: one public source
- `confirmed`: two or more independent sources, or recent posts from the venue itself
- `stale`: newest source is older than the cutoff (to be decided after pilots)
- `human_approved`: a person reviewed it

## 5. How an area search works

**Search "Lake Atitlán" → show every venue in its towns.**
1. Match the Google result to our Place by `google_place_id`.
2. If it's an area, collect all its member towns, including those of smaller areas inside it.
3. Show all venues in those towns on the map. The frontend already fits the map to the viewport.
4. **Fallback for places we haven't set up:** show venues whose coordinates fall inside the Google viewport. Explicit membership is preferred, because viewports for loose areas like "Bay Area" are rough.

So a venue in San Pedro La Laguna shows up for "San Pedro", "Lake Atitlán" and "Guatemala".

**Scene summary, per town and per area.** This helps a traveler choose where to stay. It is counted from the data, not invented:
- partner-dancing socials per week, and on which nights
- number of schools
- level mix (beginner-friendly vs. advanced)
- how fresh the data is (newest `last_confirmed`)
- for an area: which town has the most going on, e.g. "most socials are in San Pedro, few in Panajachel"

A star rating or score can come later, once pilots show which counts matter.

## 6. Research unit
- The engine researches **towns** (the playbook runs per town).
- For an area, it runs the playbook on each member town, plus area-wide searches like "salsa Lago Atitlán". These catch events that move between towns or are listed under the area name.

## Example (shape only, MOCK)

```
Place  atitlan          kind: area   towns: [san-pedro, panajachel]
Place  san-pedro        kind: town   areas: [atitlan]
Venue  MOCK Casa Salsa  town: san-pedro   kind: bar_or_club
Event  MOCK Wed social  type: social  partner_dancing: yes  schedule: Wed 21:00
       source: MOCK listing, checked 2026-11-16, status: single_source
```
