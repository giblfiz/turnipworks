# Environment breadth — expansion v0

Grammar and legend: see `README.md`. Nature, terrain, underground, exteriors and extra structure kit. Adds to `fantasy-core.catalog.md`; ids never repeat.

## U. Environment breadth

### U1. Trees & shrubs
- **tree-oak-great** — broad spreading oak · ground · 3x3 · size:240x240x480~0.6-1.6 · organic · set:HUT,NOB,GRV,CMP,RUI,TAV · var:size · aff:block,los,cover,climb · mesh · P1 · village greens, grove edges; hang a swing or a body
- **tree-birch** — slender white birch · ground · 1 · size:60x60x360~0.4-1.6 · organic · set:GRV,CMP,HUT,TAV · var:size · aff:cover · mesh · P1 · light woodland; cluster 3–5
- **tree-willow** — weeping willow · ground · 2x2 · size:180x180x360~0.5-1.6 · organic · set:GRV,HUT,NOB · var:size · aff:los,hide · mesh · P1 · stream banks, pond edges
- **tree-fruit** — apple/pear orchard tree · ground · 1 · size:120x120x180~0.5-1.6 · organic · set:HUT!,NOB,TAV · var:size · aff:cover,climb · mesh · P1 · orchards in rows; manor gardens
- **tree-sapling** — young sapling · ground · sub · size:24x24x72~0.5-2 · organic · set:HUT,GRV,CMP · var:- · aff:- · mesh · P3 · clearings, replanted fields
- **tree-burnt** — fire-blackened tree trunk · ground · 1 · size:48x48x240~0.4-1.8 · organic · set:RUI,LAI,CMP · var:size · aff:cover · mesh · P1 · raided villages, dragon country
- **tree-snowladen** — snow-covered conifer · ground · 1 · size:72x72x360~0.4-2 · organic · set:CMP,MIN · var:size · aff:block,los,cover · mesh · P3 · winter mountains
- **tree-gnarled-ancient** — twisted, hollow ancient tree · ground · 2x2 · size:150x150x300~0.6-1.8 · organic · set:GRV,CRY,RUI · var:- · aff:cover,hide,climb · mesh · P1 · haunted woods, hag lairs
- **tree-palm** — palm tree · ground · 1 · size:72x72x360~0.5-1.6 · organic · set:CMP · var:size · aff:cover · mesh · P3 · warm-coast outliers; cheap genre stretch
- **tree-roots-exposed** — tree on an eroded bank with exposed roots · ground · 2x2 · size:140x140x300~0.6-1.6 · organic · set:GRV,CMP · var:- · aff:cover,hide,climb · mesh · P3 · burrow entrances
- **hedge-straight** — clipped hedge segment · kit · edge · size:60x30x60~0.6-1.6 · organic · set:NOB!,HUT,TAV · var:ruin · aff:block,los · kit · P2 · manor gardens, mazes; overgrown in ruins
- **hedge-corner** — clipped hedge corner · kit · edge · size:60x60x60~0.6-1.6 · organic · set:NOB,TAV · var:ruin · aff:block,los · kit · P1 · hedge mazes
- **bramble-thicket** — thorny bramble patch · ground · 1 · size:60x60x40~0.5-2 · organic · set:GRV,HUT,RUI,CMP · var:size · aff:hazard,los,hide · mesh · P1 · difficult terrain
- **fern-cluster** — clump of ferns · ground · sub · size:30x30x24~0.5-2 · organic · set:GRV,CMP,RUI · var:- · aff:hide · thin · P1 · forest floor, damp ruins
- **bush-berry** — berry bush · ground · sub · size:36x36x36~0.6-1.6 · organic · set:GRV,HUT,CMP,TAV · var:- · aff:hide,loot · mesh · P1 · foraging, druid gardens
- **flowerbed** — cultivated flowerbed · ground · 1 · size:60x60x18~0.6-1.6 · organic · set:NOB,HUT,TAV · var:- · aff:- · mesh · P1 · cottage fronts, manor paths
- **vegetable-patch** — tilled rows with sprouting crops · ground · 1x2 · size:60x110x12~0.6-1.6 · organic · set:HUT!,TAV · var:- · aff:- · mesh · P1 · cottage gardens (turnips, obviously)
- **crop-field-tile** — wheat or barley field tile · ground · 1 · size:60x60x36 · organic · set:HUT · var:- · aff:hide,los · flat · P1 · tile outward for farmland
- **ivy-wall-cover** — ivy blanket over a wall face · wall · 1 · size:60x6x96~0.5-2 · organic · set:RUI!,NOB,CRY · var:- · aff:climb · flat · P2 · aging layer for any stone wall
- **creeper-roots-wall** — roots breaking through a wall · wall · 1 · size:60x12x84~0.5-2 · organic · set:RUI,DUN,GRV · var:- · aff:climb · mesh · P2 · the forest reclaiming masonry

