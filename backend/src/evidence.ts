// Evidence that a venue really offers salsa, from its own website and Instagram. Nothing is stored.
// The LLM only reads the pages we fetched and lists facts; code keeps a fact only if its quote is copied word for
// word from that page, and code (not the LLM) decides each venue's verdict:
//   evidence         -> at least one salsa fact for adults (or not stated as kids-only): show the venue
//   no_evidence      -> its pages were read and say nothing about salsa for adults: hide the venue
//   needs_instagram  -> the website had no salsa facts but links an Instagram: check that before hiding
//   not_checked      -> nothing could be read (no website, unreachable, robots.txt, daily limit): keep as today
import { askLLM } from './llm.ts';
import { fetchPage, socialSite } from './fetchPage.ts';
import { norm } from './matching.ts';
import { socialLinks } from './socials.ts';

export interface Fact {
  kind: 'class' | 'social' | 'live_music' | 'mention'; // mention = says it offers salsa, no details
  dance: string; // only "salsa" facts are kept
  audience: 'adults' | 'kids' | 'unclear';
  day: string;
  time: string;
  price: string;
  quote: string; // exact words from the page or caption
  sourceUrl: string;
}

export interface Result {
  venueKey: string;
  verdict: 'evidence' | 'no_evidence' | 'needs_instagram' | 'not_checked';
  reason: string;
  facts: Fact[];
  website?: { url: string; pagesRead: string[] };
  instagram?: { url: string; bio?: string; lastPostDate?: string };
}

export const MAX_VENUES = 15; // per request
const MAX_SUBPAGES = 2; // besides the home page
const TEXT_PER_PAGE = 2500; // characters of each page sent to the LLM
const SCHEDULE_WORDS = /horario|schedule|clase|class|precio|price|tarifa|salsa|evento|event|social|curso|course/i;

// ---------- Website ----------

export interface WebsiteRequest {
  venueKey: string;
  websiteUrl?: string;
  salsavidaUrls?: string[]; // used to find a website when there's none (SalsaVida-only venues)
}

export async function websiteEvidence(venues: WebsiteRequest[]): Promise<Result[]> {
  const start = Date.now();
  const read = await mapLimit(venues, 5, readVenueSite); // fetch 5 venues at a time
  const facts = await factsPerVenue(read.filter((r) => r.pages.length > 0).map((r) => ({ key: r.venueKey, texts: r.pages })));

  const results = read.map((r): Result => {
    const website = r.pages.length ? { url: r.pages[0].url, pagesRead: r.pages.map((p) => p.url) } : undefined;
    const instagram = r.instagramUrl ? { url: r.instagramUrl } : undefined;
    const found = facts.get(r.venueKey);
    if (r.pages.length === 0) {
      const verdict = r.instagramUrl ? 'needs_instagram' : 'not_checked';
      return { venueKey: r.venueKey, verdict, reason: r.problem, facts: [], instagram };
    }
    if (!found) return { venueKey: r.venueKey, verdict: 'not_checked', reason: 'reading the pages failed', facts: [], website };
    return { venueKey: r.venueKey, ...verdictFor(found, 'website'), facts: found, website, ...(instagram && { instagram }) };
  });
  // A website with no salsa facts but an Instagram link: check Instagram before hiding.
  for (const r of results) {
    if (r.verdict === 'no_evidence' && r.instagram) Object.assign(r, { verdict: 'needs_instagram', reason: 'no salsa on the website; Instagram not checked yet' });
  }
  logSummary('website', results, start);
  return results;
}

