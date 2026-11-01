# Conditions on the table (status effects) — lab notes (2026-10-29)

Branch `statusfx`, worktree <repo> Dev only. Harry 2026-10-29: "we never did visual
status effects"; "missing status effects that come over can just be a text label". Built to Harry's own design of
2026-10-15 (docs/design/conditions-2026-10-15.md; now docs/PAWNS.md "Conditions on the table"): no icon badges, "big
cartoony, easy to follow". The brief first asked for badges; the coordinator corrected it to the 10-15 design mid-task.

## 07:05 — reading
- Conditions were already stored as words (`conditions: [...]`, core/pawn.js CONDITIONS, ten words) and the relay already
  allowed any string of 24 or fewer (token.set check; token.create had no check at all). Shown as a sub-line under the
  floating name label (world.js refreshTokenLabel) and as words in the Pawns menu rows.
- Beyond20's conditionsAfter dropped any D&D Beyond word TW lacked (deafened, incapacitated, paralyzed, petrified,
  exhaustion). UpdateConditions carries exhaustion as its 4th argument.
- The ring already has painted condition pictures (experiments/2026-10-15-ring-icons): reserved for the ring by design.

## 07:20 — art (Codex image_gen, four workers in parallel, $0)
- BRIEF-a..d.md, art-spec.json (one house style line + one subject line each), run_art.sh. 16 pictures, all first try
  except base-runes (3) and base-drain (3: near-black corners) and plate-label (3:1 canvas). LOG-a..d.md.
- pack_atlas.py (packaging only: crop to alpha, centre, resize; drain white -> alpha) -> main checkout
  engine/client/data/icons/status/{sprites,decals,plate}.png + status.json (git-ignored like every picture). The drain
  ring's six gaps measured from its own alpha: offset -2 degrees.

## 07:40 — built
- core/conditions.js: normCondition / cleanConditions (markup and control characters out, TW spellings, "exhaustion N",
  24 characters, 12 words), conditionsProblem (the relay's SHAPE check, on token.set and token.create), statusOf (the
  looks), DDB_WORDS. core/pawn.js CONDITIONS gains paralyzed, incapacitated, dead, concentrating.
- Beyond20: conditionsAfter keeps every word; D&D Beyond is the truth for its own words and exhaustion's level.
- client/statusfx.js: three instanced draws per world (orbiter atlas, text-plate canvas atlas, floor decals); poses and
  body looks in place. world.js: conditions no longer under the name; label and indicator lifted clear of the ring; the
  indicator over the head when there is no label (it was left at the feet).
- Ring: Conditions ▸ now 14 words + exhaustion +1 (and −1 while exhausted) + one tile per text label on the selection
  ("✓ Hexed", a press takes it off) + "Other…" (fills the bar with "condition "). Bar: "condition Hexed", "remove
  condition Hexed", "exhaustion 3", "exhaustion 0", "clear all conditions".
- GET: llm.js cleans a token.set/token.create condition list before the check; card and /conditions say any short text
  is allowed. (The GM card hit the 1000-word test limit at 1002: the line was shortened.)

## Tests
- engine/test/conditions.test.mjs (in npm test): 52/52. Corpus: 276 pawns, 26 with conditions, none the new check refuses.
- npm test green (core 743, beyond20 46, conditions 52, relay 206, llm 111, ...).
- browser_statusfx.py --local: first run 16/18 (prone box too tall: the box of a turned bounding box; hover on the ring
  centre caught a passing orbiter) -> fixed: the lying figure's box from its vertices; hover over the selected figure
  names the whole list.

## 08:30 — Gemini, round 1 (agy-run; labels first; gemini/r1, stills shots/v1-*)
- Named every orbiter right: "Pink Hearts: Charmed ... Yellow Stars: Stunned (the classic Looney Tunes convention) ...
  Lime-Green Skull & Crossbones: Poisoned ... Lavender Sheet Ghost: Frightened ... Eyeball with Black Diagonal Slash:
  Blinded ... Tan/Orange Grabbing Hand: Grappled ... Brass Padlock with Chain: Restrained ... Electric-Blue Lightning
  Bolt: Paralyzed ... Drifting Sky-Blue Z Z Z: Unconscious". Shape and colour separation "A+"; stacking "clean and
  disciplined"; dead "completely unmistakable"; prone vs unconscious from straight above "relies entirely on the Z's".