### U2. Rocks, cliffs & terrain kit
- **cliff-face** — straight cliff face segment · kit · edge · size:60x30x180~0.5-3 · stone · set:MIN,CMP,LAI,RUI · var:size · aff:block,los,climb · kit · P1 · elevation changes outdoors
- **cliff-corner-outer** — outside cliff corner · kit · edge · size:60x60x180~0.5-3 · stone · set:MIN,CMP,LAI · var:size · aff:block,los,climb · kit · P2 · pairs with cliff-face
- **cliff-corner-inner** — inside cliff corner · kit · edge · size:60x60x180~0.5-3 · stone · set:MIN,CMP,LAI · var:size · aff:block,los,climb · kit · P2 · canyons, quarries
- **cliff-ledge** — overhanging ledge · kit · 1 · size:60x60x24~0.6-2 · stone · set:MIN,LAI,CMP · var:- · aff:climb,cover · kit · P3 · ambush perches
- **rock-slab-flat** — flat rock slab · ground · 1 · size:60x48x12~0.5-2 · stone · set:GRV,CMP,RUI · var:size · aff:climb · mesh · P2 · stepping stones, natural tables
- **rock-spire** — tall pointed rock spire · ground · 1 · size:48x48x180~0.4-2.5 · stone · set:LAI,CMP,MIN · var:size · aff:block,los,cover · mesh · P3 · badlands, lair approaches
- **scree-slope** — loose scree slope · ground · 1x2 · size:60x110x36~0.5-2 · stone · set:MIN,CMP,LAI · var:- · aff:hazard · mesh · P2 · difficult terrain
- **pebbles-scatter** — pebble and gravel scatter · ground · sub · size:30x30x2~0.5-2.5 · stone · set:ANY · var:- · aff:- · flat · P3 · path edges, stream beds
- **dirt-path-tile** — dirt path tile (straight, bend, fork) · ground · 1 · size:60x60x2 · organic · set:HUT,CMP,GRV,MKT,CRY,TAV · var:- · aff:- · flat · P1 · roads between places
- **mud-patch** — mud patch · ground · 1 · size:60x60x2~0.5-2 · organic · set:HUT,CMP,MKT,LAI · var:- · aff:hazard · flat · P2 · difficult terrain after rain
- **snow-drift** — snow drift mound · ground · 1 · size:60x60x24~0.5-2 · mixed · set:CMP,MIN · var:size · aff:cover,hazard · mesh · P3 · winter scenes
- **hill-mound-terrain** — grassy terrain hummock · ground · 2x2 · size:110x110x36~0.5-3 · organic · set:HUT,CMP,GRV,CRY · var:size · aff:cover,los · mesh · P1 · breaks flat ground
- **sinkhole** — collapsed sinkhole · ground · 1 · size:60x60x48~0.5-2 · organic · set:RUI,CMP,LAI · var:- · aff:hazard,pass · mesh · P3 · entrance to what's below

