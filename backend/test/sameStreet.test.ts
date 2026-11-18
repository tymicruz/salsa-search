// Regression suite for sameStreet(): real SalsaVida -> Google address pairs (Medellín, Cali, Barranquilla, Granada)
// plus hand-made hard cases. Run with `npm test` (Node's built-in test runner, no extra packages).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameStreet } from '../src/matching.ts';

// [SalsaVida address, Google address, same place?]
const pairs: [string, string, boolean][] = [
  // Real lookup hits that must match
  ['Posada León Carrera 35 #8A‑30 Medellín', 'Cra. 35 #8A-30, Medellín, Antioquia, Colombia', true],
  ['Erre de Rebelión Calle 9 # 43B-36 Parque El Poblado, Medellín, Antioquia Colombia', 'Calle 9 #43b36, Cl. 9 #43b-36, El Poblado, Medellín', true],
  ['Wandering Paisa Hostel Calle 44A #68A‑76 Medellín', 'Cl 44A #68A-76, Laureles, Medellín, Antioquia, Colombia', true],
  ['La Topa Tolondra Calle 5 # 13 - 27 Cali', 'Cl. 5 #13-27, San Antonio, Cali, Valle del Cauca, Colombia', true],
  ['Zaperoco Av. 5 Nte. #16-46 Cali', 'Av. 5 Nte. #16-46, Granada, Cali, Valle del Cauca, Colombia', true],
  ['MalaMaña Cra. 4 #9-59 Cali', 'Cra. 4 #9-59, Cali, Valle del Cauca, Colombia', true],
  ['El Rincón de Heberth Cra. 24 #5-32 Cali', 'Cra. 24 #5-32, 3 de Julio, Cali, Valle del Cauca, Colombia', true],
  ['Living Night Club Carrera 40 #11-81 Cali', 'Cra. 40 #11-81, Cali, Valle del Cauca, Colombia', true],
  ['Manicero Calle 5ta #39-71 Cali', 'Cl. 5 #39 - 71, Cali, Valle del Cauca, Colombia', true], // ordinal "5ta"
  ['El Búnker Cra. 53 #76-239 Barranquilla', 'Cra. 53 #76-239, Barranquilla, Atlántico, Colombia', true],
  ['Bourbon St Cra. 52 #74-73 Barranquilla', 'Cra. 52 #74-73, Barranquilla, Atlántico, Colombia', true],
  ['Palladium Calle 79 #51-36 Barranquilla', 'Cl. 79 #51-36 local 2, Barranquilla, Atlántico, Colombia', true], // "local 2"
  ['La Troja Calle 74 Cra. 44 Esquina Barranquilla', 'Cra. 44 #74, Nte. Centro Historico, Barranquilla, Atlántico', true], // corner
  ['Hostal Azul Calle Morazán 205 Granada Nicaragua', 'C. Morazán 205, Granada, Nicaragua', true],
  ['Contradanza GRX C. Gran Vía de Colón, 36 18010 Granada Spain', 'C. Gran Vía de Colón, 36, Centro, 18010 Granada, Spain', true], // number after comma
  // Must NOT match
  ['Las Brisas Spa Calle 36 Carrera 141 esquina Cali', 'Cra. 53a #5B-68, Cali, Valle del Cauca, Colombia', false],
  ['Siboney Club Parque Alameda Cali', 'Cra. 23b #7-66, La Alameda, Cali, Valle del Cauca, Colombia', false], // no number
  ['Zamba Sport Bar Plaza del Parque Shopping Center Barranquilla', 'Cl. 99 #53 - 40, Barranquilla, Atlántico, Colombia', false],
  ['Blood Dance Company Carrera 81 #36-44 Laureles Medellín', 'Cl. 30 #65-15, Guayabal, Medellín, Antioquia, Colombia', false],
  ['Club Diez Carrera 10 #20-30 Medellín', 'Cl. 10 #20-30, Medellín, Antioquia, Colombia', false], // Calle vs Carrera
  ['Bar Uno Carrera 35 #8A-30 Medellín', 'Cra. 35 #8B-30, Medellín, Antioquia, Colombia', false], // 8A vs 8B
  ['Bar X Calle 74 Cra. 44 #20-30 Barranquilla', 'Cra. 74 #20-30, Barranquilla, Atlántico, Colombia', false], // no corner rule with a plate
  ['Contradanza GRX C. Gran Vía de Colón, 36 18010 Granada Spain', 'C. Real, 5, 18230 Atarfe, Granada, Spain', false],
  ['Hostal Azul Calle Morazán 205 Granada Nicaragua', 'C. Real Xalteva 205, Granada, Nicaragua', false], // same number, other street
  ['PM La Casa del Bailador Rinconada Puerto Escondido', '71980, Rinconada, 71980 Puerto Escondido, Oax., Mexico', false], // postal code only
];

for (const [salsavida, google, expected] of pairs) {
  test(`${expected ? 'same' : 'different'}: ${salsavida.slice(0, 40)} | ${google.slice(0, 40)}`, () => {
    assert.equal(sameStreet(salsavida, google), expected);
  });
}