// Reads a venue's site: home page + up to 2 schedule-looking pages on the same site. Finds its Instagram link too.
async function readVenueSite(v: WebsiteRequest) {
  const pages: { url: string; text: string }[] = [];
  let instagramUrl: string | undefined;
  let problem = 'no website';
  try {
    let url = v.websiteUrl;
    if (!url && v.salsavidaUrls?.length) ({ url, instagramUrl } = await siteFromSalsaVida(v.salsavidaUrls[0]));
    if (url && socialSite(url)) {
      if (socialSite(url) === 'instagram') instagramUrl = url; // the "website" is an Instagram profile
      url = undefined;
      problem = 'website is a social page';
    }
    if (url) {
      const home = await fetchPage(url);
      if (home.html) {
        pages.push({ url: home.url, text: pageText(home.html) });
        instagramUrl ??= socialLinks(home.html).instagram[0];
        for (const sub of schedulePages(home.html, home.url)) {
          try {
            const page = await fetchPage(sub);
            if (page.html) pages.push({ url: page.url, text: pageText(page.html) });
          } catch {} // a broken subpage doesn't spoil the rest
        }
      }
    }
  } catch (err) {
    problem = `website not readable (${(err as Error).message.slice(0, 80)})`;
  }
  return { venueKey: v.venueKey, pages, instagramUrl, problem };
}

// A SalsaVida event page links to the venue's website (or shows a contact email whose domain is the website),
// and sometimes to its Instagram. SalsaVida's own links are skipped.
async function siteFromSalsaVida(salsavidaUrl: string) {
  const page = await fetchPage(salsavidaUrl);
  const html = page.html ?? '';
  const skip = /salsavida\.com|adthrive|google|gstatic|gravatar|schema\.org|w3\.org|cloudflare|x\.com|twitter\.com|pinterest|wp\.com|wordpress\.org|youtube\.com|whatsapp|wa\.me|tiktok/i;
  const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).filter((h) => !skip.test(h));
  const freeMail = /^(gmail|hotmail|yahoo|outlook|gmx|icloud|live|aol|proton(mail)?)\./i;
  const emailDomain = [...html.matchAll(/[\w.+-]+@([\w-]+\.[\w.-]+)/g)].map((m) => m[1]).find((d) => !freeMail.test(d) && !skip.test(d));
  const instagramUrl = socialLinks(html).instagram.find((u) => !u.includes('/salsavida'));
  const url = links.find((h) => !socialSite(h)) ?? (emailDomain ? `https://${emailDomain}` : undefined);
  return { url, instagramUrl };
}

// Links on the same site whose address or link text looks like a schedule, class or price page.
function schedulePages(html: string, base: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(m[1], base);
    } catch {
      continue;
    }
    const sameSite = url.hostname === new URL(base).hostname;
    const isPage = !/\.(jpe?g|png|gif|webp|pdf|zip|mp4)$/i.test(url.pathname);
    const looksRight = SCHEDULE_WORDS.test(url.pathname) || SCHEDULE_WORDS.test(m[2].replace(/<[^>]+>/g, ''));
    const href = url.href.split('#')[0];
    if (sameSite && isPage && looksRight && href !== base && !found.includes(href)) found.push(href);
    if (found.length === MAX_SUBPAGES) break;
  }
  return found;
}

// Visible text of an HTML page: no scripts, styles or tags; spaces collapsed.
function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Instagram (Apify) ----------

const APIFY_ACTOR = 'apify~instagram-profile-scraper';
const usedToday = { date: '', count: 0 }; // profiles scraped today, to stay under APIFY_MAX_PER_DAY