### U3. Caves & underground
- **cave-floor-tile** — uneven natural cave floor · kit · 1 · size:60x60x6 · stone · set:MIN,DUN,LAI · var:- · aff:- · flat · P1 · the cave-rock family's floor
- **cave-wall-corner** — rounded cave wall corner · kit · edge · size:60x60x120~0.8-1.5 · stone · set:MIN,DUN,LAI · var:- · aff:block,los · kit · P1 · lets caves read as caves, not rooms
- **cave-ceiling-rough** — rough cave ceiling piece · ceiling · 1 · size:60x60x24~0.6-1.6 · stone · set:MIN,DUN,LAI · var:- · aff:- · kit · P1 · FPV and cutaway mood
- **cave-mouth** — cave entrance arch in a rock face · kit · 2x2 · size:110x60x120~0.6-2 · stone · set:MIN!,LAI!,CMP · var:- · aff:pass · mesh · P1 · the transition from outside to under
- **cave-tunnel-narrow** — squeeze passage segment · kit · edge · size:60x30x72~0.8-1.4 · stone · set:MIN,DUN,LAI · var:- · aff:pass · kit · P1 · crawl spaces
- **cave-ramp-natural** — sloped natural rock ramp · kit · 1x2 · size:60x110x48~0.7-1.5 · stone · set:MIN,DUN,LAI · var:- · aff:pass · kit · P1 · levels in a cavern
- **flowstone-curtain** — draped flowstone formation · wall · 1 · size:60x24x96~0.4-2 · stone · set:MIN,DUN · var:- · aff:los · mesh · P3 · show caves
- **cave-pool** — still underground pool · floor · 1 · size:60x60x12~0.5-2.5 · stone · set:MIN,DUN,LAI · var:- · aff:hazard · mesh · P1 · pair with fx-water-surface
- **chasm-edge** — edge of a bottomless chasm · kit · edge · size:60x24x48 · stone · set:MIN,DUN,LAI · var:- · aff:hazard · kit · P2 · the fall; bridges span it
- **geode-cluster** — split geode with crystals · floor · sub · size:24x24x20~0.4-3 · stone · set:MIN,ARC · var:- · aff:loot · mesh · P3 · gem-mine treasure
- **glowworm-ceiling** — ceiling patch of glowworms · ceiling · 1 · size:60x60x6~0.5-2.5 · organic · set:MIN,DUN · var:lit · aff:lit · flat · P3 · soft cave light
- **root-giant** — giant root arching through a cavern · floor · 1x2 · size:36x110x72~0.5-2 · organic · set:GRV,DUN,MIN · var:- · aff:climb,cover · mesh · P2 · the world-tree's underside
- **root-ceiling-hanging** — roots dangling from the ceiling · ceiling · 1 · size:60x60x48~0.5-2 · organic · set:DUN,GRV,CRY,LAI · var:- · aff:los · thin · P1 · barrows, shallow dungeons
- **fungus-shelf** — shelf fungi on a wall · wall · sub · size:18x10x12~0.5-2.5 · organic · set:DUN,MIN,GRV · var:lit · aff:lit · mesh · P3 · damp walls; glow variant
- **fungus-forest-stalk** — towering fungus stalk · ground · 1 · size:48x48x180~0.4-2.5 · organic · set:MIN,DUN,GRV · var:size,lit · aff:block,los,cover · mesh · P2 · underground forests
- **fungus-puffball** — puffball clusters · floor · sub · size:24x24x14~0.4-2.5 · organic · set:MIN,DUN,GRV · var:- · aff:hazard · mesh · P3 · spore traps
- **slime-mold-floor** — slime mold patch · floor · 1 · size:60x60x2~0.5-2 · organic · set:DUN,LAI,MIN · var:- · aff:hazard · flat · P1 · slippery, maybe acidic
- **bridge-rope** — rope-and-plank suspension bridge span · kit · 1x3 · size:48x170x36~0.6-3 · wood · set:MIN,DUN,LAI,CMP · var:ruin · aff:pass,hazard · thin · P2 · chasm crossings; cut the ropes
- **bridge-stone-natural** — natural stone arch bridge · kit · 1x3 · size:60x170x48~0.7-2 · stone · set:MIN,DUN,LAI · var:ruin · aff:pass · mesh · P2 · spans chasms and rivers underground
- **mine-support-braced** — heavily braced timber set for weak rock · kit · edge · size:60x24x84 · wood · set:MIN · var:ruin · aff:- · kit · P3 · the dangerous section
- **mine-rail-bridge** — trestle bridge for cart rails · kit · 1x2 · size:60x110x96~0.7-1.8 · wood · set:MIN · var:ruin · aff:pass · kit · P3 · rail over a drop
- **mine-ladder-shaft** — vertical shaft with ladder platform · kit · 1 · size:60x60x120 · wood · set:MIN · var:ruin · aff:pass,climb · kit · P2 · connects mine levels

