// Calls to our own backend (backend/, see backend/README.md). It runs on the owner's machine during development.
import { EvidenceCheck, Place, SalsaEvent, SocialLinks, Venue } from './venue';

const BACKEND_URL = 'http://localhost:3000';

// POST /synthesize: the backend's AI merges one search's raw rows into readable venues
// (e.g. 3 Google pins for one studio + "Ana's Dance School at <that studio>" on SalsaVida -> one venue; invented).
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
  // The website comes from the venue's first Google place (the backend doesn't return it).
  return venues.map((v: Venue) => ({
    ...v,
    hosts: v.hosts ?? [],
    googleMapsUri: v.googleMapsUri ?? '',
    website: places.find((p) => p.id === v.placeIds[0])?.website ?? '',
    evidence: v.evidence ?? [],
    schedule: v.schedule.map((item) => ({ ...item, venue: v.name })),
  }));
}

// POST /evidence/website: the backend reads each venue's own website (or its SalsaVida page, to find one)
// and says whether it really offers salsa for adults. One request for up to 15 venues; ~20 s.
export async function checkWebsites(venues: Venue[]): Promise<Map<string, EvidenceCheck>> {
  const body = {
    venues: venues.map((v) => ({
      venueKey: v.id,
      websiteUrl: v.website || undefined,
      salsavidaUrls: v.schedule.map((e) => e.url),
    })),
  };
  return byVenue(await post('/evidence/website', body));
}

// POST /evidence/instagram: the same check on Instagram profiles (bio + latest posts). ~10 s.
export async function checkInstagram(profiles: { venueKey: string; instagramUrl: string }[]) {
  return byVenue(await post('/evidence/instagram', { venues: profiles }));
}

// { results: [...] } -> a Map from venue ID to its check.
function byVenue(data: { results: (EvidenceCheck & { venueKey: string })[] }) {
  return new Map(data.results.map(({ venueKey, ...check }) => [venueKey, check]));
}

// Website (from the Google search) + Instagram/Facebook/Linktree links found on it (POST /socials).
export async function findSocialLinks(venue: Venue): Promise<SocialLinks> {
  const website = venue.website;
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
