# Render sets

Pre-assembled groups baked locally from library objects to cut **runtime draw calls** (Harry, 2026-09-30: "reduce object count for the render engine, not for our library"). Members stay in the library as separate objects; a set is an extra library entry. Sets are never sent to TRELLIS — they are composed in Blender from their members' meshes and merged into one mesh/material with sockets preserved. Grammar: `### id · P# · place · fp · set:CODES · hint` then `- member ×N`. A P1 set uses only P1 members.

## Migrated compounds (ids kept so room recipes still resolve)

### weapon-rack-enchanted · P3 · wall · 1 · set:ARC,CAS · display rack of glowing weapons — armory of the archmage
- weapon-rack
- sword-enchanted
- staff-crystal
- wand-display
- amulet-glowing

### fish-stall-ice · P2 · ground · 1x2 · set:MKT! · slanted stall of fish on straw — fish market
- market-stall
- fish-single ×6
- fish-basket
- fish-string
- salted-fish-stack
- eel
- crab

### goods-shelves-general · P1 · wall · 1 · set:MKT! · shelves of mixed goods — the general store; players will shop
- shelf-wall ×2
- jars-preserves
- sack ×2
- basket-wicker
- candle ×3
- oil-jar
- lantern-hand

### barricade-makeshift · P3 · floor · 1x2 · set:CAS,DUN,MKT · tables, crates and planks piled as a barricade — sieges and last stands
- table-square
- crate ×2
- barrel
- debris-planks
- bench-long

### pantry-shelf · P1 · wall · 1 · set:TAV,HUT,CAS · shelf of jars, sacks and cheeses — larders
- shelf-wall
- jar-oil
- jar-pickles
- cheese-wedge
- sauerkraut-crock
- jam-jar
- sack
- onion
- salt-sack

### ingredient-shelf · P1 · wall · 1 · set:ARC! · shelf of jars, herbs and oddities — apothecary wall
- shelf-wall
- alch-jar-eyes
- alch-mandrake-root
- alch-crystal-red
- alch-crystal-blue
- alch-spell-component-pouch
- alch-potion-red-round
- alch-flask-conical

### altar-draped · P2 · floor · 1x2 · set:TEM! · cloth-draped altar with candles — a chapel ready for service
- altar-stone
- rite-altar-cloth
- candlestick ×2
- chalice-altar
- rite-prayer-book-small

### crate-stack · P1 · floor · 1 · set:MKT,TAV,DUN · stacked crates and barrels — alleys, storerooms, cover in a fight
- crate ×3
- barrel ×2
- sack

### feast-table-dressed · P2 · floor · 1x3 · set:CAS!,NOB · feast table with ~80% of its feast baked in — base mesh + 4 live accent objects per loading-and-feel
- table-feast
- plate-pewter ×8
- goblet-silver ×8
- roast-pig
- chicken-roast-whole
- bread-round-loaf-cut ×2
- cheese-wheel-cut
- candelabra ×2
- pitcher-pewter ×2
- platter-pewter-oval ×2
- apple ×4

### tavern-table-dressed · P2 · floor · 1 · set:TAV! · tavern table with tankards, dice, bread — fill a common room fast
- table-square
- tankard-of-ale ×3
- dice-and-cup
- bread-round-loaf-cut
- plate-wood-round ×2
- candle

### desk-cluttered · P2 · floor · 1 · set:ARC!,NOB · desk with books, scrolls, ink, candle — studies and wizard towers
- desk-writing
- book-stack
- book-open
- scroll-closed ×2
- quill-single
- ink-bottle
- candlestick
- parchment-sheet ×2

### alchemy-bench-dressed · P2 · floor · 1x2 · set:ARC! · workbench with alembic, bottles, mortar — lab anchor
- alch-alchemy-bench-plain
- alch-flask-conical
- alch-flask-longneck
- alch-retort
- alch-spirit-lamp
- alch-mortar-marble
- alch-vial-rack
- alch-recipe-book-open

### forge-corner · P3 · floor · 2x2 · set:SMI! · anvil, trough, tool rack as one set — drop-in smithy
- anvil
- quench-trough
- tool-rack-smith
- smith-flat-tongs
- smith-coal-rake
- smith-hammer-rack

### kitchen-prep-dressed · P2 · floor · 1x2 · set:TAV,CAS,HUT · prep table with cutting board, veg, pots — kitchens
- table-kitchen-prep
- cutting-board
- knife-carving
- cleaver
- onion ×3
- carrot ×3
- potato ×4
- cabbage-single
- pot-iron-small

### stall-produce · P1 · ground · 1x2 · set:MKT! · market stall loaded with produce — market squares; turnips mandatory
- market-stall
- turnip-basket
- apple-basket
- cabbage-single ×3
- carrot ×4
- potato-pile
- onion ×4
- vegetable-basket-mixed

### armory-rack-filled · P1 · wall · 1 · set:CAS! · weapon rack fully loaded — armories
- weapon-rack
- sword-long ×2
- spear ×3
- axe-hand
- mace-flanged
- shield-round ×2

### treasure-hoard · P1 · floor · 2x2 · set:DUN!,CRY,LAI! · coin heap with chests, goblets, gems — the vault / dragon lair
- coin-pile ×3
- chest-treasure
- gems-loose
- crown
- chalice-jeweled
- gold-bars

### camp-set · P3 · ground · 3x3 · set:CMP! · tent, bedrolls, fire ring, log seats — one-click camp
- tent-small ×2
- bedroll ×3
- campfire
- log-seat ×2
- cooking-tripod
- backpack ×2

### potion-shop-shelf · P2 · wall · 1 · set:MKT!,ARC · shelf of labelled potions — the magic shop; restock between sessions
- shelf-wall
- alch-potion-red-round ×3
- alch-potion-blue-tall ×3
- alch-potion-green-skull ×2
- alch-potion-purple-teardrop
- alch-potion-gold-ornate

### craft-barrel-drying-row · P3 · floor · 1x2 · set:SMI,MKT · row of new barrels upended — cooperage yard
- barrel ×4
- craft-barrel-raised-open ×2

### rural-grain-sheaves-cart · P3 · ground · 1x2 · set:HUT · cartload of sheaves — harvest procession
- cart-hand
- rural-grain-stook ×4
- wheat-sheaf ×3