- Fixed from it: text plates "too small at table distance" (textH 0.5 -> 0.72, 38 px bold); the drain ring "hugs the rim
  ... almost impossible to count" (1.13 -> 1.42 of the base radius, on the floor); the exhaustion-6 skull on the floor
  was hidden by a door frame (now on the head ring); the "dark" still was the GM's (the GM sees through darkness): the
  stage now shoots darkness from a player's tab.
- Not mine: the room's floating "Common room" name label covers heads at head height. Style: "intentionally loud,
  bright comic-book stickers ... ergonomically effective ... clash with the gritty tavern" (the design asked for loud).

## 08:55 — pick from stills (gemini/pick: x = ghost / crossed eye / green skull, y = "!!" / storm cloud / green bubbles)
- Frightened: ghost, 92%: "the purple cartoon ghost immediately communicates supernatural fright ... red exclamation
  marks read like a generic video game alert". Blinded: crossed eye, 98%: "the universal visual shorthand for impaired
  vision ... a dark raincloud suggests an environmental weather spell". Poisoned: skull, 75%: "the unmistakable,
  universal visual archetype for poison"; BUT its biggest confusion risk is that skull beside exhaustion 6's white skull
  ("may conflate Poisoned with dying"); "green bubbles completely avoids this collision". Kept the skull (its pick);
  `STATUS.picks.poisoned = 'poisoned-bubbles'` is the one-line change. For Harry.

