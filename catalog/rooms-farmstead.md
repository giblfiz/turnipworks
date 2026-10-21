# Farmstead rooms — recipes for the Farmstead type (2026-10-11)

Sixteen rooms for the Build tray's Farmstead type, code `HUT` (room definitions: `tools/spawn-tuner/build_data.py`, block `type:hut`; rules in words: `tools/spawn-tuner/ROOMS.md` → Farmstead). Built from the library as it stood: no mesh was generated for this type (the image allowance was spent when it started), so every slot below names roles that already had a mesh, plus the roles the room still WANTS (they show as `missing` in `rooms.json` and are listed in `docs/ASSETS_TO_BUILD.md` → Farmstead). The older `hut-*` recipes stay where they are and are reused: `hut-cottage`, `hut-peasant-supper`, `hut-supper`, `hut-kitchen-lived-in`, `hut-kitchen-shelf`, `hut-byre`, `hut-yard`, `hut-farmyard-tools`, `hut-dairy`, `hut-dairy-and-apiary`, `hut-farmyard-pens`, `hut-harvest-field`, `hut-fields`, `hut-orchard-farmland`, `hut-farmstead-grounds`, `hut-barn-tools`.

Animals are figures, not props (`tools/spawn-tuner/data/figures.json`: cow, ox, pig, sheep, goat, chicken, mule, pony, dog, cat; the scarecrow is a figure too). A byre, a sty and a coop are dressed EMPTY and read by their stalls, troughs and straw.

### hut-farm-cottage P2
- anchor: hearth-central, hearth-raised-square, bed-straw-pallet, bed-single
- furnish: table-square, table-trestle, stool-three-leg, bench-long, chest-plain, settle
- store: sack, barrel, crate, shelf-wall, storage-jar, baskets-stack, firewood-basket, bucket
- light: rushlight-holder, rushlight-holder-wall, candle-stubs-dish, candle, lantern-hand
- dress: cooking-pot, cauldron, bowl-wood-small, bread-loaf, turnip-pile, onion-string, garlic-braid, herb-bundle-fresh, broom, rug-rush-mat, rug-sheepskin, coat-pegs, pitchfork, spade-garden, kindling-bundle
- wants: cradle, spinning-wheel, quern-hand, pot-hook-tripod

### hut-farm-kitchen P2
- anchor: cook-hearth-spit, fireplace-wall, table-trestle
- furnish: bench-long, settle, rocking-chair, stool-three-leg, dresser-plates, cupboard, table-kitchen-prep, chair-plain, butter-churn
- store: flour-bin, barrel, sack, crate, storage-jar, shelf-wall, utensil-rack-wall, baskets-stack, firewood-basket
- light: candle, candlestick, lantern-hanging, rushlight-holder-wall, lamp-wall-shelf
- dress: ham-hanging, onion-string, sausage-string, garlic-braid, dried-fruit-string, cauldron, stew-pot-full, bread-loaf, cheese-wheel, pitcher-of-milk, bowl-wood-small, plate-wood-round, jug-clay, butter-crock, washtub, broom, bucket, cat-bed-basket, rug-braided-round, rug-rush-mat, fire-irons, egg-basket
- wants: spinning-wheel, bread-trough-kneading, cradle

### hut-farm-bedroom P2
- anchor: bed-double, bed-single
- furnish: chest-plain, table-side, stool-three-leg, washstand, wardrobe, cot
- store: linen-chest, basket-laundry, coat-pegs, shelf-wall
- light: candle, candlestick, rushlight-holder
- dress: rug-braided-round, rug-sheepskin, rug-rush-mat, quilt-rack, blankets-folded, clothes-folded, chamber-pot, water-jug-basin, boots-row
- wants: cradle, truckle-bed