export async function instagramEvidence(venues: { venueKey: string; instagramUrl: string }[]): Promise<Result[]> {
  const start = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (usedToday.date !== today) Object.assign(usedToday, { date: today, count: 0 });
  const allowed = Math.max(0, (Number(process.env.APIFY_MAX_PER_DAY) || 30) - usedToday.count);
  const toScrape = venues.slice(0, allowed);
  const overLimit = venues.slice(allowed);

  const byHandle = new Map<string, any>();
  if (toScrape.length) {
    usedToday.count += toScrape.length;
    for (const p of await runApify(toScrape.map((v) => handleOf(v.instagramUrl)))) byHandle.set(String(p.username).toLowerCase(), p);
  }

  // Texts per venue: the bio and each caption, with the URL a quote would link to.
  const read = toScrape.map((v) => {
    const p = byHandle.get(handleOf(v.instagramUrl));
    const posts: any[] = p?.latestPosts ?? [];
    const texts = [
      { url: v.instagramUrl, text: p?.biography ?? '' },
      ...posts.map((post) => ({ url: post.url ?? v.instagramUrl, text: post.caption ?? '' })),
    ].filter((t) => t.text);
    const lastPostDate = posts.map((x) => x.timestamp).filter(Boolean).sort().at(-1)?.slice(0, 10);
    return { v, p, texts, lastPostDate };
  });
  const facts = await factsPerVenue(read.filter((r) => r.texts.length > 0).map((r) => ({ key: r.v.venueKey, texts: r.texts })));

  const results: Result[] = read.map(({ v, p, texts, lastPostDate }) => {
    const instagram = { url: v.instagramUrl, bio: p?.biography, lastPostDate };
    if (!p || texts.length === 0) return { venueKey: v.venueKey, verdict: 'not_checked', reason: 'Instagram profile empty or not found', facts: [], instagram };
    const found = facts.get(v.venueKey);
    if (!found) return { venueKey: v.venueKey, verdict: 'not_checked', reason: 'reading the posts failed', facts: [], instagram };
    return { venueKey: v.venueKey, ...verdictFor(found, 'Instagram bio and latest posts'), facts: found, instagram };
  });
  for (const v of overLimit) {
    results.push({ venueKey: v.venueKey, verdict: 'not_checked', reason: 'daily Instagram limit reached', facts: [], instagram: { url: v.instagramUrl } });
  }
  logSummary('instagram', results, start);
  return results;
}

// "https://www.instagram.com/Some_Handle/" -> "some_handle"
function handleOf(instagramUrl: string): string {
  return new URL(instagramUrl).pathname.split('/')[1].toLowerCase();
}

// One Apify run for all handles (bio + latest 12 posts each). The token is never logged.
async function runApify(handles: string[]): Promise<any[]> {
  const headers = { Authorization: `Bearer ${process.env.APIFY_TOKEN}`, 'Content-Type': 'application/json' };
  const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?waitForFinish=120`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ usernames: handles }),
  });
  if (!res.ok) throw new Error(`Apify ${res.status}`);
  const run = (await res.json()).data;
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items`, { headers })).json();
  console.log(`[evidence] apify: ${handles.length} profiles, ${run.status}, today ${usedToday.count}/${process.env.APIFY_MAX_PER_DAY || 30}`);
  return items;
}

// ---------- Shared: LLM extraction, quote check, verdict ----------

// One LLM call per venue, 3 at a time. Measured on 5 real venues: 21 s in total (first result after 13 s),
// vs 53 s for one call with all venues, where the model "thinks" about 4x longer.
// A venue whose call fails is missing from the map, so it becomes not_checked (never hidden by mistake).
async function factsPerVenue(venues: { key: string; texts: { url: string; text: string }[] }[]): Promise<Map<string, Fact[]>> {
  const facts = new Map<string, Fact[]>();
  await mapLimit(venues, 3, async (v) => {
    try {
      facts.set(v.key, (await extractFacts([v])).get(v.key) ?? []);
    } catch (err) {
      console.error(`[evidence] LLM failed for ${v.key}:`, (err as Error).message.slice(0, 120));
    }
  });
  return facts;
}

