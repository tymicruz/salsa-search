// POST /synthesize: turns one search's raw rows (Google places + SalsaVida events) into a short list of
// real venues a human can read. The LLM only decides which rows belong together and writes labels and a
// one-line summary. Code checks everything it says and copies schedules, links and locations from the input,
// so those can never be invented.
import { askLLM } from './llm.ts';

// ---------- Shapes ----------

// A Google place as the frontend sends it. Coordinates and the Maps link stay here; they never go to the LLM.
export interface RawPlace {
  id: string; // Google place ID
  name: string;
  types?: string[];
  primaryType?: string;
  lat: number;
  lng: number;
  googleMapsUri?: string;
}

// A SalsaVida event as the frontend has it (one row per kind, so one event ID can appear twice).
export interface RawEvent {
  id: number;
  title: string;
  venue: string;
  kind: 'class' | 'social';
  days: number[];
  time: string;
  price: string;
  url: string;
  lastEdited: string;
  status: 'listed' | 'stale';
}

export interface Venue {
  id: string; // first placeId, or "sv-<eventId>" when there's no Google place
  name: string;
  hosts: string[];
  placeIds: string[]; // the first one is the pin
  lat?: number; // from the first place; missing = SalsaVida only, list without a pin
  lng?: number;
  googleMapsUri?: string;
  category: string; // one of CATEGORIES
  offers: string[]; // any of OFFERS
  summary: string;
  schedule: (Omit<RawEvent, 'id' | 'venue'> & { eventId: number })[];
  evidence: { quote: string; source: string }[]; // source = place ID or SalsaVida URL
}

const CATEGORIES = ['salsa_school', 'social_venue', 'bar_club_with_salsa', 'unknown'];
const OFFERS = ['classes', 'socials', 'music'];
const NEAR_METERS = 150;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Words too common to show two names are the same place.
const GENERIC_WORDS = new Set(
  ('salsa dance dancing baile bailes bar club academia academy escuela school studio estudio salon the and ' +
    'la el los las de del y en at social socials clases classes class bachata latin latino night disco discoteca ' +
    'restaurante restaurant cafe puerto escondido medellin cali').split(' '),
);

// ---------- Main ----------

export async function synthesize(places: RawPlace[], events: RawEvent[]) {
  // Short refs ("p1", "e1") instead of long IDs keep the prompt small and easy to check.
  const placeRefs = new Map(places.map((p, i) => [`p${i + 1}`, p]));
  const eventRefs = new Map(events.map((e, i) => [`e${i + 1}`, e]));
  const near = nearGroups(places);

  // What the LLM sees: names, types, a "near" hint and event text. No coordinates, no addresses.
  const input = {
    places: [...placeRefs].map(([ref, p]) => ({ ref, name: p.name, types: p.types, near: near.get(p.id) })),
    events: [...eventRefs].map(([ref, e]) => ({
      ref,
      title: e.title,
      venue: e.venue,
      kind: e.kind,
      days: e.days.map((d) => DAY_NAMES[d]),
      time: e.time,
      price: e.price,
    })),
  };

  const prompt = `You merge raw search results into a clean list of salsa venues for a map. Use ONLY the data below.
Never use outside knowledge and never guess.

"places" are Google Maps results. "events" are SalsaVida listings; their "venue" is the place where they happen.
Places with the same "near" value are within ${NEAR_METERS} m of each other.

Merge rows that are clearly the SAME physical venue: duplicate Google places, and events whose venue names that place.
A school or organizer that runs classes or socials at another venue is a "host" of that venue
(e.g. an event "Flavia's Dance School" at venue "PM" -> host "Flavia's Dance School" at PM).
If unsure, do NOT merge.

For each venue return:
- name: the clearest name, taken from the input names
- places: place refs, events: event refs (each ref in exactly one venue, or in notSalsa)
- hosts: schools/organizers named in the input that run things there
- category: salsa_school | social_venue (people go to partner-dance) | bar_club_with_salsa (mainly a bar/club with salsa music or nights) | unknown
- offers: only what the data shows: "classes", "socials" (partner dancing), "music" (salsa played). Salsa music alone is NOT socials.
- summary: one plain sentence, at most 25 words, only facts from the data
- evidence: up to 3 short quotes copied EXACTLY from the data, each with the ref it came from

notSalsa: place refs that the data shows have nothing to do with salsa (e.g. a restaurant with "salsa" sauce).
LEAVE OUT a place that is alone (nothing to merge, no events) and has no salsa evidence either way:
it is added automatically as "unknown". Listing it wastes time.

Return JSON only:
{"venues":[{"name":"","places":[],"events":[],"hosts":[],"category":"","offers":[],"summary":"","evidence":[{"quote":"","ref":""}]}],"notSalsa":[]}

Data:
${JSON.stringify(input)}`;

  const answer = JSON.parse(await askLLM(prompt));
  return checkAnswer(answer, placeRefs, eventRefs, near);
}

// ---------- Checking the LLM's answer ----------

