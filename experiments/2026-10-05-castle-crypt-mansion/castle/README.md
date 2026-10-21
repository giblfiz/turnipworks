# Castle type (2026-10-05): design and spec

Designer's deliverable for the castle half of the castle-crypt-mansion batch. Nothing here has been generated: this folder
holds the spec only. Brief: `../DESIGN_BRIEF.md`.

    python3 build_spec.py     # assets.json + prompts/: 122 new meshes (prompts, gate text, sizes, prio, rooms, bench, hung, light)
    python3 build_rooms.py    # rooms.json: 9 rooms; `reuse` and `new` are computed from the recipes, the library and assets.json
    flats.json                # 3 floors + 9 flat cards / rugs / decals
    ../../../catalog/objects-castle.catalog.md, rooms-castle.md   # 11 new catalog lines, 10 new recipes; catalog_tool.py is clean

## Rooms

| key | focal | reads from above by | wall family | closest program |
|---|---|---|---|---|
| great-hall | fireplace-grand, table-feast on the dais | hooded fireplace, high table across the top end, trestle rows | dressed-stone | common |
| throne-room | throne on the dais | throne, red runner from the door, mirrored avenue of pillars / braziers / armour | dressed-stone | desk (axial focal) |
| armoury | weapon-rack x3 shapes, armor-stand x3 | racks along every wall, ranks of armour stands | castle-rough | store |
| barracks (guard room folded in) | bunk-bed rows + mil-footlocker | bunk rows with a locker each, guard table by the door | castle-rough | bedroom (dormitory branch) |
| castle-kitchen | cook-hearth-spit--great, cauldron-crane | 11-ft hearth with spit, cauldron on its crane, long work tables | castle-rough | kitchen (industrial branch) |
| chapel | altar-stone on dais--s2, pew rows | altar on a step, pews facing it, stained glass | dressed-stone | desk (axial focal) + aisle rows |
| dungeon | cell-bars cells, rack-torture, iron-maiden | row of barred cells, the rack in the open floor | castle-rough | stable (cells are stalls) |
| gatehouse | portcullis, windlass | portcullis arch, clear passage, windlass and guard kit | castle-rough | hallway (passageway) |
| courtyard (OUTDOOR) | well, training-dummy, archery-target | battlemented wall with turrets and a gate, well, training corner | castle-rough edge | outdoors |

Nine rooms, one over the brief's "6-8": eight indoor rooms plus the courtyard, which is the yard grammar with a different
edge and no plants. Dropped from Harry's list: the guard room (it is the door zone of the barracks and the side bands of the
gatehouse) and the lord's chamber (the mansion's master bedroom and the existing `nob-bedchamber` recipe with `bed-canopy`
already cover it, at no new mesh). If one must go, the barracks reads least distinctly from above (it is a dormitory).

Layout rules, counts, what hangs and what is a light: `rooms.json` -> each room's `program`.

## Wall styles and doors

- **dressed-stone (exists)** suits the fine rooms: neat coursed blue-grey ashlar with thin joints (judged from its prompt
  and the catalog, not by eye: no vision pass was run). Reused as it is for great hall, throne room and chapel, plus ONE new
  panel painted from its accepted plate: `window-stained-glass--dressed-stone` (no blue glass: the chroma key).
- **castle-rough (new)**: `wall-straight--castle-rough`, `--s2`, `wall-window-small--castle-rough` (the ARROW SLIT, filed
  under the role `wall-window-small` so the wall engine picks it as the family's window with no new code; no open twin),
  `wall-doorway--castle-rough`. No corner pieces, as with log-cabin.
- **Dungeon kit**: `cell-bars` (5-ft bar panel), `door-cell-bars` (5-ft bar panel with a barred door in it, so cell fronts
  are panels end to end) and `door-cell-bars-open`. Both roles existed (DUN); neither had a mesh.
- **Gate**: `portcullis--castle-rough` is a gate ARCH panel TWO cells wide with the grille down; `portcullis-raised--castle-rough`
  is its open twin (only the spiked foot shows in the arch head). `gate-double-timber` is a leaf pair for the courtyard.
- **Courtyard edge**: `city-wall--castle-rough` (battlemented curtain wall section, 11 ft) and `city-wall-turret--castle-rough`.
  These are ground-standing; the roof-level battlement is the vertical kit's `wall-crenellated--dressed-stone`, not repeated here.
- **Doors**: `door-double-grand--leaf` exists and fits hall, throne room and chapel. `door-reinforced` had only framed skus,
  so `door-reinforced--leaf` is specified (rotates, no twin needed); it fits both families' doorways.

## Counts (122 new meshes; budget about 135)

| prio | independent | from a parent plate | total |
|---|---|---|---|
| 1 focal + wall kit | p1 20 | sib1 14 | 34 |
| 2 furniture | p2 50 | sib2 1 | 51 |
| 3 smalls, variants | p3 37 | 0 | 37 |

Shape variants: armor-stand x3, weapon-rack x3, pew x3, wall x2, throne x2, dais x2, table-feast x2, training-dummy x2,
archery-target x2, heraldic-shield x2, banner-pole x2. Large-scale variant skus of roles that already have a mesh:
`cook-hearth-spit--great`, `chandelier-ring--great`, `table-kitchen-prep--great`, `chair-armed--high-seat`.

## Reuse

168 existing library roles are named by the nine rooms' recipes (96 of them in the kitchen, which adds only 14 new pieces,
most of them shared with other rooms). Lights are all reused except the large ones: torch-bracket-rough / -fine,
torch-sconce, torch-stand, brazier-tripod, fire-basket-stand, cresset-wall, chandelier-ring, candelabra, candle-tree,
candlestick-floor, sconce-candle-triple, lantern-wall-iron, lantern-hanging. Also bunk-bed (2), bench-long (5),
table-trestle (4), table-square, chair-armed, cot, bread-oven, cook-hearth-spit, well, horse-trough-stone, shield-display,
trophy-head, chest-ironbound, sword-long, pillar-square.

