// Loads real data: salsa places from Google Places, and their weekly schedules from SalsaVida.
// Nothing is saved; results live only in the app's signals until the next search.
import { offersFromSchedule, Place, SalsaEvent, Venue } from './venue';

// ---------- Google Places (New) Text Search ----------

// All of these are "Pro" fields (5,000 free requests a month, then $32 per 1,000).
// Ratings, opening hours or websites would be "Enterprise" (pricier), so we don't ask for them.
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
// Google finds the schools and classes; socials come from SalsaVida (a bar search mostly found bars, not socials).
const QUERIES = ['salsa classes', 'salsa dance school'];

// Salsa places inside the given area. The queries run at the same time; duplicates are dropped.
// Also returns the area's city: the city most of the found places are in (empty if none found).
export async function searchPlaces(area: google.maps.LatLngBounds): Promise<{ places: Place[]; city: string }> {
  const results = await Promise.all(
    QUERIES.map((textQuery) =>
      google.maps.places.Place.searchByText({ textQuery, fields: PLACE_FIELDS, locationRestriction: area, maxResultCount: 20 }),
    ),
  );

  const found = new Map<string, Place>(); // keyed by place ID, so a place found by 2 queries is kept once
  const cityCounts = new Map<string, number>(); // city name -> how many places are in it
  for (const { places } of results) {
    for (const place of places) {
      if (found.has(place.id)) continue;

      const city = place.addressComponents?.find((c) => c.types.includes('locality'))?.longText;
      if (city) {
        cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
      }

      found.set(place.id, {
        id: place.id,
        name: place.displayName ?? '',
        address: place.formattedAddress ?? '',
        lat: place.location!.lat(),
        lng: place.location!.lng(),
        googleMapsUri: place.googleMapsURI ?? '',
        types: place.types ?? [],
        primaryType: place.primaryType ?? '',
      });
    }
  }

  let city = '';
  for (const [name, count] of cityCounts) {
    if (count > (cityCounts.get(city) ?? 0)) city = name;
  }
  return { places: [...found.values()], city };
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
}

// This week's salsa classes and socials in a city. A weekly event appears once per date, so they're
// grouped by event ID into one SalsaEvent with its weekdays.
export async function fetchSalsaVidaEvents(city: string): Promise<SalsaEvent[]> {
  const today = new Date();
  const inSixDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);

  const occurrences: SalsaVidaOccurrence[] = [];
  let cursor: string | undefined; // SalsaVida sends results in pages; cursor asks for the next one
  do {
    const page = await callSalsaVida({
      location: city,
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

// SalsaVida allows browser calls from any site (CORS), so no proxy or backend is needed.
async function callSalsaVida(args: object) {
  const response = await fetch('https://mcp.salsavida.com/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_events', arguments: args } }),
  });
  // The answer is a server-sent event: a line "data: {json}".
  const text = await response.text();
  const data = JSON.parse(text.slice(text.indexOf('data: ') + 6));
  if (data.error || data.result.isError) {
    throw new Error('SalsaVida: ' + JSON.stringify(data.error ?? data.result.content));
  }
  return data.result.structuredContent;
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
    schedule: [],
    evidence: [],
  };
}

// Same place if every word of the shorter name is in the longer one, in any order:
// "Son Havana" matches "Son Havana Bar"; "Rumba y Salsa Salsa School" matches "Salsa school Rumba y Salsa Medellín".
// The shorter name needs 2+ words (or one long word) so a generic "Salsa" doesn't match everything.
function sameName(a: string, b: string) {
  const [short, long] = [words(a), words(b)].sort((x, y) => x.size - y.size);
  const specificEnough = short.size >= 2 || [...short].some((w) => w.length >= 6);
  return specificEnough && [...short].every((w) => long.has(w));
}

// "Café Ritmo & Son!" -> {"cafe", "ritmo", "son"} (accents, case and short words like "y" dropped)
function words(name: string) {
  const plain = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return new Set(plain.split(/[^a-z0-9]+/).filter((w) => w.length > 2));
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
