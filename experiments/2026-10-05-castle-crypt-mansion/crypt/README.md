# Crypt type (2026-10-05): design and spec

The crypt designer's delivery for the castle / crypt / mansion batch (`../DESIGN_BRIEF.md`). **Design only: nothing here has
been generated and no money was spent.** The crypt ships first as the pipeline pilot, so the prio-1 set is conservative:
chunky stone and wood, a wall kit, tombs.

    python3 build_spec.py     # assets.json + prompts/<sku>.spec.md  (76 new meshes; asserts every object is in the catalog with a size)
    python3 build_rooms.py    # rooms.json + flats.json              (checks ids against the catalog, the library and assets.json)
    python3 ../../../src/catalog_tool.py                             # clean (no WARN, no ERROR) as of this delivery

Catalog files: `catalog/objects-crypt.catalog.md` (16 new lines: 12 meshes, 4 flats) and `catalog/rooms-crypt.md`
(`cry-shell` + 7 room recipes). 22 existing lines got `CRY` added to their `set:` by `catalog_tool.py --fix-tags` (the
reused lights, shelving, jars, chests, pew, lectern): a minimal edit, nothing else on those lines changed.

## Rooms

| key | label | cells | focal (in order) | reads from above as | closest program |
|---|---|---|---|---|---|
| `crypt-antechamber` | Antechamber | 4x3 | statue-weeping-angel, monument-urn-draped | mourning statue on the far wall between two braziers, stone benches along the sides, iron gate | desk (axial focal) |
| `crypt-vault` | Burial vault | 5x4 | sarcophagus, effigy-knight, stone-coffin-lidless | sarcophagi in the middle (one, or rows), niche panels on the long walls, candle stands at the corners | bedroom, then aisle rows from 25 cells |
| `crypt-ossuary` | Ossuary | 4x4 | ossuary-shrine, skull-pile | bone shrine on the far wall, skull-faced walls and pillars, bone troughs | store |
| `crypt-catacomb` | Catacomb corridor | 6x2 | wall-crypt-niches, catacomb-shelf-bones | both long walls lined with burial niches, torches between | hallway |
| `crypt-chapel` | Chapel of rest | 4x5 | altar-stone, rite-funeral-pall, rite-funeral-bier | altar on the short wall, pall-draped coffin on a bier with four corner candles, bench rows | none fits: a small new `chapel` program (shareable with the castle chapel); `common` is nearest |
| `crypt-embalming` | Embalming room | 4x3 | embalming-table, rite-corpse-on-slab | stone slab in the centre, salt tub, jar shelves, coffins waiting | kitchen |
| `crypt-relic` | Relic chamber | 3x3 | reliquary-shrine, pedestal-display, sarcophagus | gold reliquary shrine between two fire bowls, open chest of gold in the corner | desk (axial focal) + store edge fill |

Layout rules, counts by room size, what hangs and what lights are in `rooms.json` (`program` per room; `wall_kit`,
`hung_ids`, `ceiling_ids`, `lights` at the top). Each room also carries a computed `coverage` block: which of its recipe
roles already have a mesh, which this batch adds, which stay missing.

## Wall style: family `crypt-stone`

Dark, damp, dressed slate-grey stone. No windows. `wall-straight--crypt-stone` is the parent plate (group `p1`); the rest of
the kit is painted from it:
`--s2`, `wall-doorway--crypt-stone`, `wall-crypt-niches--crypt-stone` (empty) / `--s2` (wrapped bodies) / `--s3` (bones),
`ossuary-wall--crypt-stone` / `--s2` (arched urn niche), `tomb-door-sealed--crypt-stone` (a blind panel that looks like a
sealed door). Special panels REPLACE a plain panel on a wall edge; they are 18-24 in thick, so keep the room face flush and
let the extra depth go outward.

**Doors.** No existing leaf is right as the default: `door-reinforced--dressed-stone` carries its own pale stone frame. Two
new leaves: `door-crypt--leaf` (new role `door-crypt`: black oak, three iron straps) as the default door, and
`crypt-gate-iron` (existing role; a leaf of six thick bars with a solid kick plate) as a room's main door. Until they are
accepted, `door-reinforced--dressed-stone` is the fallback. **Corners:** none specified; borrow dressed-stone through
`FAMILY_FALLBACK`, the way log-cabin borrows rough-timber.

## New meshes: 76

By prio: **23 / 32 / 21** (prio 1 / 2 / 3). By group: p1 14, sib1 9, p2 24, sib2 8, p3 21. Run order p1, sib1, p2, sib2, p3.
Every sibling's parent is in `p1` or `p2` (asserted in `build_spec.py`); the `sib2` pieces whose parent is a p1 plate
(`sarcophagus--s3`, `sarcophagus-open--s1--lidoff`, `coffin--s2`, three wall panels) only need that p1 plate accepted.