### U4. Water features
- **stream-bank** — stream bank edge segment · kit · edge · size:60x24x18~0.6-1.6 · organic · set:HUT,GRV,CMP · var:- · aff:hazard · kit · P2 · rivers are banks plus fx-water-surface
- **stream-bend** — stream bank bend · kit · edge · size:60x60x18~0.6-1.6 · organic · set:HUT,GRV,CMP · var:- · aff:hazard · kit · P2 · meanders
- **pond-edge** — pond shore segment · kit · edge · size:60x30x12~0.6-1.6 · organic · set:HUT,NOB,GRV · var:- · aff:hazard · kit · P1 · ponds and lakes
- **stepping-stones** — stepping stones across water · ground · 1x2 · size:40x110x8~0.7-1.6 · stone · set:GRV,HUT,NOB · var:- · aff:pass · mesh · P2 · the careful crossing
- **waterfall-small** — small waterfall over rocks · ground · 1x2 · size:60x110x72~0.5-2.5 · stone · set:GRV,CMP,MIN · var:- · aff:hide,los · mesh · P2 · the cave behind the falls; pair with fx-water-surface
- **reeds** — reed clump · ground · sub · size:30x30x48~0.6-1.6 · organic · set:GRV,HUT,CMP · var:- · aff:hide,los · thin · P2 · water edges; hide in them
- **lily-pads** — lily pads with flowers · floor · 1 · size:60x60x2~0.5-2 · organic · set:GRV,NOB · var:- · aff:- · flat · P1 · ponds, fey pools
- **bog-tile** — boggy ground tile · ground · 1 · size:60x60x3 · organic · set:GRV,CMP,LAI · var:- · aff:hazard · flat · P2 · swamps; difficult terrain
- **swamp-tree** — moss-draped swamp tree with knees · ground · 1 · size:72x72x300~0.5-1.6 · organic · set:GRV,LAI · var:size · aff:cover,los · mesh · P2 · swamps, hag country
- **boardwalk** — plank boardwalk segment on stilts · kit · 1 · size:60x60x30 · wood · set:CMP,GRV,LAI · var:ruin · aff:pass · kit · P2 · swamp paths, lizardfolk villages
- **mill-wheel** — waterwheel on a millrace · wall · 1x2 · size:36x150x150~0.7-1.4 · wood · set:HUT,MKT · var:ruin · aff:hazard · mesh · P1 · village mills
- **ford-stones** — shallow ford with cobbles · ground · 1x2 · size:60x110x6~0.7-1.6 · stone · set:HUT,CMP · var:- · aff:pass · flat · P3 · road-meets-river
- **fountain-wall** — wall-mounted spout fountain · wall · sub · size:30x18x40~0.7-1.5 · stone · set:MKT,NOB,TEM · var:ruin · aff:use · mesh · P3 · street water source

### U5. Sewers
- **sewer-channel** — sewer channel segment with flowing water · kit · 1 · size:60x60x30 · stone · set:DUN!,MKT · var:ruin · aff:hazard · kit · P1 · pair with fx-water-surface
- **sewer-walkway** — raised sewer walkway beside a channel · kit · 1 · size:60x60x18 · stone · set:DUN! · var:ruin · aff:pass · kit · P1 · the path that follows the channel
- **sewer-junction** — channel junction chamber · kit · 2x2 · size:110x110x96 · stone · set:DUN · var:ruin · aff:pass · kit · P1 · crossroads under the city
- **sewer-outflow** — large outflow tunnel mouth · kit · 2x2 · size:110x110x96~0.7-1.6 · stone · set:DUN,MKT · var:open · aff:pass · mesh · P1 · where the sewer meets the river
- **sewer-ladder-manhole** — ladder up to a street grate · kit · 1 · size:60x60x120 · metal · set:DUN,MKT · var:open · aff:pass,climb · kit · P1 · the way out
- **sewer-sluice-gate** — sluice gate in a stone frame with a hand wheel · floor · 1 · size:50x20x60 · metal · set:DUN · var:open · aff:block,use · mesh · P1 · flood the tunnel as a scene state
- **sewer-debris-clog** — clog of refuse and bones · floor · 1 · size:60x60x24~0.5-1.6 · organic · set:DUN,LAI · var:- · aff:block,loot · mesh · P1 · something lives in there

