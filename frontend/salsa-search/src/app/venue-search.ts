// Loads real data: salsa places from Google Places, and their weekly schedules from SalsaVida.
// Nothing is saved; results live only in the app's signals until the next search.
import { offersFromSchedule, Place, SalsaEvent, Venue } from './venue';

// ---------- Google Places (New) Text Search ----------

// These are "Pro" fields (5,000 free requests a month, then $32 per 1,000).
// addressComponents is also Pro; we use it to find which city the area is in.
// formattedAddress (Pro) lets the backend join places at the same street address.
// types and primaryType are cheaper Essentials fields; they help the backend's AI guess the kind of place.
const PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'googleMapsURI',
  'addressComponents',
  'types',
  'primaryType',
];
// The main search also asks for the website, so the backend can check each place for salsa evidence.
// websiteURI is an "Enterprise" field: it bills the whole request as Text Search Enterprise
// (1,000 free requests a month, then $35 per 1,000). The SalsaVida lookups below stay on Pro.
const SEARCH_FIELDS = [...PLACE_FIELDS, 'websiteURI'];
// Google finds the schools and classes; socials come from SalsaVida (a bar search mostly found bars, not socials).
const QUERIES = ['salsa classes', 'salsa dance school'];

// Salsa places inside the given area. The queries run at the same time; duplicates are dropped.
// Also returns the area's country and candidate city names for SalsaVida, from where most of the found places
// are: the most common locality ("Cusco"), then county and state level (a locality can be a district
// SalsaVida doesn't know). Empty if no places were found.
export async function searchPlaces(
  area: google.maps.LatLngBounds,
): Promise<{ places: Place[]; cityNames: string[]; country: string }> {
  const results = await Promise.all(
    QUERIES.map((textQuery) =>
      google.maps.places.Place.searchByText({ textQuery, fields: SEARCH_FIELDS, locationRestriction: area, maxResultCount: 20 }),
    ),
  );

  const found = new Map<string, Place>(); // keyed by place ID, so a place found by 2 queries is kept once
  // name -> how many places have it, for each level of the address
  const localities = new Map<string, number>();
  const counties = new Map<string, number>();
  const states = new Map<string, number>();
  const countryCodes = new Map<string, number>();
  for (const { places } of results) {
    for (const place of places) {
      if (found.has(place.id)) continue;

      const part = (type: string) => place.addressComponents?.find((c) => c.types.includes(type));
      count(localities, part('locality')?.longText);
      count(counties, part('administrative_area_level_2')?.longText);
      count(states, part('administrative_area_level_1')?.longText);
      count(countryCodes, part('country')?.shortText); // "NI"

      found.set(place.id, toPlace(place));
    }
  }

  const cityNames = [mostCommon(localities), mostCommon(counties), mostCommon(states)].filter((n) => n);
  const countryCode = mostCommon(countryCodes);
  // The country code ("NI") doesn't depend on the browser's language; Intl.DisplayNames (built into browsers)
  // turns it into the English name SalsaVida uses ("Nicaragua").
  const country = countryCode ? (new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? '') : '';
  return { places: [...found.values()], cityNames, country };
}

// Adds one to a name's count (skips empty names).
function count(counts: Map<string, number>, name: string | null | undefined) {
  if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
}

// The name with the highest count, or '' if there are none.
function mostCommon(counts: Map<string, number>) {
  let best = '';
  for (const [name, n] of counts) {
    if (n > (counts.get(best) ?? 0)) best = name;
  }
  return best;
}

// Every SalsaVida venue gets one Text Search by SalsaVida's address (it starts with the venue name):
// those the search didn't find at all, and those matched only by name (the name match can be a different
// branch at another address). Each hit is tagged with the event it was looked up for; the backend keeps it
// only if its address or name really matches. Same Pro fields as the main search minus the website:
// one Pro call per SalsaVida venue.
export async function lookUpSalsaVidaVenues(venues: Venue[], places: Place[], area: google.maps.LatLngBounds) {
  const known = new Set(places.map((p) => p.id));
  const fromSalsaVida = venues.filter((v) => v.schedule[0]?.address);

  const hits = await Promise.all(
    fromSalsaVida.map(async (venue) => {
      const event = venue.schedule[0];
      const { places: found } = await google.maps.places.Place.searchByText({
        textQuery: event.address,
        fields: PLACE_FIELDS,
        locationBias: area,
        maxResultCount: 1,
      });
      // Skip places the normal search already has (the backend binds the event to those itself), and places
      // outside the searched area (SalsaVida sometimes files a venue under the wrong city).
      return found
        .filter((p) => !known.has(p.id) && area.contains(p.location!))
        .map((p) => ({ ...toPlace(p), lookupFor: event.eventId }));
    }),
  );
  return hits.flat();
}