**Prio 1** (23):
- `p1`: `wall-straight--crypt-stone`, `crypt-gate-iron`, `door-crypt--leaf`, `sarcophagus--s1`, `coffin--s1`, `statue-weeping-angel`, `monument-urn-draped`, `altar-stone`, `rite-funeral-pall`, `embalming-table`, `ossuary-shrine`, `reliquary-shrine`, `chest-treasure`, `skull-pile--s1`
- `sib1`: `wall-straight--crypt-stone--s2`, `wall-doorway--crypt-stone`, `wall-crypt-niches--crypt-stone`, `wall-crypt-niches--crypt-stone--s2`, `ossuary-wall--crypt-stone`, `sarcophagus--s2`, `sarcophagus-open--s1`, `coffin-open--s1`, `rite-corpse-on-slab`

**Prio 2** (32):
- `p2`: `effigy-knight`, `stone-coffin-lidless`, `tomb-slab`, `rite-funeral-bier`, `pedestal-display`, `bones-pile`, `catacomb-shelf-bones--s1`, `ossuary-pillar`, `charnel-trough`, `burial-urn-niche`, `urn-decorative--s1`, `rite-mummified-remains`, `bench-stone--s1`, `rite-pillar-candle-tall--s1`, `rite-memorial-sand-tray`, `rite-sacred-flame-bowl`, `brazier-standing--crypt`, `censer-hanging`, `rite-sanctuary-lamp`, `rite-canopic-jars-set`, `natron-tub`, `coin-pile`, `rite-grave-goods-pile`, `reliquary`
- `sib2`: `wall-crypt-niches--crypt-stone--s3`, `ossuary-wall--crypt-stone--s2`, `tomb-door-sealed--crypt-stone`, `sarcophagus--s3`, `sarcophagus-open--s1--lidoff`, `coffin--s2`, `catacomb-shelf-bones--s2`, `bench-stone--s2`

**Prio 3** (21):
- `p3`: `coffin-maker-stack`, `skull-pile--s2`, `urn-decorative--s2`, `rite-pillar-candle-tall--s2`, `candle-drippings-mound`, `skull-candle`, `rite-bone-candelabra`, `rite-offering-candles-tray`, `rite-canopic-jar--s1`, `rite-canopic-jar--s2`, `rite-embalming-tools`, `rite-burial-shroud-folded`, `linen-wrappings-basket`, `rite-death-mask`, `rite-memorial-plaque--s1`, `rite-memorial-plaque--s2`, `reliquary-hand`, `rite-relic-bone-fragment`, `urn-ashes-small`, `skull-single`, `casket-ornate`

Shape variants of the most-repeated pieces: sarcophagus x3, wall-crypt-niches x3, plain wall x2, ossuary-wall x2, coffin
x2, skull-pile x2, catacomb-shelf-bones x2, bench-stone x2, urn-decorative x2, rite-pillar-candle-tall x2, rite-canopic-jar
x2, rite-memorial-plaque x2.

**Open twins (3):** `sarcophagus-open--s1` (lid slid aside) and `sarcophagus-open--s1--lidoff` (lid leaning against the
side) are both twins of `sarcophagus--s1`; `coffin-open--s1` is the twin of `coffin--s1`. The s2 / s3 sarcophagi and the
s2 coffin have NO twin in this batch: a twin is painted from its own closed plate, and those closed plates are themselves
siblings, which the brief does not allow as parents. So the vault only ever opens the s1 design. If the pilot goes well,
their twins are a three-piece follow-up once their plates exist.

## Flags for the solver and later stages

- **Wall-hung** (`"hung": true`): `burial-urn-niche` (16 in deep, so `isHung` will NOT catch it by size: add to `HUNG_IDS`),
  `rite-death-mask`, `rite-memorial-plaque` (both pass the size test). **Ceiling-hung:** `censer-hanging`, `rite-sanctuary-lamp`.
- **Stands against a wall, not hung:** `ossuary-shrine`, `catacomb-shelf-bones` (place `wall`, deep and tall).
- **Lights** (all specified UNLIT): candle = `rite-pillar-candle-tall` (x2), `rite-memorial-sand-tray`,
  `candle-drippings-mound`, `skull-candle`, `rite-bone-candelabra`, `rite-offering-candles-tray`; brazier =
  `brazier-standing--crypt`, `rite-sacred-flame-bowl`; lantern = `rite-sanctuary-lamp`. The candles on `ossuary-shrine`
  are painted unlit and it is not flagged as a light.
- **Bench items (Harry on the Alignment Bench):** hinge = `crypt-gate-iron`, `door-crypt--leaf`, and the three open twins
  (pair alignment with their closed mesh); fire = the ten lights above.

