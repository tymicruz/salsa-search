// Regression suite for sameStreet(): SalsaVida-style vs Google-style address pairs.
// All addresses are MADE UP (no Google content in the repo). Each pair copies the format of a real case we hit
// (ordinals, "local 2", corners, the number after a comma, postal-code-only, ...). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptLookups, addressesDiffer, nameBindable, sameStreet } from '../src/matching.ts';
import type { RawEvent, RawPlace } from '../src/synthesize.ts';

// [SalsaVida-style address, Google-style address, same place?]
const pairs: [string, string, boolean][] = [
  // Must match
  ['Casa Ejemplo Carrera 12 #3A‑45 Ciudad', 'Cra. 12 #3A-45, Ciudad, Región, País', true], // Carrera = Cra., unicode hyphen
  ['Bar Prueba Calle 7 # 21B-18 Barrio Centro, Ciudad', 'Calle 7 #21b18, Cl. 7 #21b-18, Barrio Centro, Ciudad', true], // "# 21B-18" vs "#21b18"
  ['Hostal Demo Calle 33A #50A‑12 Ciudad', 'Cl 33A #50A-12, Barrio Norte, Ciudad, Región, País', true],
  ['Salsa Uno Calle 2 # 14 - 60 Ciudad', 'Cl. 2 #14-60, Barrio Sur, Ciudad, Región, País', true], // spaces around "-"
  ['Club Dos Av. 6 Nte. #18-22 Ciudad', 'Av. 6 Nte. #18-22, Barrio Este, Ciudad, Región, País', true],
  ['Academia Tres Calle 8va #27-90 Ciudad', 'Cl. 8 #27 - 90, Ciudad, Región, País', true], // ordinal "8va"
  ['Bar Cuatro Calle 61 #40-15 Ciudad', 'Cl. 61 #40-15 local 3, Ciudad, Región, País', true], // "local 3" on Google's side
  ['Salón Cinco Calle 52 Cra. 31 Esquina Ciudad', 'Cra. 31 #52, Centro, Ciudad, Región', true], // corner
  ['Hostal Seis Calle Ejemplo 118 Pueblo País', 'C. Ejemplo 118, Pueblo, País', true], // Calle = C.
  ['Escuela Siete C. Gran Paseo, 24 10101 Pueblo País', 'C. Gran Paseo, 24, Centro, 10101 Pueblo, País', true], // number after a comma
  // Streets without a type word (common in old town centers), "de la" in the name, floors in English or Spanish
  ['Hostal Ocho Posada de la Luna 214 Pueblo', 'Posada de la Luna 214, Pueblo 12001, País', true],
  ['Hostal Ocho Posada de la Luna 214 Pueblo', 'C. Posada de la Luna 214, Pueblo 12000, País', true],
  ['Hostal Ocho Posada de la Luna 214 Pueblo', 'Hostal Ocho Pueblo, Posada de la Luna 214, Pueblo 12001', true], // name first
  ['Bar Nueve Bajada de San Pedro 530 Pueblo', 'Bajada Sn. Pedro 530, Pueblo 12001, País', true],
  ['Club Diez Calle Arcos 418, 2do Piso Pueblo', 'C. Arcos 418, Pueblo 12001, País', true],
  ['Salón Once Arcada de Flores 207, 3rd Floor Pueblo', 'Arcada de Flores 207, Pueblo 12001, País', true],
  ['Bar Doce Callejón Alto 365 Pueblo', 'Calle Callejón Alto 365, Pueblo 12000', true],
  ['Hostal Trece Posada de la Luna 214 Pueblo', 'Posada de la Luna 241, Pueblo 12001, País', false], // 214 vs 241
  ['Centro Catorce Cra. 52 #7 Sur-140, tercer piso Ciudad', 'Cra. 52, Barrio, Ciudad, Región, País', false], // a bare street, no building
  ['Bar Quince Av. 9 Nte. #12-30 Ciudad', 'Av. 9 Nte., Barrio, Ciudad, País', false], // a bare street, no building
  // Must NOT match
  ['Spa Ocho Calle 20 Carrera 95 esquina Ciudad', 'Cra. 41a #6B-17, Ciudad, Región, País', false], // different numbers
  ['Club Nueve Parque Central Ciudad', 'Cra. 15b #9-33, Parque Central, Ciudad, Región', false], // no number on SalsaVida's side
  ['Bar Diez Plaza Comercial Ejemplo Ciudad', 'Cl. 88 #47 - 12, Ciudad, Región, País', false], // no number
  ['Escuela Once Carrera 70 #28-31 Barrio Oeste Ciudad', 'Cl. 19 #44-08, Barrio Sur, Ciudad, Región, País', false], // other branch
  ['Club Doce Carrera 10 #20-30 Ciudad', 'Cl. 10 #20-30, Ciudad, Región, País', false], // Calle vs Carrera
  ['Bar Trece Carrera 35 #8A-30 Ciudad', 'Cra. 35 #8B-30, Ciudad, Región, País', false], // 8A vs 8B
  ['Bar Catorce Calle 74 Cra. 44 #20-30 Ciudad', 'Cra. 74 #20-30, Ciudad, Región, País', false], // no corner rule with a plate number
  ['Escuela Quince C. Gran Paseo, 24 10101 Pueblo País', 'C. Mayor, 5, 10202 Otro Pueblo, País', false],
  ['Hostal Dieciséis Calle Ejemplo 118 Pueblo País', 'C. Otra Calle 118, Pueblo, País', false], // same number, other street
  ['Casa Diecisiete Barrio Playa Pueblo', '12345, Barrio Playa, 12345 Pueblo, País', false], // postal code only
];

