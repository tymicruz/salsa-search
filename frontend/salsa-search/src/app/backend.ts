// Calls to our own backend (backend/, see backend/README.md). It runs on the owner's machine during development.
import { Place, SalsaEvent, SocialLinks, Venue } from './venue';

const BACKEND_URL = 'http://localhost:3000';

// POST /synthesize: the backend's AI merges one search's raw rows into readable venues
// (e.g. 3 Google pins for "PM" + "Flavia's Dance School at PM" on SalsaVida -> one venue).
// Schedules, links and pin locations are copied by the backend's code, never written by the AI.
// Places it judges "not salsa" are simply left out of the answer. Takes ~30–60 s.
export async function synthesizeVenues(area: string, places: Place[], events: SalsaEvent[]): Promise<Venue[]> {
  const body = {
    area,
    places,
    events: events.map(({ eventId, ...rest }) => ({ id: eventId, ...rest })), // the backend calls it "id"
  };
  const { venues } = await post('/synthesize', body);

  // The backend's schedule items have no "venue" field; ours do, so fill it with the venue's name.
  return venues.map((v: Venue) => ({
    ...v,
    hosts: v.hosts ?? [],
    googleMapsUri: v.googleMapsUri ?? '',
    evidence: v.evidence ?? [],
    schedule: v.schedule.map((item) => ({ ...item, venue: v.name })),
  }));
}

// Website (from Google, only when a place is clicked) + Instagram/Facebook/Linktree links found on it (POST /socials).
export async function findSocialLinks(venue: Venue): Promise<SocialLinks> {
  if (!venue.placeIds.length) {
    return { website: '', instagram: [], facebook: [], linktree: [] }; // SalsaVida-only venue: no Google place
  }
  // websiteURI is an Enterprise field (pricier), so it's fetched for one clicked place, never in the search.
  const place = new google.maps.places.Place({ id: venue.placeIds[0] });
  await place.fetchFields({ fields: ['websiteURI'] });
  const website = place.websiteURI ?? '';
  if (!website) {
    return { website, instagram: [], facebook: [], linktree: [] };
  }
  const links = await post('/socials', { url: website });
  return { website, instagram: links.instagram, facebook: links.facebook, linktree: links.linktree };
}

// Sends JSON, returns JSON. The backend answers {"error": "..."} with status 400 or 502 when something fails.
async function post(path: string, body: object) {
  const response = await fetch(BACKEND_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Backend ${path}: ${data.error ?? response.status}`);
  }
  return data;
}
