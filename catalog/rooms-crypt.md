# Crypt rooms — recipes for the crypt type (2026-10-05)

Seven rooms for the Build tray's Crypt type (`experiments/2026-10-05-castle-crypt-mansion/crypt/rooms.json` holds the room definitions for integration). The recipes that already existed stay where they are and are reused by these rooms: `cry-crypt` and `cry-royal-tomb` (burial vault), `cry-catacombs` (catacomb corridor and ossuary), `cry-embalming-room` (embalming room), `cry-grave-offerings` (smalls). The wall style is the `crypt-stone` family; a crypt has no windows.

### cry-shell P1
- walls: wall-straight, wall-doorway, wall-crypt-niches, ossuary-wall, tomb-door-sealed
- floor: floor-tomb-slabs, floor-flagstone-damp, floor-flagstone-broken, floor-flagstone-large, floor-earth-packed, floor-bone-strewn
- openings: door-crypt, crypt-gate-iron, door-reinforced
- supports: pillar-square, ossuary-pillar

### cry-antechamber P1
- anchor: statue-weeping-angel, monument-urn-draped, crypt-gate-iron, door-crypt
- furnish: bench-stone, urn-decorative, pillar-square, pedestal-display
- light: brazier-standing, torch-sconce, torch-bracket-rough, brazier-tripod, torch-stand, rite-sacred-flame-bowl
- dress: burial-urn-niche, rite-death-mask, decal-cobweb, rite-memorial-plaque, tomb-door-sealed, decal-moss, candle-drippings-mound

### cry-burial-vault P1
- anchor: sarcophagus, wall-crypt-niches, coffin, effigy-knight, stone-coffin-lidless
- furnish: tomb-slab, pillar-square, bench-stone, rite-mummified-remains, monument-urn-draped
- light: torch-sconce, torch-bracket-rough, rite-pillar-candle-tall, candlestand-pricket, candle-tree, candlestick-floor
- dress: burial-urn-niche, rite-death-mask, skull-single, rite-canopic-jars-set, urn-decorative, rite-memorial-plaque, candle-drippings-mound, decal-cobweb, decal-grave-ledger

### cry-ossuary P1
- anchor: ossuary-shrine, ossuary-wall, skull-pile, ossuary-pillar
- furnish: catacomb-shelf-bones, bones-pile, charnel-trough
- light: torch-bracket-rough, rite-bone-candelabra, rite-pillar-candle-tall, skull-candle, candle-drippings-mound
- dress: skull-single, decal-cobweb, burial-urn-niche, urn-ashes-small, decal-bones-scatter

### cry-catacomb-corridor P1
- anchor: wall-crypt-niches, catacomb-shelf-bones, burial-urn-niche
- furnish: coffin, skull-pile, bones-pile, rite-mummified-remains, stone-coffin-lidless
- light: torch-sconce, torch-bracket-rough, lantern-wall-iron
- dress: decal-cobweb, skull-single, candle-drippings-mound, decal-bones-scatter, rite-memorial-plaque, decal-moss

### cry-chapel-of-rest P1
- anchor: altar-stone, statue-weeping-angel, monument-urn-draped, rite-funeral-pall, rite-funeral-bier
- furnish: bench-stone, pew, lectern, statue-deity
- light: rite-pillar-candle-tall, rite-sanctuary-lamp, candelabra, candle-tree, candlestand-pricket, candlestick-floor, rite-memorial-sand-tray, sconce-candle-single
- dress: rite-altar-cloth, rite-offering-candles-tray, holy-symbol-sun, censer-hanging, urn-decorative, tome-holy, vase-flowers, flowers-dried, rite-memorial-plaque

### cry-embalming-workroom P1
- anchor: embalming-table, rite-corpse-on-slab
- furnish: table-kitchen-prep, shelving-freestanding, natron-tub, coffin, coffin-maker-stack, washstand, basin-stone
- store: rite-canopic-jar, rite-canopic-jars-set, bucket, jar-lidded-stoneware, storage-jar, oil-jar, linen-wrappings-basket
- light: candle, lantern-hanging, candlestick, lantern-wall-iron
- dress: rite-embalming-tools, rite-burial-shroud-folded, rite-death-mask, shelf-wall, bucket-slop

### cry-relic-chamber P1
- anchor: reliquary-shrine, pedestal-display, chest-treasure
- store: chest-ironbound, chest-plain, coin-pile, rite-grave-goods-pile, urn-decorative
- light: torch-sconce, torch-bracket-rough, brazier-standing, brazier-tripod, rite-sacred-flame-bowl, candlestand-pricket
- dress: casket-ornate, rite-death-mask, coin-stack, reliquary, reliquary-hand, rite-relic-bone-fragment, urn-ashes-small, monument-urn-draped
