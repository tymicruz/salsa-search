// POST /synthesize: turns one search's raw rows (Google places + SalsaVida events) into a short list of
// real venues a human can read. The LLM only decides which rows belong together and writes labels and a
// one-line summary. Code checks everything it says and copies schedules, links and locations from the input,
// so those can never be invented.
import { askLLM } from './llm.ts';
import {
  acceptLookups,
  addressesDiffer,
  BUILDING_METERS,
  canJoin,
  groupRows,
  meters,
  nameBindable,
  NEAR_METERS,
  norm,
  rareWords,
  sameAddress,
  sameName,
  sameStreet,
  sharesWord,
  specificWords,
} from './matching.ts';

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
  lookupFor?: number; // set when this place came from a Google lookup for that SalsaVida eventId
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
  address?: string; // SalsaVida's address text: compared by code only, never sent to the LLM
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
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------- Main ----------

export async function synthesize(allPlaces: RawPlace[], events: RawEvent[]) {
  const places = acceptLookups(allPlaces, events); // drop Google lookup hits that don't match their SalsaVida venue

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

  // An event that clearly belongs to one Google place ALWAYS stays with it, whatever the LLM says,
  // so a pin never loses its own schedule. Address first, then name:
  // 1. SalsaVida's address is the same street address as exactly one place (if several, the one with the same name);
  // 2. otherwise the venue name matches exactly one place, without two different qualifiers (see differentBranch).
  const boundPlace = new Map<string, string>(); // event ref -> place ref
  let byAddress = 0;
  let byLookup = 0;
  // Lookup hits: placeId -> the SalsaVida venue name it was looked up (and accepted) for.
  const lookupVenue = new Map<string, string>();
  for (const [, p] of placeRefs) {
    const e = [...eventRefs.values()].find((ev) => ev.id === p.lookupFor);
    if (e) lookupVenue.set(p.id, norm(e.venue));
  }
  for (const [eRef, e] of eventRefs) {
    const atAddress = [...placeRefs].filter(([, p]) => !!e.address && !!p.address && sameStreet(e.address, p.address));
    const sameNamed = atAddress.filter(([, p]) => nameBindable(e, p));
    const addressMatch = atAddress.length === 1 ? atAddress : sameNamed;
    if (addressMatch.length === 1) {
      boundPlace.set(eRef, addressMatch[0][0]);
      byAddress++;
      continue;
    }
    if (atAddress.length > 1) continue; // several places at its address, none with its name: leave it to the LLM
    const matches = [...placeRefs].filter(([, p]) => nameBindable(e, p));
    if (matches.length === 1) {
      boundPlace.set(eRef, matches[0][0]);
      continue;
    }
    // 3. a Google lookup hit that was accepted for this SalsaVida venue (e.g. by its distinctive name)
    const lookedUp = [...placeRefs].filter(([, p]) => lookupVenue.get(p.id) === norm(e.venue));
    if (lookedUp.length === 1) {
      boundPlace.set(eRef, lookedUp[0][0]);
      byLookup++;
    }
  }
  console.log(
    `[synthesize] events bound to a place: ${byAddress} by address, ${boundPlace.size - byAddress - byLookup} by name, ${byLookup} by lookup`,
  );

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
      // Not with a place whose street address proves it's somewhere else (the LLM merges by name only).
      const contradicted = okPlaces.some((q: string) => addressesDiffer(e.address, placeRefs.get(q)!.address));
      if (!matches || contradicted) dropped.events++;
      return ((e === firstEvent && okPlaces.length === 0) || matches) && !contradicted;
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

// One schedule line, copied from a SalsaVida row.
function toScheduleItem({ id, venue, address, ...rest }: RawEvent) {
  return { eventId: id, ...rest };
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