### U6. Crypts & catacombs
- **catacomb-shelf-bones** — rough-cut shelves of stacked bones · wall · 1 · size:60x24x84 · organic · set:CRY!,DUN · var:ruin · aff:loot · mesh · P1 · catacomb walls
- **ossuary-wall** — decorative wall of skulls and long bones · kit · edge · size:60x18x108 · organic · set:CRY!,CLT · var:ruin · aff:block,los · kit · P1 · ossuary chapels
- **crypt-gate-iron** — iron crypt gate · kit · edge · size:48x9x90 · metal · set:CRY!,TEM · var:open,ruin · aff:pass,open · kit · P1 · graveyard-to-crypt threshold
- **burial-urn-niche** — wall niche holding cinerary urns · wall · sub · size:24x16x30 · ceramic · set:CRY,TEM · var:ruin · aff:loot · mesh · P1 · columbaria
- **stone-coffin-lidless** — open stone coffin with remains · floor · 1x2 · size:36x84x24 · stone · set:CRY,RUI,DUN · var:- · aff:loot · mesh · P1 · already robbed, or not
- **candle-drippings-mound** — mound of melted candles on stone · floor · sub · size:20x20x14~0.5-2 · mixed · set:CRY,CLT,TEM,ARC · var:lit · aff:lit · mesh · P1 · centuries of vigils
- **grave-marker-wood** — wooden grave marker · ground · tiny · size:16x3x30~0.7-1.4 · wood · set:CRY,HUT,CMP · var:ruin · aff:- · mesh · P1 · paupers' graves, battlefield burials
- **graveyard-fence-iron** — wrought iron graveyard fence · kit · edge · size:60x4x48 · metal · set:CRY,TEM,NOB · var:ruin · aff:cover · thin · P1 · encloses graveyards
- **statue-weeping-angel** — mourning winged statue · floor · 1 · size:30x30x72~0.7-1.8 · stone · set:CRY!,TEM,NOB · var:ruin · aff:cover · mesh · P1 · graveyards; the one that moved
- **tomb-door-sealed** — carved tomb door in a hillside · kit · edge · size:60x12x108 · stone · set:CRY!,RUI · var:open,ruin · aff:pass,open · kit · P2 · barrow and hillside tomb entrances
- **barrow-mound** — grassy barrow with stone entrance · ground · 3x3 · size:170x170x96~0.6-1.8 · organic · set:CRY,RUI,GRV · var:open · aff:pass · mesh · P2 · the old kings' graves

### U7. Ruin pieces
- **stair-broken** — collapsed staircase ending in air · kit · 1x2 · size:36x110x90 · stone · set:RUI!,CAS · var:- · aff:pass,climb · kit · P2 · climb what's left
- **arch-half** — half an arch still standing · floor · 1x2 · size:40x110x120~0.7-1.5 · stone · set:RUI! · var:- · aff:cover · mesh · P1 · the ruin silhouette
- **tower-collapsed** — stump of a collapsed tower · ground · 2x2 · size:110x110x180~0.6-1.8 · stone · set:RUI!,CAS · var:- · aff:block,los,climb · mesh · P2 · landmarks visible from far off
- **wall-overgrown** — ruined wall swallowed by vegetation · kit · edge · size:60x18x84 · stone · set:RUI!,GRV · var:- · aff:cover,climb · kit · P2 · the late stage of ruin
- **window-empty-frame** — empty stone window frame · kit · edge · size:60x16x108 · stone · set:RUI,TEM,CAS · var:- · aff:cover · kit · P2 · chapel ruins with sky behind
- **floor-cracked-tile** — floor tile heaved by roots · kit · 1 · size:60x60x6 · stone · set:RUI!,DUN,CRY · var:- · aff:hazard · flat · P2 · aging floor family
- **roof-collapsed** — collapsed roof section with sky hole · ceiling · 2x2 · size:110x110x48~0.7-1.4 · mixed · set:RUI,HUT,TAV · var:- · aff:- · mesh · P1 · lets rain and light in
- **chimney-standing-alone** — lone chimney of a burnt house · ground · 1 · size:36x30x180~0.7-1.4 · stone · set:RUI!,HUT · var:- · aff:cover · mesh · P1 · the saddest silhouette in a raided village
- **gate-ruined** — ruined gatehouse arch · ground · 2x2 · size:110x60x150~0.7-1.5 · stone · set:RUI,CAS · var:- · aff:pass,cover · mesh · P3 · abandoned fortresses
- **fountain-dry-cracked** — dry cracked basin with weeds · ground · 1 · size:60x60x30~0.6-1.6 · stone · set:RUI! · var:- · aff:cover · mesh · P3 · lost courtyards
- **aqueduct-span** — broken aqueduct arch span · ground · 1x3 · size:60x170x240~0.6-1.8 · stone · set:RUI · var:- · aff:pass,cover · mesh · P3 · old-empire landscape (Imperion)
- **wagon-wreck** — overturned burnt wagon · ground · 2x3 · size:84x160x60 · wood · set:RUI,CMP,LAI · var:- · aff:cover,loot · mesh · P1 · ambush aftermath

