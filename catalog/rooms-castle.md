# Castle rooms — recipes for the castle type (2026-10-05)

The castle type's rooms (`experiments/2026-10-05-castle-crypt-mansion/castle/rooms.json`) are dressed from the castle recipes that already existed (`cas-great-hall`, `cas-throne-room`, `cas-armory`, `cas-armory-full`, `cas-armory-smalls`, `cas-barracks`, `cas-barracks-kit`, `cas-great-kitchen`, `cas-high-table-setting`, `cas-feast-spread`, `cas-training-yard`, `cas-gate-defense`, the dungeon's `dun-cell-block`, `dun-interrogation`, `dun-jailer-station`, the chapel's `tem-chapel`, `tem-sanctuary-service`, `tem-altar-service`) plus the ones below, which name the pieces of the 2026-10-05 batch. The chapel and the dungeon recipes keep their own setting prefix (`tem-`, `dun-`) so no object needed a new setting tag. `cas-courtyard` is an outdoor room in the yard's grammar (`tav-yard`): `edge` is read by name.

### cas-shell P2
- walls: wall-straight, wall-window-small, wall-doorway, wall-arrow-slit, city-wall, city-wall-turret
- floor: floor-flagstone-rushes, floor-setts-courtyard, floor-sand-training, floor-flagstone-square, floor-flagstone-large, floor-flagstone-irregular, floor-checker-stone, floor-cobble, floor-cobble-mossy, floor-planks-rushes
- openings: door-reinforced, door-double-grand, portcullis, gate-double-timber
- supports: pillar-round, pillar-square

### cas-hall-high-table P2
- anchor: fireplace-grand, table-feast, dais
- furnish: chair-armed, bench-long, table-trestle, pillar-round, faldstool
- light: chandelier-ring, brazier-large, torch-bracket-fine, candelabra, candle-tree
- dress: heraldic-shield, banner-wall, banner-pole, tapestry, goblet, goblet-silver, platter-silver, salt-cellar-ship, boar-head-platter, pig-on-spit, rug-fur, trophy-head, shield-display, window-stained-glass

### cas-throne-dais P2
- anchor: throne, dais
- furnish: faldstool, pillar-round, armor-stand
- light: brazier-large, brazier-standing, torch-stand, chandelier-ring, torch-bracket-fine
- dress: banner-pole, banner-wall, heraldic-shield, crown, scepter, regalia-cushion, chest-treasure, rug-runner, window-stained-glass

### cas-armoury-racks P2
- anchor: weapon-rack, armor-stand, grindstone
- furnish: mil-armor-repair-bench
- store: arrow-barrel, mil-shield-stack, mil-crossbow-rack, mil-spear-tripod, smith-helm-row-shelf, chest-ironbound, mil-pavise
- light: torch-bracket-rough, lantern-wall-iron
- dress: shield-heater, shield-round, shield-kite, helm-great, helm-open, armor-chainmail-heap, armor-breastplate, crossbow, sword-long, sword-short, axe-hand, mace-flanged, warhammer, quiver-arrows, heraldic-shield

### cas-barracks-rows P2
- anchor: bunk-bed, mil-footlocker
- furnish: cot, table-square, bench-long
- store: mil-helmet-peg-rack, weapon-rack, armor-stand, mil-shield-stack, smith-helm-row-shelf
- light: mil-guard-lantern, lantern-hanging, torch-bracket-rough
- dress: dice-and-cup, tankard, helm-open, sword-short, horn-hunting, mil-wasters-rack, training-dummy, armor-chainmail-heap, mil-duty-roster

### cas-castle-kitchen P2
- anchor: cook-hearth-spit, bread-oven, cauldron-crane
- furnish: table-kitchen-prep, butcher-block, cauldron-huge, pig-on-spit, mortar-large-stone, basin-stone
- store: cheese-shelf-aging, potato-crate, salt-sack, grain-sack-open, firkin, bread-rack, dough-trough, vegetable-crate-mixed
- light: lamp-wall-bracket, lantern-wall-iron, cresset-wall
- dress: trade-butcher-hooks-rail, ham-hanging, carcass-hanging, poultry-plucked-hanging, saucepan-copper, fish-kettle, pot-copper, pot-iron-large, roasting-pan, knife-rack-wall, utensil-rack-wall, smoked-meat-rack, soup-cauldron-full, roast-pig, chopping-block-kitchen

### tem-castle-chapel P2
- anchor: altar-stone, dais, window-stained-glass
- furnish: pew, lectern, font-holy
- light: candelabra-standing, prayer-candle-rack, candlestick-floor, sconce-candle-triple, candle-tree
- dress: rite-altar-emblem-stand, chalice-altar, tome-holy, reliquary, pillar-round, rite-kneeler-cushion

### dun-castle-dungeon P2
- anchor: cell-bars, door-cell-bars, rack-torture, iron-maiden
- furnish: cell-bench-plank, bed-straw-pallet, table-experiment, stocks, pillory, cage-floor, block-headsman
- store: bucket-slop, chest-ironbound, chest-treasure
- light: brazier-irons, brazier-standing, torch-bracket-rough, mil-guard-lantern
- dress: manacles-wall, shackles-leg, oubliette-hatch, lever-wall, bones-pile, skull-pile, key-hook-board, decal-blood, floor-drain-grate

### cas-castle-chapel P2
- anchor: dais
- light: sconce-candle-triple

### cas-castle-dungeon P2
- furnish: stocks
- light: torch-bracket-rough, mil-guard-lantern

### cas-gatehouse P2
- anchor: portcullis, windlass, door-reinforced
- furnish: table-square, bench-long, sentry-box, mil-boiling-oil-pot
- store: weapon-rack, arrow-barrel, mil-spear-tripod, mil-crossbow-rack, mil-pavise, armor-stand
- light: brazier-large, fire-basket-stand, mil-guard-lantern, torch-bracket-rough, watch-lantern-bell
- dress: lever-wall, horn-hunting, banner-pole, mil-cheval-de-frise, oubliette-hatch, mil-helmet-peg-rack, dice-and-cup, key-hook-board, mil-catapult-stones, heraldic-shield, mil-duty-roster, ballista

### cas-courtyard P2
- anchor: well, training-dummy, archery-target, horse-trough-stone, mil-quintain
- furnish: mil-pell, mil-wasters-rack, weapon-rack, grindstone, sentry-box, stocks, cauldron-crane, sawhorse, block-headsman, tourney-lists-rail, ballista
- store: arrow-barrel, mil-shield-stack, mil-spear-tripod, stone-blocks-stack, mil-catapult-stones, manure-heap, grain-bin-stable, mil-cheval-de-frise, mil-pavise
- light: brazier-large, mil-signal-beacon, torch-stand, fire-basket-stand, torch-bracket-rough, watch-lantern-bell
- dress: banner-pole, banner-wall, pig-on-spit
- edge: city-wall, city-wall-turret, portcullis, gate-double-timber
