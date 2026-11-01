# 2026-10-29 · The Build library PiP, cleaned up (branch `piplib`)

Harry, 2026-10-29: "For the PiP layout... The wall /door count is fine, but they don't need their own sections by type.
The objects feel sparse somehow, are we missing stuff? Some of the objects are not rotated in sensable ways. Also seems
like, for instance, we should have all those faction objects anywhere they come up.. I guess that's part of 'sparse
objects' just seems like stuff is missing."

## Diagnosis (before any change; `diag.mjs`, `diag-before.json` / `.txt`: run in a worktree at origin/main 23e894d8, against the true-size spawn index)

What a room type's rules can put down was measured, not read off the recipes: every one of the 147 room types solved 48
times in the browser's own room engine (`engine/tools/library_spawns.mjs`: its usual size, 1.5x, a square smaller, 2x;
48 seeds; two of them with a faction), plus its recipe slots and sets. Against what its shelf listed:

- **677 things missing on 136 of 147 room types' shelves.** Why:
  - 534: **the shelf was its recipe slots only.** The solver programs put down far more than the slots name: their own
    lights, tableware, rugs, the dragon's hoard (lair-dragon 14 missing: strongbox stack, both treasure chests, mimic
    chest, skull pile ...), the kitchen's whole table service (19), the great hall's feast (10 + an armour stand).
  - 59: **kit pieces with no shelf, not placeable by hand at all** (58 kinds): the common room's bar counter, the
    crypt's niche wall and doors, stained glass, the stable's stalls, glazed / panelled / tower doors, parapets,
    battlements, a porch, bridges, trapdoors ... (`HAND_KIT` was the only route to a shelf or the bar).
  - 56: open states (an open chest, a door swung open): shown closed, correctly. But 11 things whose names end in
    "-open" are NOT open states (an open book, open flour / grain / potato sacks, an open helm, `pit-open`): the
    "-open" filter left them off every shelf and out of the command bar. Fixed (`isOpenState`).
  - 22: rated out (no usable sku: a crown, a pig on a spit). Left out on purpose.
  - no cap per shelf existed.
- **Variants collapsed:** one sku per thing. The plain chair has a common and a fine look; the bar counter four pieces;
  only the first was shown.
- **Faction pieces:** only the 19 room types with `flavors` showed them (all 112, mixed into Dressing, sorted by size).
  The great hall, throne room and castle passage hang `banner-wall`, a faction mark (core/factions.js) that the
  faction picker re-dresses: no faction banners on their shelves.
- **Walls:** 17 wall-family sections per library (85-96 kit pieces) plus 49 floors: ~145 of a 160-340-thing library.
  A crypt passage had 16 things of its own.
- **Overview:** the library opened framing everything: the common room (128 x 108 ft) from 177 ft, labels 4 px.

## Rotation (Gemini, labels first, `gemini/base-common-rot.txt`)