### U8. Lair terrain
- **floor-bone-strewn** — floor scattered with gnawed bones · floor · 1 · size:60x60x6 · organic · set:LAI!,DUN,CRY · var:- · aff:- · flat · P2 · lair floor layer
- **rock-scorched** — scorched, glassy rock · ground · 1 · size:50x40x30~0.5-2 · stone · set:LAI!,RUI · var:size · aff:cover · mesh · P2 · dragon country
- **claw-marks-wall** — deep claw gouges in stone · wall · 1 · size:48x2x48~0.5-2.5 · stone · set:LAI!,DUN · var:- · aff:- · flat · P2 · the warning before the reveal
- **dung-heap** — heap of monster dung and debris · floor · 1 · size:60x60x24~0.5-2 · organic · set:LAI,HUT · var:- · aff:loot,hazard · mesh · P1 · something undigested glitters
- **egg-sacs-cluster** — spider/insect egg sacs · wall · sub · size:24x12x24~0.5-2.5 · organic · set:LAI!,DUN · var:- · aff:hazard · mesh · P2 · burn before they hatch
- **hide-drying-rack** — rack of stretched hides · ground · 1 · size:60x24x72 · organic · set:LAI,CMP,HUT · var:- · aff:los · thin · P1 · hunters, goblin camps
- **goblin-hut** — ramshackle scrap hut · ground · 2x2 · size:110x110x84~0.7-1.4 · mixed · set:LAI!,CMP · var:ruin · aff:hide,los · mesh · P1 · goblin/kobold warrens aboveground
- **spike-palisade-crude** — crude stake wall with skulls · kit · edge · size:60x18x72 · wood · set:LAI!,CMP · var:ruin · aff:block,cover · kit · P1 · orc and goblin camps
- **lava-crust-edge** — cooled lava edge segment · kit · edge · size:60x24x12 · stone · set:LAI,MIN · var:- · aff:hazard · kit · P3 · pair with fx-lava

### U9. Settlement exteriors
- **street-cobble-tile** — cobbled street tile (straight, corner, T) · kit · 1 · size:60x60x4 · stone · set:MKT!,NOB,CAS · var:ruin · aff:- · flat · P1 · town streets
- **street-gutter** — street tile with open gutter · kit · 1 · size:60x60x6 · stone · set:MKT · var:- · aff:- · kit · P1 · the realistic city
- **plaza-tile** — decorative paved plaza tile · kit · 1 · size:60x60x4 · stone · set:MKT,NOB,TEM · var:ruin · aff:- · flat · P1 · squares and courtyards
- **well-house** — roofed well with windlass · ground · 1 · size:60x60x120 · wood · set:MKT!,HUT,TAV,MIN · var:ruin · aff:use · mesh · P1 · village square centerpiece
- **lamp-post-iron** — wrought iron lamp post · ground · sub · size:14x14x108 · metal · set:MKT,NOB · var:lit,ruin · aff:lit · thin · P1 · richer streets
- **lamp-post-wood** — wooden pole with hanging lantern · ground · sub · size:30x14x96 · wood · set:MKT,TAV,HUT,MIN,SMI · var:lit,ruin · aff:lit · mesh · P1 · village lanes
- **bench-street** — stone or wood street bench · ground · 1 · size:60x18x18 · mixed · set:MKT,NOB,TEM,TAV · var:ruin · aff:sit · mesh · P1 · squares, parks
- **planter-stone** — stone planter with shrub · ground · sub · size:24x24x36~0.7-1.5 · stone · set:MKT,NOB,TAV · var:ruin · aff:cover · mesh · P1 · street dressing
- **horse-trough-stone** — stone horse trough with spout · ground · 1x2 · size:96x24x24 · stone · set:MKT,TAV,CAS,SMI · var:ruin,fill · aff:cover · mesh · P1 · town squares
- **market-cross** — carved market cross · ground · sub · size:36x36x144~0.7-1.4 · stone · set:MKT! · var:ruin · aff:cover · mesh · P1 · heart of a market town
- **bollard-stone** — stone bollard · ground · tiny · size:12x12x30 · stone · set:MKT,CAS · var:- · aff:cover · mesh · P1 · street edges, gates
- **city-wall** — tall town wall segment with walkway · kit · edge · size:60x60x300~0.7-1.5 · stone · set:MKT,CAS! · var:ruin · aff:block,los · kit · P1 · town boundary
- **gate-tower** — twin-towered town gate · kit · 2x3 · size:110x170x360~0.7-1.4 · stone · set:MKT!,CAS · var:open,ruin · aff:pass,block · mesh · P1 · the entrance scene; guards
- **watchtower-wood** — wooden watchtower on stilts · ground · 1 · size:60x60x240~0.8-1.4 · wood · set:CMP,CAS,LAI,MKT · var:ruin · aff:climb,cover · mesh · P1 · borders, camps, goblin forts
- **bridge-stone-arch** — stone arch road bridge · ground · 1x3 · size:60x170x72~0.8-2 · stone · set:MKT,HUT,CAS · var:ruin · aff:pass · mesh · P1 · over rivers and moats
- **bridge-covered** — covered timber bridge · ground · 1x3 · size:60x170x120~0.8-1.6 · wood · set:HUT,MKT · var:ruin · aff:pass,los · mesh · P1 · troll-bridge territory
- **fence-picket** — picket fence segment · kit · edge · size:60x3x40 · wood · set:HUT,MKT,TAV · var:ruin · aff:cover · kit · P1 · tidier yards
- **gatepost-stone** — stone gateposts with finials · ground · sub · size:30x30x72 · stone · set:NOB!,CRY · var:ruin · aff:cover · mesh · P1 · manor drives
- **wayshrine-lantern** — stone lantern post · ground · sub · size:18x18x60 · stone · set:TEM,NOB,GRV · var:lit · aff:lit · mesh · P3 · temple approaches
- **haystack-field** — large field haystack · ground · 1 · size:72x72x108~0.6-1.4 · organic · set:HUT! · var:- · aff:hide,cover · mesh · P1 · fields; hide in it
- **woodshed** — open-fronted woodshed · ground · 1x2 · size:60x110x84 · wood · set:HUT,TAV · var:ruin · aff:cover,hide · mesh · P1 · behind cottages
- **dovecote** — freestanding dovecote · ground · 1 · size:60x60x144~0.7-1.4 · stone · set:NOB,HUT · var:ruin · aff:- · mesh · P1 · manor grounds, farmsteads
- **pigsty** — low walled pigsty · ground · 2x2 · size:110x110x36 · mixed · set:HUT · var:ruin · aff:cover · mesh · P1 · farmyards (no pigs, per the prop rule)
- **cart-shed** — open cart shelter · ground · 2x2 · size:110x110x108 · wood · set:TAV,HUT,MKT,MIN · var:ruin · aff:cover · mesh · P1 · inn yards

