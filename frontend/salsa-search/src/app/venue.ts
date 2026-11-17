// Shapes for venue data. Google Places gives the place; SalsaVida gives its weekly schedule;
// our backend's AI guess (/classify) fills in what kind of place it is when there's no schedule.

// One pin on the map: a real place found on Google Maps.
export interface Venue {
  id: string; // Google place ID
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUri: string; // "Open in Google Maps" link
  types: string[]; // Google's place types, e.g. ["dance_school", "school"]
  primaryType: string;
  events: SalsaEvent[]; // from SalsaVida; empty = schedule unknown
  guess?: Classification; // AI guess from the backend; missing until it answers
}

// The backend's AI guess for one place (POST /classify).
export interface Classification {
  category: 'salsa_school' | 'social_venue' | 'bar_club_with_salsa' | 'not_salsa' | 'unknown';
  offers: ('classes' | 'socials' | 'music')[];
  reason: string; // one sentence quoting the evidence
}

// A place's social media links (website from Google on click, the rest from POST /socials).
export interface SocialLinks {
  website: string;
  instagram: string[];
  facebook: string[];
  linktree: string[];
}

// One weekly class or social listed on SalsaVida. (Named SalsaEvent because "Event" is already a browser type.)
export interface SalsaEvent {
  id: number; // SalsaVida event ID
  title: string;
  venue: string; // venue name as SalsaVida writes it
  kind: 'class' | 'social';
  days: number[]; // weekdays it happens: 0 = Sunday ... 6 = Saturday, same as Date.getDay()
  time: string; // "18:30–19:30"
  price: string;
  url: string; // the event's SalsaVida page (their terms: always credit and link back)
  lastEdited: string; // when the listing was last changed, "2026-01-10"
  status: 'listed' | 'stale'; // SalsaVida dates are "not organizer confirmed"; stale = not edited for 6+ months
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type PinType = 'class' | 'social' | 'both' | 'music' | 'unknown';

// Pin color, letter and legend text for each pin type. Change colors here.
export const PIN_STYLES: Record<PinType, { color: string; letter: string; label: string }> = {
  class: { color: '#1a73e8', letter: 'C', label: 'Classes' },
  social: { color: '#d93025', letter: 'S', label: 'Socials (partner dancing)' },
  both: { color: '#9334e6', letter: 'CS', label: 'Classes and socials' },
  music: { color: '#e37400', letter: '♪', label: 'Salsa music, no dancing found' },
  unknown: { color: '#80868b', letter: '?', label: 'Unknown' },
};

// Does the venue have anything on this weekday? (null = no day chosen, so yes.)
export function hasDay(venue: Venue, day: number | null) {
  return day === null || venue.events.some((e) => e.days.includes(day));
}

// Which pin a venue gets: from its SalsaVida events, plus the AI guess when it found classes/socials.
// Music only counts when there's no dancing at all (salsa music is not social dancing).
export function pinType(venue: Venue): PinType {
  const offers = venue.guess?.offers ?? [];
  const hasClass = venue.events.some((e) => e.kind === 'class') || offers.includes('classes');
  const hasSocial = venue.events.some((e) => e.kind === 'social') || offers.includes('socials');
  if (hasClass && hasSocial) return 'both';
  if (hasClass) return 'class';
  if (hasSocial) return 'social';
  if (offers.includes('music')) return 'music';
  return 'unknown';
}