### rural-trapper-shack-shelf · P3 · wall · 1 · set:CMP · shelf of traps and jars — trapper cabin wall
- shelf-wall
- rural-pelt-wolf ×2
- rural-bear-trap-open
- rural-game-bag
- rope-coil
- jerky-bundle

### smith-repair-queue · P2 · wall · 1 · set:SMI! · tagged repair items on a shelf — a pot, a sword, a lantern; quest-hook shelf
- smith-armor-stand-fitted
- armor-chainmail-heap
- helm-open
- shield-heater
- sword-broken
- smith-blade-unhilted

### pot-rack-hanging · P2 · ceiling · 1 · set:TAV,CAS,NOB · ceiling rack hung with pots and pans — over the kitchen table
- pot-hook-chain
- pot-copper ×2
- pot-iron-small
- pan-long-handle
- ladle
- kettle-hanging

### bottle-row-bar · P1 · surface · tiny · set:TAV! · row of assorted bottles on a plank — dress a bar shelf in one go
- bottle-wine-green ×4
- bottle-squat-spirit ×3
- flagon

### mugs-empty-cluster · P2 · surface · tiny · set:TAV · cluster of empty mugs and tankards — end of the night
- mug-chipped ×3
- tankard-dented ×2
- cup-clay ×2

## Render sets

### set-table-dinner-poor · P1 · floor · 1 · set:HUT,TAV,DUN · peasant supper for four
- table-square
- trencher-wood ×4
- bowl-wood-small ×4
- spoon-wooden ×4
- cup-clay ×4
- bread-round-loaf-cut
- jug-clay
- candle

### set-table-dinner-common · P1 · floor · 1 · set:TAV,HUT,MKT · burgher supper for four
- table-square
- plate-pewter ×4
- knife-table ×4
- spoon-pewter ×4
- cup-pewter ×4
- pitcher-pewter
- bread-long-loaf
- cheese-wedge
- candlestick
- salt-box

### set-table-dinner-noble · P1 · floor · 1x3 · set:NOB,CAS · noble table set for eight
- table-trestle
- tablecloth-white
- plate-pewter ×8
- knife-table ×8
- fork-two-tine ×8
- spoon-apostle ×8
- goblet-silver ×8
- napkin-folded ×8
- candelabra ×2
- salt-cellar-ship
- charger-brass

### set-table-dinner-noble-silver · P2 · floor · 1x3 · set:NOB! · silver service for eight, pre-meal
- table-feast
- tablecloth-white
- plate-silver ×8
- fork-silver ×8
- knife-silver ×8
- spoon-silver ×8
- goblet-gold ×8
- napkin-folded ×8
- candelabra ×3
- salt-cellar-ship

### set-table-midmeal-poor · P1 · floor · 1 · set:HUT,TAV · supper under way
- table-square
- trencher-wood ×4
- soup-bowl ×3
- stew-bowl
- spoon-wooden ×4
- cup-clay ×3
- bread-slice ×3
- jug-clay
- candle

### set-table-midmeal-common · P1 · floor · 1 · set:TAV,HUT · tavern meal under way
- table-square
- plate-roast-veg ×2
- plate-cheese-bread
- plate-pie-slice
- tankard-of-ale ×3
- mug-of-ale
- knife-table ×3
- fork-two-tine ×2
- bread-round-loaf-cut
- candle

### set-table-midfeast-noble · P1 · floor · 1x3 · set:NOB,CAS · feast at full swing
- table-trestle
- tablecloth-white
- plate-pewter ×8
- goblet-of-wine ×6
- chalice-of-wine
- chicken-roast-whole
- meat-roast-joint
- bread-long-loaf ×2
- cheese-wheel-cut
- apple ×4
- pear ×3
- candelabra ×2
- platter-silver ×2

### set-table-afterfeast · P2 · floor · 1x3 · set:CAS,NOB,TAV · the morning after: bones, spills, tipped cups
- table-trestle
- plate-scraps ×6
- chicken-carcass-bones
- bone-meaty ×3
- goblet-of-wine-spilled ×2
- tankard-tipped-spill ×2
- bottle-broken
- apple-core ×3
- candle-stubs-dish
- napkin-crumpled ×4

### set-table-breakfast-common · P2 · floor · 1 · set:TAV,HUT · breakfast for two
- table-square
- plate-eggs-bacon ×2
- porridge-bowl ×2
- bread-roll ×3
- butter-pat
- mug-of-hot-cider ×2
- spoon-wooden ×2

### set-table-breakfast-noble · P3 · floor · 1 · set:NOB · late breakfast in the solar
- table-round-small
- tablecloth-white
- egg-boiled-cup ×2
- bread-rolls-basket
- butter-dish
- jam-jar
- cup-silver ×2
- plate-fruit-cut

### set-table-drinks-dice · P1 · floor · 1 · set:TAV! · drinking and dice
- table-square
- tankard-of-ale ×3
- mug-of-ale
- dice-and-cup
- coin-stack
- candle

### set-table-card-game · P2 · floor · 1 · set:TAV,CAS · cards in progress
- table-round-small
- playing-cards
- coin-stack ×2
- coins-scattered
- tankard-of-stout ×2
- candle-stubs-dish

### set-table-drinking-emptied · P2 · floor · 1 · set:TAV · closing time
- table-round-small
- mug-chipped ×3
- tankard-dented ×2
- cup-clay
- tankard-tipped-spill
- bottle-broken
- candle-stubs-dish

### set-table-soldiers-mess · P2 · floor · 1x2 · set:CAS,DUN,CMP · barracks mess
- table-trestle
- bowl-tin-camp ×6
- plate-tin-camp ×6
- cup-tin-camp ×6
- stew-pot-full
- bread-round-loaf-cut ×2
- ladle

### set-table-prisoner-ration · P2 · floor · sub · set:DUN · the day's ration
- trencher-wood
- gruel-bowl
- bread-stale-moldy
- jug-of-water-cell

### set-table-cult-dark-feast · P3 · floor · 1x3 · set:CLT · a feast you shouldn't eat
- table-trestle
- cup-of-blood ×6
- chalice-dark
- tentacle-grilled
- cake-poisoned ×2
- candle-black ×6
- skull-single ×2