### U10. Roofs, porches & balconies
- **roof-shingle-wood** — wood shingle roof segment · kit · 1 · size:60x60x40 · wood · set:HUT,TAV,MKT · var:ruin · aff:- · kit · P1 · middle-wealth roofs
- **roof-dormer** — dormer window piece · kit · 1 · size:48x48x60 · mixed · set:TAV,NOB,MKT · var:ruin · aff:- · kit · P1 · upper-floor rooms show from outside
- **roof-conical** — conical tower cap · kit · 1 · size:60x60x96~0.7-2 · mixed · set:CAS,ARC,NOB · var:ruin · aff:- · kit · P2 · wizard towers, castle turrets
- **roof-gable-end** — gable end wall piece · kit · edge · size:60x8x60 · mixed · set:HUT,TAV,MKT · var:ruin · aff:block,los · kit · P2 · closes a pitched roof
- **porch-covered** — covered front porch · kit · 1x2 · size:60x110x108 · wood · set:TAV,HUT,MKT · var:ruin · aff:cover · kit · P1 · tavern fronts, farmhouses
- **balcony-wood** — timber balcony with railing · kit · 1 · size:60x48x42 · wood · set:TAV,MKT,NOB · var:ruin · aff:cover · kit · P1 · upper-storey overlooks, swashbuckling
- **balcony-stone** — stone balcony on corbels · kit · 1 · size:60x48x42 · stone · set:NOB,CAS · var:ruin · aff:cover · kit · P1 · speeches, serenades, defenestration
- **gallery-interior** — interior mezzanine gallery segment · kit · 1 · size:60x60x42 · wood · set:TAV,NOB,ARC · var:ruin · aff:pass,cover · kit · P1 · common-room balconies, library upper levels
- **jetty-overhang** — overhanging upper storey (jettied) · kit · edge · size:60x30x108 · wood · set:MKT,TAV · var:ruin · aff:- · kit · P3 · crowded medieval streets
- **downspout-gutter** — gutter and downspout · wall · sub · size:12x10x108 · metal · set:MKT,NOB,TAV · var:- · aff:climb · thin · P1 · climbable route up a wall

