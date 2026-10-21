# Mine (MIN): design, 2026-10-11

Harry: "build out the rest of the fantasy genre type assets". A mine is mostly TUNNEL: the passage rooms are the heart of
it, and the coming whole-building generator (branch `buildings`) lays them as the connective tissue of a "carved" site.
Folder = `experiments/2026-10-11-types/min/` in the worktree `<repo>` (branch
`type-min`). Run name `min-01`. Exclusive sku tier `min`. Built ON the dungeon batch (`../dun`): its `cut-rock` walls,
shoring frame, rock falls, floors, water floor, pit flat and its solver helpers are shared, not copied. Land after it.

## Rooms (13), graph roles, depth hints, wall families

| key | label | role | depth | walls | default cells | key piece |
|---|---|---|---|---|---|---|
| min-tunnel | Mine tunnel | passage | any | mine-timbered | 8x2 | the cart road with timber sets over it |
| min-junction | Tunnel junction | hub | any | mine-timbered | 4x4 | the turntable; a timber set at every tunnel mouth |
| min-face | Working face | terminal (dead end) | deep | cut-rock | 4x3 | the vein across the end wall |
| min-collapsed | Collapsed tunnel | terminal (dead end) | deep | mine-timbered | 6x2 | the rock fall |
| min-flooded | Flooded gallery | terminal | deep | mine-timbered | 6x3 | props standing in still water; the pump |
| min-shaft-head | Shaft head | hub, THE VERTICAL LINK | near the shaft | mine-timbered | 5x5 | the shaft, the winch, the ladder way |
| min-sorting | Ore-sorting chamber | uses (tool store, powder store) | near the shaft | cut-rock | 6x5 | sorting tables, heaps of ore, a siding |
| min-tool-store | Tool store | terminal | near the shaft | mine-timbered | 4x3 | the tool rack |
| min-mess | Miners' mess | terminal | near the shaft | cut-rock | 6x4 | the mess table, the cook fire, two bunks |
| min-powder-store | Powder & lamp store | terminal (locked) | mid | mine-timbered | 3x3 | the powder kegs; the lamp rack |
| min-seam | Crystal seam | terminal (the reward room) | deep | cut-rock | 5x5 | the great crystal |
| min-pithead | Pithead yard | outdoor (a hub in use) | surface | none | 8x7 | the headframe; the stockpile |
| min-smelter | Smelter house | terminal | surface | fieldstone (windows) | 5x4 | the furnace |

No windows underground. Doors: plank (`door-plank`); the powder store locks (`door-reinforced`). The graph roles are in
`walls.js` `ROLES`, the depth hints in `walls.js` `MIN_DEPTH` (exported); adjacency in words is in ROOMS.md -> Mine.
`mine-timbered` = the dungeon's cut-rock with a timber post up the middle of each panel and a cap beam along the top; until
its three pieces are in the library it draws cut-rock (`FAMILY_FALLBACK`). The "worked seam" variant is not a third
family: it is the `ore-vein` slab (gold-and-copper vein; `--s2` crystals), a wall-placed PROP stood side by side across
the end wall (a special panel between plain panels reads as furniture: end to end or not at all).

## Not built, by decision
Caves and slopes (docs/VERTICAL.md). The shaft is a marker on the floor (collar mesh, else the dungeon's `pit-open`
flat, else a well) plus the library's ladder: storeys and the ladder do the vertical link. The cart track is a FLAT strip
on the floor (`mine-rail-strip`, laid in a row as the sewer's channel is), never a mesh: thin rails do not reconstruct.

## Reused from the library and the dungeon batch
cut-rock walls, floor-cut-rock, floor-water-flooded, pit-open, decal-rubble-scatter, decal-cracks (dun flats);
shoring-timber, collapse-rubble, rubble-pile, ceiling-slab-fallen, flotsam-crate (dun meshes); crystal-formation,
crystal-glowing (wizard batch, when it lands); windlass, well, well-house, ladder-wood, post-timber, wheelbarrow,
cart-hand, cart-shed, signpost, lantern-wall-iron / -horn, lantern-post, lantern-post-indoor, watch-lantern-bell, barrel,
crate, sack, bucket, table-trestle, table-square, bench-long, bunk-bed, cot, cauldron-crane, firepit-stone-round,
mil-helmet-peg-rack, coat-pegs, garden-tools-leaning, spade-garden, axe-woodcutter, grindstone, sawhorse,
shelving-freestanding, mil-catapult-stones (a heap of rock), stone-blocks-stack, hearth-raised-square, quench-trough,
washtub, water-trough, pasty, tankard, bread-loaf.

## New meshes: 32 specs (`build_spec.py` has every prompt; sizes W x D x H in)
p1: mine-cart 30x48x36 · ore-pile 36x36x18 · rural-tailings-pile 72x60x40 · mine-tool-rack 48x14x60 (NEW role) ·
mine-lamp-rack 40x12x56 (NEW) · powder-keg-stack 40x30x40 (NEW) · rural-pit-props-stack 60x36x30 ·
mine-shaft-collar 70x70x16 (NEW) · sorting-table 78x34x36 · smelter 54x54x84 · mine-headframe 110x110x168.
sib1 (painted from an accepted plate): wall-straight--mine-timbered (+ --s2), wall-doorway--mine-timbered and
ore-vein (+ --s2) from the dungeon's cut-rock plates; mine-cart--s2 (empty); ore-pile--s2 72x60x34 (stockpile).
p2: lumber-pile · coal-bin · rural-water-pump-mine · rural-ore-bucket 24x24x28 (kibble) · beam-collapsed ·
crystal-formation--s3 54x54x66 · geode-cluster · ingot-stack (NEW) · rural-sign-danger-mine 26x4x20 (hung) · sluice-box.
sib2: rural-ore-cart-tipped (from the cart) · shoring-timber--s2 (cracked; from the dungeon's frame plate).
p3: rural-slag-heap · rural-bellows-ventilation.
Thin things designed stout: tools fused to a backboard, the headframe's members over a foot thick, cart wheels 4 in thick.

## Flats: see FLATS.md (rail strips, turntable, track end, ore and coal decals, 13 room icons).
