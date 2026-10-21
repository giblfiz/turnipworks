# Room recipes — the functional derivation

Each room is a list of **slots** (anchor → furnish → store → light → dress → fx), and each slot names the roles that can fill it. This file is why the catalog exists: every role should earn its place by filling a slot here. `catalog_tool.py` checks that every named role exists, that the role's `set` tags agree with the room's setting, and that **every slot in a P1 room can be filled with P1 roles alone** (that's the definition of the P1 shelf).

Slot order is also the spin-in choreography order (floor → walls → anchors → furniture → clutter → lights fade up).

## Shell — every building

The building generator lays the shell before any room recipe runs; each architecture family supplies these.

### any-shell P1
- walls: wall-straight, wall-corner-outer, wall-corner-inner, wall-window-small, wall-doorway
- floor: floor-tile, floor-planks-worn, floor-planks-dark, floor-planks-rushes, floor-planks-polished, floor-parquet-herringbone, floor-planks-stained, floor-boards-rough, floor-flagstone-irregular, floor-flagstone-square, floor-flagstone-damp, floor-cobble, floor-brick-herringbone, floor-terracotta, floor-checker-stone, floor-earth-packed, floor-earth-straw, floor-checker-red, floor-checker-bw, floor-brick-herringbone-bw, floor-tile-kitchen-small, floor-tile-delft, floor-tile-harlequin, floor-tile-hex, floor-flagstone-large, floor-flagstone-broken, floor-earth-bare, floor-grass, floor-gravel, floor-grass-worn, floor-grass-meadow, floor-cobble-mossy, dirt-path-tile
- openings: door-plank
- circulation: stair-straight, ladder-wood
- supports: post-timber, pillar-square

## TAV — Tavern / inn

### tav-common-room P1
- anchor: fireplace-wall, bar-counter, back-bar-shelves, cask-rack
- furnish: table-round-small, table-square, table-trestle, bench-long, chair-plain, stool-bar, settle
- store: barrel, crate, shelf-wall
- light: chandelier-ring, candle, candlestick, lantern-hanging, candle-tree, sconce-candle-double, sconce-reflector, lantern-wall-iron, lantern-pierced-tin
- dress: tankard, plate, pitcher, bottle, bottle-wine-green, bottle-of-wine-open, bread-loaf, dice-and-cup, notice-board, trophy-head, shield-display, rug-small, tavern-table-dressed, rug-hearth-halfmoon, rug-oval, rug-round, rug-striped-woven, rug-bearskin
- fx: fx-fire, fx-flame-small

### tav-kitchen P1
- anchor: cook-hearth-spit, bread-oven, table-kitchen-prep
- store: pantry-shelf, sack, barrel, crock, cupboard
- light: candle, lantern-hanging, lamp-wall-bracket, lantern-pierced-tin, sconce-reflector
- dress: cooking-pot, cauldron, pan-frying, cutting-board, ham-hanging, onion-string, turnip-pile, kitchen-prep-dressed
- fx: fx-fire, fx-smoke

### tav-cellar P1
- anchor: cask-rack, tun-large, floor-trapdoor, stair-straight
- store: barrel, crate, wine-rack, bottle-wine-dusty, bottle-wine-green, sack, shelving-freestanding
- light: lantern-hand, candle, torch-bracket-rough, lantern-wall-iron
- dress: ham-hanging, cheese-wheel, decal-cobweb

### tav-guest-room P1
- anchor: bed-single, bed-double
- furnish: chair-plain, table-side
- store: chest-plain, wardrobe
- light: candle, candlestick, sconce-candle-single, lamp-wall-shelf, lamp-oil-brass
- dress: rug-small, pitcher, bowl, rug-round, rug-braided-round, rug-sheepskin, rug-striped-woven

### tav-stable-yard P1
- anchor: stable-stall, water-trough, well
- store: hay-bale, feed-trough, saddle-rack
- dress: hitching-post, outhouse, wagon, bucket

## DUN — Dungeon / prison

### dun-cell-block P1
- anchor: cell-bars, door-cell-bars
- furnish: bed-straw-pallet, cot
- store: bucket-slop
- light: torch-sconce
- dress: manacles-wall, bones-pile, skeleton-chained, floor-drain-grate, decal-cobweb

### dun-guard-room P1
- anchor: table-square, door-reinforced
- furnish: stool-three-leg, bench-long, cot
- store: weapon-rack, chest-ironbound, barrel
- light: torch-sconce, brazier-standing
- dress: dice-and-cup, tankard, lever-wall, bread-loaf

### dun-interrogation P1
- anchor: rack-torture, table-experiment
- furnish: stool-three-leg
- store: chest-ironbound
- light: brazier-irons, torch-sconce
- dress: manacles-wall, cage-hanging, iron-maiden, decal-blood

### dun-vault P1
- anchor: chest-treasure, door-reinforced
- store: chest-ironbound, coin-pile, treasure-hoard
- light: torch-sconce
- dress: trap-spikes, pressure-plate, bones-pile, mimic-chest, adventurer-remains, door-rune-sealed

## MIN — Mine

### min-gallery P1
- anchor: wall-cave-rough, mine-timber-set, mine-rail
- furnish: mine-cart
- store: ore-pile, crate, powder-keg
- light: lantern-hanging, torch-sconce
- dress: pick-and-shovel, rope-coil, collapse-rubble, stalagmite, bucket

### min-ore-face P1
- anchor: ore-vein, wall-cave-rough
- furnish: mine-cart
- store: ore-pile
- light: lantern-hanging, crystal-glowing
- dress: pick-and-shovel, rock-small, stalagmite

### min-shaft-head P1
- anchor: mine-headframe, windlass, smelter
- furnish: sorting-table, wheelbarrow
- store: ore-pile, crate, coal-bin, lumber-pile
- light: lantern-post, lantern-hanging
- dress: rock-outcrop, boulder, tree-conifer

### min-deep-cavern P1
- anchor: cave-column, crystal-formation, rock-outcrop
- dress: stalagmite, stalactite, mushrooms-giant, bones-pile
- fx: fx-water-surface, fx-lava

## CAS — Castle / keep

### cas-great-hall P1
- anchor: fireplace-wall, throne, dais, table-trestle
- furnish: bench-long, chair-armed
- light: chandelier-ring, torch-sconce, brazier-standing, candlestick
- dress: banner-wall, tapestry, shield-display, goblet, plate, rug-small
- fx: fx-fire

### cas-throne-room P1
- anchor: throne, dais, door-double-grand
- furnish: chair-armed
- light: brazier-standing, torch-sconce, chandelier-ring
- dress: banner-wall, tapestry, armor-stand, heraldic-shield, pillar-square

### cas-barracks P1
- anchor: bunk-bed, table-square
- furnish: bench-long, stool-three-leg
- store: chest-plain, weapon-rack, armor-stand
- light: torch-sconce, lantern-hanging
- dress: dice-and-cup, tankard

### cas-armory P1
- anchor: weapon-rack, armor-stand, grindstone
- store: chest-ironbound, arrow-barrel, armory-rack-filled
- light: torch-sconce
- dress: shield-display, training-dummy

### cas-battlements P1
- anchor: wall-crenellated, wall-walk, tower-round-segment
- furnish: ballista
- store: arrow-barrel
- light: brazier-large, torch-sconce
- dress: banner-pole

### cas-war-room P1
- anchor: table-map
- furnish: chair-armed
- light: candelabra, torch-sconce
- dress: map-rolled, banner-wall, scroll-pile

## NOB — Aristocrat manor

### nob-bedchamber P1
- anchor: bed-canopy, fireplace-wall
- furnish: chair-armed, table-side
- store: wardrobe, chest-plain
- light: candlestick, candle
- dress: painting-portrait, tapestry, rug-small, goblet, jewelry-box, rug-round-fine, rug-bearskin, rug-sheepskin

### nob-dining P1
- anchor: table-trestle, fireplace-wall
- furnish: chair-armed, chair-plain
- store: cupboard
- light: candelabra, candlestick
- dress: goblet, plate, painting-portrait, rug-small, roast-fowl, bottle

### nob-study P1
- anchor: desk-writing, bookshelf
- furnish: chair-armed
- store: chest-ironbound
- light: candlestick, candle
- dress: book-stack, book-open, painting-portrait, rug-small

### nob-parlor P1
- anchor: fireplace-wall
- furnish: chair-upholstered, daybed, table-round-small
- light: candelabra, chandelier-grand
- dress: painting-landscape, vase-flowers, curtains-drapes, rug-grand, board-game, birdcage, statue-bust, rug-round-fine, rug-hearth-halfmoon, rug-bearskin

### nob-garden P1
- anchor: fountain-courtyard, balustrade-stone
- furnish: bench-long
- light: lantern-post
- dress: planter-topiary, statue-heroic, flowers-wild, tree-deciduous, beehive-skep

## RUI — Ruins

### rui-fallen-hall P1
- anchor: wall-straight, pillar-square, arch-freestanding
- furnish: column-stump, column-drum-fallen
- store: rubble-pile, masonry-block-fallen
- light: campfire
- dress: vines-hanging, bush, bones-pile, decal-cobweb, statue-deity

### rui-overgrown-court P1
- anchor: fountain-courtyard, statue-toppled, wall-breach
- dress: tree-deciduous, grass-tall, flowers-wild, decal-moss, rubble-pile, pottery-shards
- fx: fx-fog-volume

## HUT — Peasant hut / farmstead

### hut-cottage P1
- anchor: hearth-central, bed-straw-pallet
- furnish: table-square, stool-three-leg, bench-long
- store: chest-plain, sack, basket-wicker, barrel, shelf-wall
- light: candle, lantern-hand
- dress: cooking-pot, bowl, bread-loaf, turnip-pile, woodpile, rug-small, rug-rush-mat, rug-braided-round, rug-sheepskin, rug-cowhide
- fx: fx-fire, fx-smoke

### hut-yard P1
- anchor: well, fence-wattle
- furnish: hay-bale, woodpile
- store: barrel, bucket, sack
- dress: turnip-pile, bush, rock-small, boulder, tree-deciduous, stump

### hut-byre P1
- anchor: stable-stall, feed-trough
- store: hay-bale, hay-pile, bucket
- dress: tools-farm-leaning, wheelbarrow, poultry-plucked-hanging, rug-cowhide, rug-hay-scatter

## SMI — Blacksmith

### smi-forge-room P1
- anchor: forge, anvil, quench-trough
- furnish: table-work, stool-three-leg
- store: tool-rack-smith, barrel, crate
- light: torch-sconce, lantern-hanging
- dress: armor-stand, weapon-rack, bucket
- fx: fx-fire, fx-sparks

### smi-shopfront P1
- anchor: counter-shop, wares-display
- furnish: stool-three-leg
- store: chest-ironbound, crate
- light: lantern-hanging
- dress: sign-hanging, armor-stand, horseshoes-pile, metal-stock

## Adjacent settings (P2 unless noted)

### tem-chapel P1
- anchor: altar-stone, pew, lectern, window-stained-glass
- light: candelabra-standing, candle-cluster, prayer-candle-rack
- dress: statue-deity, font-holy, book-open, reliquary
- fx: fx-light-shaft, fx-flame-small

### cry-crypt P1
- anchor: sarcophagus, wall-crypt-niches, coffin
- light: torch-sconce, candle-cluster
- dress: skull-pile, bones-pile, effigy-knight, decal-cobweb, urn-decorative
- fx: fx-fog-volume

### arc-alchemist-lab P1
- anchor: alembic, table-work, cauldron
- store: potion-bottles, ingredient-shelf, bookshelf, potion-single-glowing
- light: candle-cluster, glow-orb
- dress: specimen-jar, mortar-pestle, skull-candle, book-stack, herbs-drying, stuffed-crocodile, alchemy-bench-dressed

### mkt-square P1
- anchor: market-stall, well, notice-board
- furnish: cart-hand, crate-stack
- light: lantern-post
- dress: stall-produce, sign-hanging, stocks, awning, turnip-pile

### cmp-camp P1
- anchor: campfire, tent-small
- furnish: log-seat, bedroll
- dress: cooking-tripod, rope-coil, woodpile, bush, tree-conifer

## D&D sites — magic, cults, lairs, groves (Harry 2026-09-30: lean in)

### arc-wizard-sanctum P1
- anchor: portal-arch, pedestal-display, spellbook-lectern, teleport-circle-dais
- furnish: desk-writing, chair-armed, enchanting-table
- store: bookshelf, staff-rack, scroll-rack
- light: candle-cluster, glow-orb
- dress: book-stack, crystal-ball, orb-floating, magic-item-cluster, globe-armillary, magic-mirror, rocks-floating
- fx: fx-portal, fx-sparkle-arcane

### clt-sanctum P1
- anchor: altar-sacrificial, idol-dark, decal-ritual-circle
- furnish: pew, cage-sacrifice
- store: chest-ironbound, robe-rack
- light: candle-cluster, brazier-standing, elemental-brazier
- dress: cult-banner, skull-pile, phylactery, decal-blood, tentacles-floor, skull-candle
- fx: fx-colored-flame, fx-miasma

### dun-puzzle-hall P1
- anchor: door-rune-sealed, orb-socket-pedestal, statue-rotating
- furnish: rune-tile, block-sliding, pressure-plate
- light: torch-sconce
- dress: lever-wall, floor-mosaic, door-face-carved, decal-glyph-warding, adventurer-remains
- fx: fx-force-wall

### lai-dragon-lair P1
- anchor: treasure-hoard, dragon-skull, rock-outcrop
- store: coin-pile, dragon-eggs, magic-item-cluster
- dress: adventurer-remains, bones-pile, gnawed-carcass, decal-scorch, scroll-sealed-glowing
- fx: fx-fire, fx-smoke

### lai-spider-den P1
- anchor: giant-web, wall-cave-rough
- store: web-cocoon, adventurer-remains
- light: crystal-glowing
- dress: bones-pile, decal-cobweb, backpack
- fx: fx-miasma

### lai-warlord-hall P2
- anchor: bone-throne, campfire
- furnish: table-trestle, bench-long
- store: treasure-hoard, cage-sacrifice
- light: brazier-large
- dress: totem-skull, gnawed-carcass, banner-pole, weapon-rack

### lai-stone-gaze-gallery P3
- anchor: statue-petrified, pillar-round
- dress: mirror-standing, rubble-pile, adventurer-remains
- fx: fx-fog-volume

### lai-sky-nest P3
- anchor: nest-giant, rock-outcrop
- dress: bones-pile, dragon-eggs, coin-pile

### grv-druid-grove P1
- anchor: sacred-tree, druid-altar, standing-stone
- furnish: log-seat, fairy-ring
- light: flowers-glowing
- dress: runestone, log-hollow, mushrooms-giant, flowers-wild, scrying-pool
- fx: fx-sparkle-arcane, fx-magic-glow

### rui-stone-circle P1
- anchor: standing-stone, obelisk-runed
- dress: grass-tall, runestone, portal-arch, rock-small
- fx: fx-fog-volume

### mkt-magic-shop P2
- anchor: counter-shop, potion-shop-shelf
- store: magic-item-cluster, staff-rack, crystal-ball
- light: glow-orb, candle
- dress: stuffed-crocodile, scroll-sealed-glowing, potion-single-glowing, sweets-jar

### smi-arcane-smithy P3
- anchor: arcane-forge, anvil
- store: metal-stock, weapon-rack
- dress: golem-parts, orrery

## Dawnhaven check — Duskmourn Keep (Adventure #4)

The first real table. If these rooms can be built, the shelf passes its first honest test.

### dh-chamber-endless-night P1
- anchor: arcane-pylon, door-reinforced
- light: torch-sconce, crystal-glowing
- dress: bones-pile, decal-cobweb, rubble-pile
- fx: fx-magic-glow

### dh-grimward-lab P1
- anchor: table-experiment, arcane-coil, alembic
- store: specimen-jar, ingredient-shelf, crate
- light: candle-cluster, lantern-hanging
- dress: potion-bottles, book-stack, sweets-jar, manacles-wall, decal-blood

### dh-noctar-lair P1
- anchor: coffin, throne, dais
- light: candelabra-standing, candle-cluster
- dress: tapestry, curtains-drapes, painting-portrait, goblet, mirror-standing
