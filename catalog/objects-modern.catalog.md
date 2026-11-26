# Modern city — the first modern genre type (sprawl pack, 2026-11-06)

Objects the modern core rooms (apartment, office floor, bar & nightclub, city street, back alley, parking garage,
convenience store, warehouse: `experiments/2026-11-06-sprawl/DESIGN.md`) want and the catalog lacked. Roles the fantasy
catalog already had (sofa, bed-double, chair-plain, bar-counter, back-bar-shelves, stool-bar, table-billiards,
bench-street, the wall kit) get a modern sku under their own role (`sofa--mod`) in the exclusive tier `mod`
(`tools/spawn-tuner/build_data.py`, block `type:mod`), so no fantasy room ever rolls one, and a modern room prefers it.
The roles below are new and modern-only. Nothing carries words, numbers, logos or brand names (the trademark rule:
the plate gate refuses a plate with legible text). Thin things are designed stout (a streetlight's pole is 9 in across,
a forklift's guard bars are fat). Lights are electric: the engine lights them without a flame (`fx/fire.js` electric types).

## M1. Modern city — structure, doors and lights (sprawl, 2026-11-06)

- **door-roller-shutter** — corrugated steel roller shutter door; it rolls UP to open · kit · edge · size:60x6x108 · metal · set:MOD!,CYB · var:open · aff:pass,los,open · kit · P1 · the garage's and the warehouse's 10-ft vehicle door
- **door-shopfront** — glass shop door in an aluminium frame · kit · edge · size:60x6x108 · glass · set:MOD,CYB · var:open · aff:pass,open · kit · P1 · the shop's street door
- **wall-storefront** — shop-front glass wall section: a tiled riser and one big pane · kit · edge · size:60x12x108 · glass · set:MOD! · var:- · aff:block · kit · P1 · the street wall of a shop (walls.js PANELS mod-store)
- **door-flush** — plain modern flat-slab interior door with a lever handle · kit · edge · size:36x3x80 · wood · set:MOD,CYB · var:open · aff:pass,los,open · kit · P1 · the modern default door
- **door-steel** — grey steel fire door with a push bar and a small wired window · kit · edge · size:36x4x80 · metal · set:MOD,CYB · var:open · aff:pass,los,open · kit · P1 · back doors, garages, warehouses, stairwells
- **light-fluorescent** — ceiling fitting with two glowing fluorescent tubes · ceiling · sub · size:48x14x6 · metal · set:MOD!,CYB · var:lit · aff:lit · mesh · P1 · offices, shops, garages; steady cool-white light
- **sign-neon** — wall-mounted neon sign: a cocktail glass in glowing tube, no words · wall · sub · mount:72 · size:36x4x28 · glass · set:MOD!,CYB · var:lit · aff:lit · mesh · P1 · bars and clubs; the colour of the night
- **streetlight** — city streetlight: stout steel pole and cobra-head lamp · ground · 1 · size:30x72x200 · metal · set:MOD! · var:lit · aff:lit · mesh · P1 · along the kerb every 20-30 ft; warm amber light
- **lamp-floor** — modern floor lamp with a drum shade · floor · sub · size:18x18x62 · mixed · set:MOD,CYB · var:lit · aff:lit · mesh · P2 · beside the sofa or the bed

## M2. Modern city — furniture and fittings (sprawl, 2026-11-06)

- **armchair** — modern upholstered armchair · floor · 1 · size:34x34x32 · cloth · set:MOD · var:- · aff:sit · mesh · P1 · beside the sofa, facing the screen
- **coffee-table** — low modern coffee table with magazines · floor · 1 · size:48x26x16 · wood · set:MOD · var:- · aff:cover · mesh · P1 · between the sofa and the TV
- **tv-stand** — flat-screen television on a low media cabinet · wall · 1 · size:60x18x50 · mixed · set:MOD! · var:lit · aff:lit · mesh · P1 · the living room's focus; the sofa faces it
- **kitchenette** — apartment kitchen counter run with a sink and a hob · wall · 1x2 · size:96x26x38 · mixed · set:MOD,CYB · var:- · aff:use,cover · mesh · P1 · along one wall of a flat
- **fridge** — modern refrigerator · floor · 1 · size:30x30x70 · metal · set:MOD,CYB · var:- · aff:loot,cover · mesh · P1 · at the end of the kitchen run
- **table-dining** — small modern dining table · floor · 1 · size:48x32x30 · wood · set:MOD · var:- · aff:cover · mesh · P1 · flats and break rooms
- **houseplant** — big potted house plant in a white pot · floor · sub · size:24x24x40 · organic · set:MOD · var:- · aff:cover · mesh · P2 · corners of flats, offices and lobbies
- **cubicle-desk** — office cubicle: L-desk, monitor, padded partitions · floor · 1 · size:60x60x54 · mixed · set:MOD! · var:- · aff:use,cover · mesh · P1 · laid in a grid down an office floor
- **office-chair** — office swivel chair on castors · floor · sub · size:26x26x40 · mixed · set:MOD,CYB · var:- · aff:sit · mesh · P1 · at every desk
- **filing-cabinet** — four-drawer steel filing cabinet · floor · sub · size:18x28x52 · metal · set:MOD · var:- · aff:loot,cover · mesh · P1 · along office walls
- **water-cooler** — office water cooler with a big bottle · floor · sub · size:14x14x48 · mixed · set:MOD · var:- · aff:use · mesh · P2 · the corner where gossip happens
- **photocopier** — big office photocopier · floor · 1 · size:40x28x42 · mixed · set:MOD · var:- · aff:use,cover · mesh · P2 · an office's alcove
- **whiteboard** — office whiteboard with scribbled diagrams, no words · wall · 1 · mount:36 · size:72x4x48 · mixed · set:MOD · var:- · aff:- · mesh · P2 · on the meeting wall
- **booth-seat** — two red vinyl booth benches facing across a small table · floor · 1x2 · size:72x60x42 · mixed · set:MOD! · var:- · aff:sit,cover · mesh · P1 · along a bar's or diner's wall
- **table-cafe** — small round bar table on a pedestal · floor · sub · size:24x24x30 · mixed · set:MOD,CYB · var:- · aff:cover · mesh · P1 · dotted round a club floor
- **jukebox** — retro jukebox with glowing coloured bands · floor · sub · size:36x28x60 · mixed · set:MOD · var:lit · aff:lit,use · mesh · P2 · against a bar's wall
- **dj-booth** — nightclub DJ booth with two turntables, glowing front · floor · 1x2 · size:72x36x44 · mixed · set:MOD! · var:lit · aff:lit,use,cover · mesh · P1 · at the head of the dance floor
- **speaker-stack** — stack of two big black loudspeakers · floor · sub · size:30x24x60 · mixed · set:MOD · var:- · aff:cover · mesh · P2 · either side of the DJ booth
- **store-shelving** — double-sided shop shelving aisle stocked with colourful goods · floor · 1x2 · size:96x36x60 · mixed · set:MOD! · var:- · aff:loot,cover · mesh · P1 · the aisles of a convenience store
- **drinks-cooler** — glass-door drinks fridge, lit from inside · wall · 1 · size:60x30x80 · mixed · set:MOD! · var:lit · aff:lit,loot · mesh · P1 · the back wall of a shop
- **checkout-counter** — shop checkout counter with a cash register · floor · 1x2 · size:72x30x42 · mixed · set:MOD! · var:- · aff:use,cover · mesh · P1 · by a shop's door
- **atm** — free-standing cash machine with a glowing screen · floor · sub · size:26x30x64 · metal · set:MOD,CYB · var:lit · aff:lit,use · mesh · P2 · in a shop's corner, in a lobby
- **coffee-station** — self-serve coffee counter · wall · 1 · size:48x26x54 · mixed · set:MOD · var:- · aff:use · mesh · P2 · shops, offices, break rooms

## M3. Modern city — street, alley, garage and warehouse (sprawl, 2026-11-06)

- **car-sedan** — parked four-door sedan car, no badges · floor · 2x3 · size:72x180x56 · metal · set:MOD!,CYB · var:- · aff:cover,block · mesh · P1 · the street's and the garage's signature; full cover
- **car-hatchback** — parked small hatchback car, no badges · floor · 2x3 · size:68x156x58 · metal · set:MOD!,CYB · var:- · aff:cover,block · mesh · P1 · a second shape so a row of cars is not a row of copies
- **fire-hydrant** — red street fire hydrant · ground · tiny · size:16x16x30 · metal · set:MOD · var:- · aff:- · mesh · P1 · on the pavement by the kerb
- **trash-can-city** — city street litter bin · ground · sub · size:24x24x38 · metal · set:MOD · var:- · aff:loot · mesh · P1 · pavements and bus stops
- **newspaper-box** — street newspaper vending box · ground · sub · size:20x18x44 · metal · set:MOD · var:- · aff:- · mesh · P2 · street corners
- **traffic-cone** — orange traffic cone · ground · tiny · size:14x14x28 · mixed · set:MOD · var:- · aff:carry · mesh · P2 · road works, garages, crime scenes
- **dumpster** — dented green commercial dumpster · floor · 1x2 · size:72x40x50 · metal · set:MOD! · var:- · aff:cover,hide,loot · mesh · P1 · THE alley signature; full cover, a place to hide
- **trash-bags** — pile of black trash bags · floor · 1 · size:48x36x26 · organic · set:MOD,CYB · var:- · aff:cover,loot · mesh · P1 · beside dumpsters, kerbs on collection day
- **cardboard-boxes** — small stack of taped cardboard boxes · floor · sub · size:40x32x34 · paper · set:MOD,CYB · var:- · aff:cover,loot · mesh · P1 · alleys, stockrooms, squats
- **pallet-stack** — stack of wooden shipping pallets · floor · 1 · size:48x40x30 · wood · set:MOD,CYB · var:- · aff:cover,climb · mesh · P1 · alleys, loading docks, warehouses
- **oil-drum** — dented blue 55-gallon steel drum · floor · sub · size:24x24x34 · metal · set:MOD,CYB · var:- · aff:cover · mesh · P1 · alleys, warehouses, garages
- **ac-unit** — outdoor air-conditioning unit on a wall bracket · wall · sub · mount:48 · size:36x26x30 · metal · set:MOD · var:- · aff:- · mesh · P2 · alley walls and rooftops
- **pillar-concrete** — square concrete column with hazard stripes at its foot · floor · sub · size:24x24x108 · stone · set:MOD! · var:- · aff:block,cover · mesh · P1 · a parking garage's grid of columns
- **jersey-barrier** — concrete traffic barrier · floor · 1 · size:72x24x32 · stone · set:MOD · var:- · aff:cover,block · mesh · P1 · garages, road works, checkpoints
- **parking-barrier** — car-park entry barrier with a striped boom arm · floor · 1x2 · size:110x20x44 · metal · set:MOD · var:- · aff:block · mesh · P2 · a garage's way in
- **pallet-racking** — tall warehouse pallet racking loaded with boxes · wall · 1x2 · size:104x44x144 · metal · set:MOD! · var:- · aff:cover,climb,loot · mesh · P1 · rows down a warehouse
- **pallet-boxes** — pallet of shrink-wrapped boxes · floor · 1 · size:48x40x52 · mixed · set:MOD · var:- · aff:cover,loot · mesh · P1 · warehouse floors, loading docks
- **forklift** — yellow warehouse forklift · floor · 2x2 · size:50x100x86 · metal · set:MOD! · var:- · aff:cover,use · mesh · P1 · a warehouse's working space
- **shipping-container** — 20-ft steel shipping container · floor · big · size:96x240x102 · metal · set:MOD! · var:- · aff:cover,block,climb,hide · mesh · P1 · warehouses, docks, yards; a room of its own for a GM

## M4. Modern city — floors and decals (sprawl, 2026-11-06)

- **floor-tile-carpet** — grey-blue office carpet tiles · kit · 1 · size:60x60x0.1 · cloth · set:MOD,CYB · var:- · aff:- · flat · P1 · offices
- **floor-planks-laminate** — warm oak laminate boards · kit · 1 · size:60x60x0.1 · wood · set:MOD,CYB · var:- · aff:- · flat · P1 · apartments
- **floor-tile-vinyl** — white speckled vinyl shop tiles · kit · 1 · size:60x60x0.1 · mixed · set:MOD,CYB · var:- · aff:- · flat · P1 · shops, clinics
- **floor-concrete-polished** — smooth polished concrete · kit · 1 · size:60x60x0.1 · stone · set:MOD,CYB · var:- · aff:- · flat · P1 · warehouses, lofts
- **floor-concrete-garage** — stained parking-garage concrete · kit · 1 · size:60x60x0.1 · stone · set:MOD,CYB · var:- · aff:- · flat · P1 · garages, loading docks, alleys
- **floor-asphalt** — dark asphalt road surface · kit · 1 · size:60x60x0.1 · stone · set:MOD · var:- · aff:- · flat · P1 · streets, car parks, alleys
- **floor-tile-pavement** — concrete pavement slabs · kit · 1 · size:60x60x0.1 · stone · set:MOD · var:- · aff:- · flat · P1 · pavements
- **floor-tile-dark** — dark slate bar tiles · kit · 1 · size:60x60x0.1 · stone · set:MOD,CYB · var:- · aff:- · flat · P1 · bars and clubs
- **road-strip** — asphalt with a dashed yellow centre line, one 5-ft tile of a row · floor · 1 · size:60x60x0.1 · stone · set:MOD! · var:- · aff:- · flat · P1 · laid in a row down the middle of a street
- **crosswalk-strip** — asphalt with white zebra bars, one 5-ft tile of a row · floor · 1 · size:60x60x0.1 · stone · set:MOD · var:- · aff:- · flat · P1 · across a street
- **parking-line-strip** — garage concrete with a white painted line, one 5-ft tile of a row · floor · 1 · size:60x60x0.1 · stone · set:MOD · var:- · aff:- · flat · P1 · bay dividers, three in a row
- **manhole-cover** — round iron manhole cover · floor · 1 · size:30x30x0.1 · metal · set:MOD · var:- · aff:pass · flat · P2 · in the road
- **decal-oil-stain** — dark oil stain · floor · sub · size:36x36x0.1~0.5-2.5 · organic · set:MOD,CYB · var:- · aff:- · flat · P2 · garages, alleys, parked cars
- **decal-litter** — scatter of city litter · floor · sub · size:48x40x0.1~0.5-2 · paper · set:MOD,CYB · var:- · aff:- · flat · P2 · alleys, pavements, squats
