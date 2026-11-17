// POST /classify: asks the LLM what kind of salsa place each one is, using only the text we send it.
import { askLLM, type Provider } from './llm.ts';

// One place as the frontend sends it. Only id and name are required.
export interface PlaceInput {
  id: string; // Google place ID, so the frontend can match results back
  name: string;
  types?: string[]; // Google types, e.g. ["dance_school", "point_of_interest"]
  primaryType?: string;
  address?: string;
  websiteText?: string; // text from the place's website, if the frontend has it
  eventText?: string; // SalsaVida event titles/descriptions matched to this place
}

const CATEGORIES = ['salsa_school', 'social_venue', 'bar_club_with_salsa', 'not_salsa', 'unknown'];
const OFFERS = ['classes', 'socials', 'music'];

export interface PlaceResult {
  id: string;
  category: string; // one of CATEGORIES
  offers: string[]; // any of OFFERS; empty = no evidence
  reason: string; // one sentence quoting the evidence
}

const BATCH_SIZE = 20; // places per LLM call: fewer calls = lower cost
const MAX_TEXT = 1500; // characters of website/event text per place, to keep prompts small

// provider is optional: leave it out to use LLM_PROVIDER from .env.
export async function classifyPlaces(places: PlaceInput[], provider?: Provider): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];
  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const batch = places.slice(i, i + BATCH_SIZE);
    results.push(...(await classifyBatch(batch, provider)));
  }
  return results;
}

async function classifyBatch(places: PlaceInput[], provider?: Provider): Promise<PlaceResult[]> {
  const input = places.map((p) => ({
    id: p.id,
    name: p.name,
    types: p.types,
    primaryType: p.primaryType,
    address: p.address,
    websiteText: p.websiteText?.slice(0, MAX_TEXT),
    eventText: p.eventText?.slice(0, MAX_TEXT),
  }));

  const prompt = `You classify places for a salsa dancing map. Use ONLY the evidence given below for each place.
Never use outside knowledge and never guess. If the evidence is not enough, the category is "unknown".

Categories:
- salsa_school: teaches salsa (dance school, academy, studio with salsa classes)
- social_venue: a place where people go to partner-dance salsa socially
- bar_club_with_salsa: a bar or club that plays salsa music or has salsa nights, but is mainly a bar/club
- not_salsa: evidence shows it has nothing to do with salsa dancing (e.g. a restaurant selling salsa sauce)
- unknown: not enough evidence

offers: list only what the evidence shows: "classes", "socials" (partner dancing), "music" (salsa music played, live or DJ). Empty list if unclear.
reason: one sentence that quotes the exact words from the evidence you used.

Return JSON: {"results": [{"id": "...", "category": "...", "offers": [...], "reason": "..."}]} with one entry per place, same ids.

Places:
${JSON.stringify(input)}`;

  const answer = JSON.parse(await askLLM(prompt, provider));

  // Check the model's answer: keep known values only, and return every place even if the model skipped it.
  return places.map((place) => {
    const found = answer.results?.find((r: PlaceResult) => r.id === place.id);
    if (!found || !CATEGORIES.includes(found.category)) {
      return { id: place.id, category: 'unknown', offers: [], reason: 'No answer from the classifier.' };
    }
    return {
      id: place.id,
      category: found.category,
      offers: (found.offers ?? []).filter((o: string) => OFFERS.includes(o)),
      reason: String(found.reason ?? ''),
    };
  });
}
