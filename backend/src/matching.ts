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
// This is the frontend's old matcher: "Club Salsa Uno" = "Club Salsa Uno", "Casa Ritmo" = "Casa Ritmo Bar".
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
// event lacks. "Escuela Ritmo" + title "(Norte)" vs place "Escuela Ritmo Sur": yes.
// "Sabor" vs "Centro Cultural Sabor": no (only the place has extra words), so it binds.
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

// ---------- SalsaVida address vs Google address ----------

// Street-type words and their abbreviations, as written in Spanish addresses, mapped to one spelling.
const STREET_TYPES: Record<string, string> = {
  c: 'calle', cl: 'calle', cll: 'calle', calle: 'calle',
  cra: 'carrera', kr: 'carrera', kra: 'carrera', cr: 'carrera', carrera: 'carrera',
  av: 'avenida', avda: 'avenida', avenida: 'avenida',
  dg: 'diagonal', diag: 'diagonal', diagonal: 'diagonal',
  tv: 'transversal', transv: 'transversal', transversal: 'transversal',
  jr: 'jiron', jiron: 'jiron', pje: 'pasaje', pasaje: 'pasaje',
};

// Unit words: the word after them is a shop or flat number, not part of the street address ("local 2", "apto 301").
const UNIT_WORDS = new Set(['local', 'loc', 'apto', 'apartamento', 'oficina', 'of', 'interior', 'int', 'torre', 'bloque', 'consultorio']);

// Reads the street part of an address: its type ("calle"), name words ("morazan") and numbers ("205").
function readStreet(text: string) {
  const words: string[] = [];
  const raw = addressWords(text);
  for (let i = 0; i < raw.length; i++) {
    if (UNIT_WORDS.has(raw[i])) i++; // skip "local 2"
    else if (raw[i + 1] === 'piso' || raw[i] === 'piso') continue; // skip "2do piso" (a floor, not the street)
    else {
      const w = raw[i].replace(/^(\d+)(ra|ro|da|do|er|ta|to|va|vo|na|no|mo|ma|st|nd|rd|th)$/, '$1'); // "5ta" -> "5"
      words.push(...(/\d/.test(w) ? w.match(/\d+[a-z]?/g)! : [w])); // a joined plate "21b18" -> "21b", "18"
    }
  }
  const typeAt = words.findIndex((w) => STREET_TYPES[w]);
  const after = typeAt === -1 ? words : words.slice(typeAt + 1);
  const firstNumber = after.findIndex((w) => /\d/.test(w));
  return {
    type: typeAt === -1 ? '' : STREET_TYPES[words[typeAt]],
    allTypes: new Set(words.filter((w) => STREET_TYPES[w]).map((w) => STREET_TYPES[w])), // corners name 2 streets
    name: typeAt === -1 ? [] : after.slice(0, firstNumber === -1 ? after.length : firstNumber).filter((w) => w.length >= 3),
    numbers: after.filter((w) => /\d/.test(w) && w.length <= 4),
  };
}

// Google's street part: its comma-separated pieces up to the first one with a street number, at most 2
// ("Cra. 12 #34-56, Barrio, …" -> "Cra. 12 #34-56"; "C. Gran Paseo, 24, Centro, …" -> both first pieces).
function googleStreetPart(address: string): string {
  const pieces = address.split(',').slice(0, 2);
  return hasStreetNumber(pieces[0]) ? pieces[0] : pieces.join(' ');
}

// Is a SalsaVida address ("Hostal Ejemplo Calle Mayor 205 Pueblo País") the same street address as a
// Google one ("C. Mayor 205, Pueblo, País")? All numbers of Google's street part must be in the
// SalsaVida address, and the street type and name must agree when both have them.
// So "Carrera 12 #34-56" = "Cra. 12 #34-56", but "Calle 10 #20-30" ≠ "Carrera 10 #20-30".
export function sameStreet(salsavidaAddress: string, googleAddress: string): boolean {
  const g = readStreet(googleStreetPart(googleAddress));
  const s = readStreet(salsavidaAddress);
  if (g.numbers.length === 0 || !g.numbers.every((n) => s.numbers.includes(n))) return false;
  // "Cra. 47" alone is a whole street, not a building: a type and its own number, with no house number.
  if (g.type && g.name.length === 0 && g.numbers.length < 2) return false;
  // A corner ("Calle 52 Cra. 31 Esquina" = "Cra. 31 #52") names 2 street types and 2 numbers. Only for addresses
  // without a full plate number (3+ numbers like "Cra. 12 #34-56"), so normal addresses aren't loosened.
  const corner = g.numbers.length <= 2 && s.numbers.length <= 2;
  if (g.type && s.type && !(corner ? s.allTypes.has(g.type) : g.type === s.type)) return false;
  if (g.name.length && s.name.length && !g.name.some((w) => s.name.includes(w))) return false;
  return true;
}