for (const [salsavida, google, expected] of pairs) {
  test(`${expected ? 'same' : 'different'}: ${salsavida.slice(0, 40)} | ${google.slice(0, 40)}`, () => {
    assert.equal(sameStreet(salsavida, google), expected);
  });
}

// addressesDiffer(): do two addresses PROVE different places? (Then a name match may not join them.)
// [SalsaVida-style, Google-style, differ?]
const differPairs: [string, string, boolean][] = [
  ['Escuela Once Carrera 70 #28-31 Barrio Oeste Ciudad', 'Cl. 19 #44-08, Barrio Sur, Ciudad, Región, País', true], // other branch
  // same corner written from the other street (carrera 52 near calle 7 Sur = calle 7 Sur near carrera 52): not proof
  ['Centro Uno Cra. 52 #7 Sur-140, tercer piso, Colegio Ejemplo Ciudad', 'Colegio Ejemplo, Cl. 7 Sur #52-3 a 52-48 Tercer Piso, Barrio, Ciudad', false],
  ['Club Dos Calle 15 Sur #36‑02, Local 104, Barrio Ciudad', 'Cra. 36 #15 Sur-10, Barrio, Ciudad, Región, País', false],
  ['Club Tres Calle 15 Sur #36-02 Ciudad', 'Cra. 37 #15 Sur-10, Ciudad, Región, País', false], // shares 15: no proof, the name decides
  ['Escuela Ritmo Sede Norte Carrera 80 #36-44 Ciudad', 'Cra. 80 #45-12, Ciudad, Región, País', false], // same street, other plate: no proof
  ['Escuela Ritmo Carrera 70 #28-31 Ciudad', 'Cl. 19 #44-08, Barrio Sur, Ciudad, Región, País', true], // no number shared: proof
  ['Bar Cuatro Calle 61 #40-15 Ciudad', 'Cl. 61 #40-15 local 3, Ciudad, Región, País', false], // same address
  ['Casa Cinco Barrio Playa Pueblo', 'Cra. 15b #9-33, Barrio Playa, Pueblo', false], // no number on one side: no proof
];

for (const [salsavida, google, expected] of differPairs) {
  test(`${expected ? 'differ' : 'no proof'}: ${salsavida.slice(0, 40)} | ${google.slice(0, 40)}`, () => {
    assert.equal(addressesDiffer(salsavida, google), expected);
  });
}

// ---------- Name binding and lookup acceptance (invented venues) ----------

