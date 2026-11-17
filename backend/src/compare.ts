// Runs the same places through Gemini and OpenAI and prints the answers side by side.
// Usage: npm run compare                (uses compare-places.json, made-up TEST places)
//        npm run compare -- my.json     (your own list, same shape as /classify's "places")
// Token and cost lines ([gemini] ..., [openai] ...) are printed by llm.ts as each call finishes.
import { readFileSync } from 'node:fs';
import { classifyPlaces, type PlaceInput } from './classify.ts';

const file = process.argv[2] ?? 'compare-places.json';
const places: PlaceInput[] = JSON.parse(readFileSync(file, 'utf8'));

// Gemini goes through Vertex if that's what .env uses, otherwise through AI Studio.
const gemini = await classifyPlaces(places, process.env.LLM_PROVIDER === 'vertex' ? 'vertex' : 'gemini');
const openai = await classifyPlaces(places, 'openai');

// One row per place. Results come back in the same order as the places.
console.table(
  places.map((place, i) => ({
    name: place.name,
    gemini: `${gemini[i].category} [${gemini[i].offers.join(', ')}]`,
    openai: `${openai[i].category} [${openai[i].offers.join(', ')}]`,
  })),
);

// Reasons are long, so they go below the table.
for (const [i, place] of places.entries()) {
  console.log(`\n${place.name}\n  gemini: ${gemini[i].reason}\n  openai: ${openai[i].reason}`);
}
