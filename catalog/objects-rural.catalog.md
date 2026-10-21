# Mine, farm, stable & hunt — object level (Y5)

Single-object granularity for rural trades. Ids prefixed `rural-`. No live animals; animal products and trophies only.

## Y5. Mine, farm, stable & hunt — object level

### Mining — tools
- **rural-pick-miners** — single-point miner's pick · floor · tiny · size:18x4x34 · metal · set:MIN! · var:- · aff:carry · mesh · P1 · leaning on gallery walls; the mine's default tool
- **rural-pick-double** — double-headed pick · floor · tiny · size:22x4x34 · metal · set:MIN · var:- · aff:carry · mesh · P2 · harder rock; racks and tool caches
- **rural-pick-broken** — pick with snapped haft · floor · tiny · size:18x4x20 · metal · set:MIN,RUI · var:- · aff:carry · mesh · P3 · abandoned-mine clue
- **rural-hammer-and-gad** — hand hammer with iron gad wedge · surface · tiny · size:10x6x3 · metal · set:MIN! · var:- · aff:carry · mesh · P1 · splitting ore at the face
- **rural-wedges-set** — set of iron splitting wedges · surface · tiny · size:8x6x2 · metal · set:MIN · var:- · aff:carry · mesh · P3 · beside the ore vein
- **rural-sledge-mining** — short-handled mining sledge · floor · tiny · size:10x4x24 · metal · set:MIN · var:- · aff:carry · mesh · P2 · breaking boulders in tight galleries
- **rural-shovel-coal** — wide coal scoop shovel · floor · tiny · size:12x6x44 · metal · set:MIN,SMI · var:- · aff:carry · mesh · P2 · coal bins and forges
- **rural-crowbar-mine** — long iron pry bar · floor · tiny · size:3x3x60 · metal · set:MIN,DUN · var:- · aff:carry · thin · P3 · levering loose rock; opening crates
- **rural-drill-hand** — hand drill steel and hammer pair · surface · tiny · size:14x6x3 · metal · set:MIN · var:- · aff:carry · thin · P3 · drilling charge holes
- **rural-tool-cache-mine** — tarp-covered cache of mine tools · floor · sub · size:36x24x20 · mixed · set:MIN · var:- · aff:loot · mesh · P2 · dead-end caches; supply hooks

### Mining — ore & gems
- **rural-ore-iron-chunk** — rust-red iron ore chunk · surface · tiny · size:6x5x4~0.5-3 · stone · set:MIN!,SMI · var:- · aff:carry,loot · mesh · P1 · the common ore; carts and piles
- **rural-ore-copper-chunk** — green-streaked copper ore chunk · surface · tiny · size:6x5x4~0.5-3 · stone · set:MIN,SMI · var:- · aff:carry,loot · mesh · P2 · variety at the ore face
- **rural-ore-silver-chunk** — glinting silver ore chunk · surface · tiny · size:5x4x4~0.5-3 · stone · set:MIN · var:- · aff:carry,loot · mesh · P2 · worth stealing
- **rural-ore-gold-chunk** — gold-veined quartz chunk · surface · tiny · size:5x4x4~0.5-3 · stone · set:MIN!,LAI · var:- · aff:carry,loot · mesh · P1 · the reason for the mine
- **rural-ore-tin-chunk** — dark tin ore chunk · surface · tiny · size:5x4x4~0.5-3 · stone · set:MIN · var:- · aff:carry,loot · mesh · P3 · bronze-age flavor
- **rural-ore-mithral-chunk** — pale glowing fantasy ore chunk · surface · tiny · size:5x4x4~0.5-3 · stone · set:MIN,LAI · var:lit · aff:carry,loot · mesh · P2 · deep-mine treasure; fantasy metal
- **rural-coal-lump** — lump of coal · surface · tiny · size:4x3x3~0.5-2 · stone · set:MIN,SMI · var:- · aff:carry · mesh · P1 · scatter around coal bins
- **rural-coal-pile-floor** — heap of coal on the floor · floor · sub · size:40x32x16~0.5-2 · stone · set:MIN,SMI · var:- · aff:cover · mesh · P2 · forge corners, mine sidings
- **rural-gold-nuggets** — few gold nuggets in a cloth · surface · tiny · size:6x6x1 · metal · set:MIN,MKT · var:- · aff:carry,loot · mesh · P2 · panning reward
- **rural-gold-dust-pouch** — small pouch of gold dust · surface · tiny · size:3x3x3 · organic · set:MIN,MKT · var:- · aff:carry,loot · mesh · P3 · miner's payday
- **rural-gem-in-matrix** — uncut gem in rock matrix · surface · tiny · size:5x4x4~0.5-2.5 · stone · set:MIN!,ARC · var:- · aff:carry,loot · mesh · P2 · the lucky strike
- **rural-geode-split** — split geode showing crystals · surface · tiny · size:6x5x3~0.5-2.5 · stone · set:MIN,ARC · var:- · aff:carry,loot · mesh · P2 · alchemists want these
- **rural-slag-heap** — pile of smelting slag · ground · 1 · size:72x60x36~0.5-2 · stone · set:MIN,SMI · var:- · aff:cover · mesh · P3 · mine surface dressing
- **rural-tailings-pile** — spoil heap of crushed rock · ground · 1 · size:72x60x40~0.5-2.5 · stone · set:MIN! · var:- · aff:cover,climb · mesh · P1 · outside every mine mouth

