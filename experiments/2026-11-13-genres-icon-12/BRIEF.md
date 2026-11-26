# Brief: 12 options for the "All genres" icon (Turnip Works Build tray), 2026-11-13

You are an image worker. Use your BUILT-IN image generation tool (never an API key, never code that draws shapes).

## What it is
The Build tray of a tabletop-RPG map maker lists GENRES (Fantasy, Modern / sci-fi, Cultures). It needs ONE small permanent
icon that means "all the genres at once". The current one (ref/current-shipped-genres-all.png, a dragon on a 1950s flying
saucer) is rejected: the saucer is the wrong era, and the idea does not read at icon size. Make TWELVE genuinely different
concepts (list below), one image each.

Sci-fi in this game means the SPACE-OPERA / STARSHIP era: big angular starships, sleek fighters, energy pistols, star-
fields, planets. NOT 1950s saucers, NOT retro rockets with fins, NOT ray-guns with rings.

ORIGINAL ART ONLY. Every ship, weapon and symbol must be an invented, generic design. It must NOT resemble any film, TV,
game or toy franchise: no X-wing / TIE / Millennium-Falcon / Star-Destroyer / Enterprise / Borg-cube shapes, no Starfleet
delta or any insignia, no glowing laser swords of any kind, no famous dragons, no famous blasters. No text, letters,
numbers, logos or emblems anywhere (a die shows pips or blank faces, never numerals).

## Style (match the existing icon family)
`ref/anchor-type-TAV.png` is the style anchor (raw, on chroma green). `ref/genre-fantasy.png`, `ref/genre-modern.png`,
`ref/genre-cultures.png` are three finished sibling icons (keyed transparent, 128 px). Match their rendering:
bold, simple, chunky silhouette that reads at 32 to 48 pixels; a small three-quarter vignette seen from slightly above;
flat-shaded with soft matte gradients, quiet and modern (no outlines, no comic inking, no gloss, no photorealism); minimal
detail; restrained palette (warm honey wood, blue-gray stone and steel, moss green, ochre, cream, muted burgundy; sci-fi
parts cool blue-grey and cream with at most one small muted teal or amber glow). Exactly one compact vignette, centred,
filling about 80% of the frame, clear space around every edge. No frame, no badge shape, no border, no drop shadow, no floor.
FEWER, BIGGER shapes beat many small ones: this is seen at 32 px.

Background: solid chroma GREEN (#00FF00) edge to edge, opaque. The subject contains no bright green and reflects no green
light. A little grain or a slightly-off green in the background is FINE (our keyer handles it): do NOT retry for background
flatness, only for subject problems.

## Shot list (save each as ./raw/genres-NN.png)
01. `genres-01.png` SWORD + BLASTER crossed: a plain knight's longsword crossed in an X with a chunky sleek invented energy
    pistol (angular, blue-grey, small teal muzzle glow). Two big shapes.
02. `genres-02.png` THREE-FACE DIE: one big chunky six-sided die (pips only, no numbers) seen corner-on so three faces show;
    each visible face carries a tiny engraved emblem instead of pips: a castle tower, a city skyscraper, a small sleek
    starship silhouette (invented, arrow-like). Engraved shallow, same material.
03. `genres-03.png` THREE WEAPONS FANNED: a longsword, a plain revolver-style pistol (modern), and an invented sleek energy
    pistol, fanned like a hand of cards from one point.
04. `genres-04.png` PLANET + CASTLE + SKYLINE: a small round planet (blue-grey, one ring) whose top surface carries a tiny
    castle on the left and a tiny modern skyline on the right, like the Little Prince's asteroid.
05. `genres-05.png` THREE SILHOUETTE HEADS overlapping, in profile, left to right: a knight's great-helm, a modern person's
    head with a baseball cap, a space-pilot helmet with a visor (invented design). Overlapping like a stacked trio.
06. `genres-06.png` BOOK STACK: three thick books stacked, spines facing the viewer, each spine a different colour and
    carrying one small picture (no text): a dragon, a car, a starship. Slightly fanned, chunky.
07. `genres-07.png` PORTAL ARCH: a stone fantasy archway; through the opening you see a starfield with a small planet and a
    small sleek starship (invented, wedge-and-engine shape). Arch warm stone, opening deep blue.
08. `genres-08.png` COMPASS ROSE with a different symbol at three points: a chunky brass compass; the north point ends in a
    small castle tower, east in a small skyscraper, west in a small planet with a ring. No letters.
09. `genres-09.png` THREE MINIATURES: three tabletop miniature figures standing on round bases, side by side, touching: a
    knight with a shield, a modern detective in a trench coat and hat, a space marine in chunky armour with a helmet
    (invented design). All in the same painted-pewter look.
10. `genres-10.png` SPLIT SHIELD: a heater shield divided diagonally: upper half old wood and iron with a dragon head
    painted on it, lower half sleek steel panelling with a small glowing teal light and panel seams. One object, two eras.
11. `genres-11.png` DRAGON vs STARSHIP, big and simple: a single dragon head in profile (left) nose to nose with the BOW of
    a big angular space-opera starship (right; invented, wedge prow with a few panel steps, NOT any known ship). Only two
    huge shapes, cropped, filling the frame.
12. `genres-12.png` WORLD MAP SCROLL: a half-unrolled parchment map; the map shows a castle, a road to a city, and at its
    edge the parchment turns into a dark starfield with a tiny ringed planet. Chunky scroll rollers.

## Checklist (look at each result yourself; at most ONE retry per image, only for subject problems)
- one compact subject, readable shrunk to 48 px; the concept's 2-3 elements distinguishable
- matches the siblings' style (compare side by side); no outlines/ink, no gloss
- nothing franchise-like (re-check every ship, helmet, weapon), no text or numerals
Log each attempt (file, verdict, one line why) to ./LOG.md. ONE request at a time. If you hit a usage/rate limit, write the
exact text to QUOTA_STOP.txt and stop. When all twelve exist, write DONE.txt.