### hut-farm-loft P2
- anchor: bed-straw-pallet, bedroll, cot, loft-ladder-head
- furnish: chest-plain, crate, stool-three-leg
- store: sack, grain-sack-open, apple-crate, hay-bale, hay-pile, baskets-stack, barrel
- light: lantern-hand, rushlight-holder, candle-stubs-dish
- dress: onion-string, dried-fruit-string, herb-bundle-fresh, blankets-folded, bundle-wrapped, rug-hay-scatter, ladder-wood, rug-sheepskin
- wants: apple-rack-slatted

### hut-farm-passage P2
- anchor: bench-long, coat-pegs
- furnish: chest-plain, barrel, crate
- store: sack, bucket, baskets-stack, firewood-basket, boots-row
- light: rural-lantern-barn, rushlight-holder-wall, lantern-pierced-tin
- dress: broom, garden-tools-leaning, pitchfork, spade-garden, cloak-hanging, rope-coil, rug-rush-mat, horse-collar, kindling-bundle

### hut-farm-root-cellar P2
- anchor: shelving-freestanding, potato-pile, turnip-pile, root-sand-box
- furnish: crate, barrel, storage-jar, cheese-shelf-aging
- store: potato-crate, cabbage-crate, apple-crate, vegetable-crate-mixed, potato-sack-open, sack, onion-pile, carrot-pile, demijohn, jars-preserves, sauerkraut-crock
- light: lantern-hand, rural-lantern-barn, candle-stubs-dish
- dress: onion-string, garlic-braid, ham-hanging, dried-fruit-string, ladder-wood, bucket, cheese-wheel, apple-basket, turnip-basket
- wants: cellar-steps-earth

### hut-farm-byre P2
- anchor: stable-stall, stable-stall-partition, stable-stall-gate, rural-manger-wall, feed-trough
- furnish: stool-three-leg, bucket, hay-bale, hay-pile, grain-bin-stable, rural-milk-churn-tall
- store: rural-feed-sack-open, rural-oat-sack, rural-straw-bundle, rural-manure-barrow, wheelbarrow, salt-block
- light: rural-lantern-barn, lantern-hanging
- dress: pitchfork, rake, broom, rural-halter-rope, rug-hay-scatter, rural-straw-bedding, rural-water-bucket-stable, pitcher-of-milk
- wants: rural-stool-milking, cowbell, craft-yoke-ox, dung-fork

### hut-farm-coop P2
- anchor: crate, nest-bird, ladder-wood, nest-box-row, chicken-perch-ladder
- furnish: feed-trough, rural-feed-sack-open, grain-sack-open, bucket
- store: hay-pile, rural-straw-bundle, eggs-bowl, egg, egg-basket
- light: rural-lantern-barn
- dress: rural-straw-bedding, rug-hay-scatter, rural-water-bucket-stable, broom, basket-laundry
- wants: rural-nest-box-straw, rural-chicken-feeder

### hut-farm-pigsty P2
- anchor: feed-trough, fence-wattle, fence-post-corner, gate-fence, dog-kennel, pigsty
- furnish: water-trough, bucket-slop, manure-heap, hay-pile
- store: rural-feed-sack-open, turnip-pile, barrel
- dress: puddle, decal-dirt-patch, rural-straw-bedding, rug-hay-scatter, pitchfork, refuse-pile
- wants: rural-pig-sty-trough, rural-mud-wallow, rural-pen-gate-hurdle

### hut-farm-hay-barn P2
- anchor: wagon, hay-pile, hay-bale, haystack-field
- furnish: cart-hand, wheelbarrow, grindstone, sawhorse, ladder-wood, feed-trough, plough, rural-grain-stook
- store: sack, barrel, crate, rural-straw-bundle, grain-bin-stable, rural-feed-sack-open, wheel-spare
- light: rural-lantern-barn, lantern-hanging
- dress: pitchfork, rake, spade-garden, garden-tools-leaning, horse-collar, rural-harness-draft, rope-coil, rug-hay-scatter, broom
- wants: rural-hay-rake-wooden, rural-harrow, rural-plough-share, scythe