The layout rule laid each thing whichever way showed the biggest silhouette from above (`library.js` cellOf): every
stair on its side ("you cannot see the steps ... looks like a collapsed pile of lumber"), chairs and stools on their
sides ("tavern debris after a brawl"), barrels and kegs on their bellies, tankards, jugs, candles tipped ("a fire
hazard fallen on a table"), wall lanterns and the reflector sconce on their sides ("you see the side bracket rather than
the front"), the chimney stack, bartizan, cistern, posts lying down. Right: tableware and food upright, wall sconces and
shelves face up, doors / walls / fences on their backs face up. So the layer was the shelf's layout, not the catalog's
facing (fronts that lay face up faced up) and not the in-world placement (drag-out was always upright).

## What changed

- `engine/tools/library_spawns.mjs` -> `engine/client/data/library-spawns.json`: what each room type's rules put down
  (48 solves, 41 s on 6 cores). main.js loads it; taxonomy.js puts it on the shelves (slot: the one most recipes give
  it, else light / dressing / furniture by what it is). The node test solves 4 rooms again and fails on a stale index.
- `library-index.js`: `ROOM_KIT` (32 edge / post pieces, placed like walls and doors, routed to the rooms that use
  them, else to their types' rooms), `KIT_THINGS` (16 pieces placed as things: bar counter, bridges, porch, trapdoor,
  roof ridge ...), `isOpenState`, every LOOK of a thing (`looksOf`: one sku per look, not per re-generation),
  `factionSections` (a section per faction where 3+ slots come up; one "Faction pieces" section where only banners do),
  `kitSections` -> Walls / Doors & windows / Stairs, each label naming its family, the room's own family first, an
  identical sku shown once (it was shown in two family sections), `poseOf` (things lie as they are placed).
- `taxonomy.js`: spawns, faction slots (flavour rooms, spawned flavor-*, `banner-wall` -> the banners), room kit routing,
  a room with < 10 things of its own (the cave) gets its types' other rooms' things.
- `library.js`: groups packed in order (the room's things first, top left), labels 0.6 ft under a 3-ft thing (were
  0.4), section heads 1.1 ft, the opening view as far out as keeps a label 11 px (whole layout when it fits),
  `frameAll()`, a standing thing drawn no taller than 1.15 x 3 ft (its footprint smaller), poseOf.
- `modes.js`: the parapet's and battlement's corner blocks and the curtain-wall turret snap like posts.
- `assets.js`: the bar offers ROOM_KIT and KIT_THINGS; isOpenState.

## The second read (Gemini, `gemini/D1-rot.txt`, the placement rule with the game's 45-degree lens)

Right: tables, chairs, benches, the bar counter's pieces, barrels, crates, altars, coffins and effigies upright; fireplaces,
shelves, notice board, sconces and torch brackets face up; labels legible at the opening size ("Fireplace wall · common",
"Altar stone · marble", "Stone coffin lidless" read out). Wrong: the bar stool, an armed chair, pillars, candelabra,
candle stands, a brazier "tipped onto its side", wall lanterns "in side elevation". The drawn mesh boxes (`lib_stills.py`
PROBE_CATS) say all of these stand: the stool 2.69 x 3.45 x 2.61 ft, the pillar 1.24 x 3.45 x 1.24. It was the lens:
with 45 degrees, from 25 ft, a 3.45-ft thing 10 ft off the middle shows its whole side (its top drawn 0.5 of a cell
from its foot). The library's PiP lens is now 15 degrees (distances x 3.15): the worst lean in the common room's
opening view 0.18 of a cell (browser_smalls).

## The third read (`gemini/E1-rot.txt`, the 15-degree lens)

Right now: every table, chair, stool, bench, pew, throne, the bar counter's four pieces, altars, coffins, effigies,
crates, barrels, standing lights (candlesticks, candelabra, candle trees, braziers, chandeliers), "Architectural pillars
(Pillar round, Pillar square)"; wall sconces, torch brackets, shelves, fireplaces, cask rack, confessional, organ face up.
Labels at the opening size: "Fireplace wall · common", "Table square", "Cask rack"; "Altar stone · marble",
"Confessional", "Organ pipe"; "Stone coffin lidless", "Sarcophagus", "Effigy knight" read out. Still wrong: the notice
board upright ("seen edge-on ... a thin horizontal line"), the black square pillar on its back ("inconsistent" with the
other pillars: it is 4.4 times taller than wide, over the 4 of TALL_LIES), the pierced-tin wall lantern on its back
("its side silhouette like a knocked-over prop"), the armour stand upright ("an ambiguous, dark clump"). Fixed: a PANEL
(depth <= 0.45 of the smaller of width and height: notice boards, screens, signs, shields on their rims) lies face up;
TALL_LIES 4 -> 6 (pillars stand); a wall lantern hangs upright. Left: the armour stand (not a panel, not a pole).

## Rounds 2b and 4 (`gemini/E2-rot.txt`: wizard's lab, general store, mine face with the lens; `gemini/F1-rot.txt`: the final rule)

E2: right: counters, prep tables, the alchemy bench, stools, open containers, wheelbarrow, mine cart, rubble, the still,
apothecary drawers and shop shelves face up, the formula chalkboard, the mine tool rack; labels read ("Alch cauldron
bubbling green", "Wheelbarrow", "Mine tool rack"). Wrong: the tall reagent shelf upright (now a PANEL, face up), a large
specimen jar upright (wants it on its side: left; nothing lies on its side).
F1 (final rule): right: every table, chair, stool, bench, the bar counter's pieces, shop signs, fireplaces, the notice
board (now face up), cask rack, every wall lantern and sconce but one, tableware, coffins, candelabra, candle trees.
Flagged: the brass reflector sconce "ON ITS SIDE" (the tin one, beside it, face up); a hanging (ceiling) lantern upright
("a featureless pyramid cap"); the balance scales "on its back" (the data says it stands: 1.33 x 0.97 x 0.56, upright:
a misread); square pillars upright "featureless squares" (E1 called the same pillars right: the plan-view trade-off).
The brass sconce: its box on the shelf is as designed (on its back, 1.33 x 1.98 x 3 ft drawn); its sku carries a -90
degree facing correction (orient.json) that the tin one does not, and the shelf turns it with the same yaw the world
does, so if it reads side-on here it probably faces along the wall in the world too. Not changed (in-world facing,
orient.json): a lead.

## Numbers, before -> after (`diag-before.txt`, `diag-after.txt`)

All 147: things on shelves 8,265 -> 10,165; library items 29,135 -> 30,282; missing 677 -> 29 (22 rated out, 7 open
states whose closed twin is on the shelf: effectively 0). Kit kinds placeable by nobody 58 -> 0 (the open item said 68 on 10-25; 10 were added on 10-27)
(119 / 119 placeable kit kinds on a shelf and in the bar).

| room | things | kit (sections) | total | missing | faction pieces |
|---|---|---|---|---|---|
| common | 206 -> 232 | 85 (17) -> 88 (3) | 340 -> 369 | 5 -> 1 | 0 |
| kitchen | 125 -> 157 | 85 (17) -> 88 (3) | 259 -> 294 | 19 -> 0 | 0 |
| great-hall | 78 -> 118 | 84 (17) -> 95 (3) | 211 -> 262 | 13 -> 2 | 0 -> 13 |
| throne-room | 37 -> 61 | 84 (17) -> 95 (3) | 170 -> 205 | 3 -> 2 | 0 -> 13 |
| temple-nave | 139 -> 156 | 96 (17) -> 90 (3) | 284 -> 295 | 8 -> 0 | 112 (by faction) |
| crypt-vault | 34 -> 39 | 96 (17) -> 87 (3) | 179 -> 175 | 4 -> 3 | 0 |
| wiz-lab | 33 -> 53 | 95 (17) -> 87 (3) | 177 -> 189 | 7 -> 0 | 0 |
| mkt-general | 54 -> 95 | 95 (17) -> 90 (3) | 198 -> 234 | 5 -> 0 | 0 |
| min-face | 29 -> 34 | 96 (17) -> 86 (3) | 174 -> 169 | 2 -> 0 | 0 |
| lair-dragon | 19 -> 27 | 96 (17) -> 86 (3) | 164 -> 162 | 14 -> 3 | 0 |
| cave | 11 -> 279 | 96 (17) -> 86 (3) | 156 -> 414 | 1 -> 0 | 0 |

(Kit counts drop by up to 10 where a piece's one sku had been shown in two family sections: the same piece, once now.)

## Frame time (`lib_stills.py` PERF=1, 1400 x 900, local, box load ~30, 240 frames, ms median / p95)

| library | opening view | framed whole, meshes in | PiP closed |
|---|---|---|---|
| common, base (340) | 16.7 / 16.8 | 16.7 / 33.3 | 16.7 / 16.8 |
| common, new (369) | 16.7 / 16.8 | 16.7 / 16.8 | 16.7 / 16.7 |
| temple nave, base (284) / new (295) | 16.7 / 33.3 ; 16.7 / 16.8 | 16.7 / 33.4 ; 16.7 / 33.4 | 16.7 |
| cave, base (156) | 16.7 / 16.8 | 16.7 / 16.7 | 16.7 |
| cave, new, 469 things, all looks | 16.7 / 16.8 | **33.3 / 50** | 16.7 |
| cave, new, 414 (borrowed shelves: recipe things, one look) | 16.7 / 16.8 | 33.3 / 50, then 16.7 / 49.9 | 16.7 |
| cave, new, 414, labels under 3.5 px not drawn | 16.7 / 16.7 | **16.7 / 16.8**, 16.7 / 33.4 | 16.7 |

A full library framed whole is ~550 label planes (one draw call and one canvas texture each); hidden when they would be
under 3.5 px, the section heads stay. Progressive loading unchanged: at the opening view 24-43 of 169-369 things have
their mesh url; the rest arrive as the camera comes near.

## Runs

- (2026-10-29 08:0x) A first spawn sample solved rooms 5x too big (I passed feet; solve takes squares): killed, the tool
  fixed, re-run at true sizes. The diagnosis above is against the true-size index.
- Gemini queue: ~19 agy-run calls from other agents waiting on /tmp/agy.lock; a read takes 30-60 min to come back.
