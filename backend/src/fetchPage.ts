// Polite page fetching, shared by /socials and the evidence step: obeys robots.txt, names itself,
// gives up after a few seconds, reads at most ~2 MB, and never visits social sites.

// Identifies us to website owners. No personal info.
const USER_AGENT = 'SalsaSearchBot/0.1 (salsa map prototype; reads a venue page once to find its social links)';
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 2_000_000; // read at most ~2 MB of a page

export type SocialKind = 'instagram' | 'facebook' | 'linktree';

// Sites we never fetch. If a URL is on one of them, the caller gets it back as a social link instead.
const SOCIAL_SITES: Record<string, SocialKind> = {
  'instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'linktr.ee': 'linktree',
};

// Fetches one HTML page. Returns { url, html }, or { url, social } when the URL (or a redirect) is a social site.
// Throws if robots.txt disallows it, or it isn't an HTML page.
export async function fetchPage(url: string): Promise<{ url: string; html?: string; social?: SocialKind }> {
  // Follow redirects by hand so we can check every hop before fetching it.
  let res: Response | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const social = socialSite(url);
    if (social) {
      return { url, social }; // the page IS a social page: return it, don't fetch it
    }
    if (!(await robotsAllow(url))) {
      throw new Error(`robots.txt disallows ${url}`);
    }
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const next = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !next) break;
    url = new URL(next, url).href; // redirect target can be relative
  }

  if (!res?.ok || !res.headers.get('content-type')?.includes('html')) {
    throw new Error(`Not an HTML page: ${url} (${res?.status})`);
  }
  return { url, html: await readText(res) };
}

// Which social site a URL belongs to, or undefined. Covers subdomains like www. and m.
export function socialSite(url: string): SocialKind | undefined {
  const host = new URL(url).hostname.toLowerCase();
  for (const [domain, site] of Object.entries(SOCIAL_SITES)) {
    if (host === domain || host.endsWith('.' + domain)) return site;
  }
  return undefined;
}

// Reads the page in chunks and stops at MAX_BYTES, so a huge page can't eat memory.
async function readText(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) return text;
    bytes += value.length;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel(); // too big: stop downloading, keep what we have
  return text;
}

// Reads the site's robots.txt and checks whether we may fetch this path.
// Rules for our bot name win over rules for "*"; the longest matching rule wins. No robots.txt = allowed.
async function robotsAllow(url: string): Promise<boolean> {
  const { origin, pathname } = new URL(url);
  let text = '';
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return true;
    text = await res.text();
  } catch {
    return true; // robots.txt unreachable: treat as no rules
  }

  const ourRules: [string, string][] = []; // [allow|disallow, path prefix]
  const starRules: [string, string][] = [];
  let agents: string[] = [];
  let groupHasRules = false;
  for (const line of text.split('\n')) {
    const [rawKey, ...rest] = line.split('#')[0].split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      if (groupHasRules) {
        agents = []; // a new group starts
        groupHasRules = false;
      }
      agents.push(value.toLowerCase());
    } else if (key === 'allow' || key === 'disallow') {
      groupHasRules = true;
      if (agents.includes('salsasearchbot')) ourRules.push([key, value]);
      else if (agents.includes('*')) starRules.push([key, value]);
    }
  }

  const rules = ourRules.length ? ourRules : starRules;
  let best = { length: -1, allowed: true };
  for (const [key, prefix] of rules) {
    if (prefix && pathname.startsWith(prefix) && prefix.length > best.length) {
      best = { length: prefix.length, allowed: key === 'allow' };
    }
  }
  return best.allowed;
}
