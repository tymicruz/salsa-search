# Puerto Escondido Pilot: Score

Date: 2026-11-16
Pilot: `pilots/puerto-escondido.md` (blind run). Answer key: `interviews/puerto-escondido.md` (owner memory, unverified).

## Against the owner's answers

| Owner's memory | Pilot result | Score |
|---|---|---|
| **Timba**: the main school, "heart of the community", salsa + bachata + cha-cha | Not found. The pilot found "no current dedicated school". | ❌ Missed |
| **Mandala**: Thursday social hosted by Timba people after practice; one of the two best | Mándala Zicatela, Thu, class + social, free. It didn't find that Timba hosts it, and it had no vibe beyond the listing. | ✅ Found, but the host was missed |
| **Nectar**: Friday social; one of the two best | Hotel Néctar, but on **Saturday**, labeled "classes" for beginners | ⚠️ Found, but the day and type differ from memory |
| **Payame/PMA**: Tuesday, nice area, sometimes empty, less consistent | PM La Casa del Bailador, Tue + Fri, 4.9 rating, "my favourite place" | ✅ Found (almost certainly the same place). The vibe differs from the owner's memory. |
| **Congo**: a club playing about 2 salsa songs, "not a salsa event" | Labeled live music, **partner dancing: yes** | ❌ Wrong label |

**Result:** 4 of 5 places found by name. 1 big miss (Timba). 1 wrong label (Congo). 1 schedule conflict (Néctar).

**Noise:** 18 places were reported, against the owner's "maybe only two" good socials. About 8 come from old articles or a 2023 blog (Kabbalah, Rockaway, Esesarte, Los Bravos, El Mexicano, La Pared, Café Central, La Punta).

## Why

- **Timba was missed.** The two steps that would find a school, Google Maps (step 2) and Instagram (step 4), were mostly blocked. The searches used "escuela de salsa" and "salsa school", while Timba describes itself as a Latin dance school (salsa + bachata). The pilot also never asked "who hosts Mándala?", which leads straight to the school.
- **Congo was mislabeled.** Its only sources were the venue's own promotional listing and an old article. No recent first-hand reviews were read.
- **The Néctar day differs.** The schedule may have changed since the owner was there (2025 IG post: Saturday), or the memory may be off. Either way, the record needs `last_confirmed`.
- **Noise.** Nothing stopped old sources from being reported.

## Playbook steps

| Step | Verdict |
|---|---|
| 1 Event sites | ✅ Found nearly everything, the same way the owner did. It's also the weak point: it found every venue but got the labels and hosts wrong. |
| 2 Google Maps | ❌ Blocked (JS-only). This is the step most likely to find Timba. |
| 3 Names in reviews | ❌ Almost nothing was readable |
| 4 Instagram | ⚠️ 3 of 7 readable. Good for confirming day and time. |
| 5 Hostels | ✅ Found 3 hostel nights (not in the answer key, so they can't be scored) |
| 6 Reddit | ❌ Blocked. The fallback blog added mostly old noise. |
| 7 Festivals | — None current. Fine. |

## Playbook changes to make

1. **Find the host of every social.** For each social, ask "who runs this?" and search the host. A social is the way to the school.
2. **Broader school searches.** Add "escuela de baile latino", "salsa bachata clases", "dance school" and `site:instagram.com salsa <city>`.
3. **Freshness cutoff.** Sources older than about 2 years are marked "possibly closed" and kept out of the main results unless a newer source confirms them.
4. **Partner dancing needs first-hand proof.** A promotional listing alone can't set `partner_dancing: yes`. That needs a recent review or post from a dancer.
5. **The tool gap.** Google Maps reviews, Instagram and Reddit were mostly unreachable with plain page fetching. An automated version needs either the Google Places API (has a free tier, then paid; the owner decides) or a real browser. This is the main finding for the automation decision.
