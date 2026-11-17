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
  address?: string; // Google formattedAddress: compared by code only, never sent to the LLM
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
    'la el los las de del y en at social socials clases classes class bachata latin latino night disco discoteca salsoteca ' +
    'restaurante restaurant cafe puerto escondido medellin cali').split(' '),
);

// ---------- Main ----------

export async function synthesize(places: RawPlace[], events: RawEvent[]) {
  // Short refs ("p1", "e1") instead of long IDs keep the prompt small and easy to check.
  const placeRefs = new Map(places.map((p, i) => [`p${i + 1}`, p]));
  const eventRefs = new Map(events.map((e, i) => [`e${i + 1}`, e]));

  // Two hints computed by code (refs -> group id):
  // near = places within NEAR_METERS of each other; nameGroup = rows whose names share a rare, specific word.
  const placeList = [...placeRefs];
  const near = groupRows(placeList, ([, a], [, b]) => canJoin(a, b), 'g');
  const nameRows: [string, string][] = [
    ...placeList.map(([ref, p]): [string, string] => [ref, p.name]),
    ...[...eventRefs].map(([ref, e]): [string, string] => [ref, e.venue]),
  ];
  const rare = rareWords(nameRows.map(([, name]) => name));
  // Two places link only if they're also near each other (a place and an event link by name alone,
  // since SalsaVida events have no coordinates).
  const sharesRareWord = ([refA, a]: [string, string], [refB, b]: [string, string]) => {
    const [pa, pb] = [placeRefs.get(refA), placeRefs.get(refB)];
    if (pa && pb && meters(pa, pb) > NEAR_METERS) return false;
    return specificWords(a).some((w) => rare.has(w) && specificWords(b).includes(w));
  };
  const nameGroup = groupRows(nameRows, sharesRareWord, 'n');

  // What the LLM sees: names, types, the two hints and event text. No coordinates, no addresses.
  const input = {
    places: placeList.map(([ref, p]) => ({ ref, name: p.name, types: p.types, near: near.get(ref), nameGroup: nameGroup.get(ref) })),
    events: [...eventRefs].map(([ref, e]) => ({
      ref,
      title: e.title,
      venue: e.venue,
      nameGroup: nameGroup.get(ref),
      kind: e.kind,
      days: e.days.map((d) => DAY_NAMES[d]),
      time: e.time,
      price: e.price,
    })),
  };

  const prompt = `You merge raw search results into a clean list of salsa venues for a map. Use ONLY the data below.
Never use outside knowledge and never guess.

"places" are Google Maps results. "events" are SalsaVida listings; their "venue" is the place where they happen.
Two hints, computed for you:
- Places with the same "near" value are very close: same street address, within ${BUILDING_METERS} m, or within ${NEAR_METERS} m
  with a shared specific name word. (Plain neighbors on a busy street get no "near" value.)
- Rows with the same "nameGroup" share a rare, specific word in their names (e.g. "PM").
Rows with the same near or nameGroup value are usually the SAME venue: merge them unless the data shows they're
different (e.g. branches of one school in different neighborhoods, named in the names).

Merge rows that are the SAME physical venue: duplicate Google places, and events whose venue names that place.
A school or organizer that runs classes or socials at another venue is a "host" of that venue
(e.g. an event "Flavia's Dance School" at venue "PM" -> host "Flavia's Dance School" at PM).
For rows that share no hint: if unsure, do NOT merge.

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
  const checked = checkAnswer(answer, placeRefs, eventRefs, near);
  const venues = mergeBuildings(checked.venues, places, checked.venueOf);

  // Diagnosis log (counts only): how many hint groups code offered, and how many ended up as one venue.
  const { venueOf } = checked;
  console.log(`[synthesize] hints: near groups ${countMerged(near, venueOf)}, name groups ${countMerged(nameGroup, venueOf)}`);
  return { venues, notSalsa: checked.notSalsa };
}

// ---------- Same building (decided by code, not the LLM) ----------

const BUILDING_METERS = 30;

// Two venues whose places are at most 30 m apart AND at the same street address are one venue: e.g. a school
// that teaches upstairs in a dance bar. Both must have salsa evidence, so two unrelated shops in one mall
// don't get joined. Every building merge is logged for review.
function mergeBuildings(venues: Venue[], places: RawPlace[], venueOf: Map<string, number>): Venue[] {
  const gone = new Set<number>(); // indexes of venues merged into another one
  const indexOf = (placeId: string) => venues.findIndex((v, i) => !gone.has(i) && v.placeIds.includes(placeId));
  // Salsa evidence: the LLM gave it a category or offer, it has SalsaVida events, or Google calls it a dance school.
  const hasEvidence = (v: Venue, p: RawPlace) =>
    v.category !== 'unknown' || v.offers.length > 0 || v.schedule.length > 0 || !!p.types?.includes('dance_school');

  for (const a of places) {
    for (const b of places) {
      if (a === b || !a.address || !b.address) continue;
      const [ia, ib] = [indexOf(a.id), indexOf(b.id)];
      if (ia === -1 || ib === -1 || ia === ib) continue; // notSalsa, or already one venue
      const distance = meters(a, b);
      if (distance > BUILDING_METERS || !sameAddress(a.address, b.address)) continue;
      if (!hasEvidence(venues[ia], a) || !hasEvidence(venues[ib], b)) continue;

      // The venue with SalsaVida events (or else the more specific name) keeps its name; the other becomes a host.
      const aFirst =
        venues[ia].schedule.length !== venues[ib].schedule.length
          ? venues[ia].schedule.length > venues[ib].schedule.length
          : specificWords(venues[ia].name).length >= specificWords(venues[ib].name).length;
      const [keep, drop] = aFirst ? [ia, ib] : [ib, ia];
      console.log(
        `[synthesize] building merge: "${venues[drop].name}" into "${venues[keep].name}" ` +
          `(places "${a.name}" + "${b.name}", ${Math.round(distance)} m, same address)`,
      );
      joinVenues(venues[keep], venues[drop]);
      gone.add(drop);
      for (const [ref, i] of venueOf) if (i === drop) venueOf.set(ref, keep);
    }
  }
  return venues.filter((_, i) => !gone.has(i));
}

// Moves everything from `other` into `main`. main keeps its name, pin and summary.
function joinVenues(main: Venue, other: Venue) {
  main.placeIds.push(...other.placeIds);
  main.schedule.push(...other.schedule);
  for (const host of [other.name, ...other.hosts]) {
    if (!sameName(host, main.name) && !main.hosts.includes(host)) main.hosts.push(host);
  }
  main.offers = [...new Set([...main.offers, ...other.offers])];
  if (main.category === 'unknown') main.category = other.category;
  main.summary ||= other.summary;
  main.evidence = [...main.evidence, ...other.evidence].slice(0, 3);
}

// May two Google places be one venue? Only within NEAR_METERS, and only if they:
// (a) have the same street address, or
// (b) are within BUILDING_METERS, when the addresses can't be compared (one has no street number), or
// (c) share a specific name word.
// Plain neighbors don't qualify: dense areas have different schools 15–150 m apart, at different street numbers.
function canJoin(a: RawPlace, b: RawPlace): boolean {
  const distance = meters(a, b);
  if (distance > NEAR_METERS) return false;
  if (sharesWord(a.name, b.name)) return true;
  if (hasStreetNumber(a.address) && hasStreetNumber(b.address)) return sameAddress(a.address!, b.address!);
  return distance <= BUILDING_METERS;
}

// Does the address have a street or floor number (1–4 characters with a digit, like "73" or "2do")?
function hasStreetNumber(address?: string): boolean {
  return !!address && addressWords(address).some((w) => /\d/.test(w) && w.length <= 4);
}

// Address words: no accents, lower case, postal codes (5+ digits) left out.
function addressWords(address: string): string[] {
  return norm(address).split(/[^a-z0-9]+/).filter((w) => w && !/^\d{5,}$/.test(w));
}

// Same street address? Every word of the shorter address is in the longer one, and the shorter one has a street
// or floor number (1–4 characters with a digit, like "73", "44", "2do"). Postal codes (5+ digits) are ignored,
// so two places that only share a postal code, neighborhood and city never match.
function sameAddress(a: string, b: string): boolean {
  const [short, long] = [new Set(addressWords(a)), new Set(addressWords(b))].sort((x, y) => x.size - y.size);
  const hasNumber = [...short].some((w) => /\d/.test(w) && w.length <= 4);
  return short.size >= 2 && hasNumber && [...short].every((w) => long.has(w));
}

// "3 offered, 2 merged": a group counts as merged when all its rows (not dropped as notSalsa) are in one venue.
function countMerged(groups: Map<string, string>, venueOf: Map<string, number>): string {
  const venuesPerGroup = new Map<string, Set<number>>();
  for (const [ref, group] of groups) {
    if (!venueOf.has(ref)) continue; // notSalsa
    if (!venuesPerGroup.has(group)) venuesPerGroup.set(group, new Set());
    venuesPerGroup.get(group)!.add(venueOf.get(ref)!);
  }
  const merged = [...venuesPerGroup.values()].filter((v) => v.size === 1).length;
  return `${new Set(groups.values()).size} offered, ${merged} merged`;
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
  const venueOf = new Map<string, number>(); // ref -> index of the venue it ended up in (for the hints log)
  const dropped = { badRefs: 0, places: 0, events: 0, reattached: 0, quotes: [] as string[] }; // for the log

  // An event whose venue name matches a Google place's name (same rule the frontend used before the AI)
  // ALWAYS stays with that place, whatever the LLM says. So a pin never loses its own schedule.
  // Only when it's unambiguous: exactly one place matches, and the names differ by generic words at most.
  // "Son Havana" = "Son Havana Bar" binds; "Blood Dance Company" vs "Blood Dance Company Guayabal" doesn't
  // (the extra "Guayabal" may mean another branch), so the LLM and the normal checks decide that one.
  const boundPlace = new Map<string, string>(); // event ref -> place ref
  for (const [eRef, e] of eventRefs) {
    const matches = [...placeRefs].filter(([, p]) => sameName(e.venue, p.name) && onlyGenericExtras(e.venue, p.name));
    if (matches.length === 1) boundPlace.set(eRef, matches[0][0]);
  }

  for (const v of answer.venues ?? []) {
    // Keep only real, not-yet-used refs.
    const refs = [...(v.places ?? []), ...(v.events ?? [])];
    const myPlaces = (v.places ?? []).filter((r: string) => placeRefs.has(r) && !used.has(r));
    const myEvents = (v.events ?? []).filter((r: string) => eventRefs.has(r) && !used.has(r));
    dropped.badRefs += refs.length - myPlaces.length - myEvents.length;

    // A place may join only if canJoin() allows it with a place already in this venue. Anything else is split
    // back out, whatever the LLM proposed.
    const okPlaces: string[] = [];
    for (const r of myPlaces) {
      const p = placeRefs.get(r)!;
      if (okPlaces.length === 0 || okPlaces.some((q) => canJoin(p, placeRefs.get(q)!))) okPlaces.push(r);
    }
    // An event bound to a place joins only the venue holding that place (it's re-attached below otherwise).
    // Any other event may join only if its venue/title matches the venue name, one of its places,
    // or the first event's venue (for SalsaVida-only venues).
    const firstEvent = eventRefs.get(myEvents[0]);
    const names = [String(v.name ?? ''), firstEvent?.venue ?? '', ...okPlaces.map((r: string) => placeRefs.get(r)!.name)];
    const okEvents = myEvents.filter((r: string) => {
      const bound = boundPlace.get(r);
      if (bound) {
        if (!okPlaces.includes(bound)) dropped.reattached++;
        return okPlaces.includes(bound);
      }
      const e = eventRefs.get(r)!;
      const matches = names.some((n) => sameName(e.venue, n) || sharesWord(`${e.venue} ${e.title}`, n));
      if (!matches) dropped.events++;
      return (e === firstEvent && okPlaces.length === 0) || matches;
    });
    dropped.places += myPlaces.length - okPlaces.length; // these come back below as their own venue
    if (okPlaces.length === 0 && okEvents.length === 0) continue;
    for (const r of [...okPlaces, ...okEvents]) {
      used.add(r);
      venueOf.set(r, venues.length); // the venue pushed below
    }

    // Evidence quotes must appear word for word in the row they cite.
    const evidence = (v.evidence ?? [])
      .filter((ev: any) => {
        const ok = [...okPlaces, ...okEvents].includes(ev?.ref) && rowText(ev.ref, placeRefs, eventRefs).includes(norm(ev.quote));
        if (!ok) dropped.quotes.push(String(ev?.quote));
        return ok;
      })
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
    if (used.has(ref)) continue;
    venueOf.set(ref, venues.length);
    venues.push(buildVenue([place], [], empty));
  }

  // Bound events the LLM put elsewhere (or forgot) go to the venue holding their place.
  // (If that place was marked notSalsa, there's no such venue and the event falls through to the leftovers.)
  for (const [eRef, pRef] of boundPlace) {
    const index = venues.findIndex((v) => v.placeIds.includes(placeRefs.get(pRef)!.id));
    if (used.has(eRef) || index === -1) continue;
    venues[index].schedule.push(toScheduleItem(eventRefs.get(eRef)!));
    used.add(eRef);
    venueOf.set(eRef, index);
  }

  // Leftover events: one SalsaVida-only venue per venue name.
  const leftoverEvents = [...eventRefs].filter(([ref]) => !used.has(ref));
  for (const venueName of new Set(leftoverEvents.map(([, e]) => e.venue))) {
    const rows = leftoverEvents.filter(([, e]) => e.venue === venueName);
    rows.forEach(([ref]) => venueOf.set(ref, venues.length));
    venues.push(buildVenue([], rows.map(([, e]) => e), empty));
  }

  console.log(
    `[synthesize] checks dropped: ${dropped.badRefs} unknown/duplicate refs, ${dropped.places} places and ` +
      `${dropped.events} events from merges they didn't fit, ${dropped.reattached} events moved back to the ` +
      `place with their exact venue name, ${dropped.quotes.length} quotes not word for word` +
      (dropped.quotes.length ? ` (${dropped.quotes.map((q) => JSON.stringify(q)).join(', ')})` : ''),
  );
  return { venues, notSalsa, venueOf };
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
    schedule: events.map(toScheduleItem),
    evidence: llm.evidence,
  };
}