### Mining — gear & containers
- **rural-ore-sack** — sack of ore · floor · tiny · size:16x12x22 · cloth · set:MIN · var:- · aff:carry · mesh · P3 · porters' load
- **rural-lunch-pail-miner** — miner's lunch pail · surface · tiny · size:8x6x7 · metal · set:MIN · var:- · aff:carry · mesh · P3 · break-room dressing
- **rural-candle-box-mine** — box of tallow candles · surface · tiny · size:10x5x4 · wood · set:MIN · var:- · aff:carry,loot · mesh · P3 · mine stores
- **rural-shaft-cover-planks** — planks over an old shaft · floor · 1 · size:60x60x4 · wood · set:MIN,RUI · var:ruin · aff:hazard · mesh · P2 · step carefully
- **rural-sign-danger-mine** — crude painted danger sign · wall · tiny · size:18x1x12 · wood · set:MIN,DUN · var:- · aff:- · mesh · P1 · warnings nobody heeds
- **rural-timber-set-cracked** — cracked, sagging timber set · kit · edge · size:60x10x84 · wood · set:MIN!,RUI · var:- · aff:hazard · kit · P1 · cave-in foreshadowing
- **rural-mine-map-board** — chalk-marked board map of the levels · wall · sub · size:36x2x24 · wood · set:MIN · var:- · aff:use · mesh · P3 · foreman's office
- **rural-bellows-ventilation** — large ventilation bellows · floor · 1 · size:48x72x48 · mixed · set:MIN · var:- · aff:use · mesh · P3 · deep galleries
- **rural-ore-cart-tipped** — tipped ore cart spilling rock · floor · 1 · size:48x60x30 · mixed · set:MIN,RUI · var:- · aff:cover · mesh · P2 · after the collapse
- **rural-foreman-desk** — foreman's slanted desk with ledgers · floor · sub · size:30x24x44 · wood · set:MIN · var:- · aff:use,loot · mesh · P3 · mine office
- **rural-helmet-candle** — leather miner's cap with candle · surface · tiny · size:9x10x8 · mixed · set:MIN! · var:lit · aff:carry,lit · mesh · P1 · on hooks by the shaft
- **rural-lamp-miners** — small iron miner's lamp · surface · tiny · size:4x4x7 · metal · set:MIN! · var:lit · aff:carry,lit · mesh · P1 · hang on timber sets; the mine's light
- **rural-canary-cage-empty** — small empty birdcage for gas warning · surface · tiny · size:7x7x10 · metal · set:MIN · var:open · aff:carry · thin · P3 · ominous when empty
- **rural-fuse-coil** — coil of fuse cord · surface · tiny · size:8x8x2 · organic · set:MIN · var:- · aff:carry,hazard · mesh · P2 · next to powder kegs
- **rural-powder-horn** — powder horn · surface · tiny · size:10x4x4 · organic · set:MIN,CMP · var:- · aff:carry,hazard · mesh · P3 · blasting and hunting
- **rural-charge-bundle** — bundled blasting charges · surface · tiny · size:8x6x6 · mixed · set:MIN · var:- · aff:carry,hazard · mesh · P3 · the fuse everyone watches
- **rural-ore-basket** — wicker ore-carrying basket · floor · tiny · size:18x14x22 · organic · set:MIN · var:fill · aff:carry · mesh · P2 · porters' load
- **rural-ore-bucket** — iron-banded ore bucket on a rope · floor · tiny · size:16x16x16 · mixed · set:MIN · var:fill · aff:carry · mesh · P1 · hauled up the shaft
- **rural-panning-dish** — gold-panning dish · surface · tiny · size:15x15x3 · metal · set:MIN · var:- · aff:carry,use · mesh · P2 · stream-side prospecting
- **rural-sieve-riddle** — large ore riddle sieve · floor · sub · size:30x30x8 · mixed · set:MIN · var:- · aff:use · mesh · P3 · sorting areas
- **rural-assay-scale** — small assay balance with weights · surface · tiny · size:10x5x8 · metal · set:MIN,ARC,MKT · var:- · aff:use · thin · P3 · mine office; ore buyers
- **rural-assay-crucible** — crucible and tongs for assay · surface · tiny · size:10x4x4 · ceramic · set:MIN,ARC · var:- · aff:use · mesh · P3 · testing ore purity
- **rural-survey-stakes** — bundle of painted survey stakes · floor · tiny · size:6x6x36 · wood · set:MIN · var:- · aff:carry · mesh · P3 · claim markers
- **rural-claim-marker** — hand-lettered mining claim post · ground · tiny · size:12x4x48 · wood · set:MIN · var:- · aff:- · mesh · P3 · disputed claims make plots
- **rural-timber-prop-single** — single loose pit prop · floor · sub · size:8x8x72 · wood · set:MIN · var:- · aff:carry · mesh · P2 · stacked for repairs
- **rural-pit-props-stack** — stack of pit props · floor · 1 · size:60x36x30~0.6-1.6 · wood · set:MIN · var:- · aff:cover · mesh · P1 · mine stores
- **rural-rail-section-loose** — loose rail section and sleepers · floor · 1 · size:36x72x6 · metal · set:MIN · var:- · aff:- · mesh · P3 · track repair area
- **rural-cart-wheel-mine** — spare mine cart wheel · floor · tiny · size:14x4x14 · metal · set:MIN · var:- · aff:carry · mesh · P3 · broken-cart dressing
- **rural-water-pump-mine** — hand-cranked mine drainage pump · floor · 1 · size:30x30x48 · mixed · set:MIN · var:- · aff:use · mesh · P3 · flooded levels
- **rural-bell-signal-mine** — shaft signal bell on a bracket · wall · tiny · size:10x8x12 · metal · set:MIN · var:- · aff:use · mesh · P3 · ring for the lift

