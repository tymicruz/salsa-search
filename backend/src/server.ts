// Salsa Search backend. Stores nothing: every request is answered and forgotten.
// Express was picked because it's the most common Node web framework, so tutorials and answers are easy to find.
import express from 'express';
import { classifyPlaces } from './classify.ts';
import { findSocials } from './socials.ts';

const app = express();
app.use(express.json({ limit: '1mb' })); // reads JSON request bodies into req.body

// CORS: lets the Angular dev server (another origin) call this API from the browser.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204); // the browser's "may I?" check before a JSON POST
    return;
  }
  next();
});

// Body: { places: PlaceInput[] }  ->  { results: PlaceResult[] }
app.post('/classify', async (req, res) => {
  const places = req.body?.places;
  if (!Array.isArray(places) || places.some((p) => !p?.id || !p?.name)) {
    res.status(400).json({ error: 'Send { places: [{ id, name, ... }] }' });
    return;
  }
  try {
    res.json({ results: await classifyPlaces(places) });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Classifier failed' });
  }
});

// Body: { url: string }  ->  { instagram: string[], facebook: string[] }
app.post('/socials', async (req, res) => {
  const url = req.body?.url;
  if (typeof url !== 'string' || !URL.canParse(url) || !url.startsWith('http')) {
    res.status(400).json({ error: 'Send { url: "https://..." }' });
    return;
  }
  try {
    res.json(await findSocials(url));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not read that website' });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Backend on http://localhost:${port}`));