### set-table-fey-banquet · P3 · floor · 1x3 · set:GRV · a fey banquet
- table-trestle
- fey-feast-platter
- fey-fruit ×6
- mushroom-glowing-edible ×4
- goblet-glass ×6
- flowers-wild

### set-table-picnic-cloth · P3 · ground · 1 · set:HUT,GRV,NOB · picnic on the grass
- tablecloth-checked
- bread-long-loaf
- cheese-small-round
- apple ×3
- bottle-wine-green
- cup-horn ×2
- basket-wicker

### set-place-common · P1 · surface · tiny · set:TAV,HUT · one place setting
- plate-pewter
- knife-table
- spoon-pewter
- cup-pewter

### set-place-poor · P1 · surface · tiny · set:HUT,TAV · one poor setting
- trencher-wood
- spoon-wooden
- cup-clay

### set-place-noble · P1 · surface · tiny · set:NOB,CAS · one noble setting
- plate-pewter
- knife-table
- fork-two-tine
- spoon-apostle
- goblet-silver
- napkin-folded

### set-high-table · P2 · floor · 1x3 · set:CAS! · the lord's high table
- table-feast
- throne
- chair-armed ×4
- plate-pewter ×6
- goblet-silver ×6
- candelabra ×2
- salt-cellar-ship
- meat-roast-joint

### set-bench-meal-row · P1 · floor · 1x2 · set:TAV,CAS · trestle and benches, set
- table-trestle
- bench-long ×2
- trencher-wood ×6
- tankard-dented ×6
- bread-round-loaf-cut ×2

### set-bartop-busy · P1 · surface · 1 · set:TAV! · bar top during service
- tankard-of-ale ×3
- mug-of-ale ×2
- tray-long-tavern
- pitcher-pewter
- bottle-squat-spirit
- coin-stack

### set-bartop-quiet · P1 · surface · 1 · set:TAV · bar top at rest
- tankard-lidded ×3
- mug-chipped ×2
- candle
- bottle-wine-green

### set-backbar-full · P1 · wall · 1 · set:TAV! · stocked back bar
- back-bar-shelves
- bottle-wine-green ×5
- bottle-squat-spirit ×3
- flagon ×2
- tankard-lidded ×4
- jug-clay

### set-backbar-noble · P2 · wall · 1 · set:NOB,TAV · a better class of bar
- back-bar-shelves
- decanter-crystal ×2
- bottle-wine-dusty ×4
- goblet-glass ×6
- cask-small-spigot

### set-cask-row · P2 · floor · 1x2 · set:TAV · casks on the rack
- cask-rack
- cask-small-spigot ×2
- firkin ×2

### set-hearth-cooking · P1 · floor · 1x2 · set:TAV,HUT,CAS · pots on the fire
- cook-hearth-spit
- pot-iron-large
- cauldron-small
- pan-long-handle
- ladle
- andirons
- meat-roast-joint

### set-hearth-cottage · P1 · floor · 1 · set:HUT! · cottage hearth, dinner on
- hearth-central
- pot-iron-small
- ladle
- woodpile
- spoon-wooden

### set-kitchen-wall-tools · P1 · wall · 1 · set:TAV,CAS,HUT · utensils on the wall
- utensil-rack-wall
- ladle
- skimmer-iron
- knife-rack-wall
- knife-carving
- cleaver
- spoon-wooden

### set-kitchen-prep-veg · P1 · floor · 1x2 · set:TAV,HUT,CAS · vegetables mid-chop
- table-kitchen-prep
- knife-carving
- onion ×2
- carrot ×3
- potato-pile
- turnip ×3
- cabbage-single
- bowl-wood-small

### set-kitchen-prep-meat · P2 · floor · 1x2 · set:TAV,CAS · butchering for the pot
- table-kitchen-prep
- chopping-block-kitchen
- cleaver
- mallet-meat
- meat-raw-joint
- meat-raw-steak ×2
- sausage-link ×4
- bowl-clay

### set-kitchen-baking · P2 · floor · 1x2 · set:TAV,HUT,MKT · baking day
- table-kitchen-prep
- dough-bowl
- dough-kneading
- rolling-pin
- flour-sack-open
- pie-dish
- bread-pan-clay
- egg ×3

### set-kitchen-washup · P3 · floor · 1 · set:TAV,CAS · dishes in the tub
- washtub
- washing-bowl-dishes
- plate-stack-wood
- bowl-stack
- dish-rag-hanging
- scouring-sand-box

### set-pantry-shelf-full · P1 · wall · 1 · set:TAV,HUT,CAS · a well-stocked larder shelf
- shelf-wall
- jar-oil
- jar-pickles
- jam-jar
- sauerkraut-crock
- cheese-wedge ×2
- salt-sack
- onion ×3
- potato-pile

### set-pantry-shelf-sparse · P2 · wall · 1 · set:HUT,DUN · a lean larder
- shelf-wall
- jar-oil
- onion
- bread-heel
- crock

### set-larder-hanging · P2 · ceiling · 1 · set:TAV,HUT,CAS · hung meat and garlic
- ham-hanging
- sausage-string
- onion-string
- garlic-braid
- herbs-drying
- poultry-plucked-hanging

### set-root-cellar · P2 · floor · 1x2 · set:HUT,TAV · root cellar floor
- potato-crate
- cabbage-crate
- carrot-pile
- onion-pile
- turnip-basket
- sack ×3
- apple-crate

### set-great-kitchen-spit · P2 · floor · 2x2 · set:CAS! · castle kitchen at full heat
- pig-on-spit
- fireplace-grand
- cauldron-huge
- pot-copper ×2
- roasting-pan
- pan-long-handle

### set-bed-poor-slept · P1 · floor · 1x2 · set:HUT,DUN,TAV · slept-in pallet
- bed-straw-pallet
- blankets-folded
- bucket
- candle

### set-bed-common-made · P1 · floor · 1x2 · set:TAV,HUT · inn bed, made up
- bed-single
- table-side
- candlestick
- chest-plain

### set-bed-common-slept · P1 · floor · 1x2 · set:TAV · inn bed, slept in
- bed-single
- table-side
- candle-stubs-dish
- clothes-folded
- chamber-pot

