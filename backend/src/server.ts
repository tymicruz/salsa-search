// Salsa Search backend. Stores nothing: every request is answered and forgotten.
// Express was picked because it's the most common Node web framework, so tutorials and answers are easy to find.
import express from 'express';
import { findSocials } from './socials.ts';
import { synthesize } from './synthesize.ts';

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

// Body: { area, places: RawPlace[], events: RawEvent[] }  ->  { venues: Venue[], notSalsa: string[] }
app.post('/synthesize', async (req, res) => {
  const { area, places = [], events = [] } = req.body ?? {};
  if (!Array.isArray(places) || !Array.isArray(events) || places.some((p) => !p?.id || !p?.name)) {
    res.status(400).json({ error: 'Send { area, places: [{ id, name, lat, lng, ... }], events: [...] }' });
    return;
  }
  const start = Date.now();
  try {
    const result = await synthesize(places, events);
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[synthesize] ${area ?? ''}: ${places.length} places + ${events.length} events -> ${result.venues.length} venues in ${seconds}s`);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Synthesis failed' });
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
