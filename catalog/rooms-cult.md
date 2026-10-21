# Cult sanctum rooms — recipes for the cult sanctum type (2026-10-11)

Nine rooms for the Build tray's Cult sanctum type (`experiments/2026-10-11-types/clt/rooms.json` holds the room definitions). The recipes that already existed (`clt-sanctum`, `clt-inner-sanctum`, `clt-ritual-circle`, `clt-necromancer-study`, `clt-dark-feast`) stay where they are and are reused. Architecture and furniture are flavor-neutral; the `flavor-*` roles are the six flavor slots (`objects-flavor.catalog.md`).

### clt-shell P1
- walls: wall-straight, wall-doorway, wall-alcove, wall-secret-door
- floor: floor-basalt-dark, floor-flagstone-damp, floor-flagstone-large, floor-checker-stone
- openings: door-crypt, door-secret-bookcase, door-reinforced
- supports: pillar-square

### clt-hidden-entry P1
- anchor: door-secret-bookcase, wall-secret-door, floor-trapdoor
- furnish: barrel, crate, sack, shelving-freestanding, bookshelf
- light: lantern-hanging, torch-sconce, candlestick
- dress: rug-small, decal-cobweb, bucket

### clt-passage P1
- anchor: statue-hooded, wall-alcove, flavor-sculpture
- furnish: pillar-square, bench-stone
- light: brazier-standing, torch-sconce, brazier-tripod, rite-pillar-candle-tall
- dress: flavor-banner, flavor-relief, rug-runner, candle-drippings-mound

### clt-great-sanctum P1
- anchor: altar-sacrificial, flavor-idol, decal-ritual-circle
- furnish: pew, bench-stone, pillar-square, dais, rite-kneeler-cushion, statue-hooded, flavor-sculpture, flavor-buttress
- light: flavor-censer, brazier-standing, brazier-large, elemental-brazier, firepit-sunken, rite-pillar-candle-tall, torch-sconce
- dress: flavor-altarpiece, flavor-banner, flavor-relief, flavor-sigil, dagger-ritual, chalice-dark, rite-blood-bowl, candle-black, candle-cluster, rug-runner

### clt-summoning P1
- anchor: decal-ritual-circle, flavor-sigil, portal-arch
- furnish: rite-sigil-stone, spellbook-lectern, pedestal-display
- light: rite-pillar-candle-tall, elemental-brazier, brazier-tripod, candle-drippings-mound, candle-black
- dress: tome-grimoire, rite-ritual-hand-bell, rite-blood-bowl, flavor-relief

### clt-cells P1
- anchor: cage-sacrifice, cage-floor, cell-bars
- furnish: manacles-wall, cell-bench-plank, bed-straw-pallet, bucket-slop, stool-three-leg, table-square
- light: brazier-standing, torch-sconce, lantern-hanging
- dress: rural-straw-bedding, key-hook-board, chest-ironbound

### clt-vestry P1
- anchor: robe-stand, robe-rack
- furnish: bench-long, chest-plain, wardrobe, table-trestle, washstand, basin-stone
- light: candlestand-pricket, candle-tree, sconce-candle-single, torch-sconce
- dress: rite-hooded-robe-folded, rite-cult-mask-blank, candle-black, mirror-wall, coat-pegs

### clt-library P1
- anchor: spellbook-lectern, bookshelf, bookcase-ladder
- furnish: table-library, desk-writing, stool-three-leg, shelving-freestanding
- light: candlestand-pricket, candle-tree, candelabra, rite-pillar-candle-tall
- dress: tome-chained, tome-grimoire, rite-tome-stack-forbidden, book-stack, book-open, book-pile-floor, inkwell-quill, skull-single, candle-black

### clt-quarters P1
- anchor: bed-straw-pallet, bunk-bed
- furnish: chest-plain, table-trestle, bench-long, stool-three-leg, robe-rack
- light: candlestick-floor, sconce-candle-single, lantern-hanging
- dress: rite-hooded-robe-folded, candle-black, bucket, rite-kneeler-cushion

### clt-idol-vault P1
- anchor: flavor-idol, dais
- furnish: cauldron-bronze-ritual, pedestal-display, chest-treasure, chest-ironbound
- light: flavor-censer, elemental-brazier, rite-sacred-flame-bowl, rite-pillar-candle-tall
- dress: flavor-sigil, flavor-banner, chalice-dark, tome-grimoire, candle-cluster, dagger-ritual