### set-bed-double-inn · P1 · floor · 2x2 · set:TAV · the good room
- bed-double
- table-side ×2
- candlestick ×2
- rug-small
- washstand

### set-bed-noble · P1 · floor · 2x2 · set:NOB! · noble bedchamber bed
- bed-canopy
- table-side ×2
- candelabra
- rug-small
- chest-plain

### set-bed-noble-unmade · P2 · floor · 2x2 · set:NOB · bedchamber at dawn
- bed-canopy
- table-side ×2
- goblet-of-wine-spilled
- candle-stubs-dish
- gown-on-form
- clothes-folded

### set-vanity-noble · P2 · wall · 1 · set:NOB! · dressing table set out
- table-vanity
- hand-mirror
- jewelry-box
- perfume-bottles
- brooch
- locket
- candlestick

### set-washstand · P2 · wall · sub · set:TAV,NOB,HUT · morning wash
- washstand
- water-jug-basin
- towel-hanging

### set-barracks-bunk · P1 · floor · 1x2 · set:CAS!,MIN · soldier's bunk
- bunk-bed
- mil-footlocker
- mil-helmet-peg-rack

### set-sickbed · P1 · floor · 1x2 · set:TEM,MKT,TAV · patient in care
- sickbed
- trade-fever-basin
- bandage-roll
- trade-tincture-rack

### set-bookshelf-full · P1 · wall · 1 · set:ARC,NOB,TEM · a full bookshelf
- bookshelf
- book-closed ×6
- book-stack ×2
- scroll-closed ×2

### set-bookshelf-sparse · P2 · wall · 1 · set:NOB,TAV,HUT · a few books
- bookshelf
- book-closed ×2
- candle
- skull-single

### set-bookshelf-arcane · P1 · wall · 1 · set:ARC! · wizard's shelf
- bookshelf
- tome-grimoire
- book-closed ×4
- alch-crystal-blue
- skull-single
- alch-potion-blue-tall
- scroll-closed ×2

### set-bookshelf-ransacked · P2 · wall · 1 · set:ARC,NOB,RUI · books everywhere
- bookshelf
- book-pile-floor ×2
- decal-papers
- parchment-stack

### set-desk-scribe · P1 · floor · 1 · set:TEM,ARC,CAS · scribe at work
- scriptorium-desk
- trade-copy-stand
- trade-manuscript-in-progress
- quill-single
- trade-ruling-board
- candlestick

### set-desk-scholar · P1 · floor · 1 · set:ARC,NOB · scholar's desk
- desk-writing
- book-open
- book-stack
- scroll-open
- quill-single
- candlestick

### set-desk-noble-study · P1 · floor · 1 · set:NOB! · lord's writing desk
- desk-writing
- chair-armed
- letter-sealed
- ledger-accounts
- quill-single
- candlestick

### set-desk-cartographer · P2 · floor · 1 · set:ARC,CAS · maps in progress
- desk-writing
- trade-map-in-progress
- map-sheet ×2
- map-rolled
- trade-globe-terrestrial
- ink-bottle

### set-war-table · P1 · floor · 2x2 · set:CAS! · campaign planning
- table-map
- map-rolled
- mil-map-case
- letter-sealed
- candlestick ×2
- coin-stack

### set-lectern-chapel · P1 · floor · sub · set:TEM · lectern with scripture
- lectern
- book-open
- candlestick

### set-alch-bench-distilling · P1 · floor · 1x2 · set:ARC! · distillation running
- alch-alchemy-bench-plain
- alch-retort
- alch-flask-conical
- alch-spirit-lamp
- alch-bell-jar
- alch-vial-rack

### set-alch-bench-grinding · P1 · floor · 1x2 · set:ARC · grinding reagents
- alch-alchemy-bench-plain
- alch-mortar-marble
- alch-apothecary-scale
- alch-mandrake-root
- alch-crystal-red
- alch-jar-eyes

### set-alch-bench-potions · P1 · floor · 1x2 · set:ARC,MKT · potions cooling
- alch-alchemy-bench-plain
- alch-potion-red-round ×2
- alch-potion-blue-tall ×2
- alch-potion-green-skull
- alch-flask-longneck
- alch-test-tube-rack

### set-alch-shelf-reagents · P1 · wall · 1 · set:ARC! · reagent shelf
- shelf-wall
- alch-jar-eyes
- alch-mandrake-root
- alch-dragon-scale-single
- alch-crystal-red
- alch-crystal-blue
- alch-spell-component-pouch

### set-alch-shelf-glassware · P2 · wall · 1 · set:ARC · glassware drying
- shelf-wall
- alch-flask-conical ×3
- alch-flask-longneck ×2
- alch-beaker-spouted ×2
- alch-evaporating-dish
- alch-test-tube-rack

### set-alch-shelf-specimens · P2 · wall · 1 · set:ARC,DUN · specimens on display
- shelf-wall
- alch-specimen-jar-large ×2
- alch-specimen-jar-tentacle
- alch-brain-jar
- alch-heart-preserved-glowing
- alch-mummified-hand

### set-apothecary-counter · P1 · floor · 1x2 · set:MKT!,ARC · apothecary counter
- alch-counter-apothecary
- alch-apothecary-scale
- alch-potion-red-round ×2
- alch-mortar-marble

### set-apothecary-wall · P2 · wall · 1x2 · set:MKT · drawers and jars
- apothecary-drawers
- apothecary-jars
- alch-apothecary-jar-lidded ×4
- dried-herbs-jar ×2

### set-wizard-sanctum-center · P2 · floor · 2x2 · set:ARC! · sanctum working space
- teleport-circle-dais
- spellbook-lectern
- candle-cluster ×3
- alch-chalk-bundle
- alch-wand-oak

### set-summoning-circle · P1 · floor · 2x2 · set:ARC,CLT · summoning prepared
- decal-ritual-circle
- alch-summoning-candles-ring
- alch-chalk-bundle
- alch-spell-component-pouch
- skull-single

### set-scrying-nook · P2 · floor · 1 · set:ARC,MKT · fortune-teller's table
- table-round-small
- crystal-ball
- tarot-spread
- candle-black ×2
- incense-sticks

### set-mad-lab-table · P2 · floor · 1x2 · set:ARC,DUN · experiment in progress
- table-experiment
- alch-jar-lightning
- alch-brain-jar
- alch-dissection-tray
- alch-specimen-jar-large
- bandage-roll