function checkAnswer(
  answer: any,
  placeRefs: Map<string, RawPlace>,
  eventRefs: Map<string, RawEvent>,
  near: Map<string, string>,
) {
  const used = new Set<string>(); // every ref may be used once
  const venues: Venue[] = [];

  for (const v of answer.venues ?? []) {
    // Keep only real, not-yet-used refs.
    const myPlaces = (v.places ?? []).filter((r: string) => placeRefs.has(r) && !used.has(r));
    const myEvents = (v.events ?? []).filter((r: string) => eventRefs.has(r) && !used.has(r));

    // A place may join only if it's near the first place or shares a specific name word with it.
    const first = placeRefs.get(myPlaces[0]);
    const okPlaces = myPlaces.filter((r: string, i: number) => {
      if (i === 0) return true;
      const p = placeRefs.get(r)!;
      return (near.get(p.id) && near.get(p.id) === near.get(first!.id)) || sharesWord(p.name, first!.name);
    });
    // An event may join only if its venue/title shares a specific word with the venue name, one of its places,
    // or the first event's venue (for SalsaVida-only venues).
    const firstEvent = eventRefs.get(myEvents[0]);
    const names = [String(v.name ?? ''), firstEvent?.venue ?? '', ...okPlaces.map((r: string) => placeRefs.get(r)!.name)];
    const okEvents = myEvents.filter((r: string) => {
      const e = eventRefs.get(r)!;
      return e === firstEvent && okPlaces.length === 0 || names.some((n) => sharesWord(`${e.venue} ${e.title}`, n));
    });
    if (okPlaces.length === 0 && okEvents.length === 0) continue;
    [...okPlaces, ...okEvents].forEach((r) => used.add(r));

    // Evidence quotes must appear word for word in the row they cite.
    const evidence = (v.evidence ?? [])
      .filter((ev: any) => [...okPlaces, ...okEvents].includes(ev?.ref) && rowText(ev.ref, placeRefs, eventRefs).includes(norm(ev.quote)))
      .slice(0, 3)
      .map((ev: any) => ({ quote: String(ev.quote), source: sourceOf(ev.ref, placeRefs, eventRefs) }));

    venues.push(
      buildVenue(
        okPlaces.map((r: string) => placeRefs.get(r)!),
        okEvents.map((r: string) => eventRefs.get(r)!),
        {
          name: String(v.name || ''),
          hosts: (v.hosts ?? []).map(String),
          category: CATEGORIES.includes(v.category) ? v.category : 'unknown',
          offers: (v.offers ?? []).filter((o: string) => OFFERS.includes(o)),
          summary: String(v.summary ?? ''),
          evidence,
        },
      ),
    );
  }

  const notSalsa = (answer.notSalsa ?? [])
    .filter((r: string) => placeRefs.has(r) && !used.has(r))
    .map((r: string) => {
      used.add(r);
      return placeRefs.get(r)!.id;
    });

  // Nothing vanishes: rows the LLM forgot, or that failed a check, become their own "unknown" venue.
  const empty = { name: '', hosts: [], category: 'unknown', offers: [], summary: '', evidence: [] };
  for (const [ref, place] of placeRefs) {
    if (!used.has(ref)) venues.push(buildVenue([place], [], empty));
  }
  const leftoverEvents = [...eventRefs].filter(([ref]) => !used.has(ref)).map(([, e]) => e);
  for (const venueName of new Set(leftoverEvents.map((e) => e.venue))) {
    venues.push(buildVenue([], leftoverEvents.filter((e) => e.venue === venueName), empty));
  }

  return { venues, notSalsa };
}

// Puts a venue together. Location, links and schedule are copied from the input rows, never from the LLM.
function buildVenue(places: RawPlace[], events: RawEvent[], llm: Omit<Venue, 'id' | 'placeIds' | 'schedule'>): Venue {
  const first = places[0];
  return {
    id: first ? first.id : `sv-${events[0].id}`,
    name: llm.name || first?.name || events[0].venue,
    hosts: llm.hosts,
    placeIds: places.map((p) => p.id),
    lat: first?.lat,
    lng: first?.lng,
    googleMapsUri: first?.googleMapsUri,
    category: llm.category,
    offers: llm.offers,
    summary: llm.summary,
    schedule: events.map(({ id, venue, ...rest }) => ({ eventId: id, ...rest })),
    evidence: llm.evidence,
  };
}

// ---------- Helpers ----------

// Puts places within NEAR_METERS of each other in the same group ("g1", "g2", ...). Lone places get no group.
function nearGroups(places: RawPlace[]): Map<string, string> {
  const groupOf = new Map<string, string>();
  let next = 1;
  for (const a of places) {
    for (const b of places) {
      if (a === b || meters(a, b) > NEAR_METERS) continue;
      const group = groupOf.get(a.id) ?? groupOf.get(b.id) ?? `g${next++}`;
      const old = groupOf.get(b.id);
      // b's old group (if any) joins this one, so chains of nearby places end up together
      for (const [id, g] of groupOf) if (old && g === old) groupOf.set(id, group);
      groupOf.set(a.id, group);
      groupOf.set(b.id, group);
    }
  }
  return groupOf;
}

// Distance between two points in meters (haversine formula).
function meters(a: RawPlace, b: RawPlace): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// "Café Ritmo & Son!" -> "cafe ritmo & son!" (no accents, lower case), for loose text comparisons.
function norm(text: string): string {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Do two names share a word that isn't generic? ("PM Puro Movimiento" and "PM" share "pm")
function sharesWord(a: string, b: string): boolean {
  const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w));
  const wordsB = new Set(words(b));
  return words(a).some((w) => wordsB.has(w));
}

// All the text the LLM was given for one row, for checking evidence quotes.
function rowText(ref: string, placeRefs: Map<string, RawPlace>, eventRefs: Map<string, RawEvent>): string {
  const p = placeRefs.get(ref);
  if (p) return norm(`${p.name} ${(p.types ?? []).join(' ')}`);
  const e = eventRefs.get(ref)!;
  return norm(`${e.title} ${e.venue} ${e.kind} ${e.time} ${e.price}`);
}

function sourceOf(ref: string, placeRefs: Map<string, RawPlace>, eventRefs: Map<string, RawEvent>): string {
  return placeRefs.get(ref)?.id ?? eventRefs.get(ref)!.url;
}