// Each venue's texts (pages or bio/captions) -> salsa facts with exact quotes.
// Code keeps a fact only if its quote appears word for word in the text it names.
async function extractFacts(venues: { key: string; texts: { url: string; text: string }[] }[]): Promise<Map<string, Fact[]>> {
  const input = venues.map((v) => ({ venueKey: v.key, texts: v.texts.map((t) => ({ url: t.url, text: t.text.slice(0, TEXT_PER_PAGE) })) }));
  const prompt = `You read texts from venues' own websites or Instagram and list facts about SALSA dancing only.
Use ONLY these texts. Never use outside knowledge and never guess.

For each venue, list each salsa fact:
- kind: "class" (salsa lessons), "social" (people partner-dance salsa), "live_music" (salsa band or DJ; music alone is not dancing),
  or "mention" (the text says they offer salsa but gives no details)
- dance: "salsa" (list salsa facts only; skip other dances like bachata, ballet, urban)
- audience: "kids" if the salsa offer is only for children or teens, "adults" if it says adults or all ages, else "unclear"
- day, time, price: only if written in the text, else ""
- quote: the exact words copied from the text (at most 25 words) that show the fact
- sourceUrl: the url of the text the quote is from
If a venue's texts say nothing about salsa, return no facts for it.

Return JSON only: {"results":[{"venueKey":"","facts":[{"kind":"","dance":"salsa","audience":"","day":"","time":"","price":"","quote":"","sourceUrl":""}]}]}

Texts:
${JSON.stringify(input)}`;

  const answer = JSON.parse(await askLLM(prompt));
  const facts = new Map<string, Fact[]>();
  let dropped = 0;
  for (const v of venues) {
    const proposed: any[] = answer.results?.find((r: any) => r.venueKey === v.key)?.facts ?? [];
    const kept = proposed.filter((f) => {
      const source = v.texts.find((t) => t.url === f.sourceUrl);
      const ok = f.dance === 'salsa' && !!f.quote && !!source && squash(source.text.slice(0, TEXT_PER_PAGE)).includes(squash(f.quote));
      if (!ok) dropped++;
      return ok;
    });
    facts.set(v.key, kept.map((f) => {
      // Time and price must also be written in that text, or they're left empty (no invented details).
      const source = squash(v.texts.find((t) => t.url === f.sourceUrl)!.text.slice(0, TEXT_PER_PAGE));
      const ifWritten = (value: unknown) => (value && source.includes(squash(String(value))) ? String(value) : '');
      return {
        kind: ['class', 'social', 'live_music', 'mention'].includes(f.kind) ? f.kind : 'mention',
        dance: 'salsa',
        audience: ['adults', 'kids'].includes(f.audience) ? f.audience : 'unclear',
        day: String(f.day ?? ''),
        time: ifWritten(f.time),
        price: ifWritten(f.price),
        quote: String(f.quote),
        sourceUrl: f.sourceUrl,
      };
    }));
  }
  if (dropped) console.log(`[evidence] ${dropped} facts dropped: quote not word for word, or not salsa`);
  return facts;
}

// Same text for quote checks: no accents, lower case, spaces collapsed.
function squash(text: string): string {
  return norm(text).replace(/\s+/g, ' ').trim();
}

// Evidence = at least one salsa fact that isn't kids-only. A kids-only salsa school counts as no evidence.
function verdictFor(facts: Fact[], where: string): Pick<Result, 'verdict' | 'reason'> {
  if (facts.some((f) => f.audience !== 'kids')) return { verdict: 'evidence', reason: `salsa found on ${where}` };
  if (facts.length) return { verdict: 'no_evidence', reason: `only kids' salsa on ${where}` };
  return { verdict: 'no_evidence', reason: `no salsa on ${where}` };
}

function logSummary(wave: string, results: Result[], start: number) {
  const count = (v: string) => results.filter((r) => r.verdict === v).length;
  console.log(
    `[evidence] ${wave}: ${results.length} venues -> ${count('evidence')} evidence, ${count('no_evidence')} no_evidence, ` +
      `${count('needs_instagram')} needs_instagram, ${count('not_checked')} not_checked in ${((Date.now() - start) / 1000).toFixed(1)}s`,
  );
}

// Runs fn over items, at most `limit` at a time, keeping the order.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
