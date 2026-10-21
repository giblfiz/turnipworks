# Market & village rooms — recipes added for the room type (2026-10-11)

The Market & village type in the Build tray (Genre → Type → Room): twelve rooms. Each room type lists the recipe here TOGETHER with the older MKT recipes that already cover part of it (`mkt-general-store`, `mkt-bakery`, `mkt-apothecary-shop`, `mkt-tailor`, `mkt-magic-shop`, `mkt-watch-post`, `mkt-square`, `mkt-town-street` …): see `experiments/2026-10-11-types/mkt/README.md` for the pairing.

**The shop skeleton.** Every shop recipe has the same five roles first (`counter-shop`, `shop-shelf-stocked`, `craft-display-table-goods`, `shop-floor-stock`, `shop-sign`); the trade is a sku tier on those roles (`catalog/objects-market.catalog.md`), plus one or two signature pieces. The forty-odd other MKT trade recipes (cobbler, chandler, fletcher, jeweller, potter …) become rooms by adding a tier of stock, not by writing a room.

The square and the street are outdoor rooms like the yard (`tav-yard` in `rooms-inn.md`): no walls of their own.

### mkt-shop-general P2
- anchor: counter-shop, shop-shelf-stocked, bins-dry-goods, wall-window-shop
- furnish: craft-display-table-goods, stool-three-leg, shelving-freestanding
- store: shop-floor-stock, barrel, crate, sack, baskets-stack, spice-sacks-open, pottery-for-sale, rope-coil
- light: lantern-hanging, lantern-wall-iron, candle
- dress: scales-balance, ledger-counter-bell, price-board, strongbox, shop-sign, bundle-wrapped, broom

### mkt-shop-bakery P2
- anchor: counter-shop, bread-oven, shop-shelf-stocked
- furnish: bread-rack, dough-trough, craft-display-table-goods, pretzel-rack
- store: shop-floor-stock, flour-bin, flour-sack-open, sack
- light: lantern-hanging, lantern-wall-iron, candle
- dress: bread-peel, pastry-tray, bread-loaf, bread-pile, bread-rolls-basket, cake-round, trade-loaf-tray-rising, trade-proofing-basket, scales-balance, ledger-counter-bell, price-board, trade-sign-pretzel

### mkt-shop-apothecary P2
- anchor: counter-shop, apothecary-drawers, shop-shelf-stocked
- furnish: craft-display-table-goods, stool-three-leg, table-side, trade-tincture-rack
- store: shop-floor-stock, spice-sacks-open, crate
- light: lantern-hanging, candle
- dress: scales-balance, dried-herbs-jar, herb-bundle-fresh, spice-jars, ledger-counter-bell, price-board, shop-sign

### mkt-shop-tailor P2
- anchor: counter-shop, shop-shelf-stocked, dress-form
- furnish: cutting-table-tailor, craft-display-table-goods, stool-three-leg
- store: shop-floor-stock, chest-plain, baskets-stack
- light: lantern-hanging, candlestick, candle
- dress: gown-on-form, clothes-folded, cloak-hanging, hat-wide-brim, boots-row, scales-balance, ledger-counter-bell, shop-sign, rug-striped-woven

### mkt-shop-curio P2
- anchor: counter-shop, display-case-glass, shop-shelf-stocked
- furnish: craft-display-table-goods
- store: shop-floor-stock, chest-ironbound
- light: lantern-hanging, candle
- dress: bard-masks-theatre, scales-balance, ledger-counter-bell, shop-sign

### mkt-shop-backroom P2
- anchor: shelving-freestanding, shop-shelf-stocked
- furnish: stool-three-leg, ladder-wood
- store: crate, barrel, sack, shop-floor-stock, baskets-stack, chest-plain, strongbox, firkin, bundle-wrapped, rug-merchant-stack, fish-barrel-salted, pottery-for-sale
- light: lantern-hanging, lantern-hand, candle
- dress: ledger-accounts, broom, rope-coil

### mkt-shop-passage P2
- anchor: stair-straight
- furnish: table-side, chest-plain
- light: lantern-wall-iron, lantern-hanging
- dress: boots-row, cloak-hanging, broom

### mkt-watch-house P2
- anchor: watch-desk, cell-holding-wood
- furnish: chair-plain, stool-three-leg
- store: weapon-rack, chest-ironbound
- light: mil-guard-lantern, lantern-wall-iron, lantern-hanging
- dress: notice-board, bounty-poster, proclamation-scroll, watch-lantern-bell, bucket, stocks

### mkt-town-house P2
- furnish: chair-plain, cupboard, stool-three-leg
- store: chest-plain, baskets-stack, barrel
- light: candlestick, candle, lantern-hanging, oil-lamp
- dress: cooking-pot, plate, bread-loaf, pitcher, mug-glazed, bowl, shelf-wall, broom

### mkt-town-bedroom P2
- furnish: table-side, chair-plain, stool-three-leg
- store: chest-plain
- light: candlestick, candle, oil-lamp
- dress: rug-small, water-jug-basin, blankets-folded, pillows-cushions

### mkt-market-square P2
- anchor: market-stall, market-cross, well, well-house, fountain-courtyard, pump-trough-village
- furnish: craft-display-table-goods, cart-merchant-covered, cart-hand, wagon, town-crier-platform, bench-village, bench-street, stocks, pillory
- store: shop-floor-stock, pottery-for-sale, rug-merchant-stack, spice-sacks-open, fish-barrel-salted, flower-buckets, apple-crate, cabbage-crate, vegetable-crate-mixed, fruit-crate-mixed, potato-crate, barrel, crate, sack, baskets-stack, turnip-pile
- light: lamp-post-iron, lamp-post-wood, lantern-post
- dress: notice-board, signpost, bollard-stone, awning, shop-sign, sign-hanging, planter-stone, planter-barrel, horse-trough-stone, hitching-post
- plants: planter-barrel, planter-stone
- edge: bollard-stone

### mkt-street P2
- anchor: lamp-post-iron, lamp-post-wood, lantern-post
- furnish: bench-street, bench-village, horse-trough-stone, pump-trough-village, hitching-post, cart-hand, cart-merchant-covered, wagon
- store: barrel, crate, sack, rain-barrel, flower-buckets, shop-floor-stock
- light: lantern-wall-iron
- dress: shop-sign, sign-hanging, trade-sign-pretzel, awning, bollard-stone, notice-board, signpost, planter-stone, planter-barrel, flowerbox-window
- plants: planter-barrel, planter-stone
- edge: bollard-stone
