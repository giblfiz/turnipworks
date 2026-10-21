# Mine rooms — recipes for the Mine type (2026-10-11)

Thirteen rooms for the Build tray's Mine type (room definitions: `tools/spawn-tuner/build_data.py`, block `type:min`; rules in words: `tools/spawn-tuner/ROOMS.md` → Mine). The recipes that already existed stay where they are and are reused beside these: `min-gallery`, `min-ore-face`, `min-working-face`, `min-shaft-head`, `min-tool-store`, `min-ore-sorting`, `min-strike`. Every slot ends in pieces the library already had, so the rooms solve while the mine's own meshes are still to be made.

### min-shell P2
- walls: wall-straight, wall-doorway
- floor: floor-cut-rock, floor-earth-packed, floor-earth-bare, floor-flagstone-broken, floor-water-flooded
- openings: door-plank, door-reinforced
- supports: shoring-timber, post-timber

### min-tunnel P2
- anchor: mine-rail-strip, shoring-timber, mine-cart
- furnish: wheelbarrow, cart-hand, rural-pit-props-stack, ore-pile, collapse-rubble, rubble-pile
- store: crate, barrel
- light: lantern-wall-iron, lantern-wall-horn, torch-bracket-rough
- dress: rural-sign-danger-mine, decal-rubble-scatter, decal-ore-scatter, decal-cracks, decal-coal-dust, puddle

### min-junction P2
- anchor: mine-rail-cross, shoring-timber, signpost
- furnish: mine-cart, wheelbarrow, rural-pit-props-stack, ore-pile, mine-tool-rack
- store: crate, barrel, sack
- light: lantern-wall-iron, lantern-wall-horn
- dress: decal-rubble-scatter, decal-ore-scatter, decal-cracks

### min-face P2
- anchor: ore-vein, collapse-rubble, rubble-pile
- furnish: mine-cart, wheelbarrow, shoring-timber, mine-tool-rack, garden-tools-leaning
- store: ore-pile, rural-tailings-pile, mil-catapult-stones, crate, bucket
- light: lantern-post-indoor, lantern-wall-iron
- dress: decal-rubble-scatter, decal-ore-scatter, decal-cracks, mine-rail-end

### min-collapsed P2
- anchor: collapse-rubble, rubble-pile, shoring-timber
- furnish: rural-ore-cart-tipped, mine-cart, wheelbarrow, beam-collapsed, ceiling-slab-fallen
- light: lantern-wall-iron
- dress: rural-sign-danger-mine, decal-rubble-scatter, decal-cracks, mine-rail-strip

### min-flooded P2
- anchor: rural-water-pump-mine, post-timber, collapse-rubble
- furnish: mine-cart, wheelbarrow, flotsam-crate, barrel, crate, bucket
- store: rural-pit-props-stack, rubble-pile
- light: lantern-wall-iron, lantern-wall-horn

### min-shaft P2
- anchor: mine-shaft-collar, pit-open, well, windlass, ladder-wood
- furnish: rural-ore-bucket, bucket, mine-cart, wheelbarrow, watch-lantern-bell, mine-lamp-rack, mine-tool-rack
- store: crate, barrel, sack, rural-pit-props-stack
- light: lantern-wall-iron, lantern-wall-horn
- dress: mil-helmet-peg-rack, coat-pegs, rural-sign-danger-mine, decal-rubble-scatter, decal-ore-scatter, puddle

### min-sorting P2
- anchor: sorting-table, table-trestle, table-square, ore-pile, rural-tailings-pile
- furnish: mine-cart, wheelbarrow, mine-rail-strip, mil-catapult-stones, stone-blocks-stack
- store: crate, barrel, sack, bucket
- light: lantern-wall-iron, lantern-wall-horn
- dress: sieve-wooden-drum, salt-block, decal-ore-scatter, decal-rubble-scatter, decal-coal-dust

### min-tools P2
- anchor: mine-tool-rack, garden-tools-leaning, rural-pit-props-stack
- furnish: spade-garden, axe-woodcutter, ladder-wood, sawhorse, grindstone, wheelbarrow, lumber-pile
- store: crate, barrel, sack, bucket, shelving-freestanding
- light: lantern-wall-iron
- dress: mil-helmet-peg-rack, coat-pegs, key-hook-board

### min-mess P2
- anchor: table-trestle, table-square, cauldron-crane, firepit-stone-round
- furnish: bench-long, stool-three-leg, bunk-bed, cot, brazier-standing
- store: barrel, crate, rain-barrel, sack, bucket
- light: lantern-wall-iron, lantern-hand
- dress: pasty, tankard, bread-loaf, mug-wooden, jerky-bundle, mil-helmet-peg-rack, coat-pegs

### min-powder P2
- anchor: powder-keg-stack, barrel
- furnish: mine-lamp-rack, shelving-freestanding, crate
- store: bucket, sack
- light: lantern-wall-horn, lantern-wall-iron
- dress: rural-sign-danger-mine, key-hook-board

### min-seam P2
- anchor: crystal-formation, ore-vein, crystal-glowing
- furnish: geode-cluster, mine-tool-rack, mine-cart, wheelbarrow
- store: ore-pile, crate
- light: lantern-wall-iron
- dress: decal-ore-scatter, decal-rubble-scatter

### min-pithead P2
- anchor: mine-headframe, well-house, well, windlass
- furnish: mine-cart, cart-hand, wheelbarrow, cart-shed, sluice-box, water-trough, signpost, notice-board
- store: rural-tailings-pile, ore-pile, rural-slag-heap, mil-catapult-stones, stone-blocks-stack, lumber-pile, rural-pit-props-stack, crate, barrel, sack, rain-barrel
- light: lantern-post, lamp-post-wood
- dress: decal-ore-scatter, decal-rubble-scatter, decal-coal-dust, puddle

### min-smeltery P2
- anchor: smelter, hearth-raised-square, hearth-central-hood
- furnish: coal-bin, quench-trough, rural-bellows-ventilation, ingot-stack, washtub, water-trough, grindstone, wheelbarrow
- store: ore-pile, rural-tailings-pile, mil-catapult-stones, crate, barrel, sack, chest-plain, rain-barrel, bucket
- light: lantern-wall-iron
- dress: smith-soot-bucket, decal-coal-dust, decal-ore-scatter, decal-scorch
