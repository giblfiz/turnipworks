"""Room recipes of the culture packs (catalog/rooms-culture-<pack>.md), written by apply.py. The programs (cb:solver2 data
blocks) put things down by name; a recipe's slots are what the classic engine and the library shelves read."""
R = {
 'nrs': {
  'nrs-longhouse': dict(anchor='nrs-long-hearth, nrs-sleeping-platform, nrs-roof-post', furnish='nrs-loom, nrs-sea-chest, nrs-quern, nrs-wool-baskets, cauldron-crane, stool-three-leg',
                        store='barrel, sack, grain-sack-open, crate', light='lantern-wall-horn, torch-bracket-rough', dress='rug-sheepskin, rug-fur, nrs-shield-row'),
  'nrs-meadhall': dict(anchor='nrs-high-seat, nrs-long-hearth, nrs-roof-post', furnish='table-trestle, bench-long, nrs-sleeping-platform, nrs-spear-rack, nrs-sea-chest',
                       store='barrel', light='lantern-wall-horn, torch-bracket-rough', dress='nrs-shield-row, rug-bearskin, horn-drinking-banded, tankard-horn'),
  'nrs-smithy': dict(anchor='nrs-forge, anvil, quench-trough', furnish='nrs-spear-rack, grindstone, nrs-sea-chest, table-work', store='smith-coal-heap, coal-bin, woodpile, barrel',
                     light='lantern-wall-horn, torch-bracket-rough', dress='tool-rack-smith'),
  'nrs-boathouse': dict(anchor='nrs-boat', furnish='nrs-oar-rack, nrs-sail-trestle, nrs-sea-chest', store='barrel, rope-coil, crate', light='lantern-wall-horn, torch-bracket-rough', dress='nrs-shield-row, bucket'),
  'nrs-weaving': dict(anchor='nrs-loom', furnish='nrs-wool-baskets, stool-three-leg, nrs-sea-chest, nrs-quern, hearth-central', store='sack, barrel', light='lantern-wall-horn, torch-bracket-rough', dress='rug-sheepskin'),
  'nrs-yard': dict(anchor='nrs-runestone, well', furnish='nrs-fish-rack, woodpile, hay-bale, cart-hand, chopping-block', plants='bush, tree-birch', edge='fence-wattle, fence-post-rail, fence-post-corner, gate-fence'),
 },
 'mde': {
  'mde-courtyard': dict(anchor='mde-floor-fountain, well', furnish='water-trough, mde-bales, mde-saddle-packs, mde-water-jar, hitching-post', edge='mde-arcade, mde-arcade-pier, mde-khan-gate'),
  'mde-souk': dict(anchor='counter-shop, shop-shelf-stocked', furnish='shop-floor-stock, craft-display-table-goods, mde-inlaid-chest', store='mde-bales, mde-water-jar, mde-saddle-packs', light='lantern-pierced-tin, lantern-wall-brass', dress='rug-striped-woven'),
  'mde-hammam': dict(anchor='mde-floor-fountain, mde-hammam-bench', furnish='mde-wall-basin, mde-water-jar', light='lantern-pierced-tin, lantern-wall-brass, oil-lamp', dress='bucket, bowl-wood-large'),
  'mde-audience': dict(anchor='mde-dais, mde-floor-fountain', furnish='mde-divan, mde-tray-table, mde-inlaid-chest, mde-water-jar', light='lantern-pierced-tin, lantern-wall-brass', dress='rug-grand, rug-striped-woven'),
  'mde-coffee': dict(anchor='mde-coffee-brazier, mde-divan', furnish='mde-tray-table, mde-water-jar', light='lantern-pierced-tin, lantern-wall-brass', dress='pillows-cushions, rug-striped-woven'),
  'mde-garden': dict(anchor='mde-floor-fountain, fountain-courtyard', furnish='citrus-tree-tub, flowerbed, bench-stone, trellis-vine, mde-water-jar', plants='palm-potted, planter-stone'),
 },
 'rus': {
  'rus-izba': dict(anchor='rus-stove', furnish='table-square, bench-long, rus-chest, stool-three-leg', light='rushlight-holder-wall, candle-box-sconce, rushlight-holder', dress='rus-icon-corner, rug-rush-mat, firewood-basket'),
  'rus-terem': dict(anchor='rus-tiled-stove, table-trestle', furnish='rus-high-chair, bench-long, rus-chest', light='sconce-candle-single, candle-box-sconce, candlestick-floor', dress='rus-icon-corner, table-runner-embroidered, rug-striped-woven'),
  'rus-banya': dict(anchor='rus-banya-heater, rus-banya-shelf', furnish='washtub, bathtub-wood, bench-long', light='rushlight-holder-wall, rushlight-holder', dress='rus-besom-rack, bucket'),
  'rus-church': dict(anchor='rus-iconostasis, altar-stone', furnish='rus-lectern, bench-long', light='candlestand-pricket, candle-tree', dress='rite-altar-cloth'),
  'rus-market': dict(anchor='counter-shop, shop-shelf-stocked', furnish='shop-floor-stock, rus-chest', store='barrel, sack', light='rushlight-holder-wall, candle-box-sconce'),
  'rus-yard': dict(anchor='rus-well-sweep, well', furnish='rus-sledge, woodpile, hay-pile, cart-hand, chopping-block', plants='tree-birch, bush', edge='rus-palisade, post-timber, rus-yard-gate'),
 },
 'mes': {
  'mes-shrine': dict(anchor='mes-altar, mes-brazier', furnish='mes-chacmool, mes-water-jar', dress='rug-rush-mat'),
  'mes-ballcourt': dict(anchor='mes-court-ring, mes-court-wall'),
  'mes-house': dict(anchor='mes-icpalli, mes-comal-hearth', furnish='mes-reed-chest, mes-metate, mes-water-jar, storage-jar', light='mes-brazier', dress='rug-rush-mat'),
  'mes-market': dict(anchor='mes-spread-maize, mes-spread-chilies, mes-spread-pottery, mes-spread-cloth', furnish='mes-awning, mes-water-jar'),
  'mes-chinampa': dict(anchor='mes-chinampa-bed', furnish='mes-ahuejote, mes-canoe'),
  'mes-scribe': dict(anchor='mes-codex-mat', furnish='mes-paint-pots, mes-reed-chest, mes-icpalli, mes-water-jar', light='mes-brazier', dress='rug-rush-mat'),
 },
}
