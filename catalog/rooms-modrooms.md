# Modern rooms — recipes for five more City rooms and the Cyberpunk exec penthouse (modrooms lane, 2026-11-07)

Room definitions: `tools/spawn-tuner/build_data.py`, block `type:modrooms`; programs: `tools/spawn-tuner/js/solver2.js`,
block `type:modrooms`; walls: `tools/spawn-tuner/js/walls.js`, block `type:modrooms`. City rooms list `tiers: ['mod']`,
the exec penthouse `['cyb', 'mod']`. The elevator's car and doors are on the penthouses' shelves (listed in `furnish`: no program lays them; they are put down by hand, docs/VERTICAL.md "Elevators"), so the Apartment block and the Office tower offer them. Roles without a modern sku (food, kitchenware, rugs, linen) are the library's own,
reused: only those in MX_BORROW (solver2.js; the vetted list `experiments/2026-11-07-modrooms/reuse-borrow.json`).

### mod-penthouse P2
- anchor: sofa-sectional, kitchen-run-lux, kitchen-island, piano-grand
- furnish: elevator-car, elevator-doors, coffee-table, lounge-chair, dining-set-lux, bed-platform, stool-bar, bar-cart, wine-rack, houseplant, citrus-tree-tub, palm-potted, fern-potted, planter-topiary, statue-bust
- light: lamp-floor
- dress: art-canvas, rug-round-fine, rug-round, rug-oval, rug-grand, rug-striped-woven, rug-cowhide, rug-sheepskin, vase-flowers, tea-service-tray

### cyb-penthouse-exec P2
- anchor: sofa-sectional, kitchen-run-lux, kitchen-island, piano-grand
- furnish: elevator-car, elevator-doors, coffee-table, lounge-chair, dining-set-lux, stool-bar, bar-cart, planter-modern, houseplant, sculpture-abstract, drone-parked
- light: lamp-floor, video-screen
- dress: art-canvas

### mod-bathroom P2
- anchor: bathtub, shower-stall, toilet, sink-vanity
- furnish: towel-rail, towel-hanging, towel-stack, plant-pot
- light: mirror-bathroom
- dress: rug-runner

### mod-restroom P2
- anchor: toilet-stall, sink-row
- furnish: urinal, sink-vanity
- light: mirror-bathroom, light-fluorescent

### mod-kitchen P2
- anchor: range-commercial, table-prep-steel
- furnish: dish-station, fridge-reach-in, cooler-walkin-door, shelving-wire, pot-rack-wall, knife-rack-wall, utensil-rack-wall
- store: vegetable-crate-mixed, potato-crate, apple-crate, fruit-crate-mixed, vegetable-basket-mixed
- light: range-hood, light-fluorescent
- dress: cabbage-single, carrot-pile, onion-pile, potato, bread-loaf, bread-long-loaf, cheese-wheel-cut, meat-raw-joint, garlic-bulb, apple, sausage-link, egg, ham-sliced, saucepan-copper, roasting-pan, plate-ceramic, platter-board-handled

### mod-fire-escape P2
- anchor: stair-fire-escape, railing-iron
- furnish: ladder-fire-escape, ac-unit, houseplant, plant-pot, herb-pot
- dress: trash-bags, cardboard-boxes
