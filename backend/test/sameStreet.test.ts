// Regression suite for sameStreet(): SalsaVida-style vs Google-style address pairs.
// All addresses are MADE UP (no Google content in the repo). Each pair copies the format of a real case we hit
// (ordinals, "local 2", corners, the number after a comma, postal-code-only, ...). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameStreet } from '../src/matching.ts';

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