From the other designers, not duplicated: `altar-stone`, `reliquary`, `bones-pile`, `skull-pile`, `chest-treasure`,
`brazier-standing--crypt` (crypt); floors `floor-tile-encaustic` (mansion) and `floor-tomb-slabs` (crypt); stairs, parapets,
`wall-crenellated`, buttress, corbel, gargoyle (vertical). The chapel's generic religious ids specified HERE, for the crypt to
reference: `pew`, `lectern`, `font-holy`, `prayer-candle-rack`, `candelabra-standing--iron`, `chalice-altar`, `tome-holy`,
`rite-altar-emblem-stand`, `rite-kneeler-cushion`.

## Bench items (Harry, Alignment Bench)

- **hinge (4):** `door-cell-bars-open`, `portcullis-raised--castle-rough` (a vertical slide: the twin's arch must sit on the
  closed mesh's arch), `iron-maiden-open`, `mil-footlocker-open`. Leaf-only doors (`door-reinforced--leaf`,
  `gate-double-timber`) need a hinge edge like the existing leaves.
- **fire (13):** fireplace-grand, cook-hearth-spit--great, cauldron-crane, pig-on-spit (fireplace); brazier-large,
  brazier-irons, mil-signal-beacon, mil-boiling-oil-pot (brazier); chandelier-ring--great (chandelier); prayer-candle-rack,
  candelabra-standing--iron (candle); mil-guard-lantern, watch-lantern-bell (lantern). All generated UNLIT.
- **water:** none.

## For the integration agent

- **HUNG_IDS**: ten new wall-hung ids, most deeper than isHung's 8-in test: heraldic-shield, mil-crossbow-rack,
  smith-helm-row-shelf, mil-helmet-peg-rack, manacles-wall, cell-bench-plank (mount 18 in), lever-wall, horn-hunting,
  mil-duty-roster (`rooms.json` -> `hung_ids_to_add`). Ceiling-hung: chandelier-ring--great, trade-butcher-hooks-rail.
- **Stacking**: the dais carries the throne, the high table and its chairs, or the altar: its top is a floor 16 in (8 in for
  `--s2`) above the room's.
- **Two-cell gate panel**: `portcullis--castle-rough` is 120 in wide, the catalog line says 60: treat it as `door-barn-double` is treated.
- **`city-wall` at courtyard scale**: the spec size is 60x30x132, the catalog line (a 25-ft town wall) is outside that range.
- **Size overrides** live in `assets.json` `size`, as in the yard batch.
- Cross-setting recipes: the chapel and dungeon rooms take `tem-` and `dun-` recipes, so no setting tag was added to any existing line.

## Risks (what the generator may struggle with)

- **Bars and lattices**: `cell-bars`, `door-cell-bars` (+open), the portcullis grille, `cage-floor` (routed `hunyuan-mv`:
  a hollow see-through box of bars). All asked for wrist-thick; fallback is fewer, thicker bars.
- **Chains**: `manacles-wall`, `cell-bench-plank`, `shackles-leg`, `chandelier-ring--great`, `windlass`: short and fat.
- **Thin shafts**: `mil-spear-tripod`, `weapon-rack--s2` (polearms; a plank back board fills the rack), `ballista`, `banner-pole` (cloth as one slab).
- **Hollow open twins**: `iron-maiden-open` (re-route `hunyuan-mv` if TRELLIS closes the cavity).
- **Big plain stone**: `dais`, `fireplace-grand`, `cook-hearth-spit--great`, `city-wall`, `pillar-round`: every prompt asks for
  relief, separate blocks and colour variation. The dais is low and flat: it may need the steep camera its prompt asks for.
- **Proportions**: `table-feast` (14 ft x 3 ft) and `tourney-lists-rail` are very long and thin in plan; `portcullis` is wider than tall.
- **"No people"**: armour stands, training dummies and the iron maiden are figure-shaped; gates say empty, no face, no skin.
- **Parents in p groups**: `door-cell-bars` and `portcullis--castle-rough` are NOT painted from `cell-bars` / the wall plate,
  because each is the parent of its own open twin; their prompts repeat the construction text instead. Check the match by eye.

## Not decided

- Nine rooms or eight (see above).
- Whether the arrow slit should also exist under the role `wall-arrow-slit` (the catalog has both roles; one mesh, filed under `wall-window-small`).
- `chest-treasure`: the crypt's sku is the OPEN, coin-heaped chest; a closed twin is not specified by either batch.
