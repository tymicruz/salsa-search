// POST /socials: reads a venue's website once and pulls out its Instagram and Facebook links.
// Polite fetching: obeys robots.txt, names itself, gives up after a few seconds, never visits social sites.

// Identifies us to website owners. No personal info.
const USER_AGENT = 'SalsaSearchBot/0.1 (salsa map prototype; reads a venue page once to find its social links)';
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;

export interface Socials {
  instagram: string[];
  facebook: string[];
  linktree: string[];
}

// Sites we never fetch. If the website is one of them, we return it as the link instead.
const SOCIAL_SITES: Record<string, keyof Socials> = {
  'instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'linktr.ee': 'linktree',
};

export async function findSocials(url: string): Promise<Socials> {
  const socials: Socials = { instagram: [], facebook: [], linktree: [] };

  // Follow redirects by hand so we can check every hop before fetching it.
  let res: Response | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const site = socialSite(url);
    if (site) {
      socials[site].push(url); // the website IS a social page: return it, don't fetch it
      return socials;
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
  const html = await res.text();

  // Find every Instagram / Facebook / Linktree URL in the page source.
  const links = html.match(/https?:\/\/(?:[a-z]+\.)?(?:instagram\.com|facebook\.com|fb\.com|linktr\.ee)\/[^\s"'<>?#\\]+/gi) ?? [];
  for (const link of links) {
    const site = socialSite(link);
    const clean = link.replace(/\/+$/, ''); // drop trailing slashes so duplicates match
    if (site && isProfile(clean) && !socials[site].includes(clean)) {
      socials[site].push(clean);
    }
  }
  return socials;
}

// Which social site a URL belongs to, or undefined. Covers subdomains like www. and m.
function socialSite(url: string): keyof Socials | undefined {
  const host = new URL(url).hostname.toLowerCase();
  for (const [domain, site] of Object.entries(SOCIAL_SITES)) {
    if (host === domain || host.endsWith('.' + domain)) return site;
  }
  return undefined;
}

// Skip share buttons, posts, tracking pixels etc.; keep links that point at a profile or page.
function isProfile(url: string): boolean {
  const first = new URL(url).pathname.split('/')[1].toLowerCase();
  const notProfiles = ['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'tv', 'sharer', 'sharer.php', 'share', 'share.php', 'dialog', 'plugins', 'tr', 'login', 'login.php', 'help', 'policies', 'legal', 'privacy'];
  return first !== '' && !notProfiles.includes(first);
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