### set-magic-shop-case · P2 · floor · 1 · set:MKT!,ARC · magic items under glass
- display-case-glass
- wand-display
- ring-on-stand
- amulet-glowing
- alch-potion-gold-ornate
- soul-gem

### set-forge-working · P1 · floor · 2x2 · set:SMI! · forge at work
- forge
- anvil
- smith-slack-tub
- smith-flat-tongs
- smith-blank-glowing
- smith-coal-rake
- smith-charcoal-sack

### set-anvil-station · P1 · floor · 1 · set:SMI · anvil and tools
- anvil
- smith-flat-tongs
- smith-hammer-rack
- smith-sword-blank

### set-smith-tool-wall · P1 · wall · 1 · set:SMI! · tongs and hammers hung
- smith-tongs-rack-row
- smith-hammer-rack
- smith-forge-poker
- smith-leather-apron-work

### set-smith-stock-corner · P1 · floor · 1 · set:SMI · iron stock
- smith-bar-bundle
- smith-iron-bar ×3
- smith-ingot-iron ×4
- smith-charcoal-sack

### set-smith-wares-display · P1 · floor · 1x2 · set:SMI,MKT · finished goods for sale
- wares-display
- sword-long ×2
- axe-hand ×2
- dagger ×3
- smith-blade-barrel
- shield-round

### set-armorer-bench · P1 · floor · 1x2 · set:SMI,CAS · armor on the forms
- smith-armor-form
- smith-breastplate-on-form
- smith-helm-stake
- smith-helm-dome-raw
- smith-mail-in-progress
- smith-greave-pair

### set-farrier-bay · P1 · floor · 2x2 · set:SMI,TAV · shoeing bay
- smith-shoeing-stocks
- smith-farrier-box
- smith-hoof-rasp
- smith-hoof-nippers
- smith-hoof-stand
- smith-horseshoe-rack

### set-jeweler-bench · P1 · floor · 1 · set:MKT!,SMI · jeweler's bench
- jeweler-bench
- smith-loupe
- smith-ring-mandrel
- smith-gem-tray
- smith-gem-cut-single
- smith-assay-scales

### set-jeweler-display · P2 · floor · 1 · set:MKT,NOB · jewels on display
- display-case-glass
- necklace-jeweled
- tiara
- ring-on-stand
- brooch
- gems-loose

### set-carpenter-bench · P1 · floor · 1x2 · set:SMI,MKT,HUT · joiner's bench
- carpenter-bench
- craft-mortise-chisel-rack
- saw-hand
- hammer-claw
- craft-shavings-pile

### set-carpenter-yard · P2 · floor · 2x2 · set:SMI,MKT · timber yard
- lumber-pile
- craft-boards-planed-stack
- craft-beam-squared
- craft-log-debarked
- sawhorse
- craft-sawdust-pile

### set-cooper-shop · P2 · floor · 2x2 · set:SMI,MKT,TAV · barrels being raised
- craft-cooper-shaving-horse
- craft-barrel-raised-open ×2
- barrel ×3

### set-bowyer-bench · P2 · floor · 1x2 · set:SMI,CAS · bows and arrows
- table-work
- craft-bow-stave-raw
- craft-arrow-shafts-bundle
- craft-arrowheads-box
- craft-sheaf-arrows-tied
- bow-long

### set-leather-bench · P2 · floor · 1x2 · set:MKT,SMI · leatherwork bench
- leather-workbench
- craft-stitching-pony
- craft-leather-roll
- craft-leather-edge-tools
- craft-leather-offcuts

### set-tannery-beam · P1 · floor · 1x2 · set:MKT,HUT · fleshing hides
- craft-tanner-fleshing-beam
- craft-tanner-fleshing-knife
- craft-hide-raw-folded
- craft-tanner-bark-pile

### set-cobbler-bench · P1 · floor · 1 · set:MKT! · cobbler at work
- cobbler-bench
- craft-cobbler-last-single
- craft-cobbler-hammer
- craft-cobbler-shoe-on-last
- boot-single
- craft-work-stool-low

### set-cobbler-shelf · P2 · wall · 1 · set:MKT · shoes for sale
- shelf-wall
- shoes-pair ×3
- boots-pair ×2
- craft-boots-riding-new

### set-tailor-table · P1 · floor · 1x2 · set:MKT!,NOB · cutting cloth
- table-work
- craft-tailor-pattern-pieces
- craft-tailor-shears-large
- craft-cloth-bolt-red
- craft-cloth-bolt-undyed

### set-tailor-shopfloor · P2 · floor · 2x2 · set:MKT,NOB · tailor's shop floor
- craft-tailor-dummy-half
- craft-tailor-dummy-gown
- cloth-bolts-rack
- craft-cloak-hanging-new

### set-weaver-corner · P1 · floor · 1x2 · set:HUT,MKT · weaving at the loom
- craft-loom-warp-weighted
- craft-loom-weights
- craft-distaff-and-wool
- craft-yarn-ball
- basket-wicker

### set-dyers-vats · P3 · floor · 2x2 · set:MKT · dye yard
- dye-vat
- craft-dye-pot-small ×2
- craft-dyed-cloth-draped ×2

### set-potter-wheel · P2 · floor · 1 · set:MKT · potter throwing
- potters-wheel
- trade-pot-on-wheel
- trade-clay-lump
- trade-greenware-board

### set-chandler-shelf · P2 · wall · 1 · set:MKT,TEM · candles for sale
- shelf-wall
- trade-candles-hanging
- candle ×6
- candlestick ×2
- trade-candle-large-church

### set-scriptorium-shelf · P2 · wall · 1 · set:TEM · finished books
- shelf-wall
- trade-chained-book
- trade-jeweled-binding
- book-closed ×4

### set-general-store-shelf · P1 · wall · 1 · set:MKT! · general goods
- shelf-wall ×2
- jars-preserves
- sack ×2
- basket-wicker
- candle ×3
- oil-jar
- lantern-hand
- oil-flask
- torch-bundle

### set-general-store-counter · P1 · floor · 1x2 · set:MKT · counter with scales
- counter-shop
- scales-balance
- coin-stack
- ledger-accounts
- candle

