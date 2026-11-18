// POST /socials: reads a venue's website once and pulls out its Instagram and Facebook links.
// Fetching rules (robots.txt, timeout, size cap, never visiting social sites) live in fetchPage.ts.
import { fetchPage, socialSite } from './fetchPage.ts';

export interface Socials {
  instagram: string[];
  facebook: string[];
  linktree: string[];
}

export async function findSocials(url: string): Promise<Socials> {
  const socials: Socials = { instagram: [], facebook: [], linktree: [] };
  const page = await fetchPage(url);
  if (page.social) {
    socials[page.social].push(page.url); // the website IS a social page: return it, don't fetch it
    return socials;
  }

  // Find every Instagram / Facebook / Linktree URL in the page source.
  const links = page.html!.match(/https?:\/\/(?:[a-z]+\.)?(?:instagram\.com|facebook\.com|fb\.com|linktr\.ee)\/[^\s"'<>?#\\]+/gi) ?? [];
  for (const link of links) {
    const site = socialSite(link);
    // One spelling per link, so "instagram.com/X/" and "https://www.instagram.com/x" count once
    // (these sites ignore upper/lower case in profile names).
    const clean = link.toLowerCase().replace(/^https?:\/\/(?:www\.|m\.|web\.)?/, 'https://www.').replace(/\/+$/, '');
    if (site && isProfile(clean) && !socials[site].includes(clean)) {
      socials[site].push(clean);
    }
  }
  return socials;
}

// Skip share buttons, posts, tracking pixels etc.; keep links that point at a profile or page.
function isProfile(url: string): boolean {
  const first = new URL(url).pathname.split('/')[1].toLowerCase();
  const notProfiles = ['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'tv', 'sharer', 'sharer.php', 'share', 'share.php', 'dialog', 'plugins', 'tr', 'login', 'login.php', 'help', 'policies', 'legal', 'privacy'];
  return first !== '' && !notProfiles.includes(first);
}
