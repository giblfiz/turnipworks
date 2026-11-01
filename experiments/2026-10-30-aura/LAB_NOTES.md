# A pawn's aura — lab notes (2026-10-30)

Branch `aura`, worktree <repo> Dev only. The brief: a general aura with intensity levels
(Exalted's anima banner; D&D rage, spirit guardians, a divine glow; Vampire Disciplines): 0 none, 1 dim, 2 glowing,
3 burning, 4 bonfire, 5 iconic (an emblem in the column); a per-pawn colour from a palette of six; the ring, the bar and
GET; strict relay check; everyone sees it under the conditions' fog / hidden rules; nothing under the open ring; a static
version for Low graphics and reduce motion; batched draws. Style reference: the "concentrating" rune circle Harry loves.

## Reading (13:00)
- statusfx (client/statusfx.js): three instanced draws for every condition on the table; the ring's mask (app.ringMask,
  per instance on the CPU); `statusStill` parks motion. Pawns carry no faction (core/factions.js reads `flavor`, set only on
  rooms, buildings and faction pieces), so "the pawn's faction emblem" needs a field: `aura.emblem` (a faction id; the bar's
  "aura emblem dragons", GET's aura=5,gold,dragons), with `explicitFaction(pawn)` honoured if a pawn ever has one; else
  the sun. The emblems are tools/spawn-tuner/assets/emblems (round painted medallions, 256 px, alpha disc).
- The pawn ☰ is one table (client/menu.js); a list there is a sub-arc. Aura is its own list, `pawn.aura.`, after
  Indicators (browser_pawnring / cuts / rooms checks of the exact ☰ updated).

## Built (13:00-14:00)
- core/aura.js: palette (gold #ffbf47, silver-white #e4ecff, blue #4fa3ff, green #55e07c, red #ff4a32, violet #b46cff),
  `auraProblem` (strict: level an integer 0..5, colour a palette id, emblem a short id, no other field), `storedAura`
  (level 0 in gold = no field; level 0 keeps another colour), `auraAfter` (up / down clamp; a colour with none lit lights
  it at glowing), `parseAura` (the bar), `getAura` (GET values).
- core/commands.js: `aura: 'obj?'` on token.create and token.set (owner or GM, as conditions); llm.js: GET words to the
  pawn's whole aura after the change; the scene lists it; help/pawns says how (the main card is at its word limit).
- client/aurafx.js: three instanced draws per world: an open tube per aura (both faces; fbm flame noise climbing,
  thicker-is-brighter by facing, a hot core), the floor (a pool and a rippling ring), sprites (sparks and emblems, one
  canvas atlas of the emblems in use). The ring's mask per pixel: the same app.ringMask circles and panel boxes as
  uniforms, gl_FragCoord to client px in onBeforeRender, 10 px fade. Blending: premultiplied light plus a little cover
  (`AURA.cover` 0.28) so it is not lost on a bright floor by day.
- Ring: ☰ ▸ Aura: Aura up, Aura down, Aura off (while lit), six colours (✓ on the one it has). Bar: aura 3 / up / down /
  off / blue / 4 red / burning / emblem dragons.

## Tests
- engine/test/aura.test.mjs (in npm test): 38/38 first run. npm test green.
- engine/test/browser_aura.py: first run 19/21 (the colour tile's tip was its short label, not "✓ Blue aura"; the pixel
  check counted the open ☰'s caption boxes as button: it now uses the ring's own mask and checks every button centre lies
  in it), then 21/21.

## Gemini, round 1 (agy-run, argon; gemini/r1.txt; stills shots/v1-*: the five levels gold in a row, six colours at 3)
- "two tiers: a very quiet bottom half (L0-L3) ... an abrupt visual cliff jumping into massive pillars at L4-L5"; "L1
  actually reads brighter than L2"; level 5's "large, semi-transparent golden sun face" seen; colours "5 of 6 ... Gold and
  Amber/Orange-gold [the red] are too close"; L4 / L5 "wash the miniature inside into a flat, unreadable pale-yellow ghost";
  "hard, straight vertical cylinder edges"; verdict "a cheap MMO / video-game particle buff, not a painted-miniature-world
  (OSL) effect". Its three changes: light the miniature's own surfaces and carve the fog out in front of it; forms that
  hug the figure instead of laser tubes; the emblem and base glow as physical materials, never blown to white.
- Changed: each level holds the one below and more; the FIGURE lit by its aura (lit clones of its materials: a rim and an
  underlight in the colour, on its own normals); the column's near side carved away in front of the figure up to its
  crown; no silhouette edge (alpha to 0 at grazing), the radius breathing round and up the column; the floor saturated,
  never white; red #ff2448 (crimson); the emblem hung just over the head, with a relief read from its own brightness.

## Gemini, round 2 (gemini/r2.txt; shots/v2-*, night now from a PLAYER's seat in darkness)
- "Slightly better, but fundamentally the same look": the figures "now receive colored surface lighting"; still "L1 -> L2
  brightness drop" (L2's front was carved right down to the floor, L1's was not), "flat emissive wash on the mini", "neon
  floor discs", "glowing empty air". Six colours now all distinct ("Red / Fiery Orange-Red").
- Changed: the carve starts just over the base (the base's glow is the same kind at every level); flames as painted resin
  tongues (crisp edges, a deep shade of the colour at the edge to a pale core inside); a tight contact glow at the base's
  edge instead of a wide ring, a smaller pool; the figure lit on its edges and undersides only (no flat wash), the base's
  grey disc lit on its bevel and top; level 5 a little taller than 4. The stage clears the furniture (it hid two pawns).

## Ring icons (Codex built-in image_gen, $0; icons/)
- 10 pictures x 2 sets: Aura ▸, Aura up, Aura down, Aura off, six colour wisps (gold first; the other five EDITS of the gold
  painting, hue only; parchment = edits of the charcoal). First parchment batch refused: the generator takes at most five
  input images and the batch mixed two reference families (six refs): split by family, then all made.
- Gemini set match: charcoal 10/10 YES ("Each icon has a distinct hue ... every pair separates cleanly at a glance"),
  parchment 10/10 YES. Blind reads, charcoal (31 px, shuffled, no names): off "Clear/extinguish pawn aura or light effect
  (high)", up "Increase aura intensity or power up/buff pawn (medium)", down "Lower pawn or decrease/power down aura
  (medium)", the six "Set yellow/gold / red / purple / blue / green / white pawn aura (high)"; the list "Toggle
  spotlight/highlight on pawn (high)" (learned: on the ring it wears its name, Aura).

## Frame time (stage.py --perf --n 48: 48 figure pawns, every one with an aura, levels 1-5 in the six colours)
- render + gl.finish, median ms, two interleaved rounds: auras 13.6 / 16.7, none 17.9 / 15.0: no difference above the
  noise (other agents' work on the box). world.frame CPU 1.2-1.3 ms vs 1.0 (the instance rewrite). Draw calls: 3 for all
  48 auras (48 columns, 48 floors, 449 sparks and emblems).

## Gemini, round 3 (gemini/r3.txt; v3, the furniture cleared)
- L0 "already wears a yellow base ring" (the GM's own seat rim, not the aura: the stage now gives every pawn to the player,
  blue rims); L4 / L5 "straight-walled extruded cylinders ... repetitive vertical striping" (the noise cells were four
  times taller than wide); "neon coaster bases"; the emblem "faint, striated". Changed: isotropic flame noise, a ragged
  top; the near side carved from the floor; the figure's light climbs with the level (ankles at 1, lower body at 2, all of
  it from 3: its world height in the shader); the disc lit on its bevel only.

## Gemini, round 4 (gemini/r4.txt; v4) — "Better"
- "eliminates that corrugated banding"; the emblem "unmistakably clear". Night: "L0 -> L5 reads clearly step by step".
  Left: "sooty/dark alpha fringes" (light with cover over a dim edge), the emblem tilting back like a card in high views,
  ragged-less side edges. Changed: almost no cover (sparks and the emblem purely added light), an upright emblem (turned
  round the vertical only), a luminous silhouette emblem, a ragged silhouette.

## Gemini, round 5 (gemini/r5.txt; v5, every pawn the player's)
- "Day & Low views: Yes, L0 -> L5 reads as a clear step-by-step increase"; colours all six distinct ("Crimson / warm
  scarlet red"). Left: haze in front of the figure, the neon ring, the emblem "split by the dark vertical wall seam".
  Changed: the near side never drawn below the crown (the light rises behind and beside the figure); a softer, dimmer
  contact glow; the emblem covers half of what is behind it (no seam through its face), denser.
- Not changed, for Harry: in DARKNESS the fog-of-war pass dims the column's top where the wall behind it is unseen (the
  aura writes no depth; it sheds no light in the darkness rules either). Whether an aura should light the dark (like a
  carried light) is a rules question.

## The ring-fade pixel check (browser_aura A9)
- First version compared one shot with and one without: flaky (another seat's cursor or a toast passing under a button
  read as aura). Now two interleaved pairs, the per-pixel smaller difference, against a control with no aura change.
  Debugged with a per-part hold (tubes / floors / sprites / the figure's own light): no part leaks under a button.

## Gemini, rounds 6 and 7 (gemini/r6.txt, r7.txt) — "Slightly better" each, a plateau
- r6: the emblem "much cleaner ... a clean, bright golden sun-face"; six colours "unmistakably distinct in every view";
  first person (fpv-own-aura.png, her own level-4 aura): "No. The player pawn's own level-4 aura is cleanly suppressed in
  first-person view - there is no screen wash". Left: "neon hula-hoops" outside the base, L2 vs L3 (the full carve hid
  L3's flame in front of the figure). Changed: no ring outside the base above level 1 (a pool from the base's edge, the
  base's top lit), level 3 taller (1.6 figure heights).
- r7: "Mostly [clearly increasing], except between L1 and L2"; "L0->L1, L2->L3, L3->L4, and L4->L5 are all easy to tell
  apart". Its verdict through every round: "a standard game VFX / MMO buff shader, not a painted-miniature (OSL) effect":
  it wants no light in the air at all, which the brief's level 4 ("a tall column of light ... readable across the table")
  rules out; what could move toward it has (the figure and base lit, the column behind the figure, nothing white).
- Changed for r8: level 1's ring dimmer, level 2's figure light stronger and higher (lower body, 3 ft) and a ring of its
  own; levels 4 and 5 taper into ribbons (no straight walls).

## Gemini, round 8 (gemini/r8.txt) — "The same"; reverted in part
- The wider wobble folded the shell into "harsh geometric creases" and silver-white's added light read orange over the
  wood. Kept: level 1 and 2's separation; reverted: the column's wobble and taper (back to round 7); silver-white covers
  a third of what is behind it (added white alone takes the floor's colour).

## Frame time, final (a quieter box: 48 pawns, every one with an aura)
- render + gl.finish, median ms: auras 8.1 / 7.5, none 7.1 / 7.2: about +0.5 to 1 ms GPU for 48 auras. world.frame CPU
  0.9-1.2 vs 0.6 ms. Draw calls: 3 for all 48 (48 columns, 48 floors, 523 sparks and emblems).

## Gemini, round 9 (gemini/r9.txt; the landed look) — "Slightly better"
- "the progression from L0 to L5 reads as clearly increasing overall in both day and night"; "all six read clearly as six
  distinct colours in both day and night"; the emblem "clearly visible in all views ... a golden sun-in-splendour".
  Hardest pairs: L1 vs L2 at table distance on warm wood, L4 vs L5 from high up. Still its verdict: "a cheap game effect
  (a classic additive scrolling-noise cylinder ...)": it asks again for no light in the air. Open for Harry: whether the
  tall column (the brief's level 4) should give way to light only on the figure, the base and the floor.