### Farm — tools & field
- **rural-peat-stack** — stack of drying peat bricks · ground · 1 · size:60x36x36~0.6-1.6 · organic · set:HUT · var:- · aff:cover · mesh · P3 · bog country fuel
- **rural-turf-spade** — turf cutting spade · floor · tiny · size:8x4x48 · metal · set:HUT · var:- · aff:carry · mesh · P3 · peat cutting
- **rural-pruning-hook** — long pruning hook · wall · tiny · size:4x3x96 · metal · set:HUT,NOB · var:- · aff:carry · thin · P3 · orchards
- **rural-apple-ladder** — tall tapered orchard ladder · wall · edge · size:20x6x144~0.7-1.2 · wood · set:HUT,NOB · var:- · aff:climb,pass · thin · P3 · orchards
- **rural-harvest-basket-strap** — harvest basket with strap · floor · tiny · size:16x12x16 · organic · set:HUT · var:fill · aff:carry · mesh · P3 · picking season
- **rural-field-boundary-stone** — carved boundary stone · ground · tiny · size:12x8x30~0.7-1.6 · stone · set:HUT,RUI · var:- · aff:- · mesh · P3 · land disputes
- **rural-plough-share** — iron plough share blade · floor · tiny · size:14x10x5 · metal · set:HUT,SMI · var:- · aff:carry · mesh · P3 · in for repair at the smith
- **rural-harrow** — spiked wooden harrow · ground · 1x2 · size:60x72x10 · wood · set:HUT · var:- · aff:hazard · mesh · P3 · field edges
- **rural-dung-fork** — dung fork · floor · tiny · size:10x4x60 · metal · set:HUT · var:- · aff:carry · thin · P3 · byres and stables
- **rural-hay-rake-wooden** — wide wooden hay rake · floor · tiny · size:26x4x72 · wood · set:HUT · var:- · aff:carry · thin · P3 · haymaking
- **rural-scythe-snath-leaning** — scythe leaning on a wall · wall · tiny · size:30x6x68 · mixed · set:HUT,CRY · var:- · aff:carry · thin · P1 · the grim-reaper silhouette
- **rural-sickle-pair** — two sickles on a peg · wall · tiny · size:14x4x18 · metal · set:HUT · var:- · aff:carry · mesh · P3 · harvest season
- **rural-grain-stook** — stook of standing sheaves · ground · sub · size:30x30x48~0.7-1.4 · organic · set:HUT! · var:- · aff:cover,hide · mesh · P1 · harvest fields; rows of them
- **rural-seed-basket** — seed-sowing basket on a strap · surface · tiny · size:16x10x10 · organic · set:HUT · var:- · aff:carry · mesh · P1 · spring sowing
- **rural-threshing-floor-flail-pair** — two flails crossed on a threshing floor · floor · 1 · size:60x48x4 · mixed · set:HUT · var:- · aff:- · mesh · P3 · barn floor dressing
- **rural-grain-heap-threshed** — heap of threshed grain · floor · sub · size:40x36x18~0.5-2 · food · set:HUT · var:- · aff:- · mesh · P2 · barn floors
- **rural-chaff-pile** — chaff pile · floor · sub · size:40x36x14~0.5-2 · organic · set:HUT · var:- · aff:hide · mesh · P3 · winnowing aftermath
- **rural-straw-bundle** — tied straw bundle · floor · tiny · size:12x12x36 · organic · set:HUT,TAV · var:- · aff:carry · mesh · P1 · thatching, bedding
- **rural-thatch-bundles** — stack of thatching bundles · floor · 1 · size:60x36x30~0.6-1.6 · organic · set:HUT · var:- · aff:cover · mesh · P3 · roof repairs
- **rural-fence-post-bundle** — bundle of fence posts · floor · sub · size:24x24x60 · wood · set:HUT · var:- · aff:carry · mesh · P3 · mending fences
- **rural-hurdle-wattle** — woven wattle hurdle panel · floor · edge · size:60x4x42 · organic · set:HUT! · var:- · aff:cover · mesh · P1 · temporary pens
- **rural-water-yoke-bucket-pair** — pair of buckets without yoke · floor · tiny · size:26x12x12 · wood · set:HUT · var:fill · aff:carry · mesh · P3 · by the well

