// Shapes for venue data.
// A search gives raw Google places + SalsaVida events. They become Venues in two ways:
//   - rawToVenues() in venue-search.ts: one venue per Google place (+ SalsaVida-only venues), shown right away;
//   - the backend's POST /synthesize (AI): merges duplicates into fewer, readable venues, swapped in when it answers.
// Both produce this same Venue shape, so the map and the list don't care which one they got.

// A place found by Google Places Text Search (raw, before merging).
export interface Place {
  id: string; // Google place ID
  name: string;
  address: string; // Google's formattedAddress; the backend compares it to join places at the same address (never sent to the AI)
  lat: number;
  lng: number;
  googleMapsUri: string;
  types: string[]; // Google's place types, e.g. ["dance_school", "school"]
  primaryType: string;
  website: string; // Google's websiteURI ('' if none); used to check the place for salsa evidence
  lookupFor?: number; // set when found by looking up a SalsaVida venue: that event's ID (the backend checks the match)
}

// One weekly class or social listed on SalsaVida. (Named SalsaEvent because "Event" is already a browser type.)
export interface SalsaEvent {
  eventId: number; // SalsaVida event ID
  title: string;
  venue: string; // venue name as SalsaVida writes it
  address: string; // as SalsaVida writes it, e.g. "Casa Ritmo Carrera 10 #20-30 Medellín 050010 Colombia" (invented)
  kind: 'class' | 'social';
  days: number[]; // weekdays it happens: 0 = Sunday ... 6 = Saturday, same as Date.getDay()
  time: string; // "18:30–19:30"
  price: string;
  url: string; // the event's SalsaVida page (their terms: always credit and link back)
  lastEdited: string; // when the listing was last changed, "2026-01-10"
  status: 'listed' | 'stale'; // SalsaVida dates are "not organizer confirmed"; stale = not edited for 6+ months
}

export type Offer = 'classes' | 'socials' | 'music';

// One venue on the map / in the list.
export interface Venue {
  id: string; // first Google place ID, or "sv-<eventId>" for a venue only SalsaVida knows
  name: string;
  hosts: string[]; // who runs things here, e.g. ["Ana's Dance School"] (invented)
  summary: string; // one AI-written sentence; empty when no AI answered
  category: string; // AI category ("salsa_school", "not_salsa"...); empty when no AI answered
  offers: Offer[]; // from the schedule, or the AI's guess
  placeIds: string[]; // the Google places merged into this venue
  lat?: number; // missing = SalsaVida-only venue: listed, but no pin
  lng?: number;
  googleMapsUri: string;
  website: string; // the first Google place's website ('' if none)
  primaryType: string; // the first Google place's main type, e.g. "dance_school" ('' if none)
  schedule: SalsaEvent[]; // copied from SalsaVida, never written by the AI
  evidence: { quote: string; source: string }[]; // short quotes the AI based its answer on
  check?: EvidenceCheck; // the backend's check of its website / Instagram; missing = not checked yet
  doubted?: boolean; // the AI said "not salsa": shown only if its own website / Instagram proves salsa
}

// The backend's answer to "does this venue really offer salsa?" (POST /evidence/website and /evidence/instagram).
export interface EvidenceCheck {
  verdict: 'evidence' | 'no_evidence' | 'needs_instagram' | 'not_checked'; // no_evidence = hide the venue
  reason: string; // short human line, e.g. "salsa found on website"
  facts: EvidenceFact[];
  website?: { url: string; pagesRead: string[] };
  instagram?: { url: string; bio?: string; lastPostDate?: string };
}

// One salsa fact found on the venue's own website or Instagram. The quote is word for word from sourceUrl.
export interface EvidenceFact {
  kind: 'class' | 'social' | 'live_music' | 'mention';
  dance: string; // "salsa", "bachata"...
  audience: 'adults' | 'kids' | 'unclear';
  day?: string;
  time?: string;
  price?: string;
  quote: string;
  sourceUrl: string;
}

// A place's social media links (website from Google on click, the rest from POST /socials).
export interface SocialLinks {
  website: string;
  instagram: string[];
  facebook: string[];
  linktree: string[];
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type PinType = 'class' | 'social' | 'both' | 'music' | 'unknown';

// Pin color, letter and legend text for each pin type. Change colors here.
export const PIN_STYLES: Record<PinType, { color: string; letter: string; label: string }> = {
  class: { color: '#1a73e8', letter: 'C', label: 'Classes' },
  social: { color: '#d93025', letter: 'S', label: 'Socials (partner dancing)' },
  both: { color: '#9334e6', letter: 'CS', label: 'Classes and socials' },
  music: { color: '#e37400', letter: '♪', label: 'Salsa music, no dancing found' },
  unknown: { color: '#80868b', letter: '?', label: 'Details unknown' },
};

// Where a venue shows up:
//   shown       -> it has a schedule or a color, or its own website / Instagram proved salsa
//   unconfirmed -> grey and never disproved, but a dance school (Google or the AI says so): only with the toggle
//   hidden      -> its own website / Instagram showed no salsa (or only kids' salsa), the AI doubted it with no
//                  proof, or it's grey and not a school (restaurants, bars, hostels...)
export function visibility(venue: Venue): 'shown' | 'unconfirmed' | 'hidden' {
  const verdict = venue.check?.verdict;
  if (verdict === 'no_evidence') return 'hidden';
  if (verdict === 'evidence') return 'shown';
  if (venue.doubted) return 'hidden';
  if (pinType(venue) !== 'unknown') return 'shown';
  const school =
    ['salsa_school', 'social_venue'].includes(venue.category) || ['dance_school', 'sports_school'].includes(venue.primaryType);
  return school ? 'unconfirmed' : 'hidden';
}

// Does the venue have anything on this weekday? (null = no day chosen, so yes.)
export function hasDay(venue: Venue, day: number | null) {
  return day === null || venue.schedule.some((e) => e.days.includes(day));
}

// Which pin a venue gets. Music only counts when there's no dancing (salsa music is not social dancing).
export function pinType(venue: Venue): PinType {
  const hasClass = venue.offers.includes('classes');
  const hasSocial = venue.offers.includes('socials');
  if (hasClass && hasSocial) return 'both';
  if (hasClass) return 'class';
  if (hasSocial) return 'social';
  if (venue.offers.includes('music')) return 'music';
  return 'unknown';
}

// Offers shown by a venue's own website / Instagram: salsa facts that aren't for kids only.
export function offersFromFacts(facts: EvidenceFact[]): Offer[] {
  const offers: Offer[] = [];
  for (const fact of facts) {
    if (fact.dance !== 'salsa' || fact.audience === 'kids') continue;
    if (fact.kind === 'class') offers.push('classes');
    if (fact.kind === 'social') offers.push('socials');
    if (fact.kind === 'live_music') offers.push('music');
  }
  return offers;
}

// Offers that come straight from a SalsaVida schedule.
export function offersFromSchedule(schedule: SalsaEvent[]): Offer[] {
  const offers: Offer[] = [];
  if (schedule.some((e) => e.kind === 'class')) offers.push('classes');
  if (schedule.some((e) => e.kind === 'social')) offers.push('socials');
  return offers;
}
