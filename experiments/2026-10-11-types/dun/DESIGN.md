# Dungeon & prison (DUN): design, 2026-10-11

Harry: "build out the rest of the fantasy genre type assets". This is THE D&D dungeon: an adventure site, not a
realistic gaol. Folder = `experiments/2026-10-11-types/dun/` in the worktree `<repo>`
(branch `type-dun`). Run name `dun-01`. Exclusive sku tier `dun`.

## Rooms (13) and wall families

Prison half (walls `dressed-stone`, existing family): `dun-cell-block` Cell block · `dun-guard-room` Guard room ·
`dun-interrogation` Interrogation room · `dun-vault` Treasure vault · `dun-sewer` Sewer.
Adventure half (walls `cut-rock`, NEW family: hewn from the living rock): `dun-corridor` Corridor ·
`dun-trap-corridor` Trap corridor · `dun-puzzle-hall` Puzzle hall · `dun-chasm` Chasm crossing · `dun-den` Monster den ·
`dun-shrine` Shrine · `dun-flooded` Flooded chamber · `dun-collapsed` Collapsed hall.
No windows anywhere.

## Reused from the library (no generation)

cell-bars, portcullis (+raised), rack-torture, iron-maiden (+open), manacles-wall, shackles-leg, brazier-irons,
lever-wall, oubliette-hatch, cage-floor, stocks, pillory, block-headsman, cell-bench-plank, bones-pile, skull-pile,
chest-treasure, chest-ironbound (+open), coin-pile, casket-ornate, pedestal-display, key-hook-board, key-ring,
weapon-rack, mil-crossbow-rack, mil-helmet-peg-rack, mil-footlocker, mil-duty-roster, torch-bracket-rough, torch-sconce,
torch-stand, brazier-standing, lantern-wall-iron, crypt-gate-iron, door-reinforced--leaf, statue-weeping-angel,
altar-stone, rite-sacred-flame-bowl, rite-offering-candles-tray, rite-pillar-candle-tall, pillar-round, pillar-square,
stone-blocks-stack, floor-drain-grate, bed-straw-pallet, cot, table-square, stools, barrel, crate, bucket-slop, hay-pile,
ladder-wood, puddle, refuse-pile, decal-blood / -cobweb / -moss / -bones-scatter, floor-flagstone-damp / -broken / -large,
floor-bone-strewn, floor-earth-packed, fountain-wall, gargoyle-spout, crown, shield-*, armor-stand.

## New meshes (group = priority; all sizes W x D x H inches; "CHUNKY" = bars, chains, spikes as thick as a wrist)

Catalog role in brackets when it differs from the sku stem; NEW = needs a catalog line in
`catalog/objects-dungeon.catalog.md` (set:DUN, tagged `trap` / `hazard` affordances where they apply).

### Wall kit `cut-rock` (p1 parent + sib1), all `wall=True`, 60 x 12 x 108
| sku | design |
|---|---|
| wall-straight--cut-rock | PARENT. A wall hewn out of living rock: one continuous dark grey-brown rock face (NO blocks, NO mortar joints), covered in diagonal chisel and pick marks, a few natural fissures and ledges, damp green-black staining low down, lighter worked planes catching light. TALL, NARROW, almost twice as tall as wide, must NOT be square; level top, flat bottom, clean vertical side cuts. |
| wall-straight--cut-rock--s2 | same, a different pattern of fissures and a band of paler stone running across |
| wall-straight--cut-rock--s3 | same, with a shallow hewn recess (empty torch nook, 12 in) at head height |
| wall-doorway--cut-rock | same wall with an EMPTY rough-hewn door opening from the bottom, 3.5 ft x 7 ft, roughly squared head with chisel marks, no dressed arch, no leaf |