### Farm — dairy, bees & wool
- **rural-milk-churn-tall** — tall milk churn · floor · sub · size:14x14x30 · metal · set:HUT · var:fill · aff:carry · mesh · P2 · dairy corners
- **rural-cheese-mould** — wooden cheese mould · surface · tiny · size:8x8x5 · wood · set:HUT · var:- · aff:carry · mesh · P3 · dairy dressing
- **rural-curd-cloth-hanging** — cheesecloth of curds hanging to drain · ceiling · tiny · size:10x10x14 · cloth · set:HUT · var:- · aff:- · mesh · P3 · dairy dressing
- **rural-stool-milking** — one-legged milking stool · floor · tiny · size:10x10x12 · wood · set:HUT · var:- · aff:sit · mesh · P2 · byres
- **rural-feed-scoop** — wooden feed scoop · surface · tiny · size:5x10x4 · wood · set:HUT,TAV · var:- · aff:carry · mesh · P3 · feed bins
- **rural-chicken-feeder** — chicken feed trough · ground · sub · size:36x8x6 · wood · set:HUT · var:- · aff:- · mesh · P3 · by the coop
- **rural-nest-box-straw** — straw-lined nest box with eggs · floor · tiny · size:14x12x10 · organic · set:HUT · var:- · aff:loot · mesh · P2 · coop interior
- **rural-sheep-shears-small** — hand sheep shears · surface · tiny · size:3x11x1.5 · metal · set:HUT · var:- · aff:carry · mesh · P3 · shearing day
- **rural-wool-bale** — tied bale of wool · floor · sub · size:36x24x24 · cloth · set:HUT,MKT · var:- · aff:cover · mesh · P2 · trade goods; barns
- **rural-wool-fleece-single** — single rolled fleece · surface · tiny · size:14x10x8 · cloth · set:HUT,MKT · var:- · aff:carry · mesh · P2 · shearing sheds
- **rural-beehive-box** — wooden box hive · ground · sub · size:18x18x32 · wood · set:HUT,NOB · var:- · aff:hazard · mesh · P3 · orchard edges
- **rural-hive-frame** — honey-laden hive frame · surface · tiny · size:18x1.5x10 · wood · set:HUT · var:- · aff:carry · mesh · P3 · honey harvest
- **rural-bee-smoker** — beekeeper's smoker · surface · tiny · size:5x5x9 · metal · set:HUT · var:lit · aff:carry · mesh · P3 · beside the hives
- **rural-beekeeper-veil** — beekeeper's veiled hat · surface · tiny · size:14x14x12 · cloth · set:HUT · var:- · aff:carry · mesh · P3 · on a peg

