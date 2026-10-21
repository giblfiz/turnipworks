# Inn rooms — recipes added for the first generation run (2026-09-30)

### tav-hallway P1
- anchor: wall-straight, door-plank, door-reinforced, stair-straight, stair-landing
- furnish: bench-long, table-side, chest-plain, coat-pegs
- light: torch-sconce, candle, lantern-hanging, lantern-wall-iron, lantern-wall-brass, sconce-candle-single, torch-bracket-fine, lamp-wall-bracket, lantern-post-indoor
- dress: rug-runner, painting-landscape, railing-wood, gallery-interior, key-hook-board, broom, rug-oval

### tav-front-desk P1
- anchor: counter-shop, sign-hanging, door-double-grand
- store: strongbox, key-hook-board, shelf-wall
- light: candlestick, lantern-hanging, lamp-oil-brass, lamp-wall-shelf, lantern-wall-brass
- dress: ledger-counter-bell, ledger-accounts, key-simple, key-ring, notice-board, coin-stack, rug-striped-woven, rug-oval

### tav-privy P1
- anchor: privy-seat-single, privy-seat-double, outhouse
- store: bucket-slop, chamber-pot, bucket
- light: candle, lantern-hand, sconce-candle-single
- dress: washstand, water-jug-basin, broom, mop

### tav-guest-room-fine P1
- anchor: bed-canopy, fireplace-wall, wardrobe
- furnish: chair-upholstered, table-vanity, desk-writing, table-side, screen-folding
- store: linen-chest, chest-ironbound, quilt-rack
- light: candelabra, candlestick, sconce-candle-triple, lantern-wall-brass, lamp-pole, candlestand-pricket, lamp-oil-brass
- dress: rug-grand, curtains-drapes, painting-portrait, mirror-standing, washstand, chamber-pot, bathtub-wood, pillows-cushions, vase-flowers, rug-round-fine, rug-bearskin, rug-sheepskin, rug-oval, mirror-wall

### tav-storeroom P1
- anchor: shelving-freestanding, cask-rack, floor-trapdoor
- store: barrel, crate, sack, potato-sack-open, apple-crate, wine-rack, strongbox
- light: lantern-hand, candle, torch-bracket-rough
- dress: ham-hanging, cheese-wheel, onion-string, turnip-pile, rope-coil, mousetrap-cheese, broom, ledger-accounts

### tav-barn P1
- anchor: door-barn-double, stable-stall, floor-hayloft, ladder-wood, stable-stall-gate, stable-stall-partition
- furnish: hay-bale, hay-pile, feed-trough, water-trough, wagon, cart-hand
- store: saddle-rack, sack, barrel, bridle-hanging, horse-collar
- light: lantern-hanging, lantern-hand, lantern-pierced-tin, torch-bracket-rough, rural-lantern-barn
- dress: pitchfork, wheelbarrow, rural-curry-comb, rural-hoof-pick, horseshoe-single, manure-heap, blankets-folded, rural-saddle-riding, rug-hay-scatter, decal-dirt-patch

## Outdoors (2026-10-05)

The yard is a room with no walls (`tools/spawn-tuner/ROOMS.md` → Outdoors). `plants` and `edge` are slots the yard grammar reads by name: they are empty until those meshes exist and fill by themselves when they do (`docs/ASSETS_TO_BUILD.md`). The yard's ground materials are floors (`any-shell` → floor; the room type's `floors` list in `tools/spawn-tuner/build_data.py`).

### tav-yard P1
- anchor: well, horse-trough-stone, firepit-stone-round, firepit-log-spit, well-house
- furnish: bench-village, bench-street, bench-long, woodpile, woodpile-long, chopping-block, cart-hand, hitching-post, water-trough, feed-trough, notice-board, rural-mounting-block, outhouse, woodshed, cart-shed, wagon, table-picnic, sign-post-inn, log-seat
- store: barrel, crate, rain-barrel, sack, hay-bale, bucket, baskets-stack, bottles-empty-crate, firewood-basket, vegetable-crate-mixed, cabbage-crate, potato-crate, apple-crate, washtub, washboard-tub, wheelbarrow, rural-manure-barrow, manure-heap, turnip-pile, broom, compost-heap
- light: lantern-post, lamp-post-wood, torch-stand, lantern-wall-iron, lantern-wall-brass, lantern-wall-horn, lamp-wall-bracket, lantern-pierced-tin, rural-lantern-barn, torch-bracket-rough
- dress: sign-hanging, bounty-poster, proclamation-scroll, rug-hay-scatter, decal-path-worn, decal-grass-tuft, decal-grass-worn, flowerbox-window, trellis-vine, garden-tools-leaning, clothesline, dog-kennel, trade-herb-bed, vegetable-patch
- plants: bush, bush-berry, planter-barrel, flowerbed, planter-stone, tree-deciduous, tree-fruit, tree-birch, tree-oak-great, grass-tall, flowers-wild
- edge: fence-post-rail, fence-wattle, fence-picket, fence-post-corner, gate-fence, hedge-straight, hedge-corner, hedge-end-block, hedge-gap-arch, wall-drystone, wall-drystone-gate, wall-drystone-pier
