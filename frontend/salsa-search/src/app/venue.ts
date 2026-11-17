// Shapes for venue data. Google Places gives the place; SalsaVida gives its weekly schedule.

// One pin on the map: a real place found on Google Maps.
export interface Venue {
  id: string; // Google place ID
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUri: string; // "Open in Google Maps" link
  events: SalsaEvent[]; // from SalsaVida; empty = schedule unknown
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

export type PinType = 'class' | 'social' | 'both' | 'unknown';

// Pin color, letter and legend text for each pin type. Change colors here.
export const PIN_STYLES: Record<PinType, { color: string; letter: string; label: string }> = {
  class: { color: '#1a73e8', letter: 'C', label: 'Classes' },
  social: { color: '#d93025', letter: 'S', label: 'Socials (partner dancing)' },
  both: { color: '#9334e6', letter: 'CS', label: 'Classes and socials' },
  unknown: { color: '#80868b', letter: '?', label: 'Schedule unknown' },
};

// Does the venue have anything on this weekday? (null = no day chosen, so yes.)
export function hasDay(venue: Venue, day: number | null) {
  return day === null || venue.events.some((e) => e.days.includes(day));
}

// Which pin a venue gets, from its SalsaVida events.
export function pinType(venue: Venue): PinType {
  const hasClass = venue.events.some((e) => e.kind === 'class');
  const hasSocial = venue.events.some((e) => e.kind === 'social');
  if (hasClass && hasSocial) return 'both';
  if (hasClass) return 'class';
  if (hasSocial) return 'social';
  return 'unknown';
}