### set-general-store-floor · P1 · floor · 1x2 · set:MKT · barrels and sacks for sale
- bins-dry-goods
- barrel ×2
- sack ×3
- baskets-stack
- price-board

### set-bakery-counter · P1 · floor · 1x2 · set:MKT!,TAV · fresh bread
- bread-rack
- bread-round-loaf-cut ×2
- bread-long-loaf ×3
- bread-roll ×6
- pie-slice
- trade-loaf-tray-rising

### set-bakery-oven · P1 · floor · 1x2 · set:MKT,TAV · loading the oven
- bread-oven
- bread-peel
- trade-oven-rake
- trade-proofing-basket ×2
- flour-bin

### set-brewery-mash · P1 · floor · 2x2 · set:TAV! · mashing in
- mash-tun
- brew-copper
- malt-sacks
- trade-mash-fork
- trade-brewers-paddle

### set-butcher-counter · P1 · floor · 1x2 · set:MKT! · butcher's counter
- butcher-block
- trade-butcher-hooks-rail
- cleaver
- trade-meat-saw
- sausage-link ×4
- trade-steelyard-scale

### set-butcher-hooks · P2 · ceiling · 1x2 · set:MKT,CAS · hanging meat
- trade-butcher-hooks-rail
- carcass-hanging ×2
- ham-hanging
- poultry-plucked-hanging ×2

### set-healer-bench · P1 · floor · 1x2 · set:MKT,TEM · healer treating
- trade-treatment-bench
- trade-surgical-kit-roll
- bandage-roll
- splint-wooden
- trade-herbal-book-open
- trade-medicine-chest

### set-produce-stall-veg · P1 · ground · 1x2 · set:MKT! · vegetable stall
- market-stall
- potato-pile
- turnip-basket
- cabbage-single ×3
- carrot ×4
- onion ×4
- vegetable-basket-mixed

### set-produce-stall-fruit · P1 · ground · 1x2 · set:MKT · fruit stall
- market-stall
- apple-basket
- apple ×4
- pear ×4

### set-stall-bread · P2 · ground · 1x2 · set:MKT · bread stall
- market-stall
- bread-rolls-basket
- bread-long-loaf ×4
- pretzel ×3
- bread-braided ×2

### set-stall-cheese · P2 · ground · 1x2 · set:MKT · cheese stall
- market-stall
- cheese-wheel ×2
- cheese-wheel-cut
- cheese-small-round ×3
- cheese-stack
- butter-pat

### set-stall-pottery · P3 · ground · 1x2 · set:MKT · crockery stall
- market-stall
- jug-clay ×3
- bowl-clay ×4
- pot-clay ×2
- cup-clay ×4

### set-stall-weapons · P2 · ground · 1x2 · set:MKT,CMP · arms stall
- market-stall
- sword-long
- dagger ×3
- axe-hand
- spear ×2
- shield-round

### set-stall-cloth · P2 · ground · 1x2 · set:MKT · cloth stall
- market-stall
- craft-cloth-bolt-red
- craft-cloth-bolt-blue
- craft-cloth-bolt-linen
- craft-cloth-bolt-silk
- clothes-folded

### set-stall-trinkets · P3 · ground · 1x2 · set:MKT · curios and charms
- market-stall
- box-carved
- puzzle-box
- talisman-twig
- brooch
- locket
- die-single

### set-counting-table · P2 · floor · 1 · set:MKT,NOB · moneylender's table
- counting-table
- coin-stack ×4
- ledger-accounts
- scales-balance
- quill-single

### set-altar-sun · P1 · floor · 1x2 · set:TEM! · altar of a sun faith
- altar-stone
- rite-altar-cloth
- holy-symbol-sun
- chalice-altar
- candlestick ×2
- rite-pillar-candle-tall ×2

### set-altar-nature · P2 · ground · 1x2 · set:GRV!,TEM · nature shrine
- druid-altar
- holy-symbol-tree
- rite-mistletoe-sickle
- flowers-wild
- offering-bowl

### set-altar-death · P2 · floor · 1x2 · set:CRY,TEM · altar of the dead
- altar-stone
- rite-holy-symbol-skull
- candle-black ×4
- rite-canopic-jars-set
- skull-single

### set-altar-cult · P1 · floor · 1x2 · set:CLT! · cult altar primed
- altar-sacrificial
- unholy-symbol
- dagger-ritual
- rite-blood-bowl
- candle-cluster ×2
- rite-sigil-stone

### set-altar-cult-used · P2 · floor · 1x2 · set:CLT · after the rite
- altar-sacrificial
- decal-blood
- rite-blood-bowl
- candle-stubs-dish
- dagger-ritual
- cup-of-blood

### set-votive-rack · P1 · floor · sub · set:TEM · votive candles lit
- rite-offering-candles-tray
- rite-alms-box
- candle ×6

### set-necromancer-desk · P1 · floor · 1 · set:CLT,ARC · necromancer at study
- desk-writing
- rite-tome-flesh-bound
- rite-bone-candelabra
- skull-single
- rite-soul-jar
- femur-bone

### set-embalming-table · P1 · floor · 1x2 · set:CRY! · body being prepared
- rite-corpse-on-slab
- rite-embalming-tools
- rite-canopic-jar ×2
- rite-burial-shroud-folded
- candle ×2

### set-crypt-niche-bones · P1 · wall · 1 · set:CRY! · niche with remains
- wall-crypt-niches
- skull-single
- femur-bone ×2
- candle-drippings-mound

### set-crypt-niche-urns · P2 · wall · 1 · set:CRY · niche with urns
- wall-crypt-niches
- burial-urn-niche ×3
- candle

### set-grave-cluster · P2 · ground · 2x2 · set:CRY!,TEM · graveyard corner
- gravestone ×4
- grave-marker-wood ×2
- flowers-wild

### set-grave-fresh · P2 · ground · 1x2 · set:CRY · a fresh burial
- grave-open
- shovel
- lantern-hand
- dirt-path-tile

### set-barrow-goods · P2 · floor · 1 · set:CRY,RUI · barrow grave goods
- rite-grave-goods-pile
- rite-death-mask
- sword-broken
- coin-pile

