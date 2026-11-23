// POST /socials: reads a venue's website once and pulls out its Instagram and Facebook links.
// Fetching rules (robots.txt, timeout, size cap, never visiting social sites) live in fetchPage.ts.
import { fetchPage, socialSite } from './fetchPage.ts';

export interface Socials {
  instagram: string[];
  facebook: string[];
  linktree: string[];
}

export async function findSocials(url: string): Promise<Socials> {
  const page = await fetchPage(url);
  if (page.social) {
    const socials: Socials = { instagram: [], facebook: [], linktree: [] };
    socials[page.social].push(page.url); // the website IS a social page: return it, don't fetch it
    return socials;
  }
  return socialLinks(page.html!);
}

// Every Instagram / Facebook / Linktree profile the page links to. Only real links (href="...") count:
// URLs that just appear in scripts or markup (like Facebook's "facebook.com/2008/fbml" namespace) aren't links.
export function socialLinks(html: string): Socials {
  const socials: Socials = { instagram: [], facebook: [], linktree: [] };
  for (const [, href] of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const url = URL.parse(href.replaceAll('&amp;', '&'), 'https://x/'); // the base resolves "//instagram.com/x"
    const site = url && socialSite(url.href);
    if (!site || !isProfile(url.pathname)) continue;
    // One spelling per link, so "instagram.com/X/" and "https://www.instagram.com/x" count once
    // (these sites ignore upper/lower case in profile names). Facebook's profile.php needs its ?id=.
    const path = url.pathname.toLowerCase().replace(/\/+$/, '');
    const clean = `https://www.${url.hostname.replace(/^(www|m|web)\./, '')}${path}${path === '/profile.php' ? url.search : ''}`;
    if (!socials[site].includes(clean)) socials[site].push(clean);
  }
  return socials;
}

// Keep links to a profile or page; skip posts, share buttons, tracking pixels, and paths that can't be a
// profile name (all digits like "2008", or odd characters).
function isProfile(path: string): boolean {
  const first = path.split('/')[1].toLowerCase();
  const notProfiles = ['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'tv', 'sharer', 'sharer.php', 'share', 'share.php', 'dialog', 'plugins', 'tr', 'login', 'login.php', 'help', 'policies', 'legal', 'privacy'];
  return /^[\w.-]+$/.test(first) && !/^\d+$/.test(first) && !notProfiles.includes(first);
}