## Frame time (stage.py --perf --n 48: 48 figure pawns, 32 with conditions = 64 orbiter + 24 word + 12 floor instances)
- fx render + gl.finish per frame, median ms, three interleaved rounds on a busy box (other agents' suites running):
  branch 26.7 / 19.6 / 26.3; main (same pawns, conditions as label text) 33.1 / 19.0 / 27.7; no conditions 15.5 / 22.8 /
  26.6. No difference above the noise. world.frame CPU: branch 1.2-1.5 ms vs main 1.0-1.3 (the instance rewrite, ~0.2 ms).
  Draw calls for every condition on the table: 3 (main drew one label sprite per pawn with conditions).

## 09:40 — before landing
- Rebased on main (Attack-always-there landed: one conflict in relay/llm-card.js, both lines kept; its Attack line put the
  GM card at 1018 words, so the conditions line now points at /conditions instead of listing the words).
- Local, after the rebase: npm test green (core 743, beyond20 49, conditions 52, relay 206, llm 111, gamedice 178, ...);
  browser_statusfx 18/18, browser_pawnring 108/108, browser_beyond20 29/29, browser_turns 55/55.
- Gemini round 2 (the fixes, a player's darkness): the first ask (7 stills) timed out at agy's 15 min; split into r2a
  (far + dark) and r2b (invisible). The agy queue is an hour deep with other agents: landing first, reading after.

## 09:50 — landed on DEV
- main c5320596, client 20261029094949, release candidate 20261029-095005-c5320596 (dev only; prod untouched). The
  landing pruned the sharing work's candidate 20261029-093757-5e1ae7ae (this one contains its commits).
- On dev (http://127.0.0.1:8180/, GET on the dev relay 8098): browser_statusfx 18/18, browser_beyond20 29/29,
  browser_pawnring 106/108. The two failures are NOT this work: Share's Export… and Share link… (47fdf321 / 10889e14,
  landed just before) joined a PAWN's ☰ ('share.export', 'share.link'), and pawnring checks the pawn ☰ is exactly the
  five entries of 2026-10-11. Locally before that rebase: 108/108.

## 10:40 — Gemini round 2 (r2a: far + a player's darkness; r2b: invisible)
- r2a: plates "Barely readable. At table distance, the small ... font on dark wood is low-contrast"; the drain ring "Not
  countable" (it read the base rims as the rings); in darkness the pictures "ignore scene lighting (full daytime
  brightness)" and "leak on top of the fog". Checked: the pawns whose pictures showed over the fog are pawns the player
  SEES (her own, and ones in her darkvision); they are drawn over the fog exactly as their name labels and indicators
  already are (world.js sightPawns overlays). A pawn out of sight draws nothing: browser_statusfx S10b (fog of war, a
  goblin out of sight: no instances). One still was the loading screen (the stage waited too little; now 15 s).
- r2b: the GM-hidden Lurker "reads clearly as GM-hidden ... a flat, plain translucent purple silhouette"; but Mira (glass)
  and the goblin (shimmer) "read as ghosts or spirits rather than invisible ... bright, frosted, shimmering white
  outlines", and in the player's view the goblin "looks like a visible ghost". Overlap: "the icons noticeably overlap
  each other ... they do not overlap the figure's name".
- Changed: the shimmer for others is now a faint edge ripple (alpha 0.16 f^3, was 0.03 + 0.32 f); glass keeps the paint
  (mixed 25% toward pale cyan at the edges, alpha 0.3-0.77) instead of a white glow; the ring's half-height 0.013 ->
  0.021 and its lift 0.012 -> 0.018 so the near and far orbiters clear each other. browser_statusfx 19/19 (+S10b).

## 11:20 — landed again (candidate 20261029-111729-a981e154; client 20261029111712); Gemini round 3 (gemini/r3)
- On dev: browser_statusfx 19/19.
- Invisible: "In b [the player], Goblin 1 presents as an almost completely empty base with a faint edge shimmer, which
  successfully reads as 'something invisible stands here' rather than a ghost or spirit. Mira reads as invisible glass
  (owner view)"; GM view: "Mira and Goblin 1 read as glass/invisible; Lurker reads as GM-hidden".
- Overlap: "No. The orbiters are vertically lifted and spaced cleanly without overlapping each other".
- Far plates: "The wooden plates (+3, Hexed, Blessed) are legible."
- STILL OPEN (for Harry; taste): in darkness the pictures and plates are "wrongly bright ... like 2D UI billboards" (as
  the name labels already are: readable, not lit); the drain ring's lit segments are "not countable at table distance"
  (its pawn also had the rune circle round it; Harry chose the plain ring, "just 1, keep it simple": a number on it, or
  the segments on the head ring, would be the next step).

## 14:30 — Harry on dev; the ring fix and the heights (branch condring, worktree 3d-vtt-condring)
- Harry: "why are you drawing the indicators under the indicator buttons on the orbital menu? This looks like a bug maybe?
  very bad look. ... I DO like how the indicators hover overhead when placed, but they probably shouldn't be quite so
  high." Not circling the head "is ok"; the rune circle loved: both left alone.
- Reproduced on dev (house ring = the charcoal painted set; Gemini, stills before deciding): every ☰ ▸ Indicators button
  held TWO pictures, the set's painting (img.paint, prepended by ring.js paint()) and the indicator's own (img.pic), the
  second "sticks out directly below the button", "spilling onto the inner Attack button". Locally (line icons) it was
  clean. Also: a neighbour's orbiter "partially occluded by Fewer options" (orbiters are on the canvas under the page's
  buttons; painted buttons have clear corners), and the indicator "3.5 to 4 head-heights above the crown".
- Fixed: paint() leaves a button with its own picture (img.pic) unpainted; statusfx fades any orbiter / plate / Z /
  indicator whose screen box would reach a ring button (app.ringMask: the laid-out buttons as circles, open panels as
  boxes; the instance's place computed on the CPU as the vertex shader does; 10 px fade). The stack over the head:
  STATUS.clear / fig / gap / markClear (?statuslift= to compare); label and indicator stand on the ring's top.
- Heights, Gemini (gemini/g3, three stills at table distance): clear -0.010 + fig 0.03 picked, 99%: "-0.021/0 ... condition
  icons, text plates, and indicators severely collide with and obscure the figures' faces"; "0.002/0.05 floats excessively
  high ... losing clear visual association". After the fix: "Yes, perfectly clean ... no figure condition/indicator
  clipped by or drawn under a ring button".
- Seen, not mine: the Conditions arc's buttons show initials (CH, FR...) with the painted set, not the painted badges
  (paint() skips .ini, and the 14 condition words share one line icon): for the ring-icons work.
- browser_statusfx +S15 (no picture's box under any ring button in four ring states; 3-4 faded each), +S15b (one picture
  per Indicator button), +S16 (the band). Local: npm test green; statusfx 22/22, pawnring 108/108, turnhandle 26/26,
  fpv 53/53, pawnbase 44/44.
