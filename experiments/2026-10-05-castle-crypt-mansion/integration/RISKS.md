# Risks: what collides with the plan, and the order that avoids it

Written 2026-10-05, about 17:30–18:30 PDT. The other agent's work was read from `git diff` at 17:20 and again at 17:50;
it is moving, so step 3 of the checklist (`apply.py --check`) is the real test on the day.

## 1. The other agent's uncommitted hunks in the files we must touch

They are building **shaped rooms** (an L or U: `room.cells`, `outline`) and **turned rooms** (`room.turn`).

| file | their hunks (17:50) | ours | collision |
|---|---|---|---|
| `tools/spawn-tuner/js/walls.js` | `perimeter()` (cells, `line`); `chooseExteriorDoor` (turn, longest straight run); `yardDoors` key; 5 lines inside `computeEdges` (sides carry `line`; the openings push; the yard-openings push; the gate line) | 1 line at the top of `doorTypeFor`, 1 line before `// corners:` in `computeEdges`, 2 appended blocks | **None today, by construction.** My first panel hook sat directly under their gate line: `git diff -U0` made one mixed hunk of the two. It now has its own anchor (before the corners), clear of every line they have changed. If they edit the corners comment or the `doorTypeFor` signature, `apply.py` stops and says which anchor. |
| `tools/spawn-tuner/js/solver2.js` | `Ctx2` doors (`join`); `pickMainDoor` (a join is not a door); `attempt()`: `args.annex` skips the key program | 1 replaced line in `attempt()` two lines ABOVE theirs (`const type = args.type, key = …`), 2 appended blocks | **Adjacent, not overlapping**: two unchanged lines lie between, so `-U0` keeps them apart (tried: 0 mixed). If they touch the `const type = args.type, key = type.key;` line itself, the alias hunk fails its anchor; it is only needed for castle and mansion, and is trivial to re-seat. |
| | **Semantic collision: `args.annex`.** In the leg of an L-shaped room no key program runs; only `MENUS[key]` and the generic density fill. For a new type that fill would have dressed the leg from the recipe's slots, anchors included (a second altar, more sarcophagi against the wall). | `ccmAnnex()`: each new type gets one menu entry that runs only where the key program did not | Handled and tested against their current code (126 crypt legs: lit, no key piece repeated). It depends on the names `args.annex` and `MENUS`: if they rename either, the crypt test's annex section says so. |
| `tools/spawn-tuner/js/look.js` | `scatterSpecs` and `floorSpecs` (floor only the cells a shaped room stands on) | `cornerSpec` (1 line), `edgeSpecs` (1 + 2 lines) | None: different functions. |
| `engine/core/roomgen.js` | `shapedParts()`: a shaped room becomes rectangles, each with the openings of its own walls | nothing | **`room.panels` are in the whole room's coordinates.** A part gets `{ ...r, x, z, w, d }`, so it inherits `panels` with side/index of the bounding rectangle: in an L-shaped vault the program may keep tall things off the wrong stretch of wall, or not off the right one. Cosmetic, never a crash. The fix is theirs to make or to allow: map `room.panels` in `shapedParts` the way it maps openings (each has `key`). Ask after their commit. |
| `engine/client/*` (14 files modified, 2 new) | the build UI | `pack.js` APART (castle, mansion), icons (new files) | `pack.js`, `taxonomy.js`, `library.js` are not modified by them today. The crypt needs no engine edit at all. |
| `engine/test/core.test.mjs`, `browser_build.py`/`browser_ui.py` | +82 lines in core.test | one block per type | Append after the yard's block; stage by hunk. |
| `tools/spawn-tuner/test/accept.py` | one import line (the test sandbox) | the three `12 room types` counts → 19 | Different lines; stage by hunk, or wait for their commit. |
| `docs/STATUS.md`, `docs/UI.md`, `docs/VERTICAL.md`, `engine/LAB_NOTES.md` | open | a section each at the end | Write our notes in `tools/spawn-tuner/ROOMS.md`, `PLAN.md` and root `LAB_NOTES.md` (not open) first; add to STATUS.md by hunk or after they commit. |
| `tools/spawn-tuner/deploy.sh`, `engine/deploy.sh` | +2 lines each (the house-look warning) | nothing | None. |

**The order that never touches their hunks**

1. Best: integrate after their next commit. Then every file is clean and `git add` is enough.
2. If they are still open: `apply.py --check`; apply; test; `stage_hunks.py` for `walls.js`, `solver2.js`, `look.js`
   (and `accept.py`, `core.test.mjs`); `git add` by name for everything else; commit. Their hunks stay unstaged, intact.
