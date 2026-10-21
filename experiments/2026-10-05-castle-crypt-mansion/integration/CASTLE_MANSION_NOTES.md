# Castle and mansion: what differs from the crypt path

For the integrator of the castle and the mansion (round 2, 2026-10-05 evening). The checklist is `PLAN.md`; this file is
only what is different. Room-by-room detail and every design problem: `castle_notes.md`, `mansion_notes.md`.
I = this folder, B = its parent, T = `tools/spawn-tuner`.

## State of the drafts

Run together in `sandbox/all` (scope `once,crypt,castle,mansion`; the real tree, which now holds the crypt, plus fake
meshes at spec size for everything not yet made):

| suite | result |
|---|---|
| `tests/castle.test.mjs` | 1,152 indoor rooms, 192 courtyards, 12 whole castles, 126 annex legs: 617,544 checks, 0 failures |
| `tests/mansion.test.mjs` | 1,152 indoor rooms, 192 gardens, 12 whole mansions, 126 annex legs: 566,793 checks, 0 failures |
| `tests/crypt.test.mjs` on the same tree | 0 failures |
| `tests/golden.mjs sandbox/pristine sandbox/all` (the inn unchanged) | 348 scenes, 0 differ |
| the tuner's `yard`, `solver2` (760 rooms), `solver` tests | 0 failures |
| `apply.py --tree T --scope once,crypt,castle,mansion --check` (tree as of 19:10) | 42 hunks would apply cleanly |

## 1. Scope and order

- Castle: `--scope once,crypt,castle`. Mansion: `--scope once,crypt,castle,mansion` (the mansion uses castle roles:
  armour stands, silver; and the shared chapel helper). Hunks already in the tree are skipped; appended blocks are
  replaced whole, so **a correction the crypt integrator made by hand inside a `>>> ccm:` block in the tree is
  overwritten unless it is also in `hunks/` or `programs/`**. Diff the tree's blocks against the drafts first:
  `python3 apply.py … --check` does not show that; `git diff` after applying does.