### hut-farm-granary P2
- anchor: grain-bin-stable, flour-bin, sack, rural-grain-heap-threshed
- furnish: barrel, grain-sack-open, barley-sack, rural-oat-sack, malt-sacks, beans-dried-sack, crate, grindstone, cart-hand
- store: rural-straw-bundle, hay-pile, storage-jar, baskets-stack
- light: rural-lantern-barn, lantern-hanging
- dress: pitchfork, rake, broom, sieve-wooden-drum, scoop-flour, rural-feed-scoop, rope-coil, mousetrap-cheese, rug-hay-scatter, cat-bed-basket, ladder-wood, winnowing-basket, rural-grain-stook
- wants: rural-threshing-floor-flail-pair, rural-chaff-pile, quern-hand, staddle-stones

### hut-farm-dairy P2
- anchor: table-kitchen-prep, cheese-shelf-aging, trade-cheese-aging-shelf, cider-press, cheese-press, butter-churn
- furnish: washtub, trade-salting-trough, storage-jar, stool-three-leg, shelf-wall, barrel, rural-milk-churn-tall
- store: bucket, cheese-stack, demijohn, crate
- light: lantern-hanging, rural-lantern-barn
- dress: cheese-wheel, cheese-small-round, cheese-wax-sealed, butter-crock, butter-dish, curds-bowl, cream-jug, pitcher-of-milk, jug-clay, crock, dish-tub, towel-hanging, ladle, sieve-hair, salt-box
- wants: trade-cheese-vat, rural-cheese-mould, trade-curds-draining

### hut-farm-garden P2
- anchor: vegetable-patch, trade-herb-bed, fence-wattle, fence-post-corner, gate-fence
- furnish: compost-heap, rain-barrel, wheelbarrow, planter-barrel, bench-garden, bean-poles-wigwam, beehive-skep, scarecrow-post
- plants: bush-berry, bush, flowerbed
- store: turnip-basket, vegetable-basket-mixed, cabbage-crate, vegetable-crate-mixed, bucket
- dress: spade-garden, rake, watering-can, trowel-garden, turnip-pile, decal-path-worn, decal-dirt-patch, trellis-vine
- wants: cold-frame

### hut-farm-field P2
- anchor: decal-dirt-patch, fence-post-rail, fence-post-corner, gate-fence, hay-bale, rural-grain-stook, haystack-field
- furnish: rural-straw-bundle, hay-pile, cart-hand, wagon, wheelbarrow, plough, scarecrow-post
- plants: tree-deciduous, bush, bush-berry
- store: sack, grain-sack-open, turnip-pile, potato-pile
- dress: pitchfork, rake, spade-garden, decal-grass-tuft, decal-path-worn, signpost
- wants: crop-field-tile, stile, rural-harrow, rural-plough-share

### hut-farm-orchard P2
- anchor: tree-fruit, wall-drystone, wall-drystone-pier, wall-drystone-gate
- furnish: apple-crate, fruit-crate-mixed, log-seat, bench-garden, wheelbarrow, cart-hand, cider-press, beehive-skep
- plants: bush-berry, tree-fruit
- store: apple-basket, apple-pile, barrel, sack
- dress: decal-grass-tuft, decal-path-worn, bucket
- wants: rural-apple-ladder, rural-beehive-box, windfall-apples-scatter

### hut-farm-farmyard P2
- anchor: well, well-house, fence-wattle, fence-post-rail, fence-post-corner, gate-fence
- furnish: water-trough, feed-trough, woodpile, woodpile-long, chopping-block, wagon, cart-hand, manure-heap, dog-kennel, hitching-post, woodshed, outhouse, cart-shed, haystack-field, dovecote, plough
- plants: tree-deciduous, bush, bush-berry, tree-fruit
- store: hay-bale, barrel, rain-barrel, bucket, sack, wheelbarrow
- dress: decal-path-worn, decal-dirt-patch, puddle, rug-hay-scatter, pitchfork, axe-woodcutter, clothesline, washtub, compost-heap, grindstone
- wants: rural-hurdle-wattle, dung-heap, mounting-stone