3. Never `git stash`, `git checkout -- file`, `git commit -a` or a formatter on a file they have open.
4. Deploys ship the **working tree**, theirs included. Their half of `walls.js` is live the moment we deploy the tuner.
   Ask them first whether their tree passes its tests (`lane-post`), or deploy from a `git worktree` of our commit
   (the deploy scripts take their source from their own folder: `worktree/tools/spawn-tuner/deploy.sh` works, but
   the worktree needs the `assets/` folder too: check its size with `du` before choosing this).
5. Sandboxes copy the working tree too. `sandbox/pristine` must be made at the same moment as the integrated sandbox,
   or the golden test compares across their changes (today that still reads 0 differ: their changes do nothing to a
   plain rectangle).

## 2. Design problems found while solving (for the designers, while plates are still being made)

**Crypt** (all seven rooms solve: 1,008 rooms, 0 purpose fails; these are the places I had to depart from `rooms.json`)

1. **Chapel of rest, default 4×5 cells: no room for benches behind the bier.** Altar (1.5 + 3 ft) + 5–6 ft + bier
   7.5 ft + 4 ft + a bench row + 4 ft short of the door wall = 26 ft in a room 24 ft deep. By the stated clearances the
   default chapel has **zero** benches against the stated "4–6". The program now seats the mourners either side of the
   bier when two rows will not fit behind it (default room: 6 benches). Either accept that, or make the default 4×7
   like the castle chapel.
2. **Embalming room, default 4×3: zero slack.** Slab 2.8 ft + 3 ft clear each side + a 2.5-ft work table on one wall
   and coffins on the other = 13.8 of 14 ft, before heroic scale (the prep table mesh ships about 3 ft deep). In rooms
   under 17 ft across, the work line now stands on the end wall beyond the slab's head and the long walls take the
   coffins; a 3×3 room loses the table. Suggest default 4×4.
3. **The door cannot be made to face the altar.** `chooseExteriorDoor` picks the wall by seed, and the other agent is
   editing that function now. "Altar on the short wall opposite the door" is met when the door lands on a short wall;
   otherwise the program takes the short wall farther from the door and the door becomes a side porch. Same for the
   castle throne room and chapel. A door-side preference per room type is a three-line follow-up once that function is free.
4. **Special wall panels are thicker than the wall** (niches 24 in, ossuary wall 18 in, against 12). On a wall shared
   with another room the extra depth would stand in the neighbour's floor, so panels go on **outside walls only** and
   grow outward. A vault in the middle of a packed crypt shows fewer niches than the counts ask (4.9 a vault on average,
   6.4 a corridor). Also `look.js kitSpec()` stretches every kit piece to its **catalog** box and ignores the sku's own
   size: `tomb-door-sealed--crypt-stone` (spec 108 in tall, catalog line 96) will be squeezed to 96. Make the catalog
   line 60×12×108.
5. **Density lines overstate the count lines** in `rooms.json` by 1.4–2× (embalming "about 8 per 100 sq ft", but its own
   list for 12 cells is 15 things = 5.6; ossuary "about 6", list = 2.8). The programs follow the counts; the targets
   registered are antechamber 4, vault 4, ossuary 4, catacomb 3.5, chapel 5, embalming 5.5, relic 4.5.
   (Catacomb 3.5, not 3: `yard.test.mjs` asserts the yard's 2 is at most 0.6× of **every** indoor target.)
6. **Pillars overtop the wall.** `pillar-square` is catalogued 120 in and `ossuary-pillar` 108 in; props scale by their
   largest side with up to 15% variety, so they come out 9.9–10.2 ft in a 9-ft room. There is no ceiling to hit, but
   they stand above the wall tops. Give full-height pieces `scale: 1.0–1.0` and 104 in.
7. **Not placed, and why:** bone candelabrum on the shrine's "altar top" (the shrine is one 84-in mesh: no surface height
   to stand it on); two-high coffin stacks (single only, as the designer said); `tomb-slab` in the aisle floor (a 4–6 in
   mesh the solver would treat as an obstacle; the flat `decal-grave-ledger` is used instead); "neighbouring tombs must
   differ" (skus are rolled independently); "ossuary-wall s2 at most once per wall" (the look alternates versions A B A B).
8. **A whole crypt from the building tool** has five terminals and two passages. Terminals never open into each other,
   so over 12 seeds a seven-room crypt had 2.0 outside doors and 1.0 door "added so the room is reachable". It works;
   if a crypt should have exactly one way in, the vault or the chapel should be a hub.
