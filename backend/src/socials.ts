// POST /socials: reads a venue's website once and pulls out its Instagram and Facebook links.
// Fetching rules (robots.txt, timeout, size cap, never visiting social sites) live in fetchPage.ts.
import { fetchPage, socialSite, type SocialKind } from './fetchPage.ts';

export interface Socials {
  instagram: string[];
  facebook: string[];
  linktree: string[];
}

export async function findSocials(url: string): Promise<Socials> {
  const page = await fetchPage(url);
  if (page.social) {
    const socials: Socials = { instagram: [], facebook: [], linktree: [] };
    const profile = socialProfile(page.url); // the website IS a social page: return it cleaned, don't fetch it
    if (profile) socials[profile.site].push(profile.url);
    return socials;
  }
  return socialLinks(page.html!);
}

// Every Instagram / Facebook / Linktree profile the page links to. Only real links (href="...") count:
// URLs that just appear in scripts or markup (like Facebook's "facebook.com/2008/fbml" namespace) aren't links.
export function socialLinks(html: string): Socials {
  const socials: Socials = { instagram: [], facebook: [], linktree: [] };
  for (const [, href] of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const profile = socialProfile(href.replaceAll('&amp;', '&'));
    if (profile && !socials[profile.site].includes(profile.url)) socials[profile.site].push(profile.url);
  }
  return socials;
}

// A link -> its site and one clean spelling of the profile URL, or undefined if it isn't a profile.
// "instagram.com//X/", "//instagram.com/x" and "https://www.instagram.com/x?igsh=..." all become
// "https://www.instagram.com/x" (these sites ignore upper/lower case). Facebook's profile.php keeps its ?id=.
export function socialProfile(link: string): { site: SocialKind; url: string } | undefined {
  const url = URL.parse(link, 'https://x/'); // the base resolves "//instagram.com/x"
  const site = url && socialSite(url.href);
  if (!site) return undefined;
  const path = url.pathname.toLowerCase().replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (!isProfile(path)) return undefined;
  return { site, url: `https://www.${url.hostname.replace(/^(www|m|web)\./, '')}${path}${path === '/profile.php' ? url.search : ''}` };
}

// Keep links to a profile or page; skip posts, share buttons, tracking pixels, and paths that can't be a
// profile name (all digits like "2008", or odd characters).
function isProfile(path: string): boolean {
  const first = (path.split('/')[1] ?? '').toLowerCase();
  const notProfiles = ['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'tv', 'sharer', 'sharer.php', 'share', 'share.php', 'dialog', 'plugins', 'tr', 'login', 'login.php', 'help', 'policies', 'legal', 'privacy'];
  return /^[\w.-]+$/.test(first) && !/^\d+$/.test(first) && !notProfiles.includes(first);
}
