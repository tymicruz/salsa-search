// MOCK DATA: fictional places in Medellín for testing the map. Replace with the backend.
// Names, times, prices and sources are made up; they are not real listings.
import { Venue } from './venue';

export const MOCK_VENUES: Venue[] = [
  {
    id: 'm1', name: 'Escuela Contratiempo', area: 'El Poblado', lat: 6.2075, lng: -75.5685,
    events: [
      { kind: 'class', day: 1, time: '19:00', level: 'beginner', price: 'COP 30,000', source: 'MOCK school website', confirmed: '2026-11-02', status: 'confirmed' },
      { kind: 'class', day: 3, time: '19:00', level: 'intermediate', price: 'COP 30,000', source: 'MOCK school website', confirmed: '2026-11-02', status: 'confirmed' },
      { kind: 'class', day: 6, time: '11:00', level: 'everyone', price: 'COP 25,000', source: 'MOCK school website', confirmed: '2026-11-02', status: 'confirmed' },
    ],
  },
  {
    id: 'm2', name: 'Clave Azul Social', area: 'Laureles', lat: 6.2448, lng: -75.5905,
    events: [
      { kind: 'social', day: 4, time: '21:00', level: 'everyone', price: 'COP 10,000 cover', source: 'MOCK Instagram post', confirmed: '2026-10-28', status: 'single_source' },
      { kind: 'social', day: 6, time: '21:30', level: 'everyone', price: 'COP 15,000 cover', source: 'MOCK Instagram post', confirmed: '2026-10-28', status: 'single_source' },
    ],
  },
  {
    id: 'm3', name: 'Casa Giro Doble', area: 'Laureles', lat: 6.247, lng: -75.5935,
    events: [
      { kind: 'class', day: 2, time: '19:30', level: 'beginner', price: 'COP 20,000', source: 'MOCK Facebook page', confirmed: '2026-11-10', status: 'confirmed' },
      { kind: 'social', day: 5, time: '21:00', level: 'everyone', price: 'Free', source: 'MOCK Facebook page', confirmed: '2026-11-10', status: 'confirmed' },
    ],
  },
  {
    id: 'm4', name: 'La Esquina del Timbal', area: 'Centro', lat: 6.2505, lng: -75.569,
    events: [
      { kind: 'music', day: 5, time: '22:00', level: 'everyone', price: 'COP 20,000 cover', source: 'MOCK listing site', confirmed: '2026-09-15', status: 'single_source' },
      { kind: 'music', day: 6, time: '22:00', level: 'everyone', price: 'COP 20,000 cover', source: 'MOCK listing site', confirmed: '2026-09-15', status: 'single_source' },
    ],
  },
  {
    id: 'm5', name: 'Estudio Paso Básico', area: 'Envigado', lat: 6.1725, lng: -75.587,
    events: [
      { kind: 'class', day: 1, time: '18:30', level: 'beginner', price: 'COP 25,000', source: 'MOCK WhatsApp group', confirmed: '2026-11-05', status: 'single_source' },
      { kind: 'class', day: 4, time: '18:30', level: 'advanced', price: 'COP 25,000', source: 'MOCK WhatsApp group', confirmed: '2026-11-05', status: 'single_source' },
    ],
  },
  {
    id: 'm6', name: 'Salón La Vuelta', area: 'Belén', lat: 6.2315, lng: -75.602,
    events: [
      { kind: 'social', day: 0, time: '17:00', level: 'everyone', price: 'COP 8,000', source: 'MOCK owner memory', confirmed: '2026-06-01', status: 'unverified' },
      { kind: 'social', day: 3, time: '20:30', level: 'intermediate', price: 'COP 8,000', source: 'MOCK owner memory', confirmed: '2026-06-01', status: 'stale' },
    ],
  },
  {
    id: 'm7', name: 'Bar Sabor Lento', area: 'Provenza', lat: 6.2098, lng: -75.565,
    events: [
      { kind: 'music', day: 4, time: '21:00', level: 'everyone', price: 'No cover', source: 'MOCK Instagram post', confirmed: '2026-11-08', status: 'confirmed' },
      { kind: 'social', day: 6, time: '22:00', level: 'everyone', price: 'COP 15,000 cover', source: 'MOCK Instagram post', confirmed: '2026-11-08', status: 'confirmed' },
    ],
  },
  {
    id: 'm8', name: 'Academia Ritmo 70', area: 'Estadio', lat: 6.2525, lng: -75.588,
    events: [
      { kind: 'class', day: 2, time: '19:00', level: 'beginner', price: 'COP 22,000', source: 'MOCK school website', confirmed: '2026-11-12', status: 'confirmed' },
      { kind: 'class', day: 4, time: '19:00', level: 'intermediate', price: 'COP 22,000', source: 'MOCK school website', confirmed: '2026-11-12', status: 'confirmed' },
      { kind: 'social', day: 5, time: '20:00', level: 'everyone', price: 'Free for students', source: 'MOCK school website', confirmed: '2026-11-12', status: 'confirmed' },
    ],
  },
  {
    id: 'm9', name: 'Parque de los Pasos', area: 'Estadio', lat: 6.2565, lng: -75.59,
    events: [
      { kind: 'social', day: 0, time: '16:00', level: 'everyone', price: 'Free', source: 'MOCK Reddit comment', confirmed: '2026-10-20', status: 'single_source' },
    ],
  },
  {
    id: 'm10', name: 'Hostal Tumbao', area: 'Manila', lat: 6.2128, lng: -75.5735,
    events: [
      { kind: 'class', day: 3, time: '18:00', level: 'beginner', price: 'Free for guests', source: 'MOCK hostel listing', confirmed: '2026-11-01', status: 'single_source' },
    ],
  },
  {
    id: 'm11', name: 'Taberna El Montuno', area: 'Prado', lat: 6.259, lng: -75.561,
    events: [
      { kind: 'music', day: 3, time: '21:00', level: 'everyone', price: 'No cover', source: 'MOCK Facebook event', confirmed: '2026-10-30', status: 'single_source' },
    ],
  },
  {
    id: 'm12', name: 'Casa Rumbera', area: 'Conquistadores', lat: 6.2405, lng: -75.5795,
    events: [
      { kind: 'class', day: 2, time: '20:00', level: 'beginner', price: 'COP 20,000', source: 'MOCK Instagram post', confirmed: '2026-11-11', status: 'confirmed' },
      { kind: 'social', day: 2, time: '21:00', level: 'everyone', price: 'COP 10,000', source: 'MOCK Instagram post', confirmed: '2026-11-11', status: 'confirmed' },
      { kind: 'class', day: 6, time: '15:00', level: 'advanced', price: 'COP 25,000', source: 'MOCK Instagram post', confirmed: '2026-11-11', status: 'confirmed' },
    ],
  },
];