### set-ritual-circle-cult · P1 · floor · 2x2 · set:CLT · cult ritual circle
- decal-ritual-circle
- candle-cluster ×4
- rite-sigil-stone
- rite-salt-line

### set-ritual-circle-druid · P2 · ground · 3x3 · set:GRV · druid stone ring
- standing-stone ×6
- fairy-ring
- druid-altar

### set-hoard-small · P1 · floor · 1 · set:DUN,CRY,LAI · a modest stash
- chest-treasure
- coin-pile
- gems-loose

### set-hoard-medium · P1 · floor · 2x2 · set:DUN,LAI · a proper hoard
- coin-pile ×3
- chest-treasure ×2
- gems-loose
- gold-bars
- crown
- chalice-jeweled
- idol-golden

### set-hoard-dragon · P2 · floor · 3x3 · set:LAI! · dragon's bed
- coin-pile ×8
- chest-treasure ×3
- gold-bars ×2
- crown
- scepter
- chalice-jeweled ×2
- idol-golden
- gems-loose ×3
- art-objects-pile
- sword-enchanted
- helm-great

### set-treasury-shelves · P1 · wall · 1 · set:CAS! · royal treasury shelf
- shelf-wall
- coin-stack ×4
- casket-ornate
- gold-bars
- chalice-jeweled
- crown

### set-loot-pile-bandit · P1 · floor · 1 · set:CMP,LAI,DUN · bandit loot
- loot-sack ×2
- coin-stack
- sword-long
- clothes-folded
- key-simple

### set-loot-pile-goblin · P2 · floor · 1 · set:LAI · goblin hoard of junk
- loot-sack
- coins-scattered
- sword-broken
- shield-crude
- bone-meaty
- pot-dented-camp

### set-remains-fighter · P1 · floor · 1 · set:DUN,LAI,CRY · fallen fighter
- adventurer-remains
- sword-long
- shield-round
- helm-open

### set-remains-wizard · P1 · floor · 1 · set:DUN,LAI,ARC · fallen wizard
- adventurer-remains
- wizard-hat
- tome-grimoire
- scroll-closed

### set-remains-rogue · P2 · floor · 1 · set:DUN,LAI · fallen rogue
- adventurer-remains
- dagger
- lockpick-roll
- drawstring-bag
- map-treasure

### set-remains-cleric · P2 · floor · 1 · set:DUN,CRY · fallen cleric
- adventurer-remains
- holy-symbol-sun
- mace-flanged
- holy-water-vial

### set-dropped-gear · P1 · floor · 1 · set:DUN,MIN,CMP · abandoned pack
- backpack
- torch-dropped
- ten-foot-pole
- oil-flask

### set-mimic-bait · P2 · floor · 1 · set:DUN,LAI · too-good-to-be-true chest
- mimic-chest
- coins-scattered
- bones-pile

### set-armory-rack-spears · P1 · wall · 1 · set:CAS · spear rack
- weapon-rack
- spear ×4
- mil-arrow-sheaf

### set-armory-rack-swords · P1 · wall · 1 · set:CAS · sword rack
- weapon-rack
- sword-long ×3
- sword-short ×2

### set-armory-shields · P1 · floor · 1 · set:CAS · shields stacked
- mil-shield-stack
- shield-heater ×2
- shield-round ×2

### set-armory-bench · P1 · floor · 1x2 · set:CAS,SMI · armor under repair
- mil-armor-repair-bench
- armor-chainmail-heap
- helm-open
- mil-weapon-oil-flask

### set-guard-post · P1 · floor · 1 · set:CAS,MKT,DUN · guard post
- watch-desk
- mil-guard-lantern
- mil-duty-roster
- key-ring
- stool-three-leg

### set-gate-defense · P1 · floor · 2x2 · set:CAS · holding the gate
- mil-pavise ×2
- mil-arrow-sheaf ×2
- mil-boiling-oil-pot
- mil-spear-tripod

### set-training-yard · P1 · ground · 2x2 · set:CAS · practice yard
- mil-pell
- mil-quintain
- mil-wasters-rack
- training-dummy

### set-war-camp-command · P2 · ground · 3x3 · set:CMP!,CAS · commander's tent
- tent-military
- mil-field-desk
- mil-campaign-chest
- mil-map-case
- banner-standard-war

### set-siege-line · P2 · ground · 3x3 · set:CMP,CAS · siege works
- mil-mantlet ×2
- mil-siege-ladder ×2
- mil-battering-ram

### set-battlefield-aftermath · P2 · ground · 2x2 · set:RUI,CMP · after the battle
- mil-battlefield-debris
- arrows-stuck ×3
- shield-crude
- sword-broken
- helm-open
- banner-standard-war

### set-cell-dressing · P1 · floor · 1 · set:DUN! · a cell, lived in
- bed-straw-pallet
- bucket-slop
- manacles-wall

### set-cell-grim · P2 · floor · 1 · set:DUN · a forgotten cell
- skeleton-chained
- bones-pile
- decal-cobweb

### set-jailer-desk · P1 · floor · 1 · set:DUN · jailer's table
- table-square
- key-ring
- key-hook-board
- candle
- mug-of-ale

### set-torture-corner · P2 · floor · 2x2 · set:DUN · interrogation
- rack-torture
- brazier-irons
- manacles-loose
- decal-blood

### set-camp-small · P1 · ground · 2x2 · set:CMP! · travellers' camp
- campfire
- bedroll ×2
- backpack
- log-seat

### set-camp-cookfire · P1 · ground · 1 · set:CMP · supper on the fire
- campfire
- cooking-tripod
- pot-iron-small

### set-camp-hunter · P1 · ground · 2x2 · set:CMP,GRV · trapper's camp
- campfire
- rural-smoke-rack-meat
- rural-pelts-hanging-line
- rural-bear-trap-open
- rural-game-bag

### set-camp-bandit · P2 · ground · 3x3 · set:CMP,LAI · bandit camp
- campfire
- tent-small ×2
- loot-sack ×2
- cage-sacrifice
- barrel

### set-farmyard-corner · P1 · ground · 2x2 · set:HUT! · farmyard corner
- hay-bale ×2
- bucket
- pitchfork
- wheelbarrow

### set-farmyard-woodpile · P2 · ground · 1 · set:HUT · wood and axe
- woodpile
- chopping-block
- axe-woodcutter