// A Google Place result -> our Place shape.
function toPlace(place: google.maps.places.Place): Place {
  return {
    id: place.id,
    name: place.displayName ?? '',
    address: place.formattedAddress ?? '',
    lat: place.location!.lat(),
    lng: place.location!.lng(),
    googleMapsUri: place.googleMapsURI ?? '',
    types: place.types ?? [],
    primaryType: place.primaryType ?? '',
    website: place.websiteURI ?? '', // only the main search asks for it; lookups leave it ''
  };
}

// ---------- SalsaVida (free official MCP endpoint, no key) ----------

// One dated occurrence as SalsaVida returns it (only the fields we use).
interface SalsaVidaOccurrence {
  event_id: number;
  title: string;
  event_types: string[]; // 'social', 'lesson', 'festival'
  venue: string;
  price: string;
  start_time: string;
  end_time: string;
  start_date: string; // "2026-11-17", local to the event
  visit_url: string;
  source_modified_at: string;
  address: string;
}

// This week's salsa classes and socials in a city. A weekly event appears once per date, so they're
// grouped by event ID into one SalsaEvent with its weekdays.
export async function fetchSalsaVidaEvents(cityNames: string[], country: string): Promise<SalsaEvent[]> {
  // Same-named cities are common (Granada in Spain and in Nicaragua), so first find SalsaVida's ID
  // for this city in this country. Try each candidate name in order; use the first SalsaVida knows.
  let location: number | undefined;
  for (const name of cityNames) {
    location = await findSalsaVidaLocation(name, country);
    if (location) {
      console.info(`SalsaVida location: "${name}, ${country}" (candidates: ${cityNames.join(' / ')})`);
      break;
    }
  }
  if (!location) {
    console.info(`SalsaVida knows none of: ${cityNames.join(' / ')} (${country})`);
    return []; // SalsaVida doesn't list this city: show no schedules rather than another country's
  }

  const today = new Date();
  const inSixDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);

  const occurrences: SalsaVidaOccurrence[] = [];
  let cursor: string | undefined; // SalsaVida sends results in pages; cursor asks for the next one
  do {
    const page = await callSalsaVida('search_events', {
      location: String(location),
      date_from: isoDate(today),
      date_to: isoDate(inSixDays),
      dance: 'salsa',
      language: 'en',
      limit: 50,
      cursor,
    });
    occurrences.push(...page.results);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  const events = new Map<number, SalsaEvent[]>(); // event ID -> its class and/or social entry
  for (const o of occurrences) {
    if (!events.has(o.event_id)) {
      events.set(o.event_id, toEvents(o));
    }
    const day = weekday(o.start_date);
    for (const event of events.get(o.event_id)!) {
      if (!event.days.includes(day)) event.days.push(day);
    }
  }
  return [...events.values()].flat();
}

// SalsaVida's ID for "<city>" in "<country>". Each of its locations lists its country among its ancestors.
async function findSalsaVidaLocation(city: string, country: string): Promise<number | undefined> {
  const { results } = await callSalsaVida('search_locations', { query: city, language: 'en' });
  const inCountry = results.filter((r: SalsaVidaLocation) => r.ancestors.some((a) => plain(a.name) === plain(country)));
  // Prefer the exact city name: searching "Cali" also finds "Baja California".
  return (inCountry.find((r: SalsaVidaLocation) => plain(r.name) === plain(city)) ?? inCountry[0])?.id;
}

// One SalsaVida location (only the fields we use).
interface SalsaVidaLocation {
  id: number;
  name: string;
  ancestors: { name: string }[]; // e.g. [{ name: "Nicaragua" }, { name: "South America" }]
}

