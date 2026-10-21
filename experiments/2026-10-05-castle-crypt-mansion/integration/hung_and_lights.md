# Hung things and lights: what to register, per type

Taken from the `hung` / `light` fields of the four `assets.json` files and checked against the code that reads them
(2026-10-05). Draft only; the lines below are already in `hunks/` and are applied by `apply.py`.

## 1. HUNG_IDS (`tools/spawn-tuner/js/solver.js`)

`isHung(o, id)` is true for a catalog `place: wall` role when the role is in `HUNG_IDS`, **or** it is at most 8 in deep
and 48 in tall. So only the roles the size test misses need a line. `HUNG_IDS` is a module-level `Set`: the lines go in
a block appended at the end of `solver.js` (`hunks/solver_tail.<type>.js`), nothing inside the file changes.

| type | role | box W×D×H (in) | caught by size? | action |
|---|---|---|---|---|
| crypt | `burial-urn-niche` | 24×16×30 | no (16 deep) | **`HUNG_IDS.add('burial-urn-niche')`** |
| crypt | `rite-death-mask` | 8×4×10 | yes | none |
| crypt | `rite-memorial-plaque` (s1, s2) | 20×2×14 | yes | none |
| castle | `mil-crossbow-rack` | 48×10×36 | no | **add** |
| castle | `smith-helm-row-shelf` | 48×12×20 | no | **add** |
| castle | `mil-helmet-peg-rack` | 48×10×24 | no | **add** |
| castle | `cell-bench-plank` | 72×24×30 | no | **add** (a plank bench chained to the cell wall) |
| castle | `heraldic-shield`, `manacles-wall`, `lever-wall`, `horn-hunting`, `mil-duty-roster` | ≤ 8 deep | yes | none |
| mansion | `mirror-pier-gilt` | 36×5×78 | no (78 tall) | **add** |
| mansion | `sconce-candle-triple`, `bell-board-servants` | ≤ 8 deep, ≤ 48 tall | yes | none |
| vertical | `ladder-wood` (the `--upright` sku) | 18×6×120 | no | **do not add**: `ladder-wood` is an inn role that stands on the floor against the wall (barn loft ladder). The upright ladder is placed by the storey builder, not by a room program. |
| vertical | `jetty-bracket`, `corbel-stone`, `gargoyle-spout` | 18–36 deep | no | **add when the storey builder exists**; no room program asks for them today |

Notes:

- `mount()` hangs a thing with its **centre** at `height` (default 5.4 ft) and never lower than 2.5 ft to its bottom
  edge. The catalog's `mount:` (inches to the bottom edge: 36 for the urn niche, 54 for torches) is in `library.json`
  but **no solver code reads it**; the programs pass `height` themselves (`cryptHung()`: plaques 5.1, niche 4.25, mask 5.6).
- `build_data.py` (the batch block) also writes `hung: true` on the object when the manifest's `flags` say so. Nothing
  reads it yet; if `isHung` gained `|| o.hung` the table above would be data instead of code. Left as a note: it would
  be an in-body edit of a one-line function for no change in behaviour today.
- Ceiling-hung (`place: ceiling`, placed with `ctx.ceiling`, gets a chain in `look.js`): crypt `censer-hanging`,
  `rite-sanctuary-lamp`; mansion `chandelier-grand`. No registration needed.
- Wall-PLACED floor pieces that must **not** be hung (the designers flagged them; the size test agrees): crypt
  `ossuary-shrine`, `catacomb-shelf-bones`; mansion `fireplace-marble`, `clock-longcase`, `hall-stand`, `fountain-wall`,
  the bookcases.

## 2. Light types (`tools/spawn-tuner/js/fx/fire.js` `fireType(id)`, mirrored in `prep/fire_anchors.py` `fire_type`)

A placed thing is a fire when `fireType(role id)` returns a type; the type picks the flame (volume / small), its light
and where on the mesh it sits. It is a chain of regular expressions on the **role id**, so most new lights are caught
by their names. Checked every `light:` in the three specs:

| type | role | spec says | `fireType` today | action |
|---|---|---|---|---|
| crypt | `rite-pillar-candle-tall`, `candle-drippings-mound`, `skull-candle`, `rite-offering-candles-tray` | candle | candle | none |
| crypt | `rite-bone-candelabra` | candle | candelabra (3 flames in a row) | none (better than the spec) |
| crypt | `brazier-standing` | brazier | brazier | none |
| crypt | `rite-sanctuary-lamp` | lantern | lantern | none |
| crypt | **`rite-sacred-flame-bowl`** | brazier | **null** | **add** `if (/flame-bowl/.test(id)) return 'brazier';` |
| crypt | **`rite-memorial-sand-tray`** | candle | **null** | **add** `if (/sand-tray/.test(id)) return 'stubs';` (a tray of thin candles: the 4-flame cluster) |
| castle | `fireplace-grand`, `cook-hearth-spit` (great) | fireplace | hearth | none |
| castle | `brazier-large`, `brazier-irons` | brazier | brazier | none |
| castle | `chandelier-ring` (great), `prayer-candle-rack`, `watch-lantern-bell`, `mil-guard-lantern` | as named | chandelier / candle / lantern | none |
| castle | `candelabra-standing` | candle | candelabra | none |
| castle | **`cauldron-crane`**, **`pig-on-spit`** | fireplace | **null** | **add as `brazier`**, not hearth: the `hearth` type expects a cavity with a mouth (`fire_anchors.py` ray-casts for one); these are open fires under a pot or a spit. Their flame height needs the Alignment Bench. |
| castle | **`mil-signal-beacon`**, **`mil-boiling-oil-pot`** | brazier | **null** | **add** to the same line |
| castle | `cresset-wall` (kitchen recipe, reused role) | torch | null | add `if (/cresset/.test(id)) return 'torch';` |
| castle | `fire-basket-stand` (gatehouse, courtyard; an inn-era role) | brazier | null | add to the brazier line (it is unlit in the yard today too) |
| mansion | `fireplace-marble`, `chandelier-grand`, `candelabra-standing`, `candelabra` (fine), `lamp-post-iron` | as named | hearth / chandelier / candelabra / lantern | none |
| mansion | `sconce-candle-triple` | candle | candle (ONE flame) | optional: a `sconce-candle-triple` line returning `candelabra` gives it three; cosmetic |

False positives looked for (a new role whose name trips a pattern without being a light): none. `fire-screen`,
`fire-irons` and `andirons` match nothing; `rite-altar-cloth` and the rugs are excluded by the existing `rug|rake|mat` line.

The new lines go **after** `if (/lantern|lamp/.test(id)) return 'lantern';` (the last test before `return null`), so no
existing id can change type. Two files, same lines: `js/fx/fire.js` and `prep/fire_anchors.py` (it says "mirror of").

### Fire anchors (`data/fire_anchors.json`)

After the runtime GLBs exist: `cd tools/spawn-tuner && python3 prep/fire_anchors.py`
(needs trimesh + rtree). It derives the flame points per sku from the mesh (wick tops, torch head, hearth cavity,
lantern body) for every library sku whose role has a fire type, and rewrites the whole file: run it once per type
after that type's meshes are in `assets/m/`, and diff the file (only new skus should appear). All batch lights were
generated **unlit**, as inn-02's were. The ten crypt lights, the open twins and the two door leaves are also on the
Alignment Bench list for Harry (`crypt/README.md`, "Bench items"); the bench's records win over the derived anchors.

### Which light a program hangs

`solver2.js attempt()` hangs `chandelier-ring` (hubs, the fine room) or the first ceiling light of the recipe's `light`
slot over each zone of a room above 300 sq ft. The new programs make no zones and empty the slots (`ccmDone`), so that
loop does nothing for them: each program places its own lights, and the crypt programs end with `ccmEnsureLight`
(a windowless room must have at least one; the node test checks every room with `fireType`).