## Reuse (30 library roles, no new mesh)

Lights: torch-sconce, torch-bracket-rough, torch-stand, brazier-tripod, candlestand-pricket, candle-tree,
candlestick-floor, candelabra, candlestick, candle, sconce-candle-single, lantern-hanging, lantern-wall-iron.
Structure and furniture: pillar-square, table-kitchen-prep, shelving-freestanding, shelf-wall, washstand, basin-stone.
Containers and smalls: chest-ironbound, chest-plain, coin-stack, bucket, bucket-slop, jar-lidded-stoneware, storage-jar,
oil-jar, vase-flowers, flowers-dried. Flat: decal-cobweb. Floors that already exist: floor-flagstone-damp, -broken, -large,
-square, floor-earth-packed, floor-checker-stone, floor-tile-kitchen-small.

The library had almost nothing funerary: of the 159 roles tagged CRY before today, 6 had a mesh (two torches, a gatepost,
garlic, dried flowers, a pumpkin). So this batch is mostly existing catalog lines getting their first mesh.

## Flats wanted (`flats.json`): 6

Two floors: `floor-tomb-slabs` (new: dark worn paving with carved grave ledgers) and `floor-bone-strewn` (existing line,
first image: grave earth with bones pressed in). Four others: `decal-bones-scatter` (new, 3 shapes: loose bones are flat on
purpose), `decal-grave-ledger` (new, 2 shapes), `decal-moss` (existing line), `rite-altar-cloth` (existing line).

## Risks

1. **Carved figures against the "no people" rule.** `statue-weeping-angel`, `effigy-knight`, and the wrapped bodies
   (`wall-crypt-niches--crypt-stone--s2`, `stone-coffin-lidless`, `rite-mummified-remains`, `rite-corpse-on-slab`) are
   stone carvings or fully covered bundles, and the prompts say so, but an image model may refuse or a gate may read
   "a person". `monument-urn-draped` is the figure-free antechamber focal so that room does not depend on the angel; the
   empty `embalming-table` and the empty niche panel cover the other two rooms.
2. **Open tombs are hollow.** `sarcophagus-open--*` and `coffin-open--s1` need a real cavity. Inn-02 got open chests
   through TRELLIS with a three-quarter view into the hollow, and these follow that recipe (`route: trellis`). If the
   cavity comes back filled, `hunyuan-mv` is the retry.
3. **Niche panels.** Three deep recesses in a 2-ft wall: TRELLIS may flatten them into painted panels or punch them
   through. The gate text demands "recesses", not a depth; measure the mesh.
4. **Bars and chains.** `crypt-gate-iron` (six thick bars over a solid kick plate), `censer-hanging` (three chain rods
   drawn nearly touching; `route_note` gives the single-rod fallback), `rite-sanctuary-lamp` (one thick link rod).
5. **Big plain stone.** Walls, sarcophagi, altar, embalming table, monument and benches all ask for relief and colour
   variation, because big blank masses come back partly unpainted.
6. **Bone textures.** Every bone piece is specified as ONE packed mass like a relief. The risk is the reverse of thinness:
   mush at table distance. Rows of big skulls are the readable element in each.
7. **Tall thin pieces scale by largest dimension.** `ossuary-pillar` (24x24x108) and the wall panels will be scaled on
   height; check their widths after scaling.
8. **Palette.** The house style template names "blue-gray stone" while the chroma key forbids blue on the object. The
   crypt prompts say dark slate-grey with a green cast and "never bright blue"; watch the first wall plate for keying holes.

## Not decided here

- **Shared existing roles the castle or mansion designers may also specify** (same role, possibly the same sku name):
  `altar-stone`, `chest-treasure`, `coin-pile`, `pedestal-display`, `urn-decorative`, `brazier-standing`, `reliquary`,
  `casket-ornate`, `skull-single`, `statue-weeping-angel`. Checked at delivery: no clash with mansion or vertical catalog
  ids; castle had not written its files yet. `pew`, `lectern` and `statue-deity` are in the chapel recipe but deliberately
  NOT specified here (the castle chapel is the natural owner); the crypt chapel seats on `bench-stone` until they exist.
- **Catalog priority versus batch prio.** `bench-stone`, `charnel-trough` and `ossuary-pillar` are P1 in the catalog only
  because the validator wants three P1 options in each slot of a P1 room; in the batch they are prio 2.
- **A chapel program.** Whether to write one (recommended, shared with the castle) or bend `common`.
- **No graveyard.** An outdoor graveyard room (`cry-graveyard` exists as a recipe) was left out: 7 indoor rooms used the
  budget, and gravestones, iron fence and mausoleum would be another 12-15 meshes.