const event = (id: number, venue: string, address: string, title = 'Salsa class'): RawEvent => ({
  id, title, venue, address, kind: 'class', days: [2], time: '19:00', price: '', url: `u${id}`, lastEdited: '2026-10-01', status: 'listed',
});
const place = (id: string, name: string, address: string, lookupFor?: number): RawPlace => ({ id, name, address, lat: 1, lng: 1, lookupFor });

test('same street, other plate, different branch qualifiers: no name binding', () => {
  const e = event(1, 'Escuela Ritmo Sede Norte', 'Escuela Ritmo Sede Norte Carrera 80 #36-44 Ciudad');
  assert.equal(nameBindable(e, place('A', 'Escuela Ritmo Sede Sur', 'Cra. 80 #45-12, Ciudad, País')), false);
});
test('same street, other plate, same name: the name decides (binds)', () => {
  const e = event(1, 'Escuela Ritmo', 'Escuela Ritmo Carrera 80 #36-44 Ciudad');
  assert.equal(nameBindable(e, place('A', 'Escuela Ritmo', 'Cra. 80 #45-12, Ciudad, País')), true);
});
test('no number shared: never by name', () => {
  const e = event(1, 'Escuela Ritmo', 'Escuela Ritmo Carrera 70 #28-31 Ciudad');
  assert.equal(nameBindable(e, place('A', 'Escuela Ritmo Sur', 'Cl. 19 #44-08, Ciudad, País')), false);
});

test('no-number fallback: one hit sharing a distinctive word is kept', () => {
  const e = event(7, 'Danzflor Dance School', 'Danzflor Av. Ejemplo (exact number unverified) Ciudad');
  const kept = acceptLookups([place('N1', 'Café Central', 'Cl. 1 #2-3, Ciudad'), place('H1', 'Danzflor Escuela de Danza', 'Av. Ejemplo 1015, Ciudad', 7)], [e]);
  assert.deepEqual(kept.map((p) => p.id), ['N1', 'H1']);
});
test('no-number fallback: two qualifying hits -> neither is kept', () => {
  const e = event(7, 'Danzflor Dance School', 'Danzflor Av. Ejemplo Ciudad');
  const kept = acceptLookups([place('H1', 'Danzflor Norte', 'Av. Ejemplo 1015, Ciudad', 7), place('H2', 'Danzflor Studio', 'Cl. 9 #1-2, Ciudad', 7)], [e]);
  assert.deepEqual(kept.map((p) => p.id), []);
});
test('no-number fallback: not used when SalsaVida has a street number', () => {
  const e = event(7, 'Danzflor Dance School', 'Danzflor Carrera 12 #3-45 Ciudad');
  const kept = acceptLookups([place('H1', 'Danzflor Escuela de Danza', 'Cl. 50 #60-70, Ciudad', 7)], [e]);
  assert.deepEqual(kept.map((p) => p.id), []);
});
test('no-number fallback: a generic or short shared word is not enough', () => {
  const e = event(7, 'Club Latino Bar', 'Club Latino Plaza Central Ciudad');
  const kept = acceptLookups([place('H1', 'Latino Grill', 'Cl. 50 #60-70, Ciudad', 7)], [e]);
  assert.deepEqual(kept.map((p) => p.id), []);
});
test('no-number fallback: the address names the building the venue is in', () => {
  const e = event(7, 'Club Sabroso', 'Club Sabroso Hotel Miramundo, Avenida Central Ciudad');
  const kept = acceptLookups([place('H1', 'Hotel Miramundo', 'Av. Central, Ciudad', 7)], [e]);
  assert.deepEqual(kept.map((p) => p.id), ['H1']);
});
test('no-number fallback: a word from the street (after the first comma) is not enough', () => {
  const e = event(7, 'Club Sabroso', 'Club Sabroso Hotel Miramundo, Avenida Miraflores Ciudad');
  const kept = acceptLookups([place('H1', 'Bar Miraflores', 'Av. Miraflores, Ciudad', 7)], [e]);
  assert.deepEqual(kept.map((p) => p.id), []);
});