### Farm — yard & pens
- **rural-pig-sty-trough** — stone pig trough · ground · 1 · size:48x18x12 · stone · set:HUT · var:fill · aff:- · mesh · P3 · sty; no live pigs
- **rural-pen-gate-hurdle** — hurdle gate on a pen · ground · edge · size:60x4x42 · wood · set:HUT · var:open · aff:pass · mesh · P3 · sheepfolds
- **rural-mud-wallow** — muddy wallow patch · floor · 1 · size:72x60x2~0.6-1.6 · organic · set:HUT · var:- · aff:hazard · flat · P3 · sty dressing
- **rural-feed-sack-open** — open feed sack spilling grain · floor · tiny · size:18x14x16 · cloth · set:HUT,TAV,ARC · var:- · aff:- · mesh · P2 · barn floors
- **rural-salt-lick** — salt-lick block on a post · ground · tiny · size:8x8x48 · stone · set:HUT · var:- · aff:- · mesh · P3 · pastures
- **rural-lantern-barn** — barn lantern on a nail · wall · tiny · mount:60 · size:6x6x11 · metal · set:HUT,TAV · var:lit · aff:lit · mesh · P1 · barns and stables

### Stable & tack
- **rural-manger-wall** — wall-mounted manger and hay rack · wall · 1 · size:48x18x36 · wood · set:TAV!,HUT,CAS · var:fill · aff:- · mesh · P1 · every stall
- **rural-mounting-block** — stone mounting block · ground · tiny · size:30x24x24 · stone · set:TAV,CAS,NOB · var:- · aff:climb · mesh · P3 · inn yards
- **rural-tack-trunk** — tack trunk · floor · sub · size:36x20x24 · wood · set:TAV,CAS · var:open · aff:loot,open · mesh · P3 · tack rooms
- **rural-halter-rope** — rope halter on a hook · wall · tiny · size:8x3x20 · organic · set:TAV,HUT · var:- · aff:carry · thin · P3 · stall doors
- **rural-horse-brasses** — strap of horse brasses · wall · tiny · size:4x2x20 · metal · set:TAV,HUT · var:- · aff:- · mesh · P1 · tavern decoration
- **rural-saddle-soap-tin** — tin of saddle soap and rag · surface · tiny · size:5x5x2 · metal · set:TAV · var:- · aff:carry · mesh · P3 · tack bench
- **rural-saddle-riding** — riding saddle on a stand · floor · sub · size:20x28x30 · organic · set:TAV!,HUT,CAS · var:- · aff:loot · mesh · P1 · stables, tack rooms
- **rural-saddle-war** — high-backed war saddle · floor · sub · size:22x30x34 · organic · set:CAS! · var:- · aff:loot · mesh · P2 · knights' stables
- **rural-saddle-pack** — pack saddle frame · floor · sub · size:22x26x24 · mixed · set:TAV,CMP,MIN · var:- · aff:- · mesh · P2 · caravans, mines
- **rural-saddle-side** — side saddle · floor · sub · size:22x30x30 · organic · set:NOB · var:- · aff:- · mesh · P3 · noble stables
- **rural-harness-draft** — draft-horse harness with collar · wall · sub · size:30x12x40 · organic · set:HUT,TAV,MKT · var:- · aff:- · mesh · P2 · carthorse gear
- **rural-horse-blanket-folded** — folded horse blanket · surface · tiny · size:20x14x6 · cloth · set:TAV,CAS · var:- · aff:carry · mesh · P3 · stall doors
- **rural-barding-cloth** — heraldic horse caparison on a rack · floor · sub · size:36x72x60 · cloth · set:CAS!,NOB · var:- · aff:- · mesh · P3 · tourney stables
- **rural-curry-comb** — curry comb · surface · tiny · size:5x4x2 · mixed · set:TAV,HUT · var:- · aff:carry · mesh · P3 · grooming kit
- **rural-hoof-pick** — hoof pick · surface · tiny · size:1x6x2 · metal · set:TAV,HUT,SMI · var:- · aff:carry · mesh · P3 · grooming kit
- **rural-grooming-box** — grooming box with brushes · surface · tiny · size:16x8x8 · wood · set:TAV,CAS · var:open · aff:carry · mesh · P1 · stall corners
- **rural-horseshoe-nails-box** — box of horseshoe nails · surface · tiny · size:6x4x3 · metal · set:SMI,TAV · var:- · aff:carry · mesh · P3 · farrier bench
- **rural-farrier-apron** — leather farrier's apron on a peg · wall · tiny · size:20x2x30 · organic · set:SMI,TAV · var:- · aff:- · mesh · P3 · smithy
- **rural-oat-sack** — sack of oats · floor · tiny · size:16x12x22 · cloth · set:TAV,HUT · var:- · aff:carry · mesh · P1 · feed rooms
- **rural-nosebag** — horse nosebag · surface · tiny · size:10x8x12 · cloth · set:TAV,CMP · var:- · aff:carry · mesh · P1 · travellers
- **rural-water-bucket-stable** — stable water bucket · floor · tiny · size:12x12x12 · wood · set:TAV,HUT,ARC,SMI · var:fill · aff:carry · mesh · P1 · every stall
- **rural-manure-barrow** — barrow of manure · floor · sub · size:26x54x26 · mixed · set:TAV,HUT · var:- · aff:- · mesh · P3 · mucking out
- **rural-straw-bedding** — fresh straw bedding in a stall · floor · 1 · size:60x60x4~0.6-1.6 · organic · set:TAV!,HUT,CAS,CLT,LAI · var:- · aff:sleep · flat · P1 · stall floors; sleep in the stables
- **rural-riding-crop** — riding crop · surface · tiny · size:1x26x1 · organic · set:NOB,TAV · var:- · aff:carry · thin · P3 · noble stables
- **rural-lance-rack** — rack of tourney lances · wall · 1 · size:36x12x132 · wood · set:CAS · var:- · aff:loot · thin · P3 · tilt-yard stables