9. `door-crypt` and `crypt-gate-iron` missing at integration: the door falls back to `door-plank` (look.js), not to
   `door-reinforced--dressed-stone` as the README hopes. Both are prio 1, so this should not arise.

**All three types**

10. **Sku names that already exist.** `washstand--fine` (mansion) is the name of a live inn mesh. `build_data.py` keys
    skus, runtime files (`assets/m/<sku>.glb`) and ratings by that name, so the mansion mesh would have overwritten the
    inn's. The batch block refuses and prints it; **rename the mansion's** (e.g. `washstand--fine--s2`) before its mesh is made.
11. **New variants of roles the inn already uses would have changed the inn.** With the whole batch in the library and
    no guard: a great `chandelier-ring`, an 11-ft `cook-hearth-spit--great`, `rug-runner--royal`, `chair-armed--high-seat`,
    `table-kitchen-prep--great`, `bed-canopy--state`, the `--t10` stairs, new rugs / paintings / drapes and the mansion's
    `tier: fine` furniture all join pools the inn rolls from. The batch block gives every such sku an exclusive tier
    (`castle`, `noble`, `storey`, `ccm`) and `chooseSku` rolls those only for room types that list them. Result:
    348 scenes of the 12 existing room types, 0 differ. The cost: a program that wants the plain inn mesh in a castle
    room says so (`sku: { tiers: [] }`), and one that wants a named variant says `sku: { shape: 'high-seat' }`.
12. **Door leaves.** `look.js` hung the first leaf-only sku of a door role. `door-double-grand--fine-leaf` (mansion)
    sorts before the inn's `door-double-grand--leaf` and would have become every grand door in the game;
    `door-reinforced--leaf` (castle) would have become the inn's cellar and storeroom door (it has no leaf today).
    Now a role's plain `leaf` hangs unless the room type asks (`DOORS[key].leaf`), and a second leaf for a role the inn
    already hangs is renamed `<type>-leaf` in the library. If the castle leaf SHOULD replace the inn's framed
    reinforced door (it would look better: the leaf fills the opening), that is a decision for the supervisor, not a default.
13. **`make_manifest.py` reads the first `--` part of any kit sku as a wall family**: `door-crypt--leaf` → family
    `leaf`, `stair-straight--…--t10`, `portcullis--castle-rough--raised` and the like. The batch block moves anything that
    is not a known wall family back into `shape`. Better fixed at the source (the tooling agent), but harmless as is.
14. **Tray membership is by recipe prefix.** Castle `chapel` (all `tem-`) and `dungeon` (all `dun-`) have no `cas-`
    recipe: they will be listed under Temple & chapel and Dungeon & prison, **not under Castle**. Add a `cas-` recipe
    for each to `catalog/rooms-castle.md`. The other way round, the castle kitchen and the mansion's kitchen and cellar
    name `tav-` recipes: they would have appeared under Tavern & inn and been packed into inns by the building tool;
    `room_types.py` moves those to `borrow` (read for their slots only).
15. **The tuner's palette** shows every room type as a button with a hotkey from a list of 12. With 38 types the 13th
    onward showed `undefined`. Fixed (`main.palette-keys`: no key, a heading per type); the palette is three rows taller.
16. **Tests that count room types**: `accept.py` A1 / A14 / A20b say 12. `yard.test.mjs` line 56 compares the yard's
    target with every other `DENSITY` entry: an outdoor courtyard or garden at 2, or the ballroom at the designer's 2.5,
    fails it. The filter should be "indoor types only" and the ballroom needs a decision (3.5 keeps the test as it is).
17. **`fog_defaults.json`** already had `crypt: 3` and `vault: 2.5`, but fog is keyed by room type key, and ours are
    `crypt-vault`, … The crypt hunk adds its seven keys (vault, ossuary and catacomb 3 ft; relic 2.5; antechamber and
    chapel 1.5; embalming 0). That is my guess at Harry's taste, not a decision of his.

## 3. Things that only the real meshes will show

- Which way long tombs face. The programs treat local +Z as the foot of a sarcophagus, coffin, slab or bier
  (catalog boxes 3 × 7 ft, long side as depth). A mesh modelled across is caught by the box rule in the front sweep;
  a mesh modelled head-for-foot is not, and nobody will notice.