### Doors (leaf-only, like `door-crypt--leaf` / `door-reinforced--leaf`: the engine hinges them)
| sku | role | size | p | design |
|---|---|---|---|---|
| door-cell-bars--leaf | door-cell-bars | 40x5x84 | 1 | ONLY a barred prison door leaf: heavy flat iron frame, FIVE fat round vertical bars, two flat cross straps, big box lock on the right, two knuckle hinges left. CHUNKY. See-through between bars. (The castle's dungeon wants this too.) |
| door-rune-sealed--leaf | door-rune-sealed | 44x8x90 | 1 | ONLY a monolithic stone door slab, no frame: dark stone, a ring of deep-carved angular runes round a central carved disc with an empty round socket, runes painted DULL (no glow), bronze corner bindings |
| door-face-carved--leaf | door-face-carved | 44x8x90 | 2 | ONLY a stone door slab carved as one giant grim face in relief, open mouth as a shallow dark recess, moss in the creases |

### Traps and hazards (ordinary placeable things; catalog aff `trap` / `hazard`)
| sku | role | size | p | design |
|---|---|---|---|---|
| pressure-plate | pressure-plate | 30x30x4 | 1 | a square stone floor plate standing 3 in proud in a darker stone collar, worn hollow in the middle, a small carved warning skull at one corner |
| pressure-plate--s2 | pressure-plate | 30x30x4 | 2 | (sib of the above) round bronze-rimmed plate with a carved spiral |
| trap-spikes | trap-spikes | 56x56x22 | 1 | SPRUNG floor spike trap: a square iron-bound stone plate with a 4 x 4 grid of holes, sixteen FAT cone spikes (base as thick as a fist) standing 18 in tall, rust and dark stains. CHUNKY |
| trap-spike-pit | NEW trap-spike-pit (floor, 1, aff trap,hazard) | 58x58x12 | 1 | a square pit seen as an object: a low kerb of dressed stones 10 in tall round a 4-ft square opening, inside it a dark painted floor bristling with fat sharpened stakes whose tips reach the kerb top; half a broken false-floor plank cover on one side |
| trap-blade | trap-blade (catalog line changes to floor) | 66x20x96 | 1 | swinging-blade trap as ONE free-standing gantry: two thick stone posts with a heavy timber crossbeam, and hanging from it on a thick iron arm a huge crescent axe blade (3 ft wide) at the bottom of its swing, a foot off the floor. CHUNKY; nothing thin |
| trap-dart-wall | trap-dart-wall (catalog: wall, 1, mount 0) | 56x10x84 | 1 | a carved stone wall slab standing against a wall: three rows of four round dart holes, each hole the mouth of a small carved snarling face, verdigris bronze rim round the slab, a few darts lying at its foot fused to the base |
| trap-flame-jet | NEW trap-flame-jet (floor, sub, aff trap,hazard; bench: fire) | 24x24x16 | 2 | a squat bronze dragon-head nozzle set in a scorched square stone block, soot fan on the block. UNLIT |
| trap-crossbow | NEW trap-crossbow (floor, sub, aff trap) | 26x34x34 | 2 | a heavy crossbow bolted on a stubby timber tripod block, loaded, a thick cord running from the trigger to a floor peg. CHUNKY |
| boulder-rolling | boulder-rolling | 60x60x60 | 1 | one huge near-spherical granite boulder, chipped and scarred, a scraped band round its middle |
| lever-floor | NEW lever-floor (floor, sub, aff use) | 16x22x40 | 1 | a floor lever: a thick iron lever with a ball handle in a slotted iron-and-stone housing, thrown to one side |
| trap-bear | bear-trap | 30x30x10 | 3 | open iron jaw trap with fat teeth, chain stub. CHUNKY |

### Puzzle hall
| sku | role | size | p | design |
|---|---|---|---|---|
| block-sliding | block-sliding | 54x54x54 | 1 | a pushable stone cube, each face framed by a carved border with a big recessed rune, scuffed lower edges, bronze corner caps |
| statue-rotating | statue-rotating | 32x32x78 | 1 | a robed stone guardian holding a stone staff close to the body, pointing arm extended only slightly, on a ROUND turntable plinth with a bronze toothed ring and an arrow marker |
| statue-rotating--s2 | statue-rotating | 32x32x78 | 2 | (sib) armoured stone knight, sword point down between the feet, same round turntable plinth |
| orb-socket-pedestal | orb-socket-pedestal | 20x20x42 | 1 | a waist-high carved stone pedestal with a bowl-shaped socket on top holding a dull grey STONE orb (not glass), bronze claws |
| puzzle-dial-pillar | NEW puzzle-dial-pillar (floor, sub, aff use) | 24x24x60 | 2 | a fat stone column made of four stacked rotating drums, each drum carved with a row of different symbols, bronze bands between |
| obelisk-rune | NEW obelisk-rune (floor, sub, aff use,cover) | 28x28x90 | 2 | a four-sided dark stone obelisk with deep-cut runes on every face, stepped base |
| statue-guardian | NEW statue-guardian (floor, 1, aff cover,block) | 36x30x90 | 1 | a massive weathered stone warrior statue standing at attention with a great shield in front, square plinth; for corridors, vaults, shrine |
| statue-guardian--s2 | same | 36x30x90 | 2 | (sib) a horned beast-headed guardian with arms crossed |

### Prison
| sku | role | size | p | design |
|---|---|---|---|---|
| skeleton-chained | skeleton-chained (wall, mount 0) | 26x14x66 | 1 | a slumped skeleton sitting against a slab of wall backing, wrists in fat manacles on short thick chains, ragged cloth; ONE solid mass (ribs filled dark, limbs against the body), nothing thin |
| ball-and-chain | NEW ball-and-chain (floor, tiny, aff carry) | 20x14x10 | 2 | an iron ball, three fat links and an open leg shackle |
| chain-pile | chain-pile | 22x22x9 | 2 | a heap of rusty heavy chain, fat links fused into one mound, a hook on top |
| chair-interrogation | NEW chair-interrogation (floor, sub, aff sit,use) | 30x30x56 | 1 | a heavy iron-and-oak restraint chair: tall back, thick leather straps with buckles on the arms and legs, a head band, bolted foot plate |
| table-torture-tools | NEW table-torture-tools (floor, 1x2, aff use) | 60x28x36 | 1 | a scarred heavy work table with pincers, pokers, a hammer, a coil of rope and an open roll of tools laid out (all chunky, fused to the top), dark stains |
| whipping-post | NEW whipping-post (floor, sub, aff use) | 16x16x80 | 2 | a thick scarred timber post on a stone foot with two iron rings and a pair of fat manacles hanging close against it |
| gibbet-cage | cage-hanging (catalog: floor, sub) | 34x34x84 | 2 | a man-sized gibbet cage of FAT flat iron straps, standing on a low iron stand with a stubby hook ring on top; a skull inside on the floor of the cage. CHUNKY |
| bed-cell-stone | NEW bed-cell-stone (floor, 1x2, aff sleep) | 30x72x18 | 3 | a stone slab cell bunk with a thin straw mattress and a ragged blanket |

### Treasure vault
| sku | role | size | p | design |
|---|---|---|---|---|
| chest-treasure-open | NEW chest-treasure-open (open_of chest-treasure; bench: twin) | 40x30x40 | 1 | (EDIT of the accepted chest-treasure plate) the same chest with its lid thrown back, heaped to overflowing with gold coins, a crown and goblets |
| treasure-hoard | treasure-hoard (check the catalog; else NEW floor, 2x2, aff loot,climb) | 96x96x36 | 1 | a big mound of gold coins with half-buried chests, urns, a shield, swords stuck in it and gems; warm gold, NOT pale |
| gold-bars | gold-bars | 30x20x14 | 1 | a neat pyramid stack of stamped gold ingots |
| coin-pile--s2 | coin-pile | 30x30x12 | 2 | a spilled heap of gold coins with three bulging coin sacks |
| mimic-chest | mimic-chest | 38x26x34 | 2 | an iron-bound chest whose half-open lid shows rows of big teeth and a fat purple tongue lolling out, a few coins as bait |
| silver-plate-pile | silver-plate-pile | 28x24x16 | 2 | a pile of silver platters, ewers and candlesticks |
| armor-chainmail-heap | armor-chainmail-heap | 26x22x9 | 3 | a slumped chainmail shirt with a helm on top |
| strongbox-stack | NEW strongbox-stack (floor, 1, aff loot,cover) | 40x30x44 | 1 | three iron strongboxes stacked, riveted, with fat padlocks and carry rings |
| vault-shelf-treasure | NEW vault-shelf-treasure (floor, 1, aff loot) | 56x18x78 | 2 | a heavy iron-framed shelf unit loaded with coffers, gold urns, a stack of ingots and rolled charters |

### Monster den
| sku | role | size | p | design |
|---|---|---|---|---|
| nest-monster | NEW nest-monster (floor, 2x2, aff hide,loot) | 100x100x30 | 1 | a huge round nest of torn bedding, branches, bones and shredded armour with a hollowed middle holding three large mottled eggs |
| web-cocoon | web-cocoon | 26x26x66 | 1 | a man-sized victim wrapped in thick pale web, standing/leaning, anchored by fat web cables to a clump at the foot |
| web-cocoon--s2 | web-cocoon | 60x26x24 | 2 | (sib) the same lying on the floor, a boot sticking out |
| eggs-monster | eggs-monster | 30x26x18 | 2 | a clutch of five leathery green-black eggs in a slime crust, one cracked |
| adventurer-remains | adventurer-remains | 34x70x16 | 1 | a skeleton in rusted armour lying on its back with a pack, a round shield and a sword, all fused low to the ground |
| adventurer-remains--s2 | adventurer-remains | 36x40x30 | 2 | (sib) sitting slumped against its pack, helm askew, hand on a lantern |
| carcass-ribcage | NEW carcass-ribcage (floor, 1x2, aff cover) | 50x90x40 | 1 | the picked ribcage and spine of a large beast (ox-sized), FAT ribs, skull at one end, scraps of hide |
| stalagmite | stalagmite | 34x34x54 | 2 | a cluster of three fat stalagmites, wet sheen, banded ochre and grey |
| stalagmite--s2 | stalagmite | 26x26x30 | 2 | (sib) a low pair |
| mushroom-cave-giant | fungus-puffball? use NEW mushroom-cave-giant (floor, sub, aff cover) | 36x36x48 | 3 | a cluster of fat pale cave mushrooms with spotted violet caps |

### Collapsed hall / chasm / sewer / flooded / shrine
| sku | role | size | p | design |
|---|---|---|---|---|
| collapse-rubble | collapse-rubble | 110x70x80 | 1 | a ceiling collapse: a steep slope of big broken rock slabs and boulders with a snapped timber beam sticking out, tallest at the back |
| collapse-rubble--s2 | collapse-rubble | 60x60x60 | 2 | (sib) a smaller cone of fallen blocks |
| rubble-pile | rubble-pile | 56x50x24 | 1 | a low pile of broken masonry blocks and dust |
| rubble-pile--s2 | rubble-pile | 36x30x14 | 2 | (sib) a few blocks and chips |
| pillar-broken | NEW pillar-broken (floor, 1, aff cover,block) | 34x34x60 | 1 | the stump of a round stone column, snapped at chest height with a jagged top, on its square base |
| column-drums-fallen | NEW column-drums-fallen (floor, 1x2, aff cover,climb) | 36x100x34 | 1 | three big fluted column drums lying toppled in a line with a broken capital |
| shoring-timber | NEW shoring-timber (floor, 1, aff block) | 60x20x100 | 2 | a mine-style prop frame: two thick posts and a lintel beam with wedges, holding nothing, a lantern hook |
| ceiling-slab-fallen | NEW ceiling-slab-fallen (floor, 1x2, aff cover,climb) | 70x90x26 | 2 | one great slab of ceiling stone lying cracked in two on smaller rubble |
| bridge-stone-slab | bridge-stone-natural | 60x170x30 | 1 | a narrow stone bridge: a slightly arched span of big rough slabs 5 ft wide and 14 ft long with low kerb stones, broken edges, no supports under (it spans a painted chasm) |
| bridge-plank-rickety | plank-bridge (own size) | 40x170x14 | 2 | a rickety walkway of thick planks lashed over two logs, a plank missing |
| stepping-pillar | stepping-pillars | 40x40x24 | 2 | the flat top of a rock pillar: a rough column stump with a worn flat top (stands in the painted chasm) |
| chasm-post-pair | NEW bridge-post-rope (floor, sub) | 20x20x44 | 3 | a thick timber post with a fat rope coil and an iron lantern hook |
| sewer-grate | sewer-grate (wall, mount 0) | 44x10x44 | 1 | a round stone outflow arch standing against a wall, barred by FOUR fat iron bars, green slime below. CHUNKY |
| sewer-pipe-mouth | sewer-outflow (own size) | 60x30x56 | 1 | a big brick-and-stone pipe mouth sticking out of a wall, dark inside (painted black-green), a lip stained with slime |
| sewer-debris-clog | sewer-debris-clog | 56x50x24 | 2 | a clog of branches, bones, a broken barrel and rags, wet |
| sluice-wheel | sewer-sluice-gate (floor, 1) | 50x20x60 | 2 | a sluice gate in a stone frame with a big iron hand wheel on top. CHUNKY |
| crate-floating | NEW flotsam-crate (floor, sub, aff loot) | 40x36x14 | 2 | a half-sunk crate and a barrel lying on its side with a ring of scum (cut flat at the waterline) |
| pillar-flooded | NEW pillar-waterline (floor, 1, aff block,cover) | 30x30x100 | 2 | a square dressed-stone pillar with a dark slimy tide band over its bottom third |
| shrine-wayside | NEW shrine-wayside (floor, 1, aff use; bench: fire) | 44x24x84 | 1 | a small carved stone shrine standing against a wall: a stepped base, an arched niche with a seated hooded idol figure in it, a stone offering shelf with a bowl and two unlit candle stubs |
| statue-forgotten-god | NEW statue-forgotten-god (floor, 1, aff cover,use) | 44x44x96 | 2 | a seated, worn stone deity with a broken-off hand, moss, an offering bowl in its lap |
| offering-bowl | NEW offering-bowl (floor, tiny, aff loot) | 16x16x8 | 2 | a wide bronze bowl of coins, a ring and dried flowers |
| fountain-skull | NEW fountain-wall-skull (wall, mount 0; bench: water) | 36x24x50 | 3 | a wall fountain: a carved stone skull spout over a half-round basin (basin EMPTY, painted dark) |

Total: 4 + 3 + 11 + 8 + 8 + 9 + 10 + 22 = 75 specs.

## Flats (separate agent): see FLATS.md
