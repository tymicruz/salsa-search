// Calls to our own backend (backend/, see backend/README.md). It runs on the owner's machine during development.
import { Offer, Place, SocialLinks, Venue } from './venue';

const BACKEND_URL = 'http://localhost:3000';

// POST /classify: the backend's AI guesses what each Google place is (school, social venue...).
// One request for the whole search. Returns the venues with the guesses added:
// AI offers join the schedule's offers; the AI's reason becomes the summary.
// (To be replaced by POST /synthesize, which also merges duplicate venues.)
export async function classifyVenues(venues: Venue[], places: Place[]): Promise<Venue[]> {
  const request = places.map((p) => ({ id: p.id, name: p.name, types: p.types, primaryType: p.primaryType, address: p.address }));
  const { results } = await post('/classify', { places: request });

  return venues.map((venue) => {
    const guess = results.find((r: { id: string }) => r.id === venue.placeIds[0]);
    if (!guess) return venue;
    const offers = [...new Set<Offer>([...venue.offers, ...guess.offers])]; // a Set drops repeats
    return { ...venue, category: guess.category, offers, summary: guess.reason };
  });
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
