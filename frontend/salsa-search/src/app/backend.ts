// Calls to our own backend (backend/, see backend/README.md). It runs on the owner's machine during development.
import { Classification, SocialLinks, Venue } from './venue';

const BACKEND_URL = 'http://localhost:3000';

// POST /classify: the backend's AI guesses what each place is (school, social venue...).
// One request for the whole search result; returns a guess per place ID.
export async function classifyPlaces(venues: Venue[]): Promise<Map<string, Classification>> {
  const places = venues.map((v) => ({
    id: v.id,
    name: v.name,
    types: v.types,
    primaryType: v.primaryType,
    address: v.address,
    eventText: v.events.map((e) => e.title).join('; '), // matched SalsaVida titles, as extra evidence
  }));
  const { results } = await post('/classify', { places });

  const guesses = new Map<string, Classification>();
  for (const r of results) {
    guesses.set(r.id, { category: r.category, offers: r.offers, reason: r.reason });
  }
  return guesses;
}

// Website (from Google, only when a place is clicked) + Instagram/Facebook/Linktree links found on it (POST /socials).
export async function findSocialLinks(venue: Venue): Promise<SocialLinks> {
  // websiteURI is an Enterprise field (pricier), so it's fetched for one clicked place, never in the search.
  const place = new google.maps.places.Place({ id: venue.id });
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