// Do the addresses prove they're different places? Both have a street number and they don't match.
// Address evidence beats a name match: "Escuela Ritmo" at Carrera 70 #28-31 isn't its other branch at Calle 19 #44-08.
// Proof means: NONE of the numbers in Google's street part appears in SalsaVida's address. Anything less is
// "no proof" and the name decides, e.g. the same corner written from the other street ("Cra. 47 #9 Sur-122" vs
// "Cl. 9 Sur #47-2"), an odd format with an extra number, or the same street with another plate number.
export function addressesDiffer(salsavidaAddress?: string, googleAddress?: string): boolean {
  if (!hasStreetNumber(salsavidaAddress) || !hasStreetNumber(googleAddress)) return false;
  const g = readStreet(googleStreetPart(googleAddress!));
  const s = readStreet(salsavidaAddress!);
  return g.numbers.length > 0 && !g.numbers.some((n) => s.numbers.includes(n));
}

// May an event be put on this place because of its NAME? Same name, not another branch, and the addresses
// don't prove they're different places. Used for code binding and for accepting lookups.
export function nameBindable(e: RawEvent, p: RawPlace): boolean {
  return sameName(e.venue, p.name) && !differentBranch(e, p.name) && !addressesDiffer(e.address, p.address);
}

// Google lookups the frontend ran for SalsaVida-only venues ("<venue> <address>"), tagged lookupFor = eventId.
// Keep a hit only if it's at that event's street address, or has the event's venue name (no other-branch
// qualifier). Others are dropped before anything else sees them: no pin, no hint, nothing sent to the LLM.
// A hit that's already in the normal results is kept once.
//
// Fallback when SalsaVida's address has NO street number ("Av. Ejemplo (exact number unverified)"): keep the hit
// if its name shares a distinctive word with the venue name (not generic, 5+ letters, in at most 2 different names
// in this search) and it's the only hit that qualifies for that event. The frontend only sends hits inside the area.
export function acceptLookups(places: RawPlace[], events: RawEvent[]): RawPlace[] {
  const normalIds = new Set(places.filter((p) => p.lookupFor === undefined).map((p) => p.id));
  const hits = places.filter((p) => p.lookupFor !== undefined);
  const allNames = [...places.map((p) => p.name), ...events.map((e) => e.venue)];
  const kept = places.filter((p) => p.lookupFor === undefined);
  const counts = { address: 0, name: 0, distinctive: 0 };

  const distinctiveHits = new Map<number, RawPlace[]>(); // eventId -> hits that only qualify by a distinctive word
  for (const p of hits) {
    const e = events.find((ev) => ev.id === p.lookupFor);
    if (!e || normalIds.has(p.id) || kept.some((k) => k.id === p.id)) continue; // unknown event or duplicate
    if (e.address && p.address && sameStreet(e.address, p.address)) {
      kept.push(p);
      counts.address++;
    } else if (nameBindable(e, p)) {
      kept.push(p);
      counts.name++;
    } else if (!hasStreetNumber(e.address) && distinctiveWord(`${e.venue} ${e.address?.split(',')[0] ?? ''}`, p.name, allNames)) {
      // The rare word can be in the venue's name or in the address part before the first comma, which often names
      // the building it's in ("Club X Hotel Ejemplo, Av. Central" -> a hit called "Hotel Ejemplo"). The street
      // after the comma never counts, so "Bar Central" isn't kept for "Av. Central".
      distinctiveHits.set(e.id, [...(distinctiveHits.get(e.id) ?? []), p]);
    }
  }
  for (const candidates of distinctiveHits.values()) {
    if (candidates.length === 1) {
      kept.push(candidates[0]);
      counts.distinctive++;
    }
  }

  const keptHits = counts.address + counts.name + counts.distinctive;
  if (hits.length) {
    console.log(
      `[synthesize] lookups: ${hits.length} sent, ${keptHits} kept (${counts.address} by address, ${counts.name} by name, ` +
        `${counts.distinctive} by distinctive name), ${hits.length - keptHits} dropped`,
    );
  }
  return kept;
}

// A word both names share that's distinctive: not generic, 5+ letters, and in at most 2 different names
// in the whole search ("danzbloom" yes; "latino" or a word in many names no).
function distinctiveWord(a: string, b: string, allNames: string[]): boolean {
  const wordsB = specificWords(b);
  return specificWords(a).some(
    (w) => w.length >= 5 && wordsB.includes(w) && new Set(allNames.filter((n) => specificWords(n).includes(w)).map(norm)).size <= 2,
  );
}
