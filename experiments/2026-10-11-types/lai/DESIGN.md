# Monster lair (LAI): design, 2026-10-11

Harry: "build out the rest of the fantasy genre type assets". A lair is the home of a creature, so a lair room is
defined by its OCCUPANT. Folder = `experiments/2026-10-11-types/lai/` in the worktree
`<repo>` (branch `type-lai`). Run name reserved: `lai-01`. Sku tier reserved: `lai`.

**What happened to the asset run.** On 2026-10-11 the shared image allowance was out when this type began, so the
rooms were first built from the library alone. On 2026-10-12 (allowance back; the dungeon and the mine landed) the lair's
own batch `lai-01` was made: 16 signature meshes, 16 of 16 plates accepted first time, 16 of 16 meshes accepted (two at
their own size), one pod for 41 minutes, **$1.22**; ten painted room icons, a painted floor web and two painted scorch
marks on the free image route. Everything else the lair uses is the library's and the dungeon batch's.

## Rooms (10), roles and depth

| key | label | cells | role | depth | what it is |
|---|---|---|---|---|---|
| `lair-mouth` | Cave mouth | 7x6 | outdoor | entrance | the ground before the lair: warnings either side of the way in, the dead along it, the last party's camp |
| `lair-passage` | Cave passage | 8x2 | passage | mid | the connective tissue: the way winds round standing rock |
| `lair-warren` | Goblin warren | 7x6 | hub | mid | DEN (goblin / kobold): chieftain's seat, bunks, cook fire, stolen goods, snare, ladder |
| `lair-beast` | Beast den | 5x5 | terminal | mid | DEN (bear / wolf / owlbear): bedding, the kill, bones; dark |
| `lair-spider` | Spider nest | 6x6 | terminal | mid or deep | DEN (giant spider / ettercap): the web, egg sacs, wrapped catch; dark |
| `lair-larder` | Larder | 4x4 | uses (a den) | mid | hung kills, the chopping block, a cage of live prey |
| `lair-pit` | Prisoner pit | 5x5 | terminal | mid | the pit, cages, manacles, the ladder drawn up |
| `lair-hatchery` | Hatchery | 5x4 | terminal | deep | the great clutch on straw, clutches round the walls, the brood mother's nest |
| `lair-trophy` | Trophy cave | 7x3 | passage | deep | a gallery of taken arms, armour and heads, walked through to reach the heart |
| `lair-dragon` | Dragon's hoard | 8x7 | terminal | heart | DEN (dragon): the hoard is the bed; a hollow for the dragon; soot |