### set-harvest-cart · P1 · ground · 1x2 · set:HUT · harvest coming in
- cart-hand
- rural-grain-stook ×2
- rural-straw-bundle ×2
- rural-scythe-snath-leaning

### set-harvest-field-corner · P1 · ground · 2x2 · set:HUT · field at harvest
- rural-grain-stook ×4
- rural-seed-basket
- rural-scythe-snath-leaning

### set-stable-stall-kept · P1 · floor · 1x2 · set:TAV,CAS · stall ready for a horse
- stable-stall
- rural-manger-wall
- rural-water-bucket-stable
- rural-straw-bedding
- rural-oat-sack

### set-tack-wall · P1 · wall · 1 · set:TAV,CAS · tack hung up
- tack-wall
- rural-saddle-riding
- bridle-hanging
- rural-horse-brasses
- rural-grooming-box

### set-dairy-corner · P2 · floor · 1 · set:HUT · milking corner
- rural-stool-milking
- rural-milk-churn-tall
- bucket
- cheese-small-round

### set-riverbank-fishing · P1 · ground · 2x2 · set:HUT,CMP · fishing spot
- rural-fishing-rod-leaning
- rural-catch-bucket
- rural-bait-pot
- rural-net-drying-rack

### set-jetty-moored · P2 · ground · 2x2 · set:HUT,MKT · little jetty
- rural-jetty-small
- rural-mooring-post
- rowboat-beached
- rural-oars-pair

### set-mine-face · P1 · floor · 1x2 · set:MIN! · working face
- ore-vein
- rural-pick-miners
- rural-hammer-and-gad
- rural-ore-bucket
- rural-lamp-miners
- rural-ore-iron-chunk ×3

### set-mine-cart-loaded · P1 · floor · 1 · set:MIN · cart ready to haul
- mine-cart
- ore-pile
- rural-coal-lump ×2

### set-mine-timber-stack · P2 · floor · 1 · set:MIN · props for shoring
- rural-pit-props-stack
- rural-timber-prop-single
- lantern-hanging

### set-mine-collapse · P1 · floor · 2x2 · set:MIN,DUN · cave-in
- collapse-rubble
- rural-timber-set-cracked
- pick-and-shovel

### set-mine-gold-strike · P2 · floor · 1 · set:MIN · a lucky strike
- rural-ore-gold-chunk ×3
- rural-gold-nuggets
- rural-panning-dish
- rural-gem-in-matrix

### set-rubble-cluster-small · P1 · floor · 1 · set:RUI!,DUN,MIN · rubble
- rubble-pile
- masonry-block-fallen ×2
- rock-small

### set-rubble-cluster-large · P1 · floor · 2x2 · set:RUI · collapsed wall
- rubble-pile ×2
- masonry-block-fallen ×3
- column-drum-fallen

### set-ruin-column-fallen · P1 · floor · 1x2 · set:RUI! · fallen colonnade
- column-stump
- column-drum-fallen ×2
- rubble-pile

### set-overgrowth-wall · P1 · wall · 1 · set:RUI!,GRV · ivy-choked wall
- vines-hanging
- bush
- grass-tall ×2

### set-overgrowth-floor · P1 · floor · 1 · set:RUI,GRV · grass through the flagstones
- grass-tall ×3
- bush
- moss-rock

### set-raided-home · P2 · floor · 2x2 · set:RUI,HUT · after the raid
- timbers-burnt
- furniture-smashed
- debris-planks
- pottery-shards
- decal-scorch

### set-forest-floor · P1 · ground · 2x2 · set:GRV,CMP · woodland floor
- leaf-litter
- branches-fallen
- fern-cluster
- rock-small
- mushroom-ring-small

### set-rock-cluster · P1 · ground · 2x2 · set:ANY · rocks
- boulder
- rock-small ×3
- moss-rock

### set-cave-formation · P1 · floor · 2x2 · set:MIN,DUN · cave formation
- stalagmite ×3
- crystal-glowing
- rock-small ×2

### set-fungus-grove · P2 · floor · 2x2 · set:MIN,GRV · underground mushrooms
- mushrooms-giant ×3
- fungus-forest-stalk
- slime-mold-floor

### set-dungeon-corridor-dress · P1 · floor · 1 · set:DUN! · corridor detail
- torch-sconce
- bones-pile
- decal-cobweb
- puddle

### set-sewer-clog · P2 · floor · 1 · set:DUN · sewer muck
- sewer-debris-clog
- refuse-pile
- puddle

### set-spider-corner · P2 · floor · 1 · set:LAI,DUN · spider corner
- giant-web
- web-cocoon ×2
- egg-sacs-cluster
- bones-pile

### set-lair-bones · P2 · floor · 2x2 · set:LAI! · lair floor
- floor-bone-strewn
- gnawed-carcass
- bones-pile
- skull-single

### set-goblin-hut-dressing · P2 · ground · 2x2 · set:LAI · goblin hut
- goblin-hut
- totem-skull
- dung-heap
- refuse-pile

### set-street-corner · P1 · ground · 1 · set:MKT! · street corner
- lamp-post-wood
- bench-street
- notice-board
- barrel

### set-well-scene · P1 · ground · 2x2 · set:HUT,MKT · village well
- well
- bucket ×2
- bench-village

### set-alley-clutter · P1 · ground · 1 · set:MKT,TAV · alley
- crate ×3
- barrel ×2
- refuse-pile
- puddle

### set-town-square-center · P2 · ground · 3x3 · set:MKT · market cross
- market-cross
- bench-street ×2
- lamp-post-iron ×2
- planter-stone ×2

### set-festival-green · P3 · ground · 3x3 · set:MKT,HUT · fair day
- maypole
- festival-bunting
- stage-wooden
- bench-village ×2

### set-inn-frontage · P1 · ground · 1x2 · set:TAV! · outside the inn
- sign-hanging
- hitching-post
- horse-trough-stone
- bench-street

### set-bard-corner · P1 · floor · 1 · set:TAV · bard's corner
- bard-instrument-stand
- bard-songbook
- bard-tip-hat
- stool-three-leg

### set-players-wagon · P3 · ground · 2x2 · set:MKT · traveling players
- wagon
- bard-costume-trunk
- bard-masks-theatre
- bard-playbill