// Calls one SalsaVida tool ('search_events' or 'search_locations').
// SalsaVida allows browser calls from any site (CORS), so no proxy or backend is needed.
async function callSalsaVida(tool: string, args: object) {
  let response: Response;
  try {
    response = await postToSalsaVida(tool, args);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    // SalsaVida sometimes fails for a moment ("Failed to fetch"). Retry ONCE after 1.5 s, never more:
    // they allow about 120 calls a minute.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await postToSalsaVida(tool, args);
    if (!response.ok) throw new Error(`SalsaVida: HTTP ${response.status}`);
  }
  // The answer is a server-sent event: a line "data: {json}".
  const text = await response.text();
  const data = JSON.parse(text.slice(text.indexOf('data: ') + 6));
  if (data.error || data.result.isError) {
    throw new Error('SalsaVida: ' + JSON.stringify(data.error ?? data.result.content));
  }
  return data.result.structuredContent;
}

function postToSalsaVida(tool: string, args: object) {
  return fetch('https://mcp.salsavida.com/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
  });
}

// One SalsaVida event can be a class and a social at once; we keep one entry per kind. Festivals are skipped.
function toEvents(o: SalsaVidaOccurrence): SalsaEvent[] {
  const kinds: SalsaEvent['kind'][] = [];
  if (o.event_types.includes('lesson')) kinds.push('class');
  if (o.event_types.includes('social')) kinds.push('social');

  const lastEdited = o.source_modified_at.slice(0, 10);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return kinds.map((kind) => ({
    eventId: o.event_id,
    title: o.title,
    venue: o.venue,
    address: o.address ?? '',
    kind,
    days: [],
    time: o.end_time ? `${o.start_time}–${o.end_time}` : o.start_time,
    price: o.price,
    url: o.visit_url,
    lastEdited,
    status: new Date(lastEdited) < sixMonthsAgo ? 'stale' : 'listed',
  }));
}

// ---------- Matching ----------

// Raw results -> venues, without AI (shown right away, and the fallback if the backend is down):
// one venue per Google place, holding the SalsaVida events whose venue name matches it.
// SalsaVida gives no coordinates, so the name is all we can match on. Events that match no place
// become SalsaVida-only venues ("sv-<eventId>"): listed, but without a pin.
export function rawToVenues(places: Place[], events: SalsaEvent[]): Venue[] {
  const venues = places.map((place) => newVenue(place.id, place.name, place));
  for (const event of events) {
    let venue = venues.find((v) => sameName(v.name, event.venue));
    if (!venue) {
      venue = newVenue('sv-' + event.eventId, event.venue);
      venues.push(venue);
    }
    venue.schedule.push(event);
  }
  for (const venue of venues) {
    venue.offers = offersFromSchedule(venue.schedule);
  }
  return venues;
}

// An empty venue; with a Google place it gets the place's pin location and Maps link.
function newVenue(id: string, name: string, place?: Place): Venue {
  return {
    id,
    name,
    hosts: [],
    summary: '',
    category: '',
    offers: [],
    placeIds: place ? [place.id] : [],
    lat: place?.lat,
    lng: place?.lng,
    googleMapsUri: place?.googleMapsUri ?? '',
    website: place?.website ?? '',
    schedule: [],
    evidence: [],
  };
}

// Same place if every word of the shorter name is in the longer one, in any order:
// "Casa Ritmo" matches "Casa Ritmo Bar"; "Ritmo y Sabor School" matches "School Sabor y Ritmo Centro" (invented examples).
// The shorter name needs 2+ words (or one long word) so a generic "Salsa" doesn't match everything.
function sameName(a: string, b: string) {
  const [short, long] = [words(a), words(b)].sort((x, y) => x.size - y.size);
  const specificEnough = short.size >= 2 || [...short].some((w) => w.length >= 6);
  return specificEnough && [...short].every((w) => long.has(w));
}

// "Café Ritmo & Son!" -> {"cafe", "ritmo", "son"} (accents, case and short words like "y" dropped)
function words(name: string) {
  return new Set(plain(name).split(/[^a-z0-9]+/).filter((w) => w.length > 2));
}

// "Bogotá" -> "bogota": accents and capitals removed, so names compare equal however they're written.
function plain(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------- Dates ----------

// Date -> "2026-11-17" in local time (toISOString would use UTC and can be a day off).
function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// "2026-11-17" -> weekday number (0 = Sunday).
function weekday(isoDay: string) {
  const [year, month, day] = isoDay.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}
