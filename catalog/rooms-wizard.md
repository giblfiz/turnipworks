# Wizard's tower rooms — recipes for the wizard / alchemist tower type (2026-10-11)

Eleven rooms for the Build tray's Wizard's tower type (`experiments/2026-10-11-wizard-tower/wizard/rooms.json` holds the room definitions for integration). The older recipes stay where they are (`arc-alchemy-bench`, `arc-reagent-store`, `arc-summoning-chamber` and the rest in `rooms-alchemist.md`; `arc-alchemist-lab`, `arc-wizard-sanctum` in `room-recipes.md`): they list the table-top smalls. These list what a room is laid out from at table distance. Semantic roles are shared with the other types on purpose (a bed is `bed-canopy`, a bookcase `bookshelf`, a work table `table-kitchen-prep`), so a recipe changes genre by choosing a family and a tier.

### arc-tower-shell P2
- walls: wall-straight, wall-doorway, wall-window-small, wall-shop-window
- floor: floor-flagstone-square, floor-planks-dark, floor-checker-stone, floor-tile-hex, floor-tile-encaustic, floor-planks-worn
- openings: door-tower, door-reinforced, door-plank
- supports: pillar-square

### arc-tower-laboratory P2
- anchor: alch-athanor, alch-bench-dressed, alch-still-copper-large, alch-cauldron-bubbling-green
- furnish: table-kitchen-prep, stool-three-leg, alch-homunculus-vat, alch-specimen-jar-large, table-experiment
- store: alch-reagent-shelf-tall, apothecary-drawers, alch-carboy-wicker, barrel, shelving-freestanding
- light: candle-tree, candlestand-pricket, lantern-hanging, sconce-candle-single, brazier-tripod
- dress: alembic, alch-retort, mortar-pestle, potion-bottles, alch-vial-rack, book-open, book-stack, skull-single, bottle-cluster, jar-lidded-stoneware, alch-mandrake-pot, cauldron

### arc-tower-study P2
- anchor: desk-writing, spellbook-lectern, bookshelf, desk-partners
- furnish: chair-armed, table-library, scroll-rack, staff-rack, armillary-great, trade-globe-terrestrial, library-steps, alch-formula-chalkboard, cabinet-curios, chair-upholstered
- light: candle-tree, candlestick, candlestand-pricket, sconce-candle-single, lantern-hanging
- dress: book-pile-floor, book-stack, book-open, tome-grimoire, scroll-pile, inkwell-quill, map-rolled, crystal-ball, alch-hourglass-sand-colored, skull-single, statue-bust, rug-round, map-wall

### arc-tower-summoning P2
- anchor: decal-ritual-circle, arcane-pylon, elemental-brazier
- furnish: spellbook-lectern, pedestal-display, chest-ironbound
- light: rite-pillar-candle-tall, candle-drippings-mound, elemental-brazier, torch-sconce, candlestick-floor
- dress: tome-grimoire, skull-single, skull-candle, crystal-glowing, scroll-pile, decal-blood

### arc-tower-observatory P2
- anchor: telescope-great, armillary-great, orrery, decal-star-floor
- furnish: telescope, table-library, chair-armed, desk-writing, trade-globe-terrestrial, library-steps, bookshelf
- light: candle-tree, lantern-hanging, candlestand-pricket
- dress: map-rolled, book-open, book-stack, scroll-pile, alch-hourglass-sand-colored, map-wall, inkwell-quill

### arc-tower-scrying P2
- anchor: scrying-pool, orb-socket-pedestal, mirror-standing
- furnish: table-round-small, chair-armed, pillows-cushions, stool-three-leg, pedestal-display
- light: candle-tree, candlestick-floor, brazier-tripod, rite-pillar-candle-tall
- dress: crystal-ball, curtains-drapes, rug-round, candle, tome-grimoire, crystal-glowing, hand-mirror

### arc-tower-store P2
- anchor: alch-reagent-shelf-tall, apothecary-drawers
- store: cabinet-curios, shelving-freestanding, alch-potion-crate-straw, alch-carboy-wicker, barrel, crate, sack, storage-jar, alch-specimen-jar-large, chest-plain
- light: lantern-hanging, lantern-wall-iron, candlestick
- dress: potion-bottles, bottle-cluster, jar-lidded-stoneware, mortar-pestle, herb-bundle-fresh, dried-herbs-jar, skull-single, specimen-jar

### arc-tower-apothecary P2
- anchor: alch-counter-apothecary, counter-shop, apothecary-drawers, wall-shop-window
- furnish: alch-reagent-shelf-tall, cabinet-curios, stool-bar, bench-long, shelf-wall
- store: alch-potion-crate-straw, alch-carboy-wicker, barrel, crate
- light: lantern-hanging, candlestick, sconce-candle-single
- dress: alch-sign-apothecary, scales-balance, mortar-pestle, potion-bottles, bottle-cluster, alch-mandrake-pot, ledger-counter-bell, herb-bundle-fresh, plant-pot, rug-small

### arc-tower-bedchamber P2
- anchor: bed-canopy, hatstand-wizard
- furnish: table-side, wardrobe, trunk-travel, desk-bureau, chair-upholstered, bookshelf, alch-familiar-perch, washstand, mirror-standing
- light: candlestick, candle-tree, sconce-candle-single, fireplace-wall
- dress: book-stack, book-pile-floor, wizard-hat, cat-bed-basket, rug-round, rug-sheepskin, crystal-ball, tome-grimoire, curtains-drapes

### arc-tower-menagerie P2
- anchor: birdcage-standing, perch-tree, cage-floor, vivarium
- furnish: animal-hutch, alch-familiar-perch, egg-nest-great, cat-tree, feed-trough, table-kitchen-prep
- store: sack, grain-bin-stable, barrel, rural-water-bucket-stable, hay-bale
- light: lantern-hanging, lantern-wall-iron, lantern-post-indoor
- dress: cat-bed-basket, nest-bird, rug-hay-scatter, fern-potted, rural-feed-sack-open, plant-pot

### arc-tower-stair P2
- anchor: stair-spiral-wide, statue-bust
- furnish: bookshelf, bench-long, chest-plain, pedestal-display, armillary-great
- light: torch-sconce, lantern-wall-iron, candle-tree
- dress: tapestry, rug-runner, book-pile-floor, staff-rack, map-wall

### arc-tower-workshop P2
- anchor: enchanting-table, portal-arch, arcane-pylon
- furnish: table-kitchen-prep, staff-rack, crystal-formation, scroll-rack, cabinet-curios, chest-ironbound, stool-three-leg, pedestal-display
- light: elemental-brazier, candle-tree, lantern-hanging, crystal-glowing
- dress: tome-grimoire, scroll-pile, crystal-ball, potion-bottles, book-stack, alch-hourglass-sand-colored