- `sandbox/pristine` is the tree BEFORE the crypt went in. The working tree cannot produce that reference any more.
  For the castle, the golden reference is: every room type that exists at that moment, crypt included. Make it from
  the committed tree before applying: `git stash` is forbidden (other agents' work), so use
  `git worktree add /tmp/tw-ref HEAD` and point `golden.mjs` at `/tmp/tw-ref/tools/spawn-tuner` (it needs only `js/`
  and `data/`), or copy `T/js` and `T/data` aside by hand just before `apply.py`. `golden.mjs` compares every type the
  FIRST tree knows, so with a post-crypt reference it also proves the crypt does not change.

## 2. Hunks the crypt did not need

| hunk | file | what |
|---|---|---|
| `solver2.outdoor.castle` / `.mansion` | `T/js/solver2.js`, `attempt()` | one replaced line: `finish(ctx, (KEY[key] \|\| yard)(ctx), args)`. An outdoor type with a `KEY` entry runs its own grammar; the inn's yard has none and is unchanged. The other agent edits `attempt()` three lines below: check the anchor on the day. |
| `walls.castle`, `walls.mansion` | `T/js/walls.js` (appended) | roles, `castle-rough` / `noble-panel` / `noble-paper` / `conservatory`, wide doors (`SPANS`), `DOORS` with leaf names, stained-glass `PANELS` |
| `solver.castle`, `solver.mansion` | `T/js/solver.js` (appended) | HUNG_IDS (four castle roles, `mirror-pier-gilt`) |
| `fire.castle`, `fire-anchors.castle` | `T/js/fx/fire.js`, `T/prep/fire_anchors.py` | cresset → torch; beacon, oil pot, fire basket, cauldron crane, pig on spit → brazier |
| `html.walls.*`, `fog.*` | `T/index.html`, `T/data/fog_defaults.json` | Walls select options; dungeon 2 ft, wine cellar 2.5 ft of fog |

Engine edits (the crypt had none), both in `build_types_patch.py`:

- `engine/client/pack.js` `APART`: add `courtyard`, `gatehouse`, `mansion-garden`, `mansion-cellar`,
  `mansion-conservatory` (and `crypt-catacomb` if the crypt integrator did not). Without it a dragged Castle packs its
  courtyard as an indoor cell. `pack.js` is in the other agent's folder; it was unmodified at 17:50.
- optional: `engine/tools/build_types.py` label `'NOB': 'Manor'` → `'Mansion'`.

## 3. The 19 room icons

The tray shows `engine/client/data/icons/room-<room key>.png`, and `engine/test/browser_build.py` (ICONS) fails for a room
without one. The keys are NOT prefixed alike. The flats agent is painting them into `B/flats/icons/`; at 19:10 it held
the 7 crypt icons and `type-CRY.png` only. Names wanted, exactly:

- castle (9): `room-great-hall.png`, `room-throne-room.png`, `room-armoury.png`, `room-barracks.png`,
  `room-castle-kitchen.png`, `room-chapel.png`, `room-dungeon.png`, `room-gatehouse.png`, `room-courtyard.png`
- mansion (10): `room-mansion-hall.png`, `room-mansion-drawing.png`, `room-mansion-dining.png`,
  `room-mansion-library.png`, `room-mansion-bedroom.png`, `room-mansion-ballroom.png`,
  `room-mansion-conservatory.png`, `room-mansion-garden.png`, `room-mansion-kitchen.png`, `room-mansion-cellar.png`

`python3 I/build_types_patch.py --check tools/spawn-tuner` lists every room with `icon ok` or the missing file name.
A file named for the label instead of the key (`room-entrance-hall.png`) is the likely slip.

## 4. The Build tray

- `chapel` and `dungeon` now carry `cas-castle-chapel` / `cas-castle-dungeon` (added to `catalog/rooms-castle.md` in
  round 2; two or three CAS-tagged roles each, `catalog_tool.py` clean), so they list under Castle. They ALSO list
  under Temple & chapel and Dungeon & prison through their `tem-` / `dun-` recipes, as do the barracks and gatehouse
  under Dungeon (`dun-guard-room`). That is the catalog's "symlink"; say so if it is not wanted.
- The castle kitchen and the mansion's kitchen and cellar read the inn's `tav-` recipes as `borrow` (slots only), so
  they do not appear under Tavern & inn and the inn's building tool never packs them.
- `browser_build.py`: the CRYPT block in `build_types_patch.py` is the model; castle expects 9 rooms under `t:CAS`,
  mansion 10 under `t:NOB`.

## 5. Default sizes changed from the designers' (in `gen_room_types.py` CELLS)

| room | was | now | why |
|---|---|---|---|
| great-hall | 8×5 | 10×6 | 8×5 held 1–2 trestles and a dais in 60% of halls |
| barracks | 6×4 | 7×5 | 6×4 held about 8 bunks with lockers on one wall, not 12 |
| mansion-hall | 5×5 | 5×6 | `stair-grand` is 10×15 ft; the stair now stands in 16 of 24 default halls (the other 8 have a door in the facing wall) |
| mansion-conservatory | 5×3 | 5×4 | the centre fountain needs 17 ft across |

Not changed: the ballroom (8×6 leaves 50–55% of the floor empty against the asked 60%), and the crypt's two
(chapel 4×7, embalming 4×4: recommended to the crypt integrator, whose hunk it is).

## 6. Sizes the mesh agent must write: `manifest_overrides.<type>.json`

Drafts are `I/manifest_overrides.castle.json` and `I/manifest_overrides.mansion.json` (make_manifest.py's format).
**Copy each to `B/<type>/manifest_overrides.json` before `make_manifest.py`** (merge with what the mesh QA writes there
for kit boxes). They only set the shipped size; no plate needs repainting.

| piece | spec | cap | reason |
|---|---|---|---|
| `dais` | 110 × 170 × 16 | **170 × 110 × 16** | the long side must run along the wall: a 14-ft `table-feast` stands on it. The program reads the mesh's box and lays the long side to the wall either way; with the turned box the solver's own rule turns the mesh. Chosen over two dais sections side by side (a seam under the lord's chair). `dais--s2` (110 square) stays for the throne and the chapel altar. |
| `banner-pole--s1/s2` | 110 in tall | 104 | props scale by their largest side; anything catalogued at or over the 108-in wall overtops it |
| `pillar-round` | 120 | 104 | the same |
| `fireplace-marble`, `--s2` | 108 | 104 | the same |
| `bookcase-ladder` | 108 | 104 | the same |

Left tall on purpose: `stair-grand` (120 in: it must reach the next storey; the mansion test lets it through by name),
and the outdoor pieces `city-wall` (132), `city-wall-turret`, `gate-double-timber`, `mil-signal-beacon`.
`pillar-square` (120, an inn-era mesh) and the crypt's `ossuary-pillar` (108) have the same fault and are not in these
files: the first is live, the second is the crypt's.
One-storey rooms are the rule today; `docs/VERTICAL.md` makes a great hall a tall room later, and these caps are in the
manifest, not the mesh, so they can be lifted then without regenerating anything.

Also for the mansion spec (`B/mansion/assets.json`): give `tier: fine` to `urn-decorative--porcelain`,
`urn-decorative--floor-vase`, `pedestal-display--marble`, `candelabra-standing--s1`, `candelabra-standing--s2`. Without
it they are plain variants that mix into crypt and castle rooms of the same role. `washstand--state` (renamed by the
supervisor) no longer clashes with the inn's `washstand--fine`.

## 7. The two outdoor rooms have their own grammar

Both are role `outdoor` (no walls, ground for a floor, neighbours' doors open onto them, the gate from `walls.js`),
and neither calls into `yard()`: each lays its own edge from the gate opening's open segments, with rule `yard-edge`
so the density and the tests treat the pieces as they treat a yard's fence.

- **Courtyard** (`castleCourtyard`): a bailey. Curtain wall always (`city-wall` on every open grid edge,
  `city-wall-turret` where a run ends or turns, `portcullis` at the gate); a well or stone trough in the open; the
  door-to-gate ways kept clear; from 900 sq ft a training corner (dummies, pell, archery butts against the wall with
  a clear range, weapon and waster racks, arrow barrels); sentry box, brazier or beacon and banner poles by the gate;
  stone blocks, catapult stones, grindstone, stocks at the wall. No inn sign, picnic table, kennel, plants.
  Not built: the sand patch (`floor-sand-training` as a ground strip), tourney rails, the quintain.
- **Formal garden** (`mansionGarden`): hedge always, with the arch at the gate; a main axis and a cross axis kept
  clear; fountain at the crossing (small fountain or sundial in a small garden), gazebo at the far end in big ones,
  everything else in mirrored pairs (topiary, parterres ringed with roses, statues, urns, benches facing the fountain,
  lamp posts at the gate, orange tubs by the house). 95.7% of off-axis things have a same-role partner across the axis.
  Limits: the gazebo appears in 38 of 192 gardens (the gate usually takes the far end of the axis); no balustrade
  (the house side has no edge segment to stand one on); the designer's 42-cell list does not fit 35×30 ft.
- Neither registers a `DENSITY` entry (each sets its own target, as `yard()` does): `test/yard.test.mjs` line 56
  compares the yard's 2 with every `DENSITY` value and would fail on an outdoor 2. The hall and ballroom targets are
  3.5 for the same test, not the designers' 3 and 2.5.
- In the game a yard keeps its layout until re-rolled; build the courtyard and the garden AFTER their buildings.
- `room_shots.py` builds each room alone: for these two, add a hall beside them by hand before the blind read, or the
  read is of an empty court.

## 8. Programs that differ in kind from the crypt's

- **Castle kitchen** wraps the inn's `KEY.kitchen` in its own function (not `PROGRAM_OF`): with the alias every cooking
  line rolled the 11-ft `cook-hearth-spit--great` and some kitchens had no hearth. The great hearth fits about 70% of
  kitchens (arrow slits break the wall runs).
- **Mansion kitchen and cellar** do use `PROGRAM_OF` (→ `kitchen`, `cellar`), with the bell board and the wine bins
  added by wrapping, so a change to the inn's kitchen or cellar program changes them too. That is intended.
- **Tiers.** Castle rooms carry `tiers: ['castle', 'ccm']`, mansion rooms `['noble', 'ccm']` and `wealth: 'fine'`.
  A program that wants the plain inn mesh says `sku: { tiers: [] }`; a named variant, `sku: { shape: 'high-seat' }`.
  Every placement of a role that has a noble mesh rolled it in the mansion test (8,942 of 8,942), and the inn's Fine
  guest room is in the golden test.
- **Hub rooms** (great hall, entrance hall, ballroom): `attempt()` walks a hub's loop after the key program; in 8 of
  144 furnished great halls it finds no way round. The test counts it and does not fail it; nothing a player walks is blocked.
- **Doors.** The oldest room's rule wins a shared door, so the conservatory's glazed door and the cellar's reinforced
  one lose to the hall's panelled door. A `rank` on a `DOORS` rule would fix it; `specialDoor` is scope `once`, in
  the tree now, so that is an edit for whoever holds `walls.js` next.

## 9. Sandbox notes

- `make_sandbox.py` does not read the override files. After building a sandbox, `python3 mansion_caps_sandbox.py`
  (the mansion fork's helper; it is hard-wired to `sandbox/mansion`) writes the mansion caps and tiers into the fake
  manifest; the castle test applies its caps to its own copy of the library (`--raw` runs without them).
- A sandbox copies the working tree. It now contains the crypt's REAL meshes and bounds beside fake castle and mansion
  ones. That already showed one thing fake meshes hid: the real funeral pall is 3.8 ft wide (spec 3.0) and its candles
  1.2–1.5 ft (spec 0.8), and in a crypt-only sandbox the default 4×5 crypt chapel then seats nobody in 3 of 8 seeds.
  Expect the same kind of drift for the castle chapel's pews and the dining table's chairs when their meshes arrive.