// ---------- Helpers ----------

// Puts linked rows in the same group ("g1", "g2", ... with the given prefix), keyed by ref. Lone rows get no group.
// Rows are [ref, value] pairs; linked() says whether two values belong together.
function groupRows<T>(rows: [string, T][], linked: (a: [string, T], b: [string, T]) => boolean, prefix: string) {
  const groupOf = new Map<string, string>();
  let next = 1;
  for (const a of rows) {
    for (const b of rows) {
      if (a === b || !linked(a, b)) continue;
      const group = groupOf.get(a[0]) ?? groupOf.get(b[0]) ?? `${prefix}${next++}`;
      const old = groupOf.get(b[0]);
      // b's old group (if any) joins this one, so chains of linked rows end up together
      for (const [ref, g] of groupOf) if (old && g === old) groupOf.set(ref, group);
      groupOf.set(a[0], group);
      groupOf.set(b[0], group);
    }
  }
  return groupOf;
}

// The specific words of a name: no accents, lower case, 2+ letters, generic words removed.
function specificWords(name: string): string[] {
  return norm(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w));
}

// Words that can link names in a nameGroup. A short word (3 letters or fewer, like "pm") counts only if it's
// rare in this search: in at most 3 different names. Otherwise "pm" or "rd" could chain unrelated places.
function rareWords(names: string[]): Set<string> {
  const namesWith = new Map<string, Set<string>>(); // word -> the different names it appears in
  for (const name of names) {
    for (const w of specificWords(name)) {
      if (!namesWith.has(w)) namesWith.set(w, new Set());
      namesWith.get(w)!.add(norm(name));
    }
  }
  return new Set([...namesWith].filter(([w, ns]) => w.length > 3 || ns.size <= 3).map(([w]) => w));
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

// One schedule line, copied from a SalsaVida row.
function toScheduleItem({ id, venue, ...rest }: RawEvent) {
  return { eventId: id, ...rest };
}

// Same place name? Every word of the shorter name is in the longer one, in any order, accents and case ignored.
// The shorter name needs 2+ words (or one word of 6+ letters) so a lone "Salsa" doesn't match everything.
// This is the frontend's old matcher: "Social Club Academia" = "Social Club Academia", "Son Havana" = "Son Havana Bar".
// Generic words DO count here, unlike sharesWord, because the whole name must match.
function sameName(a: string, b: string): boolean {
  if (norm(a).trim() !== '' && norm(a).trim() === norm(b).trim()) return true; // identical names always match
  const words = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const [short, long] = [words(a), words(b)].sort((x, y) => x.size - y.size);
  const specificEnough = short.size >= 2 || [...short].some((w) => w.length >= 6);
  return specificEnough && [...short].every((w) => long.has(w));
}

// Do the two names differ only by generic words? ("Son Havana" vs "Son Havana Bar": yes. "... Guayabal": no.)
function onlyGenericExtras(a: string, b: string): boolean {
  const [wa, wb] = [new Set(specificWords(a)), new Set(specificWords(b))];
  return [...wa].every((w) => wb.has(w)) && [...wb].every((w) => wa.has(w));
}

// Do two names share a word that isn't generic? ("PM Puro Movimiento" and "PM" share "pm")
function sharesWord(a: string, b: string): boolean {
  const wordsB = new Set(specificWords(b));
  return specificWords(a).some((w) => wordsB.has(w));
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
