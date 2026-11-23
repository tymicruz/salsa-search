// socialLinks(): only real profile links from href attributes. The HTML is MADE UP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { socialLinks, socialProfile } from '../src/socials.ts';

test('keeps profile links from hrefs, once each', () => {
  const html = `
    <html xmlns:fb="http://www.facebook.com/2008/fbml">
    <script>var feed = "https://www.instagram.com/someone_else/embed";</script>
    <a href="https://instagram.com/Escuela.Ejemplo/">IG</a>
    <a href='https://www.instagram.com/escuela.ejemplo'>IG again</a>
    <a href="https://www.instagram.com/p/AbC123/">a post</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
    <a href="https://m.facebook.com/profile.php?id=123&amp;ref=x">FB</a>
    <a href="https://linktr.ee/ejemplo">links</a>
    <a href="//www.instagram.com/otra.escuela">protocol-relative</a>
    <a href="/contacto">contact</a>`;
  assert.deepEqual(socialLinks(html), {
    instagram: ['https://www.instagram.com/escuela.ejemplo', 'https://www.instagram.com/otra.escuela'],
    facebook: ['https://www.facebook.com/profile.php?id=123&ref=x'],
    linktree: ['https://www.linktr.ee/ejemplo'],
  });
});

test('cleans a profile URL given as a website', () => {
  assert.equal(socialProfile('https://instagram.com//Escuela.Ejemplo/?igsh=abc')?.url, 'https://www.instagram.com/escuela.ejemplo');
  assert.equal(socialProfile('https://www.instagram.com/'), undefined);
});
