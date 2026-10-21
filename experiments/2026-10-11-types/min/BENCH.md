# For the Alignment Bench: the mine (accepted pieces only)

Notes for Harry. Nothing here needs wiring: the deploy's tool sweep lists these from the catalog, the run manifest
(`catalog/runs/min-01/manifest.tsv`, `flags`) and `fx/fire.js fireType()`. Everything was generated UNLIT and DRY.

## Fire: where the flame sits

| piece | flame type the code gives it | note |
|---|---|---|
| `smelter--mine` | oven (new line in `fireType()`: `^smelter`) | the fire is behind the arched TAP HOLE low in the front; the open top should smoke, not flame. Height and depth are a guess: bench it first |
| `mine-lamp-rack` | lantern (`lamp` in the id) | SIX small lamps on two shelves; the code gives it ONE flame. Either one lit lamp (my guess: the middle of the top shelf) or leave it dark: a rack of lamps in a store is not burning |
| `lantern-wall-iron`, `lantern-wall-horn`, `lantern-post`, `lantern-post-indoor`, `torch-bracket-rough`, `cauldron-crane` | as before | older pieces the mine's rooms use; already on the bench |

## Glow, not flame (no effect exists yet: waived in `tools/tool-sweep/waivers.json` under `crystal-formation`)

| piece | what should glow |
|---|---|
| `crystal-formation--s3` (the great crystal of the Crystal seam) | the whole cluster, violet to rose; it is the room's light |
| `ore-vein--s2` (the crystal vein slab) | the band of crystals only |
| `geode-cluster` | the hollow |
| `crystal-formation--s1`, `crystal-glowing` (wizard batch) | used by the seam too |

`ore-vein` (the gold-and-copper vein) does not glow: it is painted metal.

## Water

| piece | where the water is |
|---|---|
| `rural-water-pump-mine` (`bench:water` in the manifest) | the spout's mouth: a trickle, if anything. The pump stands IN the flooded gallery's water floor |
| the Flooded gallery itself | no vessel: its floor is the dungeon's `floor-water-flooded` (still water, a plain surface) |

## Open / shut
None. The mine has no chest, door leaf or hatch of its own (doors are the library's `door-plank` and `door-reinforced`).
`mine-cart` (full) and `mine-cart--s2` (empty) are two shapes of one role, not an open/shut pair.
