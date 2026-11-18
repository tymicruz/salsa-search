// Matching helpers for /synthesize: names, addresses, distances and hint groups. Pure functions, no LLM.
import type { RawEvent, RawPlace } from './synthesize.ts';

export const NEAR_METERS = 150;

// Words too common to show two names are the same place.
export const GENERIC_WORDS = new Set(
  ('salsa dance dancing baile bailes bar club academia academy escuela school studio estudio salon the and ' +
    'la el los las de del y en at social socials clases classes class bachata latin latino night disco discoteca salsoteca ' +
    'restaurante restaurant cafe puerto escondido medellin cali').split(' '),
);

export const BUILDING_METERS = 30;

// May two Google places be one venue? Only within NEAR_METERS, and only if they:
// (a) have the same street address, or
// (b) are within BUILDING_METERS, when the addresses can't be compared (one has no street number), or
// (c) share a specific name word.
// Plain neighbors don't qualify: dense areas have different schools 15–150 m apart, at different street numbers.
export function canJoin(a: RawPlace, b: RawPlace): boolean {
  const distance = meters(a, b);
  if (distance > NEAR_METERS) return false;
  if (sharesWord(a.name, b.name)) return true;
  if (hasStreetNumber(a.address) && hasStreetNumber(b.address)) return sameAddress(a.address!, b.address!);
  return distance <= BUILDING_METERS;
}

// Does the address have a street or floor number (1–4 characters with a digit, like "73" or "2do")?
export function hasStreetNumber(address?: string): boolean {
  return !!address && addressWords(address).some((w) => /\d/.test(w) && w.length <= 4);
}

// Address words: no accents, lower case, postal codes (5+ digits) left out.
export function addressWords(address: string): string[] {
  return norm(address).split(/[^a-z0-9]+/).filter((w) => w && !/^\d{5,}$/.test(w));
}

// Same street address? Every word of the shorter address is in the longer one, and the shorter one has a street
// or floor number (1–4 characters with a digit, like "73", "44", "2do"). Postal codes (5+ digits) are ignored,
// so two places that only share a postal code, neighborhood and city never match.
export function sameAddress(a: string, b: string): boolean {
  const [short, long] = [new Set(addressWords(a)), new Set(addressWords(b))].sort((x, y) => x.size - y.size);
  const hasNumber = [...short].some((w) => /\d/.test(w) && w.length <= 4);
  return short.size >= 2 && hasNumber && [...short].every((w) => long.has(w));
}

// Puts linked rows in the same group ("g1", "g2", ... with the given prefix), keyed by ref. Lone rows get no group.
// Rows are [ref, value] pairs; linked() says whether two values belong together.
export function groupRows<T>(rows: [string, T][], linked: (a: [string, T], b: [string, T]) => boolean, prefix: string) {
  const groupOf = new Map<string, string>();
  let next = 1;
  for (const a of rows) {
    for (const b of rows) {
      if (a === b || !linked(a, b)) continue;
      const group = groupOf.get(a[0]) ?? groupOf.get(b[0]) ?? `${prefix}${next++}`;
      const old = groupOf.get(b[0]);
      // b's old group (if any) joins this one, so chains of linked rows end up together
      for (const [ref, g] of groupOf) if (old && g === old) groupOf.set(ref, group);
      groupOf.set(a[0], group);
      groupOf.set(b[0], group);
    }
  }
  return groupOf;
}

// The specific words of a name: no accents, lower case, 2+ letters, generic words removed.
export function specificWords(name: string): string[] {
  return norm(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w));
}

// Words that can link names in a nameGroup. A short word (3 letters or fewer, like "pm") counts only if it's
// rare in this search: in at most 3 different names. Otherwise "pm" or "rd" could chain unrelated places.
export function rareWords(names: string[]): Set<string> {
  const namesWith = new Map<string, Set<string>>(); // word -> the different names it appears in
  for (const name of names) {
    for (const w of specificWords(name)) {
      if (!namesWith.has(w)) namesWith.set(w, new Set());
      namesWith.get(w)!.add(norm(name));
    }
  }
  return new Set([...namesWith].filter(([w, ns]) => w.length > 3 || ns.size <= 3).map(([w]) => w));
}

// Distance between two points in meters (haversine formula).
export function meters(a: RawPlace, b: RawPlace): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// "Café Ritmo & Son!" -> "cafe ritmo & son!" (no accents, lower case), for loose text comparisons.
export function norm(text: string): string {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Same place name? Every word of the shorter name is in the longer one, in any order, accents and case ignored.
// The shorter name needs 2+ words (or one word of 6+ letters) so a lone "Salsa" doesn't match everything.
// This is the frontend's old matcher: "Social Club Academia" = "Social Club Academia", "Son Havana" = "Son Havana Bar".
// Generic words DO count here, unlike sharesWord, because the whole name must match.
export function sameName(a: string, b: string): boolean {
  if (norm(a).trim() !== '' && norm(a).trim() === norm(b).trim()) return true; // identical names always match
  const words = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const [short, long] = [words(a), words(b)].sort((x, y) => x.size - y.size);
  const specificEnough = short.size >= 2 || [...short].some((w) => w.length >= 6);
  return specificEnough && [...short].every((w) => long.has(w));
}

// Could the event be at another branch than this place? Yes when BOTH sides have their own qualifier:
// the event's venue (or a "(...)" in its title) has a specific word the place lacks, AND the place has one the
// event lacks. "Blood Dance Company" + title "(Laureles)" vs place "Blood Dance Company Guayabal": yes.
// "Timbale" vs "Organización Cultural y Social Timbalé": no (only the place has extra words), so it binds.
export function differentBranch(e: RawEvent, placeName: string): boolean {
  const parentheses = (e.title.match(/\(([^)]*)\)/g) ?? []).join(' ');
  const eventWords = new Set(specificWords(`${e.venue} ${parentheses}`));
  const placeWords = new Set(specificWords(placeName));
  const eventExtra = [...eventWords].some((w) => !placeWords.has(w));
  const placeExtra = [...placeWords].some((w) => !eventWords.has(w));
  return eventExtra && placeExtra;
}

// Do two names share a word that isn't generic? ("PM Puro Movimiento" and "PM" share "pm")
export function sharesWord(a: string, b: string): boolean {
  const wordsB = new Set(specificWords(b));
  return specificWords(a).some((w) => wordsB.has(w));
}
