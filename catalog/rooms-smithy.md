# Smithy & workshop rooms — recipes added for the room type (2026-10-11)

The Smithy & workshop type in the Build tray (Genre → Type → Room): nine rooms. Each room type lists the recipe here TOGETHER with the older SMI recipes that already cover part of it (`smi-forge-room`, `smi-working-forge`, `smi-armorer-workshop`, `smi-carpenter-shop`, `smi-shopfront`, `smi-farrier-bay` …): see `experiments/2026-10-11-types/smi/README.md`.

**The workshop skeleton.** Every workshop recipe has the same roles: a heat source (anchor, where the craft has one), the workstation (anchor), a tool wall and a raw-material store (store), a rack of finished goods (furnish), a bench. The craft is one line of data in the room program (`tools/spawn-tuner/js/solver2.js` `SMI_CRAFTS`). The other crafts of the catalog (tanner, cooper, wheelwright, bowyer, glassblower, jeweller, locksmith, bell founder …) become rooms by adding a workstation and a stock list (`docs/ASSETS_TO_BUILD.md` → Smithy & workshop), not by writing a room.

The yard is an outdoor room like the inn's yard (`tav-yard` in `rooms-inn.md`): no walls of its own.

### smi-room-forge P1
- anchor: forge, anvil, bellows-great, quench-trough
- furnish: table-work, shop-shelf-stocked, weapon-rack, stool-three-leg, grindstone
- store: tool-rack-smith, smith-horseshoe-rack, coal-bin, metal-stock, smith-coal-heap, barrel, crate, smith-soot-bucket, bucket, firewood-basket
- light: lantern-wall-iron, torch-sconce, torch-bracket-rough, lantern-hanging
- dress: shop-sign, horseshoes-pile, warhammer, fire-irons, broom, bellows-hand

### smi-room-armoury P1
- anchor: smith-breastplate-on-form, mil-armor-repair-bench, table-work
- furnish: armor-stand, weapon-rack, shop-shelf-stocked, grindstone, stool-three-leg, anvil
- store: tool-rack-smith, metal-stock, shop-floor-stock, mil-shield-stack, chest-ironbound, crate, barrel
- light: lantern-wall-iron, torch-sconce, torch-bracket-rough, lantern-hanging
- dress: smith-helm-row-shelf, shield-display, mil-helmet-peg-rack, helm-open, helm-great, armor-breastplate, sword-long, sword-short, warhammer, heraldic-shield

### smi-room-carpenter P1
- anchor: carpenter-bench
- furnish: sawhorse, craft-chair-half-built, chair-plain, table-square, chest-plain, stool-three-leg, ladder-wood
- store: craft-tool-wall-pegboard, craft-boards-planed-stack, craft-wood-offcut-bin, woodpile, barrel, crate, wheel-spare
- light: lantern-wall-iron, lantern-hanging
- dress: craft-shavings-pile, axe-woodcutter, broom, bucket

### smi-room-potter P2
- anchor: kiln-pottery, potters-wheel
- furnish: table-work, pots-drying-shelf, stool-three-leg, shelving-freestanding
- store: clay-bin, pottery-for-sale, storage-jar, urn-garden, woodpile, firewood-basket, barrel, rural-water-bucket-stable, bucket
- light: lantern-wall-iron, lantern-hanging
- dress: jug-clay, bowl-clay, cup-clay, bottle-clay, broom

### smi-room-shopfront P1
- anchor: counter-shop, shop-shelf-stocked
- furnish: craft-display-table-goods, stool-three-leg, smith-breastplate-on-form, armor-stand, weapon-rack
- store: shop-floor-stock, chest-ironbound, crate, barrel, mil-shield-stack, pottery-for-sale, pots-drying-shelf
- light: lantern-wall-iron, lantern-hanging, lantern-wall-brass
- dress: shop-sign, price-board, horseshoes-pile, ledger-accounts, strongbox, shield-display, smith-helm-row-shelf, smith-horseshoe-rack

### smi-room-stock P2
- anchor: metal-stock, shelving-freestanding
- furnish: desk-writing, stool-three-leg
- store: coal-bin, smith-coal-heap, craft-boards-planed-stack, clay-bin, craft-wood-offcut-bin, woodpile, crate, barrel, sack, chest-ironbound, shop-floor-stock, stone-blocks-stack, wheel-spare
- light: lantern-wall-iron, lantern-hanging, torch-sconce
- dress: ledger-accounts, key-hook-board, broom, bucket

### smi-room-yard P1
- anchor: smith-shoeing-stocks, hitching-post
- furnish: horse-trough-stone, water-trough, farrier-stand, anvil, smelter, kiln-pottery, wagon, cart-hand, bench-village, log-seat, sawhorse, grindstone, craft-display-table-goods
- store: smith-coal-heap, coal-bin, craft-boards-planed-stack, woodpile, wheel-spare, rain-barrel, barrel, crate, stone-blocks-stack, smith-farrier-box, pottery-for-sale
- light: lantern-wall-iron, lantern-post, lamp-post-wood, torch-sconce
- dress: shop-sign, smith-horseshoe-rack, horseshoes-pile, bucket, rural-water-bucket-stable

### smi-room-quarters P2
- anchor: bed-single, bed-double
- furnish: chest-plain, table-square, chair-plain, washstand, wardrobe, stool-three-leg
- store: barrel, crate
- light: candlestick, lantern-wall-iron
- dress: coat-pegs, rug-striped-woven, broom

### smi-room-passage P2
- anchor: stair-straight
- furnish: bench-long
- store: barrel, crate, sack
- light: lantern-wall-iron, torch-sconce
- dress: coat-pegs, broom, key-hook-board