- Whether a niche panel has real recesses (designer's risk 3) and where its room face sits after `kit_fix`: the look
  hunk assumes the piece is centred in its catalog box and shifts it outward by half the extra depth.
- Fake bounds are the spec's box scaled so the largest side is 1.0. Real TRELLIS meshes of thin things come out
  stouter; the 0.5-ft grid ate the margins twice in the sandbox (candles beside a bier, benches beside an aisle).
  Expect a handful of "no room at its spot" placements to shift; the node test will say which rooms lost a piece.
- The three.js side: the `look.js` hunks parse and were never rendered.

## 4. Castle and mansion

See `castle_notes.md` and `mansion_notes.md` (written by the two forks) for their rooms, their design problems and
what `yard()` would need for the courtyard and the formal garden. Their summaries are at the end of this file.

## 5. All three together (run 18:20, `sandbox/all`, scope `once,crypt,castle,mansion`, fake meshes for all 374 specs)

| suite | result |
|---|---|
| `tests/crypt.test.mjs` | 1,008 rooms + 126 annex legs + 12 whole crypts: 139,846 checks, 0 failures |
| `tests/castle.test.mjs` | 1,152 rooms + 64 courtyards + 126 legs + 12 castles: 534,147 checks, 0 failures |
| `tests/mansion.test.mjs` | 1,152 rooms + 40 gardens + 126 legs + 12 mansions: 519,568 checks, 0 failures |
| `tests/golden.mjs` (the inn unchanged) | 348 scenes, 0 differ |
| the tuner's `yard`, `solver2` (760 rooms), `solver`, `repeat`, `wall_items`, `v2_fuzz` | 0 failures |
| `apply.py --check` on today's real tree | 40 hunks in 11 files would apply cleanly |

**Castle** (details: `castle_notes.md`)

- `dais` (110 w × 170 d) is narrower than the `table-feast` it carries (168): laid turned a quarter. Swap w and d in the catalog line; `dais--s2` (110 square) carries no feast table at all.
- Default great hall 8×5: 1–2 trestles, not two rows; a dais in 60% of halls. Default barracks 6×4: about 8 bunks, not 12 (7×5 would hold the brief's list).
- `banner-pole` (110 in) and `pillar-round` (120 in) overtop the 108-in wall; poles cannot stand on the dais.
- The 11-ft great hearth fits 70% of kitchens (arrow slits break the wall runs); the rest get the inn's hearth.
- `chapel` and `dungeon` have no `cas-` recipe: listed under Temple and Dungeon, not Castle. `armoury` recipes name two roles with no catalog line.
- The courtyard solves, as an INN yard (well, fence or hedge, woodpile, kennel). The curtain wall, the training corner and "no plants" need hunks inside `yard()`: listed in the notes, not drafted, and `yard()` is in the file the other agent has open.
- Counted, not failed: the hub loop `attempt()` walks after furnishing is blocked in 9 of 144 great halls.

**Mansion** (details: `mansion_notes.md`)

- `washstand--fine` clashes with a live inn sku (item 10 above).
- `stair-grand` is 10×15 ft and 10 ft tall, not 2×2 cells: the hall must be 5 cells deep for it.
- `fireplace-marble` and `bookcase-ladder` are 108 in: wall height, they overtop it with scale variety.
- Ballroom 8×6: 50–55% of the floor empty, not 60%. Its target and the hall's are 3.5, not 2.5 and 3 (the yard test).
- Conservatory 5×3 is too narrow for the fountain (it appears from 17 ft across). Dining chairs cannot tuck under the table. Books cover 40% of the library's wall, not 50–70%.
- `urn-decorative--porcelain`, `pedestal-display--marble`, `candelabra-standing` have no tier: they mix with the crypt's and castle's meshes of the same role. Give them `tier: fine` in the spec.
- The formal garden solves as an inn yard too: no fountain axis, no symmetry. Same `yard()` dependency as the courtyard.
- Every placement of a role that has a noble mesh rolled it (8,339 of 8,339).

**Still open in the shared drafts** (asked for by the forks, not done): a rank in `specialDoor` (the conservatory's
glazed door should beat the hall's panelled one on a shared wall); a sku wish on `ccmFocalOn`, `chapel()`'s dais,
`ctx.rug` and `ctx.ceiling` (worked round locally in both files); `seatFor` sizes by the catalog line, so the short
`pew--s3` is never chosen. Done: the leaf rule now tests the role alone, so the castle's `door-reinforced--leaf` no
longer becomes the inn's reinforced door; `ccmAt` takes `sku`.

**Icons**: the 7 crypt room icons exist in `B/flats/icons/`. None of the 19 castle and mansion room icons do yet
(`room-great-hall.png` … `room-mansion-cellar.png`); the engine's ICONS test fails without them.