### Hunter & trapper
- **rural-drag-sledge** — hunter's drag sledge · ground · 1x2 · size:36x84x12 · wood · set:CMP,HUT · var:- · aff:carry · mesh · P3 · hauling kills home
- **rural-trail-cairn** — small trail-marker cairn · ground · tiny · size:12x12x16~0.6-2 · stone · set:CMP,GRV,MIN · var:- · aff:- · mesh · P1 · wilderness wayfinding
- **rural-tree-snare-bent** — bent-sapling snare · ground · sub · size:30x24x60 · wood · set:CMP,GRV · var:- · aff:trap · thin · P3 · hoist traps
- **rural-boar-tusk-trophy** — boar tusks mounted on a plaque · wall · tiny · size:12x4x8 · organic · set:CMP,TAV,NOB · var:- · aff:- · mesh · P3 · lodge walls
- **rural-snare-wire** — set wire snare · ground · tiny · size:8x8x6 · metal · set:CMP,GRV,HUT · var:- · aff:trap · thin · P3 · game trails
- **rural-trap-box-rabbit** — wooden box trap · ground · tiny · size:8x24x8 · wood · set:CMP,HUT · var:open · aff:trap · mesh · P3 · hedgerows
- **rural-trap-deadfall** — deadfall trap with propped log · ground · sub · size:36x30x30 · wood · set:CMP,GRV · var:- · aff:trap,hazard · mesh · P2 · ranger ambushes
- **rural-trap-pit-covered** — branch-covered pit trap · floor · 1 · size:60x60x2 · organic · set:CMP,GRV,LAI · var:open · aff:trap,hazard · mesh · P2 · goblin trails
- **rural-bear-trap-open** — open jaw trap, sprung-ready · floor · tiny · size:16x10x4 · metal · set:CMP!,GRV,LAI · var:open · aff:trap,hazard · mesh · P1 · hidden in leaves
- **rural-pelt-wolf** — wolf pelt · surface · tiny · size:18x48x1 · organic · set:CMP,HUT,MKT · var:- · aff:carry,loot · mesh · P1 · trappers' cabins, markets
- **rural-pelt-bear** — bear pelt · floor · 1 · size:48x72x2 · organic · set:CMP,NOB,CAS · var:- · aff:loot · mesh · P2 · chief's hall, hunting lodge
- **rural-pelt-fox** — fox pelt · surface · tiny · size:10x32x1 · organic · set:CMP,MKT · var:- · aff:carry,loot · mesh · P3 · fur trader stock
- **rural-pelt-rabbit-bundle** — bundle of rabbit pelts · surface · tiny · size:12x10x4 · organic · set:CMP,HUT,MKT · var:- · aff:carry · mesh · P3 · poachers
- **rural-pelt-deer** — deer hide · surface · tiny · size:30x48x1 · organic · set:CMP,HUT · var:- · aff:carry · mesh · P3 · tanning stock
- **rural-pelts-hanging-line** — line of hanging pelts · wall · 1x2 · size:96x4x36 · organic · set:CMP!,MKT · var:- · aff:los · mesh · P1 · trapper camps
- **rural-antlers-shed** — shed antler · surface · tiny · size:14x10x6~0.6-1.6 · organic · set:CMP,GRV,HUT · var:- · aff:carry · mesh · P1 · forest floor finds
- **rural-antlers-rack** — antler rack on a board · wall · sub · size:30x12x24 · organic · set:CMP,TAV,NOB · var:- · aff:- · mesh · P2 · lodges, taverns
- **rural-game-bag** — leather game bag · surface · tiny · size:12x4x12 · organic · set:CMP,HUT · var:- · aff:carry,loot · mesh · P1 · hunters' gear
- **rural-skinning-knife** — skinning knife · surface · tiny · size:1x9x1 · metal · set:CMP,HUT · var:- · aff:carry · mesh · P3 · next to pelts
- **rural-skinning-board** — skinning board with stretched hide · floor · sub · size:24x6x48 · mixed · set:CMP · var:- · aff:use · mesh · P1 · trapper cabin
- **rural-smoke-rack-meat** — smoking rack of meat strips · ground · 1 · size:48x30x48 · mixed · set:CMP!,HUT · var:lit · aff:- · mesh · P1 · jerky over coals
- **rural-decoy-duck** — carved decoy duck · surface · tiny · size:12x5x7 · wood · set:CMP,HUT · var:- · aff:carry · mesh · P3 · marsh blinds
- **rural-hunting-blind** — reed hunting blind · ground · 1 · size:60x36x54 · organic · set:CMP,GRV · var:- · aff:hide,cover,los · mesh · P2 · ambush spot
- **rural-hunting-spear** — boar spear with crossbar · wall · tiny · size:8x3x84 · mixed · set:CMP,NOB · var:- · aff:carry · thin · P3 · lodge walls
- **rural-falconry-perch** — falconry perch with hood and glove · floor · sub · size:18x12x42 · mixed · set:NOB,CAS · var:- · aff:- · mesh · P3 · noble mews (no bird)
- **rural-scent-lure-jar** — jar of scent lure · surface · tiny · size:3x3x5 · ceramic · set:CMP · var:- · aff:carry · mesh · P3 · trapper supplies
- **rural-tracks-trail-decal** — animal tracks in mud · floor · 1 · size:36x60x0.1~0.5-2 · organic · set:CMP,GRV,LAI · var:- · aff:- · flat · P2 · tracking checks