Figures these match (the monsters are FIGURES, `tools/spawn-tuner/data/figures.json`): `foe-dragon-young-{red,black,
green,white}` and `foe-dragon-wyrmling`; `foe-giant-spider`, `foe-ettercap`; twelve `foe-goblin-*`, six `foe-kobold-*`
(also the orcs, hobgoblins, gnolls and bugbears: the warren is a tribe's den); `beast-bear`, `foe-wolf`,
`foe-dire-wolf`, `foe-owlbear`. Plain "dragon": no published dragon's trade dress anywhere.

Walls: `cut-rock`, the dungeon batch's family (hewn from the living rock), shared. A NATURAL `cave-rock` family is
wanted (below) and is one changed word per room type when it exists. No cave terrain, no slopes: rooms with rock walls.
No windows.

## The den skeleton (one skeleton, swappable dressing)

`laiDen(ctx, K)` in `integration/programs.js`. Six beats, the same for every creature; K is the creature's dressing.

| beat | rule on the placement | where | dragon | spider | beast | goblin (the warren's own program, same beats) |
|---|---|---|---|---|---|---|
| BED | `den-bed` | the deepest corner (by the bolt hole when there is a second door) | the great heap, on the wall facing the way in | the heart of the web in the far corner (a web sheet over the floor) | a nest of bedding on trampled straw | bunks, pallets and bedrolls down one side wall |
| SPOT | (kept clear; recorded on the bed as `lair.spot`, `lair.stand`) | before the bed, on the door's side | a 10-ft hollow ringed by the hoard | 5 ft | 10 ft | (none: a tribe) |
| HOARD | `den-hoard` | within reach of the bed, never by the door | a crescent of heaps, bars and plate round the hollow, chests on the wall, a crown on a lid | egg sacs in the web | what it dragged home, by the bed | stolen goods heaped down the other side wall |
| FEED | `den-feed` | the open floor in the half the bed is not in | a carcass on a patch of soot | its catch wrapped along the walls, web round each | the kill, blood under it | the cook fire, log seats, the pot |
| SIGNS | `den-sign` | within a few steps inside the main door | soot on the floor, one who got this far, skulls | web across the floor, the first of its catch, webs on the door wall | a blood trail in, bones thrown out | a snare beside the way in, skulls and spears at the door |
| ESCAPE | path kind `escape` / `den-escape` | every second door joined to the SPOT by a kept-clear line | (it has one way in) | door only | door only | a ladder up the wall when there is no second door |

The warren adds a seventh beat, the chieftain's seat (`key-seat`) on the wall facing the way in.
Lights: beast, spider and dragon dens have NONE (nothing there uses fire). The goblins have torches and the cook fire;
the larder and the pit have a keeper's torch by the door; half the hatcheries have two braziers by the great clutch.

## Reused (no generation)

Library: coin-pile (to 10 ft: the catalog allows x4), chest-treasure, chest-ironbound (+open), loot-sack, crown,
skull-pile, bones-pile, decal-bones-scatter, decal-blood, decal-cobweb (hung, and laid flat as floor web), decal-moss,
puddle, decal-dirt-patch, rug-hay-scatter, rural-straw-bedding, hay-pile, rite-mummified-remains (the wrapped catch,
until cocoons land), throne, bunk-bed, bed-straw-pallet, bedroll, firepit-stone-round, fire-ring-iron, log-seat,
stool-three-leg, soup-cauldron-full, cauldron, crate, barrel, sack, chest-plain (+open), malt-sacks, mil-shield-stack,
mil-spear-tripod, ladder-wood, weapon-rack, woodpile, refuse-pile, bucket-slop, banner-pole, rug-bearskin, butcher-block,
carcass-hanging, smoked-meat-rack, trade-salting-trough, salt-sack, cage-floor, meat-raw-joint, oubliette-hatch,
manacles-wall, shackles-leg, key-hook-board, armor-stand, monster-head-trophy, trophy-head, shield-display,
heraldic-shield, horn-hunting, pedestal-display, helm-great, bush, bush-berry, brazier-standing, torch-bracket-rough,
torch-sconce, the floors floor-earth-packed / -bare / -straw, floor-bone-strewn, floor-flagstone-broken.

The dungeon batch (`experiments/2026-10-11-types/dun`, tier `dun`; taken by name, in order of preference, when it has
landed): the `cut-rock` wall kit, dun-treasure-hoard, gold-bars, silver-plate-pile, armor-chainmail-heap,
chest-treasure-open, mimic-chest, strongbox-stack, nest-monster, web-cocoon (+s2), eggs-monster, adventurer-remains,
carcass-ribcage, stalagmite, rubble-pile, collapse-rubble, mushroom-cave-giant, skeleton-chained, gibbet-cage,
chain-pile, bear-trap / trap-bear, pressure-plate, trap-spikes, and its flats pit-open, decal-web-floor,
decal-claw-marks, decal-scorch, decal-slime where they exist.

Derived here with no image model (`tools/derive_flats.py`): `decal-scorch--d1`, our own dirt-patch plate recoloured to
soot (`flats/README.md`). Room icons: pictures of our own meshes (`tools/render_icons.py`, `icons/README.md`).

## Batch `lai-01` (made 2026-10-12: the first sixteen, `build_spec.py`) and what is still wanted (the rest of these tables)

House style D (heroic hand-painted), text prompts and our own style reference only. Lessons already paid for: design
bones, ribs, web strands and egg-sac stalks STOUT; say "smooth ... painted as one flat solid surface" for fur, nests,
webs and hair; scale by largest dimension; gate the plate for meaning and the matte before meshing.
Role in brackets when the catalog already has the line; NEW = needs a catalog line (`catalog/objects-lair.catalog.md`).

### Priority 1: the signature pieces (17)
| sku | role | size | design |
|---|---|---|---|
| treasure-hoard-heap | NEW (floor, big, aff loot,climb,cover; set:LAI!) | 150x130x54 | THE dragon's bed: one great chunky mound of gold coin painted as one solid surface with a few big readable things half buried in it (a chest corner, a shield rim, a goblet, a crown), a shallow worn DISH in its top where something heavy sleeps. No thin coins standing on edge. No blue gems |
| treasure-hoard-heap--s2 | same | 96x84x34 | a smaller slumped mound with a spill of coin down one side, a helm and two gold bars in it |
| treasure-hoard-spill | NEW (floor, 1) | 72x48x12 | a low fan of coin run out across the floor from a heap, a few cups and a plate in it: lies at the foot of the big mound |
| scales-pile | scales-pile | 30x26x8 | a drift of shed plate-sized scales in dull red-bronze, painted as one solid heap |
| dragon-skull | dragon-skull | 110x150x60 | a great horned reptile skull lying on the floor, lower jaw beside it, thick horns, deep eye sockets; plain "dragon", no published design |
| gnawed-carcass | gnawed-carcass | 40x70x24 | a half-eaten ox: stout rib arches, a haunch, hide; aftermath, not gore (no viscera, dark dry stains only) |
| web-sheet-corner | NEW giant-web-corner (floor, 2x2; set:LAI!) | 110x110x70 | a THICK funnel of web filling a room corner: a solid pale mass rising from floor to shoulder height where the two walls would meet, a dark round tunnel mouth in it, ropes of web as thick as an arm running out to the floor. One solid painted surface, nothing thin |
| web-cocoon-hanging | NEW (ceiling, sub) | 26x26x72 | a wrapped victim hung by a rope of web as thick as a wrist, boots just showing |
| egg-sacs-floor | NEW (floor, sub; aff hazard) | 34x30x26 | a cluster of five pale leathery egg sacs the size of pumpkins stuck together with web, one split |
| egg-sacs-cluster | egg-sacs-cluster (wall) | 24x12x24 | the same on a wall, three sacs |
| nest-giant | nest-giant | 110x110x36 | a beast's bed: a ring of branches, bones and torn bedding, trampled flat in the middle; smooth, painted as one solid surface |
| bone-throne | bone-throne | 48x40x72 | a crude chieftain's seat lashed from big bones, a horned skull over the back, a fur thrown on it; stout pieces |
| bunk-crude | NEW (floor, 1x2; aff sleep) | 40x76x66 | a goblin bunk: three shallow sleeping shelves knocked together from mismatched planks and a door, rags and straw on each, a shield nailed on the end |
| totem-skull | totem-skull | 20x16x84 | a thick post with three skulls and a bunch of feathers, a crosspiece: the warning at a lair's mouth |
| cave-mouth | cave-mouth | 110x60x120 | a rock arch standing on the ground: a dark opening 6 ft wide in a hump of natural rock, boulders at its feet (set outdoors against the lair's wall, over its door) |
| rock-outcrop | rock-outcrop | 140x110x96 | a hump of natural grey-brown rock, mossed |
| tree-burnt | tree-burnt | 60x60x108 | a charred dead tree, 9 ft, three stout limbs, no twigs (under the wall tops, so it also stands indoors) |

### Priority 2: variety and the shared rooms (16)
| sku | role | size | design |
|---|---|---|---|
| wall-straight--cave-rock (+ --s2, --s3) | wall-straight (kit) | 60x12x108 | NATURAL cave wall: one continuous lumpy water-worn rock face, flowstone ribs, no tool marks, no blocks; TALL and NARROW, level top, clean vertical side cuts |
| wall-doorway--cave-rock | wall-doorway (kit) | 60x12x108 | the same with a ragged natural opening from the floor, 4 ft x 7 ft, no leaf, no frame |
| cave-opening--leaf | NEW door-cave-opening (leaf-only door role) | 44x10x90 | an "open door" for a cave: two hanging stalactite teeth and a rubble sill only, so a doorway reads as a hole in the rock (the engine hangs a leaf in every door; this is the leaf) |
| hide-curtain--leaf | NEW door-hide-curtain | 44x6x90 | a goblin door: a stitched hide hung from a pole |
| stalagmite--s3 | stalagmite | 40x40x84 | a tall pair, joined at the base |
| boulder-pile | NEW (floor, 1; aff cover,block) | 60x50x44 | three rounded boulders |
| pelts-stack | pelts-stack | 40x30x14 | as catalogued |
| hide-drying-rack | hide-drying-rack | 60x24x66 | a hide laced into a pole frame |
| tusks, skull-monster, claw-giant | as catalogued | | trophies for the plinths |
| trophy-rack-skulls | NEW (wall, 1; hung) | 60x10x40 | a pole rack of five big skulls of different beasts |
| cage-sacrifice | cage-sacrifice | 48x48x72 | a cage of lashed poles, fat bars |
| pit-kerb | NEW (floor, 2x2; aff hazard) | 110x110x14 | a ring of rough stones round a 6-ft hole painted black, a rope over the edge |
| dung-heap | dung-heap | 60x60x24 | as catalogued |
| campfire | campfire | 40x40x18 | stone ring, cold logs (UNLIT: the game adds the fire) |
| drum-war, banner-standard-war | as catalogued | | the warren |
| dragon-eggs | dragon-eggs | 48x48x24 | three large mottled eggs bedded in ash and straw |

### Flats wanted (the image route; none made)
giant-web-floor (a 10-ft sheet of web seen from above, role NEW) · web-curtain card (wall, 5 ft x 8 ft) ·
decal-claw-marks (floor) and claw-marks-wall · decal-slime · decal-scorch--s1..s3 painted (the derived one stands in) ·
decal-drag-trail (blood drag, 2 ft x 6 ft) · floor-cave-natural (+ v2, v3: lumpy water-worn rock) · ten room icons in
the tray's painted style (`room-lair-*`; the rendered ones stand in).

## For the Alignment Bench
`BENCH.md`.