### U11. Stairs, ladders & crossings
- **stair-exterior-wood** — exterior wooden stair to an upper door · kit · 1x2 · size:40x110x108 · wood · set:TAV,MKT,HUT · var:ruin · aff:pass · kit · P1 · outside stairs to rented rooms
- **stair-grand** — wide ceremonial stair · kit · 2x2 · size:110x110x108 · stone · set:NOB!,CAS,TEM · var:ruin · aff:pass · kit · P1 · manor foyers, temple approaches
- **stair-wall-hugging** — stair built along a wall with no rail · kit · 1x2 · size:36x110x108 · stone · set:CAS,DUN,ARC · var:ruin · aff:pass,hazard · kit · P3 · tower interiors
- **stair-rope-trapdoor** — pull-down loft ladder under a hatch · kit · 1 · size:36x60x108 · wood · set:HUT,TAV · var:open · aff:pass,climb · kit · P3 · sleeping lofts
- **scaffold** — timber scaffold section · kit · 1 · size:60x60x120 · wood · set:MKT,CAS,TEM · var:ruin · aff:pass,climb,cover · thin · P3 · construction sites, chase scenes
- **plank-bridge** — single plank across a gap · kit · 1x2 · size:12x110x2 · wood · set:MIN,DUN,RUI,CMP · var:- · aff:pass,hazard · mesh · P2 · improvised crossings
- **stepping-pillars** — stone pillars rising from a pit · floor · 1 · size:60x60x60~0.6-2 · stone · set:DUN,CRY,RUI · var:ruin · aff:pass,hazard · mesh · P2 · jump puzzles
- **climbing-chain** — heavy chain hung for climbing · wall · edge · size:4x4x120 · metal · set:DUN,CAS,MIN · var:- · aff:climb,pass · thin · P3 · shafts and pits

### U12. Environmental clutter
- **leaf-litter** — autumn leaf litter · ground · 1 · size:60x60x1~0.5-2 · organic · set:GRV,HUT,RUI,CMP,CRY · var:- · aff:- · flat · P1 · seasonal dressing; hides pressure plates
- **branches-fallen** — fallen branches · ground · sub · size:48x30x12~0.5-2 · wood · set:GRV,CMP,RUI · var:- · aff:- · mesh · P1 · forest floor clutter
- **puddle** — rain puddle · ground · sub · size:30x24x0.1~0.4-3 · mixed · set:ANY · var:- · aff:- · flat · P1 · streets, cellars, cave floors
- **roots-surface** — surface roots across a path · ground · 1 · size:60x60x8~0.6-1.6 · organic · set:GRV,RUI,CMP · var:- · aff:hazard · mesh · P3 · trip hazards
- **moss-rock** — moss-covered rock · ground · sub · size:24x20x16~0.5-2.5 · stone · set:GRV,RUI,CRY · var:size · aff:cover · mesh · P1 · damp woods
- **bones-animal-skull** — bleached animal skull · ground · tiny · size:12x7x6~0.5-2.5 · organic · set:LAI,CMP,RUI · var:- · aff:- · mesh · P3 · wasteland markers
- **rubble-small-scatter** — small stone chips and dust · floor · sub · size:30x30x3~0.5-2.5 · stone · set:RUI,DUN,MIN · var:- · aff:- · flat · P2 · edges of rubble piles
- **straw-scatter** — loose straw on the floor · floor · sub · size:40x40x1~0.5-2 · organic · set:HUT,TAV,DUN · var:- · aff:- · flat · P3 · stables, cells, barns
- **refuse-pile** — midden of rubbish · floor · 1 · size:60x60x24~0.5-1.6 · organic · set:MKT,DUN,LAI,HUT · var:- · aff:loot,hide · mesh · P1 · alleys, lair corners
- **chain-pile** — heap of rusty chain · floor · sub · size:18x18x6~0.5-2 · metal · set:DUN,CAS,MIN · var:- · aff:carry · mesh · P3 · dungeons, drawbridge rooms
- **mushroom-ring-small** — small toadstool cluster · ground · tiny · size:12x12x5~0.5-2 · organic · set:GRV,CMP,RUI · var:- · aff:- · mesh · P1 · woodland scatter
- **snow-patch** — thin snow patch · ground · 1 · size:60x60x1~0.5-2 · mixed · set:CMP,MIN · var:- · aff:- · flat · P3 · winter dressing
- **icicles-hanging** — icicle cluster · ceiling · sub · size:24x12x24~0.5-2.5 · glass · set:MIN,CMP,LAI · var:- · aff:hazard · mesh · P3 · ice caves, frost-giant lairs
- **ice-floor-tile** — slick ice floor tile · kit · 1 · size:60x60x4 · glass · set:MIN,LAI,CMP · var:ruin · aff:hazard · flat · P3 · ice caves; difficult terrain
