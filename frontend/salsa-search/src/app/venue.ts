// Shapes for venue data (simplified from docs/product/map-ux.md).

// One pin on the map: a school, bar, park... with its own weekly nights.
export interface Venue {
  id: string;
  name: string;
  area: string; // neighborhood, e.g. "Laureles"
  lat: number;
  lng: number;
  events: SalsaEvent[];
}

// One weekly class, social or music night. (Named SalsaEvent because "Event" is already a browser type.)
export interface SalsaEvent {
  kind: 'class' | 'social' | 'music'; // music = live band / DJ to listen to, not partner dancing
  day: number; // 0 = Sunday ... 6 = Saturday, same as JavaScript's Date.getDay()
  time: string; // "21:00"
  level: 'everyone' | 'beginner' | 'intermediate' | 'advanced';
  price: string; // as the source says
  source: string; // where the info came from
  confirmed: string; // date it was last confirmed, "2026-11-02"
  status: 'unverified' | 'single_source' | 'confirmed' | 'stale';
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type PinType = 'class' | 'social' | 'both' | 'music';

// Pin color, letter and legend text for each pin type. Change colors here.
export const PIN_STYLES: Record<PinType, { color: string; letter: string; label: string }> = {
  class: { color: '#1a73e8', letter: 'C', label: 'Classes / school' },
  social: { color: '#d93025', letter: 'S', label: 'Socials (partner dancing)' },
  both: { color: '#9334e6', letter: 'CS', label: 'Classes and socials' },
  music: { color: '#80868b', letter: '♪', label: 'Salsa music only, no dancing' },
};

// Which pin a venue gets. Music nights don't count as dancing.
export function pinType(venue: Venue): PinType {
  const hasClass = venue.events.some((e) => e.kind === 'class');
  const hasSocial = venue.events.some((e) => e.kind === 'social');
  if (hasClass && hasSocial) return 'both';
  if (hasClass) return 'class';
  if (hasSocial) return 'social';
  return 'music';
}