### Fisher (river & pond)
- **rural-floats-bundle** — bundle of cork floats · surface · tiny · size:8x6x6 · organic · set:HUT,MKT · var:- · aff:carry · mesh · P3 · net making
- **rural-scaling-table** — fish scaling table · floor · 1 · size:48x24x34 · wood · set:HUT,MKT · var:- · aff:use · mesh · P3 · landings
- **rural-crayfish-trap** — crayfish pot · floor · tiny · size:12x12x14 · organic · set:HUT · var:- · aff:carry · mesh · P3 · river margins
- **rural-creel-full** — creel spilling fish · surface · tiny · size:14x9x10 · organic · set:HUT,CMP · var:- · aff:carry · mesh · P3 · end of the day
- **rural-reed-bundle-cut** — bundle of cut reeds · floor · sub · size:16x16x60 · organic · set:HUT · var:- · aff:carry · mesh · P3 · thatch and baskets
- **rural-net-cast** — round cast net · surface · tiny · size:18x18x3 · organic · set:HUT,CMP,MKT · var:- · aff:carry · thin · P3 · riverbanks
- **rural-net-drying-rack** — net drying on poles · ground · 1x2 · size:96x36x72 · mixed · set:HUT,MKT · var:- · aff:los · thin · P1 · fishing huts
- **rural-fish-trap-basket** — wicker fish trap · floor · tiny · size:14x14x30 · organic · set:HUT,CMP · var:- · aff:carry · mesh · P1 · shallows, hut walls
- **rural-eel-trap** — long eel trap · floor · tiny · size:8x8x40 · organic · set:HUT · var:- · aff:carry · mesh · P3 · river margins
- **rural-bait-pot** — bait pot with worms · surface · tiny · size:5x5x5 · ceramic · set:HUT,CMP · var:- · aff:carry · mesh · P1 · fisher's kit
- **rural-tackle-box** — tackle box with hooks and floats · surface · tiny · size:10x6x5 · wood · set:HUT,CMP,MKT · var:- · aff:carry,loot · mesh · P3 · fisher's hut
- **rural-fishing-rod-leaning** — fishing rod leaning with line · wall · tiny · size:6x6x108 · wood · set:HUT!,CMP · var:- · aff:carry · thin · P1 · riverbanks, cottage walls
- **rural-fishing-spear** — fish spear · wall · tiny · size:6x3x84 · mixed · set:HUT,CMP · var:- · aff:carry · thin · P3 · reed-bed fishers
- **rural-oars-pair** — pair of oars · floor · tiny · size:12x6x90 · wood · set:HUT,CMP · var:- · aff:carry · mesh · P1 · leaning by boats
- **rural-coracle** — round hide coracle upturned · ground · 1 · size:48x48x20 · organic · set:HUT,CMP · var:- · aff:cover,hide · mesh · P3 · riverbank fishers
- **rural-punt-pole** — punting pole · floor · tiny · size:3x3x144 · wood · set:HUT · var:- · aff:carry · thin · P3 · fens
- **rural-mooring-post** — mooring post with rope · ground · tiny · size:10x10x42 · wood · set:HUT,MKT · var:- · aff:- · mesh · P1 · river landings
- **rural-jetty-small** — short plank fishing jetty · kit · 1x2 · size:48x120x24~0.8-1.5 · wood · set:HUT,MKT · var:ruin · aff:pass · kit · P2 · pond edges, ferries
- **rural-fish-smoker** — small fish smoking hut · ground · 1 · size:48x48x72 · wood · set:HUT · var:lit · aff:- · mesh · P3 · fishing villages
- **rural-catch-bucket** — bucket with the day's catch · floor · tiny · size:12x12x12 · wood · set:HUT,MKT · var:- · aff:carry · mesh · P1 · end of a good day
