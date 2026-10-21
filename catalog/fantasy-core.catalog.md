# Fantasy Core — role catalog v0

Grammar and legend: see `README.md`. One role per line. Style families and variants multiply roles into SKUs.

## A. Structure

### A1. Walls
- **wall-straight** — full-height wall segment · kit · edge · size:60x12x108 · mixed · set:ANY · var:ruin · aff:block,los · kit · P1 · the backbone; every family needs one
- **wall-corner-outer** — outside corner piece · kit · edge · size:60x60x108 · mixed · set:ANY · var:ruin · aff:block,los · kit · P1 · pairs with straight; solver places automatically
- **wall-corner-inner** — inside corner piece · kit · edge · size:60x60x108 · mixed · set:ANY · var:ruin · aff:block,los · kit · P1 · concave room corners
- **wall-t-junction** — three-way junction post · kit · edge · size:60x60x108 · mixed · set:ANY · var:- · aff:block,los · kit · P2 · interior partitions meeting exterior walls
- **wall-end-cap** — finished free end of a wall run · kit · edge · size:12x12x108 · mixed · set:ANY · var:ruin · aff:block,los · kit · P2 · stub walls, ruin edges
- **wall-half** — waist-high wall segment · kit · edge · size:60x12x40 · mixed · set:ANY · var:ruin · aff:block,cover · kit · P2 · cover in combat; stall fronts; ruin remnants
- **wall-window-small** — wall with shuttered or slit window · kit · edge · size:60x12x108 · mixed · set:ANY · var:open,ruin · aff:block · kit · P1 · lets light and sight through when open
- **wall-window-large** — wall with large mullioned window · kit · edge · size:60x12x108 · mixed · set:NOB,CAS,TEM · var:ruin · aff:block · kit · P2 · great halls and chapels; strong light shaft source
- **wall-arrow-slit** — thick wall with cross-shaped slit · kit · edge · size:60x24x108 · stone · set:CAS! · var:ruin · aff:block,cover · kit · P2 · battlements and tower rooms
- **wall-doorway** — wall with empty door opening · kit · edge · size:60x12x108 · mixed · set:ANY · var:ruin · aff:pass · kit · P1 · takes any door role
- **wall-archway** — wall with wide open arch · kit · edge · size:60x16x108 · stone · set:CAS,NOB,TEM,RUI · var:ruin · aff:pass · kit · P2 · room-to-room flow without a door
- **wall-breach** — wall with a smashed-through hole · kit · edge · size:60x16x108 · mixed · set:RUI!,DUN,MIN · var:- · aff:pass,cover · kit · P1 · secret routes, siege damage, ruin reveals
- **wall-crenellated** — battlement parapet with merlons · kit · edge · size:60x24x60 · stone · set:CAS! · var:ruin · aff:cover · kit · P1 · wall-walk edge; gives ¾ cover
- **wall-palisade** — sharpened log wall segment · kit · edge · size:60x12x120 · wood · set:CMP,MKT,CAS · var:ruin · aff:block,los · kit · P3 · frontier forts, bandit camps
- **wall-crypt-niches** — wall of burial niches · kit · edge · size:60x18x108 · stone · set:CRY! · var:ruin · aff:block,los,loot · kit · P1 · catacomb corridors
- **wall-cave-rough** — natural rock wall, irregular · kit · edge · size:60x24x120 · stone · set:MIN!,DUN,CMP,LAI · var:- · aff:block,los · kit · P1 · mines and caves; hides the grid

### A2. Floors
- **floor-tile** — one-cell floor tile (per family: plank, flagstone, packed earth, cobble, marble) · kit · 1 · size:60x60x4 · mixed · set:ANY · var:ruin · aff:- · flat · P1 · instanced; the cheapest thing in any scene
- **floor-planks-worn** — worn honey wooden planks, 5-ft floor swatch · kit · 1 · size:60x60x1 · wood · set:TAV!,HUT,ANY · var:- · aff:- · flat · P1 · tavern default; tiles seamlessly
- **floor-planks-dark** — dark scuffed oak boards · kit · 1 · size:60x60x1 · wood · set:TAV,NOB,CAS,ARC · var:- · aff:- · flat · P1 · common rooms, halls, front desks
- **floor-planks-rushes** — planks strewn with dried rushes · kit · 1 · size:60x60x1 · wood · set:TAV!,CAS,HUT · var:- · aff:- · flat · P1 · medieval hall floor
- **floor-planks-polished** — polished fitted floorboards · kit · 1 · size:60x60x1 · wood · set:NOB!,TAV · var:- · aff:- · flat · P1 · fine guest rooms
- **floor-parquet-herringbone** — herringbone wooden parquet · kit · 1 · size:60x60x1 · wood · set:NOB!,CAS · var:- · aff:- · flat · P2 · noble chambers
- **floor-planks-stained** — tavern planks with ale stains · kit · 1 · size:60x60x1 · wood · set:TAV! · var:- · aff:- · flat · P2 · busy taprooms
- **floor-boards-rough** — rough split boards with gaps · kit · 1 · size:60x60x1 · wood · set:HUT!,TAV,RUI · var:- · aff:- · flat · P1 · privies, storerooms, hovels
- **floor-flagstone-irregular** — irregular blue-gray flagstones · kit · 1 · size:60x60x2 · stone · set:TAV,CAS,TEM,ANY · var:- · aff:- · flat · P1 · kitchens, halls, cellars
- **floor-flagstone-square** — dressed square stone slabs · kit · 1 · size:60x60x2 · stone · set:CAS!,TEM,NOB,ARC · var:- · aff:- · flat · P1 · dressed-stone default
- **floor-flagstone-damp** — damp mossy cellar flagstones · kit · 1 · size:60x60x2 · stone · set:DUN,CRY,TAV,CLT · var:- · aff:- · flat · P1 · cellars, dungeons
- **floor-cobble** — rounded cobblestones · kit · 1 · size:60x60x3 · stone · set:MKT,TAV,CAS · var:- · aff:- · flat · P1 · stables, yards
- **floor-brick-herringbone** — worn red brick in herringbone · kit · 1 · size:60x60x2 · stone · set:TAV,NOB,MKT · var:- · aff:- · flat · P2 · kitchens, bakeries
- **floor-terracotta** — terracotta floor tiles · kit · 1 · size:60x60x1 · ceramic · set:TAV,NOB,MKT · var:- · aff:- · flat · P2 · kitchens, washrooms
- **floor-checker-stone** — cream and slate checkered stone · kit · 1 · size:60x60x2 · stone · set:CAS!,NOB,TEM,ARC,CLT · var:- · aff:- · flat · P2 · great halls, chapels
- **floor-earth-packed** — hard-packed earth · ground · 1 · size:60x60x1 · organic · set:HUT!,MIN,CMP,TAV,CRY · var:- · aff:- · flat · P1 · barns, privies, hovels
- **floor-earth-straw** — earth floor scattered with straw · ground · 1 · size:60x60x1 · organic · set:HUT,TAV · var:- · aff:- · flat · P1 · stables, barns
- **floor-checker-red** — red and white checkered tiles, 15-in squares · kit · 1 · size:60x60x1 · ceramic · set:TAV,NOB,MKT · var:- · aff:- · flat · P1 · kitchens, washrooms, taprooms
- **floor-checker-bw** — black and white checkered tiles, 15-in squares · kit · 1 · size:60x60x1 · ceramic · set:NOB!,TAV,CAS,TEM · var:- · aff:- · flat · P1 · kitchens, halls, chapels
- **floor-brick-herringbone-bw** — black and white herringbone tiles · kit · 1 · size:60x60x1 · ceramic · set:TAV,NOB · var:- · aff:- · flat · P1 · kitchens, sculleries
- **floor-tile-kitchen-small** — small terracotta and cream kitchen tiles · kit · 1 · size:60x60x1 · ceramic · set:TAV,HUT,MKT · var:- · aff:- · flat · P2 · kitchens, dairies
- **floor-tile-delft** — blue-and-white painted tiles in a checker · kit · 1 · size:60x60x1 · ceramic · set:NOB!,TAV · var:- · aff:- · flat · P2 · fine rooms, front desks
- **floor-tile-harlequin** — red and cream harlequin diamond tiles · kit · 1 · size:60x60x1 · ceramic · set:NOB!,CAS,TEM · var:- · aff:- · flat · P2 · lobbies, chapels, noble halls
- **floor-tile-hex** — hexagonal terracotta tiles · kit · 1 · size:60x60x1 · ceramic · set:TAV,MKT,TEM,ARC · var:- · aff:- · flat · P2 · kitchens, bathhouses, front desks
- **floor-flagstone-large** — large irregular flagstones · kit · 1 · size:60x60x2 · stone · set:CAS,TAV,DUN,ANY · var:- · aff:- · flat · P1 · halls, stables, cellars
- **floor-flagstone-broken** — broken, cracked flagstones with dirt showing · kit · 1 · size:60x60x2 · stone · set:RUI!,DUN,CRY,TAV,MIN · var:- · aff:- · flat · P1 · ruins, old cellars, stables
- **floor-earth-bare** — plain packed earth, the base under scatter · ground · 1 · size:60x60x1 · organic · set:HUT,TAV,CMP,MIN · var:- · aff:- · flat · P1 · barns and stables under hay and mud scatter
- **floor-rushes** — earth floor strewn with rushes/straw · kit · 1 · size:60x60x3 · organic · set:HUT!,TAV,DUN · var:- · aff:- · flat · P2 · peasant and cheap-tavern floor family
- **floor-step** — single step / level change edge · kit · edge · size:60x12x8 · stone · set:ANY · var:ruin · aff:pass · kit · P2 · sunken rooms, raised platforms
- **floor-drain-grate** — floor tile with iron drain grate · kit · 1 · size:60x60x4 · metal · set:DUN!,CAS,MKT · var:- · aff:- · kit · P2 · cells, kitchens, torture rooms
- **floor-trapdoor** — floor tile with hinged hatch · kit · 1 · size:60x60x4 · wood · set:TAV,HUT,DUN,CLT · var:open · aff:pass,hide · kit · P1 · cellar access; secret exits
- **floor-pit-edge** — floor edge dropping into a pit · kit · edge · size:60x12x24 · stone · set:DUN,MIN,RUI · var:- · aff:hazard · kit · P2 · chasms, oubliettes, collapsed floors
- **floor-broken-hole** — floor with collapsed hole · kit · 1 · size:60x60x12 · mixed · set:RUI!,MIN,DUN · var:- · aff:hazard,pass · kit · P2 · reveals the level below
- **floor-hayloft** — hayloft floor with open edge and hatch · kit · 1 · size:60x60x8 · wood · set:TAV,HUT! · var:ruin · aff:pass,hide · kit · P1 · the upper storey of a barn; hide in the hay
- **dais** — raised platform, 1–2 steps · floor · 2x3 · size:110x170x16~0.7-1.5 · stone · set:CAS!,NOB,TEM,CLT · var:ruin · aff:- · kit · P1 · under thrones and altars; lifts the focal object

### A3. Vertical circulation
- **stair-straight** — straight staircase run · kit · 1x2 · size:36x110x108 · mixed · set:ANY · var:ruin · aff:pass · kit · P1 · connects storeys; multi-floor is day-one
- **stair-spiral** — spiral stair in a round shaft · kit · 1 · size:60x60x108 · stone · set:CAS!,TEM,ARC · var:ruin · aff:pass · kit · P2 · towers; compact in footprint
- **stair-landing** — landing / turn platform · kit · 1 · size:60x60x54 · mixed · set:ANY · var:ruin · aff:pass · kit · P2 · switchback stairs
- **stair-cut-rock** — steps hewn into rock · kit · 1x2 · size:40x110x90 · stone · set:MIN,DUN,CRY · var:- · aff:pass · kit · P2 · descending into the depths
- **ladder-wood** — wooden ladder · wall · edge · size:18x6x120 · wood · set:ANY · var:ruin · aff:pass,climb · thin · P1 · lofts, wells, mine shafts
- **ladder-rope** — rope ladder · wall · edge · size:16x3x120 · organic · set:CMP,MIN,DUN · var:- · aff:pass,climb · thin · P3 · pits and escapes
- **ramp** — sloped ramp · kit · 1x2 · size:48x120x36 · mixed · set:MIN,CAS · var:- · aff:pass · kit · P3 · cart ramps, siege ramps

### A4. Openings (doors, gates, windows)
- **door-plank** — simple plank door · kit · edge · size:36x3x80 · wood · set:ANY · var:open,ruin,wealth · aff:pass,los,open · kit · P1 · the default door; open/closed is a scene state
- **door-reinforced** — iron-banded heavy door · kit · edge · size:40x4x84 · mixed · set:CAS,DUN,NOB,TAV,CRY,ARC,MIN,CLT · var:open,ruin · aff:pass,los,open · kit · P1 · vaults, keeps, lockable rooms
- **door-double-grand** — tall double doors · kit · edge · size:72x4x120 · wood · set:CAS,NOB!,TEM,TAV · var:open,ruin · aff:pass,los,open · kit · P1 · throne rooms, great halls, chapels
- **door-cell-bars** — barred cell door · kit · edge · size:36x3x84 · metal · set:DUN! · var:open · aff:pass,open · kit · P1 · blocks movement, not sight
- **door-secret-bookcase** — bookcase that swings open · kit · edge · size:40x16x90 · wood · set:NOB,ARC,CAS,CLT · var:open · aff:pass,hide,open · kit · P1 · the classic reveal
- **door-cellar-hatch** — slanted exterior cellar doors · kit · 1 · size:48x60x24 · wood · set:TAV,HUT · var:open · aff:pass,open · kit · P3 · outside-to-cellar
- **doorway-curtain** — cloth hanging across a doorway · kit · edge · size:40x1x84 · cloth · set:HUT,TAV,CMP,MKT · var:open · aff:pass,los · flat · P3 · cheap privacy; blocks sight only
- **portcullis** — iron-grille gate in a slot · kit · edge · size:60x6x120 · metal · set:CAS!,DUN · var:open · aff:pass,open · kit · P2 · gatehouses; raised by a winch
- **gate-double-timber** — heavy exterior gate leaves · kit · 2x2 · size:110x8x120 · wood · set:CAS,MKT,CMP · var:open,ruin · aff:pass,los,open · kit · P2 · courtyard and town gates
- **gate-fence** — small field gate · kit · edge · size:48x4x42 · wood · set:HUT,MKT,TAV · var:open · aff:pass,open · kit · P2 · pens and yards
- **shutters-pair** — exterior window shutters · wall · edge · size:40x2x48 · wood · set:HUT,TAV,MKT · var:open · aff:los · mesh · P3 · lets a window become a scene cue
- **window-stained-glass** — stained-glass window panel · kit · edge · size:36x4x72 · glass · set:TEM!,NOB,CAS · var:ruin · aff:- · kit · P2 · chapel signature; colored light shafts
- **door-barn-double** — wide double barn doors · kit · 2x2 · size:110x4x120 · wood · set:TAV,HUT! · var:open,ruin · aff:pass,los,open · kit · P1 · barns and stables; open = daylight floods in
- **drawbridge** — timber drawbridge with chains · kit · 2x3 · size:110x170x12 · wood · set:CAS! · var:open,ruin · aff:pass · thin · P3 · moats; big scene-state moment

### A5. Supports
- **pillar-square** — square stone pillar · floor · sub · size:20x20x120 · stone · set:ANY · var:ruin,shape · aff:block,los,cover · mesh · P1 · breaks up big rooms; hard cover
- **pillar-round** — round column with capital · floor · sub · size:20x20x120 · stone · set:CAS,NOB,TEM,RUI,LAI · var:ruin · aff:block,los,cover · mesh · P2 · colonnades; ruin signature when broken
- **post-timber** — load-bearing timber post · floor · sub · size:10x10x108 · wood · set:TAV,HUT,MIN,MKT · var:ruin · aff:block,cover · mesh · P1 · timber buildings, taverns, barns
- **beam-ceiling** — exposed ceiling beam · ceiling · edge · size:60x10x10 · wood · set:TAV,HUT,NOB · var:ruin · aff:- · kit · P2 · FPV texture; hang lanterns and hams from it
- **arch-freestanding** — standalone stone arch · floor · 1x2 · size:48x110x120~0.8-1.5 · stone · set:RUI!,TEM,NOB · var:ruin · aff:pass · mesh · P1 · ruins, garden gates, portals
- **buttress** — wall buttress · wall · 1 · size:36x48x108 · stone · set:CAS,TEM · var:ruin · aff:cover · mesh · P3 · exterior silhouettes
- **mine-timber-set** — post-and-cap timber frame for tunnels · kit · edge · size:60x10x84 · wood · set:MIN! · var:ruin · aff:- · kit · P1 · repeats every cell or two down a gallery

### A6. Roofs & exterior shell
- **roof-thatch** — thatched roof segment (slope, ridge, end) · kit · 1 · size:60x60x48 · organic · set:HUT!,TAV,MKT · var:ruin · aff:- · kit · P2 · exterior; hide with a cut plane when indoors
- **roof-tile-slate** — slate/tile roof segment · kit · 1 · size:60x60x40 · stone · set:TAV,NOB,CAS,MKT · var:ruin · aff:- · kit · P2 · wealthier roofs
- **chimney-stack** — exterior chimney · kit · 1 · size:30x30x72 · stone · set:HUT,TAV,NOB · var:ruin · aff:- · kit · P3 · pairs with interior fireplaces
- **tower-round-segment** — curved tower wall segment · kit · edge · size:60x36x108 · stone · set:CAS!,ARC · var:ruin · aff:block,los · kit · P1 · towers; wizard towers
- **wall-walk** — wall-top walkway with parapet · kit · 1 · size:60x60x48 · stone · set:CAS! · var:ruin · aff:pass,cover · kit · P1 · patrol routes

### A7. Barriers & railings
- **railing-wood** — wooden balcony/stair railing · kit · edge · size:60x4x36 · wood · set:TAV,NOB,HUT · var:ruin · aff:cover · thin · P2 · galleries over common rooms
- **balustrade-stone** — stone balustrade · kit · edge · size:60x8x36 · stone · set:NOB!,CAS,TEM · var:ruin · aff:cover · kit · P1 · noble terraces
- **fence-wattle** — woven wattle fence · kit · edge · size:60x4x42 · organic · set:HUT!,MKT,TAV · var:ruin,shape · aff:cover · kit · P1 · gardens, pens
- **fence-post-rail** — post-and-rail fence · kit · edge · size:60x6x48 · wood · set:HUT,MKT,TAV · var:ruin · aff:cover · kit · P2 · paddocks, stable yards
- **wall-drystone** — low dry-stone field wall · kit · edge · size:60x24x36 · stone · set:HUT,RUI,MKT,TAV · var:ruin · aff:cover · kit · P2 · countryside boundaries

## B. Fixtures (room anchors)
- **hearth-central** — open central hearth ring · floor · 1 · size:48x48x12 · stone · set:HUT!,CMP · var:lit,ruin · aff:lit,hazard · mesh · P1 · center of a one-room cottage
- **fireplace-wall** — stone fireplace with mantel · wall · 1x2 · size:60x30x60 · stone · set:TAV!,HUT,NOB,CAS,ARC · var:lit,ruin,wealth · aff:lit,hazard · mesh · P1 · anchor for common rooms; seating faces it
- **fireplace-grand** — huge hooded fireplace · wall · 2x2 · size:110x48x100 · stone · set:CAS!,NOB · var:lit,ruin · aff:lit,hazard · mesh · P2 · great halls; heraldry above
- **cook-hearth-spit** — kitchen hearth with spit and pot crane · wall · 1x2 · size:72x36x72 · mixed · set:TAV,CAS,NOB,HUT · var:lit · aff:lit,use,hazard · mesh · P1 · kitchen anchor
- **bread-oven** — domed masonry bread oven · wall · 1 · size:60x60x60 · stone · set:TAV,HUT,CAS,MKT · var:lit,ruin,open · aff:use · mesh · P1 · kitchens and village bakeries
- **bar-counter** — serving counter segment (straight, corner, end, flap) · kit · 1 · size:60x24x42 · wood · set:TAV! · var:ruin,wealth · aff:block,cover,use · kit · P1 · THE tavern signature; staff side vs customer side
- **back-bar-shelves** — shelving behind the bar with bottles · wall · 1 · size:60x14x84 · wood · set:TAV! · var:fill · aff:loot · mesh · P1 · always behind the counter
- **cask-rack** — horizontal rack of casks with taps · wall · 1x2 · size:72x30x60 · wood · set:TAV!,NOB · var:fill · aff:loot · mesh · P1 · behind the bar or in the cellar
- **forge** — smith's forge with hood · floor · 2x2 · size:72x60x72 · stone · set:SMI! · var:lit,ruin · aff:lit,use,hazard · mesh · P1 · smithy anchor; the room is built around it
- **bellows-great** — large two-handled bellows · floor · 1 · size:48x30x36 · mixed · set:SMI! · var:- · aff:use · mesh · P2 · beside the forge
- **quench-trough** — stone or wood water trough · floor · 1 · size:48x20x26 · stone · set:SMI!,MKT,TAV,MIN · var:fill · aff:use · mesh · P1 · forge side; doubles as horse trough
- **anvil** — anvil on a stump · floor · sub · size:24x12x32 · metal · set:SMI! · var:- · aff:use,cover · mesh · P1 · one step from forge and trough
- **grindstone** — treadle grindstone wheel · floor · sub · size:30x24x36 · mixed · set:SMI!,CAS,HUT,MIN · var:- · aff:use · mesh · P1 · sharpening corner; armories
- **smelter** — clay bloomery/smelting furnace · floor · 1 · size:40x40x72~0.8-1.4 · stone · set:MIN!,SMI · var:lit,ruin · aff:lit,use,hazard · mesh · P1 · mine head or smith's yard
- **well** — stone well with windlass and bucket · floor · 1 · size:60x60x72 · stone · set:HUT!,MKT,CAS,TAV,MIN · var:ruin · aff:use,hazard · mesh · P1 · village and courtyard centerpiece
- **cistern-hatch** — cistern or water tank opening · floor · 1 · size:48x48x6 · stone · set:CAS,DUN · var:- · aff:hazard · mesh · P3 · underworld access
- **basin-stone** — stone washbasin/sink · wall · sub · size:24x18x12 · stone · set:TAV,CAS,NOB,TEM,CRY,CLT · var:ruin · aff:use · mesh · P3 · kitchens, sculleries
- **washtub** — wooden laundry tub · floor · sub · size:30x30x16 · wood · set:HUT,TAV,MIN · var:fill · aff:use · mesh · P3 · yards and sculleries
- **bathtub-wood** — wooden bathtub with linen · floor · 1 · size:60x30x24 · wood · set:NOB,TAV · var:fill,wealth · aff:use · mesh · P3 · a noble or a paying guest's luxury
- **privy-seat-single** — single wooden privy seat over a chute · wall · 1 · size:30x24x18 · wood · set:TAV,CAS,NOB,HUT · var:wealth · aff:use · mesh · P1 · the mundane completeness test
- **privy-seat-double** — two-hole privy bench · wall · 1 · size:60x24x18 · wood · set:TAV,CAS · var:- · aff:use · mesh · P1 · tavern and barracks privies
- **garderobe** — castle wall-projecting latrine · wall · 1 · size:40x40x84 · stone · set:CAS! · var:ruin · aff:use · mesh · P3 · castles really had these
- **outhouse** — freestanding outhouse · ground · 1 · size:48x48x90 · wood · set:HUT!,TAV,MKT · var:open,ruin · aff:use,hide · mesh · P1 · the yard behind any building
- **throne** — throne with high back · floor · 1 · size:36x30x60 · mixed · set:CAS!,NOB,LAI · var:ruin,wealth · aff:sit · mesh · P1 · throne room focal point; on a dais
- **altar-stone** — stone altar block · floor · 1x2 · size:72x36x38 · stone · set:TEM!,CRY,RUI · var:ruin · aff:use,cover · mesh · P1 · chapel focus; ritual chambers
- **fountain-courtyard** — tiered stone fountain · ground · 2x2 · size:96x96x72~0.6-1.5 · stone · set:NOB!,MKT · var:ruin · aff:block · mesh · P1 · manor gardens, town squares
- **hitching-post** — hitching rail · ground · 1 · size:72x6x40 · wood · set:TAV,MKT,HUT,SMI · var:- · aff:- · mesh · P1 · outside taverns and shops
- **water-trough** — long animal water trough · ground · 1x2 · size:72x20x22 · wood · set:HUT,TAV,MKT,MIN,SMI · var:fill · aff:cover · mesh · P1 · stables and yards
- **mine-headframe** — timber headframe over a shaft · ground · 2x2 · size:110x110x240~0.8-1.5 · wood · set:MIN! · var:ruin · aff:use · mesh · P1 · mine surface landmark
- **windlass** — hand-cranked winch with rope · floor · 1 · size:40x30x36 · wood · set:MIN!,CAS,HUT · var:- · aff:use · thin · P1 · shafts, portcullis rooms, wells
- **lift-cage** — wooden mine lift platform · kit · 1 · size:48x48x84 · wood · set:MIN! · var:- · aff:pass · thin · P3 · moves between mine levels

## C. Furniture

### C1. Seating
- **stool-three-leg** — plain three-legged stool · floor · sub · size:14x14x18 · wood · set:ANY · var:ruin,shape · aff:sit,carry · mesh · P1 · peasant homes, bars, workshops
- **stool-bar** — tall bar stool · floor · sub · size:15x15x30 · wood · set:TAV!,ARC · var:ruin · aff:sit · mesh · P1 · line them along the bar counter
- **chair-plain** — simple wooden chair · floor · sub · size:18x18x36 · wood · set:ANY · var:ruin,wealth,shape · aff:sit · mesh · P1 · the default chair
- **chair-armed** — armchair, carved · floor · sub · size:24x22x42 · wood · set:NOB,CAS,TAV,ARC · var:ruin,wealth · aff:sit · mesh · P1 · head of table; study; by the fire
- **chair-upholstered** — padded, cushioned chair · floor · sub · size:28x28x40 · mixed · set:NOB!,TAV,ARC · var:ruin · aff:sit · mesh · P1 · parlors; the "comfortable chair" test
- **bench-long** — backless long bench · floor · 1x2 · size:72x12x18 · wood · set:TAV,HUT,CAS,TEM,DUN,NOB,LAI,ARC,MIN,CLT,SMI · var:ruin,shape · aff:sit · mesh · P1 · pairs with trestle tables
- **settle** — high-backed bench with storage · floor · 1x2 · size:60x20x54 · wood · set:TAV,HUT · var:ruin · aff:sit,loot · mesh · P2 · beside the fire; blocks drafts
- **pew** — church pew · floor · 1x2 · size:96x24x36 · wood · set:TEM!,CLT,CRY · var:ruin · aff:sit,cover · mesh · P1 · rows facing the altar
- **faldstool** — folding X-frame stool · floor · sub · size:22x18x20 · mixed · set:CAS,CMP,NOB · var:- · aff:sit,carry · mesh · P3 · commanders' tents
- **daybed** — cushioned couch/daybed · floor · 1x2 · size:72x30x30 · mixed · set:NOB! · var:ruin · aff:sit,sleep · mesh · P1 · solar, parlor

### C2. Tables
- **table-round-small** — small round table · floor · sub · size:30x30x30 · wood · set:TAV!,NOB,ARC · var:ruin,wealth · aff:cover · mesh · P1 · 2–4 seats; scatter across a common room
- **table-square** — square table for four · floor · 1 · size:36x36x30 · wood · set:TAV,HUT,CAS,DUN,MIN,CLT,SMI · var:ruin,wealth,shape · aff:cover · mesh · P1 · the workhorse table
- **table-trestle** — long trestle table: a thick plank tabletop at dining height resting on two trestle stands · floor · 1x2 · size:96x30x30 · wood · set:TAV,HUT,CAS,TEM,NOB,LAI,MIN,CLT · var:ruin,shape · aff:cover · mesh · P1 · pairs with two long benches
- **table-feast** — very long feast table · floor · 1x3 · size:168x36x30 · wood · set:CAS!,NOB · var:ruin,wealth · aff:cover · mesh · P2 · great hall centerline; high table on a dais
- **table-side** — small side table / nightstand · floor · sub · size:18x18x26 · wood · set:ANY · var:ruin,wealth · aff:- · mesh · P1 · beside beds and armchairs
- **desk-writing** — writing desk · floor · 1 · size:42x24x30 · wood · set:NOB,ARC!,CAS,TEM,TAV,CLT,SMI · var:ruin,wealth · aff:use · mesh · P1 · study anchor
- **table-work** — heavy workbench · floor · 1x2 · size:72x30x34 · wood · set:SMI!,HUT,ARC · var:ruin · aff:use,cover · mesh · P1 · every trade's bench
- **table-kitchen-prep** — kitchen prep table · floor · 1x2 · size:72x30x34 · wood · set:TAV,CAS,NOB,CRY,ARC,HUT · var:ruin · aff:use · mesh · P1 · center of a kitchen
- **table-map** — war table with map · floor · 2x2 · size:72x72x32 · wood · set:CAS! · var:ruin · aff:use · mesh · P1 · war room; add markers
- **table-vanity** — dressing table with mirror · wall · 1 · size:36x18x60 · wood · set:NOB!,TAV · var:ruin · aff:use · mesh · P1 · bedchambers
- **table-experiment** — slab table with straps and gutters · floor · 1x2 · size:78x30x34 · mixed · set:ARC,DUN · var:ruin · aff:use · mesh · P1 · mad-science lab (Grimward) or interrogation
- **counter-shop** — shop counter · floor · 1x2 · size:72x24x40 · wood · set:MKT!,SMI,ARC,TAV · var:ruin · aff:cover,use · mesh · P1 · shop front; storekeeper behind

### C3. Beds
- **bed-straw-pallet** — straw-stuffed sack mattress lying directly on the floor, no bed frame · floor · 1x2 · size:32x72x6 · organic · set:HUT!,DUN,TAV,CLT,LAI · var:- · aff:sleep · mesh · P1 · the poorest bed; prison cells
- **bedroll** — rolled blanket bed · floor · 1x2 · size:28x72x4 · cloth · set:CMP!,TAV,MIN,HUT,LAI · var:open · aff:sleep,carry · mesh · P1 · camps; floor of a cheap room
- **cot** — simple frame cot · floor · 1x2 · size:30x76x18 · wood · set:CAS,DUN,MIN,HUT · var:ruin · aff:sleep · mesh · P1 · infirmaries, cells
- **bunk-bed** — two-tier bunk · floor · 1x2 · size:36x78x66 · wood · set:CAS!,MIN,CLT,LAI · var:ruin · aff:sleep · mesh · P1 · barracks, miners' dormitory
- **bed-single** — single bed with blanket · floor · 1x2 · size:40x80x24 · wood · set:TAV,HUT,NOB,SMI · var:ruin,wealth,shape · aff:sleep · mesh · P1 · inn rooms
- **bed-double** — double bed · floor · 2x2 · size:60x82x30 · wood · set:TAV,NOB,HUT,SMI · var:ruin,wealth · aff:sleep · mesh · P1 · the good inn room
- **bed-canopy** — four-poster canopy bed · floor · 2x2 · size:66x86x84 · mixed · set:NOB!,CAS,TAV,ARC · var:ruin · aff:sleep,hide · mesh · P1 · noble bedchamber anchor
- **cradle** — wooden rocking cradle · floor · sub · size:36x20x28 · wood · set:HUT,NOB · var:- · aff:- · mesh · P3 · family homes; plot hooks

### C4. Storage furniture
- **wardrobe** — tall wardrobe · wall · 1 · size:48x24x78 · wood · set:NOB,TAV,CAS,ARC,HUT,CLT,SMI · var:open,ruin,wealth,shape · aff:loot,hide · mesh · P1 · bedrooms; hide inside
- **cupboard** — low cupboard · wall · 1 · size:42x18x36 · wood · set:ANY · var:open,ruin,shape · aff:loot · mesh · P1 · kitchens, cottages
- **dresser-plates** — dresser with plate rack · wall · 1 · size:48x18x72 · wood · set:HUT,TAV,NOB · var:fill · aff:loot · mesh · P2 · display the household's plates
- **bookshelf** — full bookshelf · wall · 1 · size:40x14x78 · wood · set:ARC!,NOB,TEM,CLT · var:fill,ruin,shape · aff:loot,los · mesh · P1 · libraries; line walls
- **shelf-wall** — wall-mounted plank shelf · wall · 1 · size:48x10x12 · wood · set:ANY · var:fill,shape · aff:loot · mesh · P1 · takes surface clutter
- **shelving-freestanding** — open storage shelving · floor · 1 · size:48x18x72 · wood · set:TAV,SMI,MKT,DUN,CRY,ARC,MIN,HUT,CLT · var:fill,ruin · aff:loot,los · mesh · P1 · storerooms, cellars
- **wine-rack** — lattice wine rack · wall · 1 · size:40x14x60 · wood · set:NOB,TAV,CAS · var:fill · aff:loot · mesh · P3 · cellars
- **coat-pegs** — pegboard with cloaks and hats · wall · sub · size:36x8x24 · mixed · set:TAV,HUT,NOB,MIN,CLT,SMI · var:fill · aff:- · thin · P3 · by the door
- **scroll-rack** — honeycomb scroll cubby · wall · 1 · size:40x14x48 · wood · set:ARC!,TEM,CAS · var:fill · aff:loot · mesh · P1 · scholars and archives

## D. Containers
- **chest-plain** — wooden chest · floor · sub · size:36x20x20~0.7-1.3 · wood · set:ANY · var:open,ruin,shape · aff:loot,open,carry · mesh · P1 · foot of beds; storerooms
- **chest-ironbound** — iron-bound chest · floor · sub · size:36x20x22~0.7-1.3 · mixed · set:CAS,DUN,NOB,SMI,CLT,MKT,TAV,CRY,ARC · var:open,ruin · aff:loot,open · mesh · P1 · locked; worth a check
- **chest-treasure** — treasure chest spilling coins · floor · sub · size:34x20x24~0.7-1.4 · mixed · set:DUN!,CRY,CAS,LAI,CLT · var:open · aff:loot,open · mesh · P1 · the reward shot
- **strongbox** — small iron strongbox · surface · tiny · size:12x9x8~0.7-1.4 · metal · set:TAV,NOB,MKT,CAS,SMI · var:open · aff:loot,open,carry · mesh · P1 · under the innkeeper's counter
- **trunk-travel** — domed travel trunk · floor · sub · size:34x20x24~0.8-1.2 · mixed · set:TAV,NOB,CMP,ARC · var:open · aff:loot,open · mesh · P2 · guests' luggage
- **barrel** — standing barrel · floor · sub · size:22x22x34~0.7-3.5 · wood · set:ANY · var:open,ruin,fill,shape · aff:cover,loot,hide · mesh · P1 · the universal clutter; cluster 2–5
- **keg-small** — small tapped keg · surface · tiny · size:10x10x14~0.7-1.4 · wood · set:TAV! · var:- · aff:carry · mesh · P2 · on the bar
- **tun-large** — huge fermenting tun · floor · 2x2 · size:110x110x96~0.7-1.4 · wood · set:TAV,NOB · var:- · aff:cover · mesh · P3 · brewery corner, cellar drama
- **rain-barrel** — rain barrel under a downspout · ground · sub · size:24x24x36~0.8-1.3 · wood · set:HUT,TAV,MKT,MIN,SMI · var:fill · aff:cover · mesh · P3 · exteriors
- **crate** — closed wooden crate · floor · sub · size:24x24x24~0.5-2 · wood · set:ANY · var:open,ruin,pile,shape · aff:cover,loot · mesh · P1 · stacks of 2–3; storerooms, docks, mines
- **sack** — tied grain/flour sack · floor · tiny · size:16x12x24~0.7-1.4 · cloth · set:ANY · var:pile,ruin,shape · aff:cover,carry · mesh · P1 · pile against walls
- **basket-wicker** — open wicker basket · floor · tiny · size:16x16x12~0.6-1.6 · organic · set:ANY · var:fill,shape · aff:carry · mesh · P1 · takes food or laundry
- **basket-back** — backpack basket (pannier) · floor · tiny · size:16x12x24~0.8-1.2 · organic · set:HUT,MKT,MIN · var:fill · aff:carry · mesh · P3 · foragers, porters
- **bucket** — wooden bucket · floor · tiny · size:11x11x12~0.8-1.4 · wood · set:ANY · var:fill,shape · aff:carry · mesh · P1 · wells, stables, cells
- **bucket-slop** — lidded waste bucket · floor · tiny · size:12x12x14~0.8-1.2 · wood · set:DUN,HUT,TAV,CRY,CLT,LAI · var:open · aff:carry · mesh · P1 · the mundane completeness test, again
- **storage-jar** — large clay storage jar · floor · sub · size:20x20x34~0.6-1.6 · ceramic · set:HUT,TAV,TEM,RUI,CRY,ARC,SMI · var:ruin,shape · aff:loot · mesh · P2 · oil, grain, wine; ruins full of broken ones
- **crock** — small lidded crock · surface · tiny · size:8x8x9~0.6-1.6 · ceramic · set:ANY · var:- · aff:carry · mesh · P2 · pantries, apothecaries
- **urn-decorative** — tall decorative urn · floor · sub · size:16x16x36~0.6-1.6 · ceramic · set:NOB,TEM,CRY · var:ruin,shape · aff:- · mesh · P1 · niches, landings
- **coffin** — plain wooden coffin · floor · 1x2 · size:26x76x18 · wood · set:CRY!,TEM · var:open,ruin,shape · aff:loot,open,hide · mesh · P1 · vampire lairs (Noctar), undertakers
- **sarcophagus** — stone sarcophagus with effigy lid · floor · 1x2 · size:36x88x40~0.9-1.3 · stone · set:CRY!,TEM,RUI · var:open,ruin,shape · aff:loot,open,cover · mesh · P1 · crypt anchor
- **coin-purse** — leather coin purse · surface · tiny · size:5x4x4~0.7-1.5 · organic · set:ANY · var:- · aff:carry,loot · mesh · P3 · on a table as a plot object
- **coin-pile** — heap of coins · floor · sub · size:30x30x12~0.3-4 · metal · set:DUN,CAS,CRY,LAI · var:size · aff:loot · mesh · P1 · hoards; tip of a dragon's pile

## E. Lighting
- **candle** — single candle · surface · tiny · size:2x2x6~0.6-2 · mixed · set:ANY · var:lit,shape · aff:lit,carry · mesh · P1 · the smallest light; tables and shelves
- **candle-cluster** — cluster of melted candles · surface · tiny · size:8x8x8~0.6-2 · mixed · set:TEM,CRY,ARC,DUN,CLT,MKT · var:lit · aff:lit · mesh · P1 · altars, ritual spots, spooky shelves
- **candlestick** — candlestick holder with candle · surface · tiny · size:4x4x12~0.7-1.5 · metal · set:ANY · var:lit,wealth · aff:lit,carry · mesh · P1 · the dining-table light
- **candelabra** — branched candelabra · surface · tiny · size:12x5x16~0.8-1.5 · metal · set:NOB!,TEM,CAS,TAV,CRY,CLT · var:lit,wealth · aff:lit · mesh · P1 · feasts and chapels
- **candelabra-standing** — floor-standing candle stand · floor · sub · size:18x18x60 · metal · set:TEM,NOB,CRY · var:lit · aff:lit · thin · P1 · flanks altars and thrones
- **rushlight-holder** — iron rushlight clip on a stand · floor · sub · size:10x10x40 · metal · set:HUT! · var:lit · aff:lit · thin · P3 · the peasant's candle
- **oil-lamp** — clay oil lamp · surface · tiny · size:5x3x3~0.8-1.5 · ceramic · set:ANY · var:lit · aff:lit,carry · mesh · P2 · desks, niches, ruins
- **lantern-hand** — handheld lantern · surface · tiny · size:7x7x12 · metal · set:ANY · var:lit · aff:lit,carry · mesh · P1 · carried by tokens; hangs on hooks
- **lantern-hanging** — lantern on a chain or hook · ceiling · tiny · size:8x8x18 · metal · set:TAV,MIN,MKT,DUN,CAS,SMI,CRY,ARC,HUT,CLT · var:lit,shape · aff:lit · thin · P1 · beams, mine timbers, porches
- **lantern-post** — street lantern on a post · ground · sub · size:14x14x96 · mixed · set:MKT!,NOB,TAV,MIN,SMI · var:lit · aff:lit · mesh · P1 · streets, manor drives
- **torch-sconce** — wall torch in an iron sconce · wall · tiny · mount:54 · size:8x12x24 · mixed · set:CAS,DUN!,CRY,MIN,SMI,TAV,ARC,CLT,LAI · var:lit,shape · aff:lit · mesh · P1 · every stone corridor
- **chandelier-ring** — iron cartwheel chandelier · ceiling · 1 · size:40x40x36~0.7-1.6 · metal · set:TAV!,CAS · var:lit · aff:lit · thin · P1 · common rooms, halls
- **chandelier-grand** — ornate crystal/gilt chandelier · ceiling · 2x2 · size:60x60x60~0.7-1.6 · mixed · set:NOB! · var:lit,ruin · aff:lit · thin · P1 · ballrooms; ruin version on the floor
- **brazier-standing** — iron brazier on legs · floor · sub · size:20x20x36~0.8-1.4 · metal · set:CAS,TEM,DUN,CRY,CLT,MIN,LAI · var:lit · aff:lit,hazard · mesh · P1 · throne rooms, torture chambers, shrines
- **brazier-large** — big bowl brazier · floor · 1 · size:40x40x36~0.7-1.6 · metal · set:CAS,TEM,RUI,LAI,CLT · var:lit · aff:lit,hazard · mesh · P1 · courtyards, ritual sites
- **campfire** — campfire ring with logs · ground · 1 · size:40x40x18~0.6-1.6 · stone · set:CMP!,RUI,LAI · var:lit · aff:lit,hazard · mesh · P1 · camps, bandit ruins
- **glow-orb** — magical floating light orb · attach · tiny · size:8x8x8~0.5-3 · glass · set:ARC!,TEM,MKT · var:lit · aff:lit · mesh · P1 · wizard's lab lighting
- **crystal-glowing** — glowing crystal cluster · floor · sub · size:18x18x24~0.4-3 · glass · set:MIN,ARC,DUN,LAI · var:lit,shape · aff:lit · mesh · P1 · deep mines; Room 2's crystal puzzle

## F. Table & kitchenware
- **tankard** — wooden or pewter tankard · surface · tiny · size:6x4.5x7 · mixed · set:TAV!,CAS,HUT,DUN,MIN · var:wealth,shape · aff:carry · mesh · P1 · one per drinker; scatter
- **mug-clay** — clay mug · surface · tiny · size:5x4x4.5 · ceramic · set:ANY · var:- · aff:carry · mesh · P2 · peasant tables
- **goblet** — metal goblet · surface · tiny · size:4x4x7 · metal · set:NOB!,CAS,TEM · var:wealth,shape · aff:carry · mesh · P1 · noble place settings; chalices
- **drinking-horn** — drinking horn on a stand · surface · tiny · size:12x5x8 · organic · set:TAV,CAS · var:- · aff:carry · mesh · P3 · feast-hall flavor
- **bottle** — wine/spirit bottle · surface · tiny · size:3.5x3.5x12 · glass · set:ANY · var:fill,shape · aff:carry · mesh · P1 · bars, cellars, desks
- **bottle-cluster** — cluster of assorted bottles · surface · tiny · size:10x8x12 · glass · set:TAV,ARC,NOB · var:- · aff:- · mesh · P2 · bar backs, alchemy shelves
- **pitcher** — clay or pewter jug · surface · tiny · size:7x6x10 · ceramic · set:ANY · var:wealth,shape · aff:carry · mesh · P1 · tables, washstands
- **plate** — plate or wooden trencher · surface · tiny · size:10x10x1.2 · mixed · set:ANY · var:wealth,shape · aff:carry · mesh · P1 · place settings; stack for dressers
- **bowl** — wooden or clay bowl · surface · tiny · size:7x7x3 · mixed · set:ANY · var:fill,shape · aff:carry · mesh · P1 · stew, porridge, alms
- **platter** — serving platter · surface · tiny · size:16x12x2 · metal · set:TAV,CAS,NOB · var:fill,wealth · aff:carry · mesh · P2 · takes roasts and bread
- **serving-tray** — tray with drinks · surface · tiny · size:16x12x8 · wood · set:TAV,NOB · var:fill · aff:carry · mesh · P3 · on a barmaid's route
- **cooking-pot** — iron cooking pot · surface · tiny · size:12x12x9~0.7-1.6 · metal · set:ANY · var:fill · aff:carry · mesh · P1 · hearths, campfires
- **cauldron** — big iron cauldron on legs · floor · sub · size:30x30x30~0.5-2 · metal · set:HUT,CAS,ARC!,CMP,TAV · var:fill,lit · aff:use,hazard · mesh · P1 · kitchen, witch's hut, alchemist
- **cooking-tripod** — tripod with hanging pot · floor · sub · size:36x36x48 · metal · set:CMP!,HUT · var:lit · aff:use · thin · P1 · over campfires
- **pan-frying** — frying pan · surface · tiny · size:12x22x3 · metal · set:TAV,HUT,CAS · var:- · aff:carry · mesh · P3 · kitchen walls
- **kettle** — iron kettle · surface · tiny · size:10x8x10 · metal · set:HUT,TAV · var:- · aff:carry · mesh · P3 · hearthside
- **cutting-board** — board with knife and chopped veg · surface · tiny · size:16x10x4 · wood · set:TAV,HUT,CAS · var:- · aff:- · mesh · P2 · prep tables
- **mortar-pestle** — stone mortar and pestle · surface · tiny · size:6x6x6~0.7-1.5 · stone · set:ARC!,HUT,TEM · var:- · aff:carry · mesh · P1 · apothecaries, herb-wives
- **butter-churn** — upright butter churn · floor · sub · size:14x14x36 · wood · set:HUT! · var:- · aff:use · mesh · P3 · farm kitchens
- **dice-and-cup** — dice with a leather cup · surface · tiny · size:6x4x5 · mixed · set:TAV!,CAS,CMP,DUN · var:- · aff:carry · mesh · P1 · gambling tables; guard rooms
- **board-game** — board game (merels/chess) mid-play · surface · tiny · size:16x16x3 · wood · set:TAV,NOB,CAS · var:- · aff:- · mesh · P3 · a quiet corner; aristocrats' table
- **salt-cellar** — ornate salt cellar · surface · tiny · size:5x4x5 · metal · set:NOB!,CAS · var:- · aff:carry · mesh · P3 · high-table status object

## G. Food & provisions
- **bread-loaf** — round loaf · surface · tiny · size:8x8x4~0.7-1.5 · food · set:ANY · var:pile,shape · aff:carry · mesh · P1 · any table; basket filler
- **cheese-wheel** — cheese wheel (whole/cut) · surface · tiny · size:14x14x5~0.5-1.6 · food · set:TAV,HUT,MKT,CAS · var:pile,shape · aff:carry · mesh · P1 · larders, market stalls
- **turnip-pile** — heap of turnips · floor · sub · size:24x24x10~0.5-2.5 · food · set:HUT!,MKT,TAV · var:pile · aff:- · mesh · P1 · house mascot; ship this first and make it beautiful
- **cabbage** — cabbages · floor · tiny · size:12x12x8~0.6-1.6 · food · set:HUT,MKT · var:pile · aff:carry · mesh · P2 · gardens, stalls, cellars
- **onion-string** — hanging string of onions/garlic · ceiling · tiny · size:8x5x30~0.7-1.3 · food · set:HUT!,TAV · var:- · aff:- · mesh · P2 · hangs from beams
- **carrots-bunch** — bunch of carrots · surface · tiny · size:10x4x3~0.8-1.3 · food · set:HUT,MKT · var:pile · aff:carry · mesh · P3 · prep tables
- **apple-pile** — apples · surface · tiny · size:12x12x5~0.5-2.5 · food · set:HUT,MKT,TAV,NOB · var:pile · aff:carry · mesh · P2 · baskets, bowls, barrels
- **pumpkin** — pumpkin/squash · floor · sub · size:16x16x12~0.5-2 · food · set:HUT,MKT · var:pile · aff:carry · mesh · P3 · harvest scenes
- **grapes-bunch** — bunch of grapes · surface · tiny · size:6x5x8~0.8-1.3 · food · set:NOB,MKT · var:- · aff:carry · mesh · P3 · noble fruit bowls
- **ham-hanging** — cured ham on a hook · ceiling · tiny · size:10x8x20~0.8-1.3 · food · set:TAV,HUT,CAS · var:- · aff:- · mesh · P1 · kitchens, cellars
- **sausage-string** — hanging sausages · ceiling · tiny · size:12x3x24~0.8-1.3 · food · set:TAV,HUT,MKT · var:- · aff:- · mesh · P3 · larders, butchers
- **carcass-hanging** — dressed pig/sheep/goat carcass on a hook · ceiling · sub · size:20x14x48~0.6-1.4 · food · set:MKT,CAS,TAV,HUT,LAI · var:size · aff:- · mesh · P3 · butcher, castle kitchen
- **roast-fowl** — roast chicken or goose · surface · tiny · size:12x9x6~0.7-1.5 · food · set:TAV,CAS,NOB · var:- · aff:carry · mesh · P2 · feast centerpiece
- **roast-pig** — whole roast pig with apple · surface · sub · size:18x40x14~0.7-1.4 · food · set:CAS!,NOB,TAV · var:- · aff:- · mesh · P2 · the great-hall feast
- **fish** — fish (single or string) · surface · tiny · size:5x14x3~0.5-2 · food · set:MKT,TAV,HUT · var:pile · aff:carry · mesh · P2 · stalls, kitchens
- **pie** — pie · surface · tiny · size:10x10x3~0.8-1.3 · food · set:TAV,HUT,NOB · var:- · aff:carry · mesh · P3 · windowsills, feasts
- **eggs-basket** — basket of eggs · surface · tiny · size:10x10x6 · food · set:HUT,MKT · var:- · aff:carry · mesh · P3 · farm kitchens
- **honey-pot** — honey pot · surface · tiny · size:5x5x6 · ceramic · set:HUT,MKT · var:- · aff:carry · mesh · P3 · beekeepers, pantries
- **herbs-drying** — bundles of drying herbs · ceiling · tiny · size:10x4x16~0.7-1.4 · organic · set:ARC,HUT,TEM · var:- · aff:- · thin · P2 · hang from beams; apothecary mood
- **poultry-plucked-hanging** — plucked chickens/geese hung by the feet · ceiling · tiny · size:12x6x22~0.8-1.3 · food · set:HUT,TAV,MKT,CAS · var:pile · aff:- · mesh · P1 · kitchens, butcher stalls; the chicken, as a prop
- **game-brace-hanging** — brace of rabbits or pheasants, unplucked · ceiling · tiny · size:14x6x30~0.8-1.3 · food · set:TAV,HUT,NOB,CMP · var:- · aff:- · mesh · P2 · hunting lodges, cottage doors, poachers
- **pig-on-spit** — whole pig roasting on a spit over coals · floor · 1x2 · size:54x72x36 · food · set:CAS!,TAV,CMP · var:lit · aff:lit,use,hazard · mesh · P2 · feast prep; bandit camps
- **butcher-block** — butcher's block with cleaver and cuts · floor · sub · size:24x24x34 · mixed · set:MKT!,TAV,CAS,HUT,LAI · var:- · aff:use · mesh · P1 · butcher stall, castle kitchen
- **deer-dressed** — field-dressed deer on a gambrel · ground · 1 · size:40x24x72~0.8-1.3 · food · set:NOB,HUT,CMP · var:- · aff:- · mesh · P3 · hunting lodges, woodsman's yard
- **boar-head-platter** — roast boar's head centerpiece · surface · tiny · size:18x14x12 · food · set:NOB!,CAS · var:- · aff:- · mesh · P3 · high-table showpiece
- **spit-small-campfire** — rabbit/fish on sticks over a fire · floor · sub · size:30x30x20 · food · set:CMP!,RUI · var:lit · aff:lit · thin · P3 · travellers' supper
- **fish-gutting-board** — board with gutted fish and knife · surface · tiny · size:16x10x3 · food · set:MKT,HUT,TAV · var:- · aff:- · mesh · P3 · fishwives, kitchens
- **sweets-jar** — jar of sweets/candy · surface · tiny · size:5x5x7 · glass · set:MKT,NOB,ARC · var:fill · aff:carry · mesh · P3 · lure for a certain flesh golem ("FRANKIE LIKE CANDY")

## H. Trades & work

### H1. Smithing & metalwork
- **tool-rack-smith** — wall rack of tongs and hammers · wall · 1 · size:48x8x36 · metal · set:SMI! · var:fill · aff:loot · thin · P1 · behind the anvil
- **coal-bin** — bin of coal/charcoal · floor · 1 · size:48x30x30 · mixed · set:SMI!,MIN · var:fill · aff:- · mesh · P1 · forge fuel
- **metal-stock** — bars and ingots on a rack · floor · sub · size:36x18x24 · metal · set:SMI!,MIN · var:pile · aff:loot · mesh · P2 · raw material
- **horseshoes-pile** — pile of horseshoes · surface · tiny · size:12x12x5 · metal · set:SMI,TAV · var:- · aff:carry · mesh · P1 · farrier corner
- **wares-display** — rack of finished blades for sale · floor · 1 · size:48x18x60 · metal · set:SMI!,MKT · var:fill · aff:loot · thin · P1 · the shopfront side of the smithy
- **vise-bench** — leg vise on a bench · floor · sub · size:30x24x36 · metal · set:SMI · var:- · aff:use · mesh · P3 · fine work

### H2. Carpentry & general work
- **sawhorse** — sawhorse with plank · floor · 1 · size:40x24x30 · wood · set:HUT,MKT,CAS,MIN,SMI · var:- · aff:use · mesh · P3 · repair scenes
- **lumber-pile** — stacked planks · floor · 1x2 · size:40x96x24~0.6-1.5 · wood · set:HUT,MKT,MIN · var:size · aff:cover · mesh · P2 · workyards, mine stores
- **woodpile** — split firewood stack · floor · 1 · size:48x24x36~0.5-1.6 · wood · set:HUT!,TAV,CMP,SMI · var:size,shape · aff:cover · mesh · P1 · by the hearth or outside wall
- **chopping-block** — stump with an axe · floor · sub · size:18x18x30 · wood · set:HUT!,CMP,TAV · var:- · aff:use · mesh · P2 · yards
- **toolbox** — wooden toolbox · surface · tiny · size:20x8x9 · wood · set:SMI,MIN,HUT · var:- · aff:carry,loot · mesh · P3 · anywhere work happens
- **rope-coil** — coiled rope · surface · tiny · size:12x12x5~0.7-1.5 · organic · set:ANY · var:- · aff:carry · mesh · P2 · mines, docks, adventurer kit

### H3. Textile & household
- **loom** — floor loom · floor · 1x2 · size:60x72x60 · wood · set:HUT,NOB · var:- · aff:use · thin · P3 · weaver's cottage
- **spinning-wheel** — spinning wheel · floor · sub · size:36x20x36 · wood · set:HUT!,NOB · var:- · aff:use · thin · P2 · peasant home signature
- **laundry-line** — line with drying clothes · ground · 1x2 · size:110x6x72 · cloth · set:HUT,MKT,TAV · var:- · aff:los · thin · P3 · yards, alleys
- **broom** — broom · floor · tiny · size:10x4x50 · organic · set:ANY · var:- · aff:carry · thin · P1 · leaning in corners

### H4. Farming & livestock
- **hay-bale** — hay bale · floor · sub · size:36x18x16~0.8-1.2 · organic · set:HUT!,TAV,MKT,ARC · var:pile,shape · aff:cover,climb · mesh · P1 · barns, stables
- **hay-pile** — loose hay heap · floor · 1 · size:60x60x36~0.5-1.6 · organic · set:HUT,TAV,DUN,LAI · var:- · aff:hide,sleep · mesh · P1 · lofts; hide in it
- **tools-farm-leaning** — pitchfork, rake, scythe leaning together · wall · sub · size:24x12x66 · mixed · set:HUT! · var:- · aff:carry · thin · P1 · by the door
- **plough** — wooden plough · ground · 1x2 · size:30x96x36 · wood · set:HUT · var:ruin · aff:- · mesh · P3 · field edges
- **wheelbarrow** — wheelbarrow · floor · sub · size:26x56x26 · wood · set:HUT,MIN,MKT,TAV · var:fill · aff:carry · mesh · P1 · yards, mines
- **feed-trough** — feed trough · floor · 1 · size:48x18x20 · wood · set:HUT,TAV,ARC · var:fill · aff:- · mesh · P1 · stalls, pens
- **stable-stall** — horse stall partition · kit · edge · size:60x6x60 · wood · set:TAV!,CAS,HUT,SMI · var:open · aff:block,cover · kit · P1 · stable rows
- **chicken-coop** — small chicken coop · ground · 1 · size:60x48x48 · wood · set:HUT! · var:- · aff:- · mesh · P2 · cottage yards
- **beehive-skep** — straw beehive skep on a stand · ground · sub · size:16x16x30 · organic · set:HUT,NOB · var:- · aff:hazard · mesh · P3 · gardens
- **scarecrow** — scarecrow · ground · sub · size:36x12x72 · mixed · set:HUT! · var:ruin · aff:- · mesh · P3 · fields; spooky variant
- **saddle-rack** — saddle and tack on a rack · wall · sub · size:24x20x40 · organic · set:TAV,CAS · var:- · aff:loot · mesh · P1 · tack rooms

### H5. Mining
- **mine-cart** — ore cart on wheels · floor · 1 · size:30x48x36 · mixed · set:MIN! · var:fill,ruin · aff:cover,carry · mesh · P1 · on rails; tipped over in a collapse
- **mine-rail** — rail track (straight, curve, junction, end-stop) · kit · 1 · size:60x60x6 · mixed · set:MIN! · var:ruin · aff:- · kit · P1 · the mine's circulatory system
- **ore-pile** — heap of raw ore · floor · sub · size:36x36x18~0.4-2.5 · stone · set:MIN! · var:size,shape · aff:cover · mesh · P1 · cart ends, sorting areas
- **ore-vein** — rock face with glittering vein · wall · edge · size:60x24x108 · stone · set:MIN! · var:- · aff:use · mesh · P1 · the dig face; mix with wall-cave-rough
- **pick-and-shovel** — pickaxe and shovel leaning together · wall · sub · size:18x10x48 · mixed · set:MIN!,DUN · var:- · aff:carry · thin · P1 · everywhere in a mine
- **sorting-table** — ore sorting table with sieves · floor · 1x2 · size:60x30x34 · wood · set:MIN · var:- · aff:use · mesh · P1 · surface works
- **sluice-box** — wooden sluice for washing ore · ground · 1x2 · size:24x110x30 · wood · set:MIN · var:- · aff:use · mesh · P3 · streams outside the mine
- **powder-keg** — blasting-powder keg · floor · sub · size:14x14x18 · wood · set:MIN,CAS · var:- · aff:hazard · mesh · P1 · the fuse everyone watches
- **collapse-rubble** — tunnel-blocking rock fall · floor · 1 · size:60x60x72~0.5-1.5 · stone · set:MIN!,DUN,RUI · var:size,shape · aff:block,los · mesh · P1 · dead ends; scene-state "cave-in"

### H6. Scholarship & writing
- **book-stack** — stack of books · surface · tiny · size:9x7x8~0.6-2 · paper · set:ARC!,NOB,TEM,CLT · var:size,shape · aff:carry · mesh · P1 · desks, floors of messy studies
- **book-open** — open book (tome) · surface · tiny · size:16x11x3 · paper · set:ARC,TEM,NOB,CLT · var:- · aff:carry · mesh · P1 · lecterns, desks
- **scroll-pile** — rolled scrolls · surface · tiny · size:12x10x5~0.6-1.8 · paper · set:ARC,TEM,CAS · var:- · aff:carry · mesh · P1 · desks, scroll racks
- **inkwell-quill** — inkwell with quill · surface · tiny · size:3x3x10 · mixed · set:ARC,NOB,TEM,CAS,CLT · var:- · aff:carry · thin · P2 · every desk
- **lectern** — reading lectern · floor · sub · size:22x20x44 · wood · set:TEM!,ARC,CRY · var:ruin · aff:use · mesh · P1 · chapels, libraries
- **map-rolled** — rolled and open maps · surface · tiny · size:18x12x4 · paper · set:CAS,ARC,TAV · var:- · aff:carry · mesh · P1 · war tables, quest-givers
- **globe-armillary** — armillary sphere · surface · sub · size:16x16x22 · metal · set:ARC!,NOB · var:- · aff:- · thin · P3 · scholars' studies
- **hourglass** — hourglass · surface · tiny · size:4x4x8 · glass · set:ARC,NOB · var:- · aff:carry · mesh · P3 · desks; a time-magic villain's prop (Maldred)
- **telescope** — brass telescope on a stand · floor · sub · size:20x20x60 · metal · set:ARC!,NOB · var:- · aff:use · mesh · P3 · tower tops

### H7. Alchemy & arcane
- **alembic** — distilling apparatus of flasks and tubes · surface · sub · size:18x12x24 · glass · set:ARC! · var:- · aff:use · thin · P1 · alchemy bench centerpiece
- **potion-bottles** — cluster of potion bottles · surface · tiny · size:10x8x8 · glass · set:ARC!,MKT · var:shape · aff:carry,loot · mesh · P1 · shelves, benches, shops
- **specimen-jar** — jar with pickled specimen/organ · surface · tiny · size:6x6x10~0.6-2 · glass · set:ARC!,DUN · var:- · aff:carry · mesh · P1 · Grimward's lab
- **skull-candle** — skull with a candle on top · surface · tiny · size:6x7x12 · organic · set:ARC,CRY,DUN,CLT · var:lit · aff:lit · mesh · P2 · necromancer shorthand
- **crystal-ball** — crystal ball on a stand · surface · tiny · size:6x6x9 · glass · set:ARC!,MKT · var:lit · aff:use · mesh · P1 · fortune tellers
- **arcane-pylon** — standing crystal focus pylon · floor · sub · size:20x20x60~0.6-2 · mixed · set:ARC,RUI,DUN · var:lit,ruin · aff:use,lit · mesh · P1 · activate-four-crystals puzzles (Room 2)
- **arcane-coil** — lightning-coil apparatus · floor · 1 · size:36x36x72 · metal · set:ARC · var:lit · aff:use,hazard · mesh · P1 · mad-science flavor without leaving fantasy
- **stuffed-crocodile** — stuffed crocodile hung from the ceiling · ceiling · 1 · size:20x72x12~0.6-1.3 · organic · set:ARC!,MKT · var:- · aff:- · mesh · P3 · the oldest apothecary joke in the book

## I. Military
- **weapon-rack** — rack of spears and swords · wall · 1 · size:48x12x60 · mixed · set:CAS!,SMI,DUN,LAI,MKT · var:fill · aff:loot · thin · P1 · armories, guard rooms
- **armor-stand** — armor on a stand · floor · sub · size:24x18x70 · metal · set:CAS!,SMI,NOB,LAI · var:ruin · aff:loot · mesh · P1 · armories; noble halls
- **shield-display** — shields hung on a wall · wall · 1 · size:48x6x36 · mixed · set:CAS!,TAV,SMI,LAI · var:- · aff:- · mesh · P1 · great halls; old-soldier taverns
- **training-dummy** — straw training dummy · floor · sub · size:24x18x66 · organic · set:CAS!,CMP · var:ruin · aff:- · mesh · P1 · courtyards, barracks
- **archery-target** — straw archery butt · ground · sub · size:36x12x48 · organic · set:CAS,MKT · var:- · aff:- · mesh · P3 · practice yards, fairs
- **arrow-barrel** — barrel of arrows · floor · sub · size:16x16x36 · wood · set:CAS · var:fill · aff:loot · thin · P1 · wall-walks, armories
- **ballista** — mounted ballista · floor · 1 · size:48x72x48 · wood · set:CAS · var:ruin · aff:use,cover · thin · P1 · tower tops
- **catapult** — catapult/trebuchet · ground · 2x2 · size:110x150x120~0.8-1.5 · wood · set:CAS,CMP · var:ruin · aff:use,cover · mesh · P3 · siege camps
- **stakes-sharpened** — sharpened stake barrier · ground · 1 · size:60x30x48 · wood · set:CAS,CMP · var:- · aff:block,hazard · mesh · P3 · field defenses
- **banner-pole** — standing banner on a pole · floor · sub · size:24x12x110 · cloth · set:CAS,CMP,MKT,LAI · var:ruin · aff:- · thin · P1 · heraldry and camps
- **tent-military** — officer's tent · ground · 2x2 · size:110x130x100~0.8-1.4 · cloth · set:CMP!,CAS · var:open,ruin · aff:los,hide · mesh · P2 · war camps; command tent

## J. Dungeon, prison & traps
- **cell-bars** — iron cell bar wall · kit · edge · size:60x4x108 · metal · set:DUN!,CLT · var:ruin · aff:block · kit · P1 · pairs with door-cell-bars; blocks moves, not sight
- **manacles-wall** — wall chains with manacles · wall · sub · size:24x6x30 · metal · set:DUN!,CLT,LAI · var:- · aff:use · thin · P1 · cells, torture rooms
- **skeleton-chained** — skeleton in wall manacles · wall · sub · mount:0 · size:26x14x66 · organic · set:DUN!,CRY · var:- · aff:- · thin · P2 · the forgotten prisoner
- **stocks** — wooden stocks · ground · 1 · size:60x20x36 · wood · set:DUN,MKT!,CAS · var:ruin · aff:use · mesh · P2 · town squares, dungeon yards
- **pillory** — standing pillory · ground · sub · size:36x20x72 · wood · set:MKT,DUN · var:ruin · aff:use · mesh · P3 · public punishment
- **rack-torture** — torture rack · floor · 1x2 · size:36x84x36 · wood · set:DUN! · var:ruin · aff:use · mesh · P1 · interrogation room anchor
- **iron-maiden** — iron maiden · floor · sub · size:30x24x78 · metal · set:DUN · var:open · aff:hazard,hide · mesh · P1 · horror beat
- **cage-hanging** — gibbet cage hanging from a chain · ceiling · sub · size:30x30x72 · metal · set:DUN!,MKT,CAS · var:open,ruin · aff:hide · thin · P1 · over pits, at crossroads
- **cage-floor** — floor cage for prisoners or beasts · floor · 1 · size:60x60x66~0.6-1.3 · metal · set:DUN,CMP,ARC,CLT,LAI · var:open · aff:block · thin · P1 · menageries, slavers' camps
- **brazier-irons** — brazier with branding irons · floor · sub · size:20x20x36 · metal · set:DUN! · var:lit · aff:lit,hazard · mesh · P1 · torture room
- **gallows** — gallows platform · ground · 2x2 · size:110x110x150 · wood · set:MKT,CAS · var:ruin · aff:climb · thin · P3 · town square, grim foreshadowing
- **oubliette-hatch** — iron grate over a pit · floor · 1 · size:36x36x4 · metal · set:DUN!,CAS,LAI · var:open · aff:pass,hazard · mesh · P3 · the forgotten cell
- **lever-wall** — wall lever · wall · tiny · size:6x8x18 · metal · set:DUN!,CAS,MIN,RUI · var:open · aff:use · mesh · P1 · opens gates, trips traps; scene-state trigger
- **pressure-plate** — floor pressure plate · floor · 1 · size:24x24x2 · stone · set:DUN,CRY,RUI · var:- · aff:trap · mesh · P1 · trap trigger (GM-hidden)
- **trap-spikes** — floor spike trap · floor · 1 · size:60x60x18 · metal · set:DUN!,CRY,RUI · var:open · aff:trap,hazard · mesh · P2 · retracted vs sprung
- **trap-blade** — swinging pendulum blade on its own free-standing gantry · floor · 1 · size:66x20x96 · metal · set:DUN,CRY · var:- · aff:trap,hazard · thin · P3 · corridor gauntlets
- **trap-dart-wall** — carved stone slab with dart holes, standing against a wall · wall · 1 · mount:0 · size:56x10x84 · stone · set:DUN,CRY,RUI · var:- · aff:trap,hazard · mesh · P3 · tomb corridors
- **boulder-rolling** — big round boulder · floor · 1 · size:60x60x60~0.7-1.3 · stone · set:DUN,CRY,RUI · var:- · aff:trap,block · mesh · P3 · you know the scene
- **bones-pile** — pile of bones · floor · sub · size:30x30x12~0.5-2 · organic · set:DUN!,CRY,RUI,MIN,LAI · var:size,shape · aff:loot · mesh · P1 · cell corners, monster lairs
- **skull-pile** — heap of skulls · floor · sub · size:24x24x18~0.5-2.5 · organic · set:CRY!,DUN,CLT,LAI · var:size,shape · aff:- · mesh · P1 · ossuaries, cult sites
- **sewer-grate** — wall sewer outflow grate · wall · 1 · mount:0 · size:44x10x44 · metal · set:DUN,CAS,MKT · var:open · aff:pass · mesh · P2 · escape routes

## K. Religious & funerary
- **font-holy** — stone baptismal font · floor · sub · size:26x26x40 · stone · set:TEM! · var:ruin,fill · aff:use · mesh · P1 · chapel entry
- **shrine-roadside** — small wayside shrine · ground · sub · size:30x20x60 · stone · set:TEM,MKT,HUT,RUI · var:ruin · aff:use · mesh · P2 · crossroads, village edges
- **statue-deity** — robed deity/saint statue · floor · 1 · size:36x30x96~0.6-2.5 · stone · set:TEM!,RUI,CRY · var:ruin,shape · aff:block,cover · mesh · P1 · chapel apse; headless in ruins
- **idol-dark** — sinister idol · floor · sub · size:24x20x42~0.5-3 · stone · set:CLT!,DUN,RUI,CRY · var:lit · aff:use · mesh · P1 · cult chambers
- **prayer-candle-rack** — votive candle rack · floor · sub · size:36x16x40 · metal · set:TEM! · var:lit · aff:lit · mesh · P1 · side chapels
- **reliquary** — gilded reliquary box · surface · tiny · size:12x8x10 · metal · set:TEM!,CRY · var:open · aff:loot · mesh · P3 · the MacGuffin case
- **bell-hanging** — large bronze bell · ceiling · 1 · size:48x48x48~0.3-1.5 · metal · set:TEM,CAS · var:- · aff:use · mesh · P3 · bell towers
- **offering-bowl** — offering bowl with coins/flowers · surface · tiny · size:10x10x4 · metal · set:TEM,CRY,RUI · var:fill · aff:loot · mesh · P3 · shrines
- **incense-burner** — hanging or standing censer · surface · tiny · size:6x6x10 · metal · set:TEM,ARC · var:lit · aff:- · mesh · P3 · pair with fx-smoke
- **tomb-slab** — floor tomb slab with inscription · floor · 1x2 · size:36x84x4 · stone · set:CRY!,TEM · var:open,ruin · aff:pass,loot · mesh · P2 · lift it for a stair down
- **effigy-knight** — tomb with reclining knight effigy · floor · 1x2 · size:40x90x42 · stone · set:CRY!,TEM,CAS · var:ruin · aff:cover · mesh · P2 · noble crypts
- **gravestone** — headstone · ground · sub · size:22x6x34~0.6-1.6 · stone · set:CRY!,TEM,RUI · var:ruin,shape · aff:cover · mesh · P2 · graveyards; cluster with lean
- **grave-open** — freshly dug or opened grave · ground · 1x2 · size:40x84x18 · organic · set:CRY · var:- · aff:hazard · mesh · P3 · resurrection scenes
- **mausoleum** — small stone mausoleum · ground · 2x2 · size:110x130x130~0.8-1.5 · stone · set:CRY!,NOB · var:open,ruin · aff:pass · mesh · P3 · graveyard landmark; crypt entrance

## L. Noble décor & leisure
- **tapestry** — large woven tapestry · wall · 1x2 · size:96x1x72~0.6-1.6 · cloth · set:NOB!,CAS,ARC · var:ruin,shape · aff:hide · flat · P1 · great halls; hides secret doors
- **banner-wall** — heraldic hanging banner · wall · 1 · size:30x1x72~0.6-1.6 · cloth · set:CAS!,NOB · var:ruin,shape · aff:- · flat · P1 · thrones, halls
- **painting-portrait** — framed portrait · wall · sub · size:28x2x36~0.6-1.8 · mixed · set:NOB!,TAV · var:ruin,shape · aff:- · flat · P1 · ancestors watching; eyes-follow-you variant
- **painting-landscape** — framed landscape · wall · sub · size:42x2x30~0.6-1.8 · mixed · set:NOB,TAV · var:- · aff:- · flat · P1 · parlors
- **mirror-standing** — tall standing mirror · floor · sub · size:26x20x70 · mixed · set:NOB!,LAI,TAV,ARC · var:ruin · aff:- · mesh · P3 · bedchambers; vampire tells
- **rug-small** — small rug · floor · 1 · size:60x40x0.5~0.7-1.3 · cloth · set:ANY · var:wealth,shape · aff:- · flat · P1 · under tables, before hearths
- **rug-runner** — long narrow hallway runner · floor · 1x3 · size:36x160x0.4~0.8-1.2 · cloth · set:TAV!,NOB,CAS,ARC,CLT · var:wealth · aff:- · flat · P1 · hallways and stair landings; tiles end to end
- **rug-grand** — large patterned carpet · floor · 2x3 · size:110x170x0.5~0.7-1.2 · cloth · set:NOB!,CAS,TAV · var:ruin · aff:- · flat · P2 · throne-room runner, bedchambers
- **rug-fur** — animal-skin rug · floor · 1x2 · size:48x72x1.5~0.8-1.3 · organic · set:NOB,CAS,TAV · var:- · aff:- · flat · P2 · lodges, hearthside
- **rug-round** — round woven rug · floor · 1 · size:60x60x0.5~0.7-1.4 · cloth · set:TAV,NOB,HUT,ARC · var:- · aff:- · flat · P1 · under round tables, bedside
- **rug-oval** — oval woven rug · floor · 1x2 · size:48x72x0.5~0.8-1.3 · cloth · set:TAV,NOB · var:- · aff:- · flat · P1 · before hearths and beds
- **rug-braided-round** — round braided rag rug · floor · 1 · size:48x48x0.6~0.7-1.3 · cloth · set:HUT!,TAV · var:- · aff:- · flat · P1 · cottages, cheap rooms
- **rug-round-fine** — fine round medallion carpet · floor · 2x2 · size:96x96x0.5~0.8-1.2 · cloth · set:NOB!,CAS,TAV · var:- · aff:- · flat · P2 · noble chambers, solars
- **rug-hearth-halfmoon** — half-moon hearth rug · floor · 1 · size:60x30x0.6 · cloth · set:TAV,HUT,NOB · var:- · aff:- · flat · P1 · in front of every fireplace
- **rug-striped-woven** — striped woven rug · floor · 1 · size:60x36x0.4~0.8-1.4 · cloth · set:TAV,HUT,MKT,SMI · var:- · aff:- · flat · P1 · common rooms, guest rooms
- **rug-rush-mat** — woven rush floor mat · floor · 1 · size:72x48x0.4~0.7-1.3 · organic · set:HUT!,TAV,TEM · var:- · aff:- · flat · P1 · peasant floors, monk cells
- **rug-sheepskin** — sheepskin rug · floor · sub · size:30x40x2~0.8-1.2 · organic · set:HUT,NOB,TAV,CMP,ARC · var:- · aff:- · flat · P1 · bedside, by the fire
- **rug-bearskin** — bearskin rug with the head · floor · 1x2 · size:60x84x8~0.8-1.3 · organic · set:NOB!,CAS,TAV,CMP,LAI · var:- · aff:- · flat · P2 · lodges, lords' hearths
- **rug-wolfskin** — wolfskin rug · floor · 1 · size:30x60x2~0.8-1.2 · organic · set:CMP!,HUT,TAV · var:- · aff:- · flat · P2 · hunters' cabins, mercenary rooms
- **rug-cowhide** — cowhide rug · floor · 1 · size:54x66x0.5~0.8-1.2 · organic · set:HUT,TAV,MKT · var:- · aff:- · flat · P3 · farmhouses, rustic inns
- **rug-hay-scatter** — loose hay scattered on the floor · floor · 1 · size:60x48x1~0.6-1.6 · organic · set:TAV,HUT!,CMP,ARC,LAI · var:shape · aff:- · flat · P1 · stables, barns, byres; breaks up dirt floors
- **decal-dirt-patch** — patch of damp dirt and mud · ground · sub · size:48x36x0.5~0.6-1.6 · organic · set:TAV,HUT,CMP,LAI · var:shape · aff:- · flat · P1 · scatter on earth floors; breaks up repetition
- **trophy-head** — mounted stag head · wall · sub · size:30x20x30~0.8-1.4 · organic · set:NOB,TAV,CAS,LAI · var:- · aff:- · mesh · P2 · hunting lodges, taverns
- **armor-decorative** — ornate suit of armor · floor · sub · size:24x18x72 · metal · set:NOB!,CAS · var:ruin · aff:hide · mesh · P2 · hallways (is it moving?)
- **statue-bust** — bust on a plinth · floor · sub · size:16x16x54 · stone · set:NOB!,ARC · var:ruin · aff:cover · mesh · P2 · galleries, libraries
- **statue-heroic** — full heroic statue on a pedestal · floor · 1 · size:36x36x110~0.7-2 · stone · set:NOB,MKT,RUI · var:ruin,shape · aff:block,cover · mesh · P1 · courtyards, town squares; toppled in ruins
- **vase-flowers** — vase with flowers · surface · tiny · size:8x8x18 · ceramic · set:NOB!,TAV,CRY · var:ruin · aff:carry · mesh · P1 · side tables, windowsills
- **planter-topiary** — potted topiary · floor · sub · size:22x22x48~0.6-1.5 · organic · set:NOB! · var:ruin · aff:cover · mesh · P1 · terraces, garden edges
- **lute** — lute on a stand · floor · sub · size:16x8x36 · wood · set:TAV,NOB · var:- · aff:carry · thin · P3 · bard's corner
- **harp** — standing harp · floor · sub · size:24x18x60 · wood · set:NOB · var:- · aff:use · thin · P3 · solar music room
- **curtains-drapes** — heavy window drapes · wall · 1 · size:60x6x96 · cloth · set:NOB!,CAS,TEM,TAV,ARC · var:open,ruin · aff:hide,los · flat · P1 · scene state: drawn/open changes light
- **screen-folding** — folding dressing screen · floor · 1 · size:60x12x66 · mixed · set:NOB,TAV · var:- · aff:los,hide · mesh · P3 · bedchambers, bathhouses
- **jewelry-box** — jewelry box · surface · tiny · size:10x7x6 · mixed · set:NOB! · var:open · aff:loot,carry · mesh · P2 · the heist target
- **perfume-bottles** — perfume bottles on a tray · surface · tiny · size:10x7x7 · glass · set:NOB · var:- · aff:- · mesh · P3 · vanity dressing
- **heraldic-shield** — coat-of-arms plaque · wall · sub · size:24x4x30 · mixed · set:CAS!,NOB,SMI,LAI · var:ruin · aff:- · mesh · P2 · over fireplaces and gates
- **birdcage** — ornate birdcage · surface · sub · size:12x12x20 · metal · set:NOB · var:open · aff:- · thin · P3 · parlor oddity
- **cat-tree** — cat tree: carpeted cat tower with a rope scratching post and a cubby · floor · 1 · size:34x34x60 · mixed · set:TAV,HUT,NOB,ARC · var:- · aff:climb,hide · mesh · P3 · cat furniture for a house or an inn common room; no cat; generated 2026-10-06 (A playtester asked for it)

## M. Outdoors & settlement
- **market-stall** — covered market stall · ground · 1x2 · size:72x110x96 · wood · set:MKT! · var:ruin,shape · aff:cover,use · mesh · P1 · the unit of a market square
- **awning** — cloth awning over a shopfront · wall · 1x2 · size:72x36x24 · cloth · set:MKT!,TAV · var:ruin · aff:- · thin · P2 · shopfronts
- **sign-hanging** — hanging shop/tavern sign · wall · sub · size:30x4x24 · wood · set:TAV!,MKT,SMI · var:ruin,shape · aff:- · mesh · P1 · the tavern's name lives here
- **signpost** — crossroads signpost · ground · sub · size:24x24x84 · wood · set:MKT,HUT,CMP,MIN · var:ruin · aff:- · mesh · P2 · crossroads, village edges
- **notice-board** — notice board with papers · ground · sub · size:40x12x72 · wood · set:MKT!,TAV!,MIN · var:- · aff:use · mesh · P1 · quest hook dispenser
- **cart-hand** — handcart · ground · 1 · size:40x72x36 · wood · set:MKT,HUT,MIN,TAV,SMI · var:fill,ruin · aff:cover · mesh · P1 · streets, farms
- **wagon** — four-wheeled covered wagon · ground · 2x3 · size:84x170x110 · wood · set:MKT,CMP,TAV,HUT,SMI · var:fill,ruin · aff:cover,hide · mesh · P2 · caravans, stable yards
- **cart-hay** — hay cart · ground · 1x2 · size:60x110x72 · wood · set:HUT,MKT · var:fill · aff:cover,hide · mesh · P3 · hide in the hay
- **bridge-small** — small plank or stone bridge · ground · 1x2 · size:60x110x24~0.8-1.5 · mixed · set:HUT,MKT,CMP,RUI · var:ruin · aff:pass · mesh · P3 · streams
- **milestone** — roadside milestone · ground · tiny · size:12x10x20 · stone · set:HUT,CMP · var:ruin · aff:- · mesh · P3 · roads
- **tent-small** — small canvas tent · ground · 1x2 · size:60x84x48~0.8-1.3 · cloth · set:CMP! · var:open · aff:los,hide,sleep · mesh · P1 · camps
- **lean-to** — branch lean-to shelter · ground · 1x2 · size:72x72x54 · organic · set:CMP · var:- · aff:los,sleep · mesh · P3 · wilderness
- **log-seat** — log bench · ground · 1x2 · size:72x16x16~0.7-1.3 · wood · set:CMP!,HUT,GRV,TAV,SMI,LAI · var:- · aff:sit · mesh · P1 · around a campfire

## N. Nature & cave
- **tree-deciduous** — broadleaf tree · ground · 2x2 · size:150x150x360~0.4-2 · organic · set:HUT,NOB,CMP,RUI,TAV · var:size,shape · aff:block,los,cover,climb · mesh · P1 · exteriors; the ground plane's anchor
- **tree-conifer** — pine/fir tree · ground · 1 · size:72x72x360~0.4-2 · organic · set:CMP,HUT,MIN · var:size,shape · aff:block,los,cover · mesh · P1 · mountain mines, forests
- **tree-dead** — dead twisted tree · ground · 1 · size:72x72x240~0.4-2 · organic · set:RUI,CRY,CMP · var:size,shape · aff:cover · mesh · P2 · spooky exteriors
- **stump** — tree stump · ground · sub · size:24x24x18~0.6-2 · wood · set:ANY · var:- · aff:sit · mesh · P2 · clearings
- **log-fallen** — fallen log · ground · 1x2 · size:30x110x24~0.6-1.6 · wood · set:CMP,RUI,HUT · var:- · aff:cover · mesh · P2 · forest cover
- **bush** — bush/shrub · ground · sub · size:40x40x36~0.5-2 · organic · set:ANY · var:size,shape · aff:los,hide · mesh · P1 · breaks sightlines outside
- **rock-small** — small rocks · ground · tiny · size:12x10x6~0.5-3 · stone · set:ANY · var:pile,shape · aff:- · mesh · P1 · scatter
- **boulder** — large boulder · ground · 1 · size:60x54x48~0.5-2 · stone · set:ANY · var:size,shape · aff:block,los,cover · mesh · P1 · outdoor hard cover
- **rock-outcrop** — rock outcrop/cliff chunk · ground · 2x2 · size:140x110x96~0.6-2 · stone · set:MIN,CMP,RUI,LAI · var:- · aff:block,los,climb · mesh · P1 · mine entrances, overlooks
- **grass-tall** — tall grass clump · ground · sub · size:30x30x30~0.6-1.6 · organic · set:HUT,RUI,CMP,TAV · var:- · aff:hide · flat · P1 · ruin overgrowth, fields
- **flowers-wild** — wildflower patch · ground · sub · size:30x30x14~0.6-1.6 · organic · set:HUT,NOB,RUI,GRV,TAV · var:- · aff:- · flat · P3 · gardens, graves
- **mushrooms-giant** — giant fantasy mushrooms · ground · sub · size:40x40x60~0.4-2.5 · organic · set:MIN,CMP,RUI,GRV · var:size,lit,shape · aff:lit,cover · mesh · P1 · underground gardens; glowing variant
- **vines-hanging** — hanging vines/ivy mass · wall · 1 · size:60x8x96~0.6-1.5 · organic · set:RUI! · var:- · aff:los · flat · P1 · ruin overgrowth's workhorse
- **stalagmite** — stalagmite cluster · floor · sub · size:30x30x48~0.4-3 · stone · set:MIN!,DUN,LAI · var:size,shape · aff:block,cover · mesh · P1 · caves
- **stalactite** — stalactite cluster · ceiling · sub · size:30x30x40~0.4-3 · stone · set:MIN,DUN · var:size · aff:- · mesh · P1 · caves (FPV mood)
- **cave-column** — floor-to-ceiling rock column · floor · 1 · size:60x60x144~0.6-2 · stone · set:MIN,DUN · var:- · aff:block,los,cover · mesh · P1 · cavern pillars
- **crystal-formation** — large crystal formation · floor · 1 · size:60x60x84~0.4-2 · glass · set:MIN!,ARC · var:lit,size · aff:lit,cover · mesh · P1 · the deep mine wonder

## O. Ruin & debris
- **rubble-pile** — pile of masonry rubble · floor · 1 · size:60x60x30~0.4-2 · stone · set:RUI!,DUN,MIN,CAS,LAI · var:size,shape · aff:cover,climb · mesh · P1 · the ruin workhorse; varied sizes
- **masonry-block-fallen** — fallen dressed block · floor · sub · size:30x20x20~0.6-1.6 · stone · set:RUI! · var:shape · aff:cover · mesh · P1 · scatter around broken walls
- **column-drum-fallen** — toppled column drums · floor · 1x2 · size:30x90x30~0.7-1.5 · stone · set:RUI! · var:- · aff:cover · mesh · P1 · the ruin's signature silhouette
- **column-stump** — column broken off at waist height · floor · sub · size:22x22x40~0.7-1.5 · stone · set:RUI! · var:- · aff:cover · mesh · P1 · colonnade remnants
- **statue-toppled** — toppled statue pieces · floor · 1x2 · size:40x96x30~0.6-2 · stone · set:RUI!,TEM · var:- · aff:cover · mesh · P1 · lost glories
- **beam-collapsed** — fallen roof beams · floor · 1x2 · size:40x110x30~0.7-1.4 · wood · set:RUI,MIN,TAV · var:- · aff:cover,block · mesh · P2 · burned-out buildings, cave-ins
- **timbers-burnt** — charred timbers and ash · floor · 1 · size:60x60x20~0.6-1.5 · wood · set:RUI,HUT,TAV · var:- · aff:cover · mesh · P2 · raided villages
- **debris-planks** — scattered broken planks · floor · 1 · size:60x60x8~0.6-1.5 · wood · set:RUI,DUN,MIN · var:- · aff:- · mesh · P2 · floor dressing
- **furniture-smashed** — smashed tables and chairs heap · floor · 1 · size:60x60x30~0.7-1.4 · wood · set:RUI,TAV,DUN · var:- · aff:cover · mesh · P2 · aftermath of a brawl
- **pottery-shards** — broken pottery · floor · tiny · size:18x18x3~0.5-2 · ceramic · set:RUI,DUN,CRY · var:- · aff:- · mesh · P3 · floor dressing
- **mound-overgrown** — earthen mound with grass · ground · 1 · size:70x70x36~0.5-2 · organic · set:RUI,CRY,HUT · var:- · aff:cover · mesh · P3 · barrows, buried rooms

## P. Compounds (baked dressing sets)

## Q. FX & decals (not meshes)
- **fx-fire** — fire (small/large) · attach · sub · size:24x24x30~0.2-4 · mixed · set:ANY · var:size · aff:lit,hazard · fx · P1 · hearths, braziers, burning buildings
- **fx-flame-small** — candle/torch flame · attach · tiny · size:1x1x3~0.5-3 · mixed · set:ANY · var:- · aff:lit · fx · P1 · every lit=on light source
- **fx-smoke** — smoke/steam plume · attach · sub · size:24x24x60~0.3-4 · mixed · set:ANY · var:- · aff:los · fx · P1 · chimneys, forges, incense
- **fx-sparks** — forge sparks · attach · tiny · size:12x12x12~0.5-2 · mixed · set:SMI! · var:- · aff:- · fx · P1 · anvil strikes
- **fx-water-surface** — water surface (pool, puddle, stream) · floor · 1 · size:60x60x1~0.5-4 · mixed · set:ANY · var:- · aff:hazard · fx · P1 · cisterns, flooded mines, sewers
- **fx-lava** — lava surface · floor · 1 · size:60x60x1~0.5-4 · mixed · set:MIN,DUN · var:- · aff:hazard · fx · P1 · deep mines, volcano lairs
- **fx-fog-volume** — ground fog volume · floor · 2x2 · size:110x110x24~0.5-3 · mixed · set:CRY,RUI,CMP,LAI · var:- · aff:los · fx · P1 · graveyards, swamps
- **fx-light-shaft** — dusty light shaft through a window · attach · 1 · size:30x30x96~0.5-2 · mixed · set:TEM,NOB,RUI · var:- · aff:- · fx · P1 · the chapel/ruin money shot
- **fx-magic-glow** — magical glow/aura · attach · sub · size:24x24x24~0.3-3 · mixed · set:ARC,TEM,RUI,GRV · var:- · aff:lit · fx · P1 · pylons, idols, portals
- **fx-portal** — swirling portal field · attach · 1x2 · size:48x6x84~0.6-1.6 · mixed · set:ARC,GRV,CLT,RUI · var:- · aff:lit,pass · fx · P1 · fills portal-arch
- **fx-force-wall** — shimmering wall of force · floor · edge · size:60x2x108~0.5-2 · mixed · set:ARC,DUN · var:- · aff:block · fx · P1 · barriers that aren't walls
- **fx-colored-flame** — green/blue/purple magical fire · attach · sub · size:18x18x24~0.3-3 · mixed · set:ARC,CLT,CRY · var:- · aff:lit,hazard · fx · P1 · evil braziers, necromancer candles
- **fx-miasma** — poison gas/miasma cloud · floor · 2x2 · size:110x110x36~0.5-3 · mixed · set:DUN,CRY,LAI,CLT · var:- · aff:hazard,los · fx · P1 · trap gas, swamp lairs
- **fx-sparkle-arcane** — drifting arcane motes · attach · sub · size:24x24x24~0.5-3 · mixed · set:ARC,GRV · var:- · aff:- · fx · P1 · ambient magic
- **decal-blood** — blood stain · floor · sub · size:24x24x0.1~0.3-3 · mixed · set:DUN,CRY,RUI,CLT,ARC,LAI · var:- · aff:- · flat · P2 · crime scenes, torture rooms
- **decal-scorch** — scorch mark · floor · sub · size:30x30x0.1~0.3-3 · mixed · set:RUI,SMI,ARC,LAI,MIN · var:- · aff:- · flat · P3 · aftermath of a fireball
- **decal-cobweb** — cobwebs (corner, doorway) · wall · sub · size:24x1x24~0.5-3 · mixed · set:CRY,DUN,RUI,TAV,LAI,CLT · var:- · aff:- · flat · P1 · corners of anything abandoned
- **decal-moss** — moss/lichen patch · floor · 1 · size:60x60x0.1~0.5-2 · organic · set:RUI,DUN,CRY,LAI · var:- · aff:- · flat · P2 · aging layer for ruins
- **decal-cracks** — floor/wall cracks · floor · 1 · size:60x60x0.1~0.5-2 · mixed · set:RUI,DUN,MIN · var:- · aff:- · flat · P2 · aging layer
- **decal-ritual-circle** — painted ritual circle · floor · 2x2 · size:110x110x0.1~0.5-2 · mixed · set:CLT!,ARC,DUN,CRY · var:lit · aff:use · flat · P1 · summonings; can glow
- **decal-papers** — scattered papers/letters · floor · sub · size:24x18x0.3~0.6-2 · paper · set:ARC,NOB,CAS · var:- · aff:loot · flat · P3 · ransacked studies

## R. Magic, cults, lairs & puzzles

The D&D-critical layer: things that make a room *an adventure site* rather than a building. Kept generic on purpose — no publisher-specific monsters or named artifacts.

### R1. Arcane apparatus & sanctums
- **pedestal-display** — stone pedestal presenting one item · floor · sub · size:18x18x40 · stone · set:ARC,TEM,DUN!,CRY,LAI,CLT,NOB · var:ruin,lit · aff:loot,use · mesh · P1 · the "don't touch the thing on the pedestal" shot
- **portal-arch** — standing stone arch framing a portal · floor · 1x2 · size:60x24x120~0.7-1.8 · stone · set:ARC!,RUI,GRV,CLT · var:lit,ruin · aff:pass,use · mesh · P1 · pair with fx-portal; lit = active
- **teleport-circle-dais** — low rune-inscribed stone ring · floor · 2x2 · size:110x110x8~0.7-1.5 · stone · set:ARC!,RUI,DUN · var:lit,ruin · aff:pass,use · mesh · P2 · fast travel, escape hatches, villain exits
- **scrying-pool** — basin of still silvered water · floor · 1 · size:48x48x30 · stone · set:ARC,TEM,GRV · var:lit · aff:use · mesh · P2 · visions; the villain watching the party
- **magic-mirror** — ornate mirror with a glowing surface · wall · 1 · size:30x4x60~0.7-1.5 · mixed · set:NOB,ARC,CLT · var:lit,ruin · aff:use · mesh · P2 · talking mirrors, trapped souls, a way through
- **enchanting-table** — rune-carved table with a floating tome · floor · 1 · size:48x30x34 · mixed · set:ARC! · var:lit · aff:use · mesh · P1 · item-crafting downtime scenes
- **spellbook-lectern** — lectern with a chained, glowing spellbook · floor · sub · size:22x20x46 · mixed · set:ARC!,TEM,CLT · var:lit · aff:use,loot · mesh · P1 · the wizard's prize; reading it is a choice
- **staff-rack** — rack of staves and wands · wall · 1 · size:40x10x72 · wood · set:ARC!,MKT · var:fill · aff:loot · thin · P1 · wizard armory
- **magic-item-cluster** — wands, orbs and rings on a velvet cloth · surface · tiny · size:14x10x5 · mixed · set:ARC,MKT,DUN,LAI · var:- · aff:loot · mesh · P1 · shops, hoards, reward reveals
- **potion-single-glowing** — a single glowing potion · surface · tiny · size:3x3x6 · glass · set:ANY · var:shape · aff:carry,loot · mesh · P1 · the healing potion on the table
- **scroll-sealed-glowing** — sealed spell scroll with glowing wax · surface · tiny · size:10x2x2 · paper · set:ARC,TEM,DUN,LAI,MKT · var:- · aff:carry,loot · mesh · P2 · loot and quest deliveries
- **orb-floating** — orb hovering over a claw stand · surface · tiny · size:6x6x12 · mixed · set:ARC!,CLT,LAI · var:lit · aff:use,loot · mesh · P1 · power source, MacGuffin
- **orrery** — mechanical planetary orrery · floor · 1 · size:36x36x48 · metal · set:ARC,SMI · var:- · aff:use · thin · P3 · astrologer towers
- **arcane-forge** — rune anvil with a glowing crucible · floor · 1x2 · size:48x84x40 · mixed · set:SMI,ARC · var:lit · aff:use,lit,hazard · mesh · P3 · magic weapon crafting
- **golem-parts** — stone/iron golem limbs on a workbench · floor · 1x2 · size:36x84x40 · mixed · set:ARC,RUI,SMI · var:ruin · aff:use · mesh · P3 · unfinished construct; lab dressing
- **rocks-floating** — cluster of levitating rocks · floor · 1 · size:48x48x60~0.5-2 · stone · set:ARC,RUI,GRV · var:- · aff:climb · mesh · P3 · wild-magic zones, tower tops
- **elemental-brazier** — brazier of colored elemental flame · floor · sub · size:20x20x36 · metal · set:ARC,CLT,TEM · var:lit · aff:lit,hazard · mesh · P1 · pair with fx-colored-flame

### R2. Cults & the profane
- **altar-sacrificial** — stone slab with blood channels and candles · floor · 1x2 · size:40x84x38 · stone · set:CLT!,DUN,RUI · var:ruin · aff:use,cover · mesh · P1 · the cult's climax set-piece
- **cult-banner** — cult-sigil banner · wall · 1 · size:30x1x72~0.6-1.6 · cloth · set:CLT! · var:ruin · aff:- · flat · P1 · tells you what they worship
- **robe-rack** — hooks of hooded cult robes · wall · sub · size:30x10x60 · cloth · set:CLT · var:- · aff:loot · mesh · P1 · disguise opportunity
- **bone-throne** — throne built of bones · floor · 1 · size:48x40x72~0.8-1.5 · organic · set:LAI!,CLT · var:ruin · aff:sit · mesh · P2 · warlords, necromancers, goblin kings
- **phylactery** — ornate soul vessel on a stand · surface · tiny · size:5x5x10 · mixed · set:CLT,CRY,LAI · var:lit · aff:loot · mesh · P1 · destroy it to end the lich
- **cage-sacrifice** — wooden cage holding a captive · floor · 1 · size:48x48x72~0.8-1.3 · wood · set:CLT,LAI,CMP · var:open · aff:open · mesh · P1 · the rescue beat
- **tentacles-floor** — tentacles rising from a floor crack · floor · 1 · size:60x60x72~0.5-2 · organic · set:CLT,LAI · var:- · aff:hazard · mesh · P3 · something below is waking
- **totem-skull** — skull totem on a pole · ground · sub · size:20x16x84 · organic · set:LAI!,CMP,CLT · var:- · aff:- · thin · P2 · tribal borders, lair warnings

### R3. Lairs
- **dragon-skull** — giant dragon skull · floor · 2x2 · size:110x150x60~0.4-2 · organic · set:LAI!,RUI · var:- · aff:cover,climb · mesh · P1 · lair centerpiece; ancient battlefields
- **dragon-eggs** — clutch of large eggs in a nest · floor · 1 · size:48x48x24~0.6-2 · mixed · set:LAI! · var:- · aff:loot · mesh · P1 · stakes-raising loot
- **adventurer-remains** — skeleton in armor with pack and sword · floor · 1 · size:30x70x16 · mixed · set:DUN,LAI,CRY,RUI,MIN · var:shape · aff:loot · mesh · P1 · "the last party" — loot and foreshadowing
- **mimic-chest** — chest with teeth and tongue · floor · sub · size:36x20x22~0.7-1.4 · mixed · set:DUN,CRY,LAI,TAV · var:open · aff:loot,hazard,trap · mesh · P1 · closed = looks like chest-plain; open = surprise
- **giant-web** — giant spider web across a passage · wall · 1x2 · size:110x4x96~0.5-2 · organic · set:LAI!,DUN,CRY,GRV · var:ruin · aff:hazard,los,block · thin · P1 · difficult terrain; burn it
- **web-cocoon** — web-wrapped victim · floor · sub · size:24x24x70~0.4-1.3 · organic · set:LAI!,DUN,CRY · var:open · aff:loot · mesh · P1 · hang from ceiling or lie in corners
- **statue-petrified** — statue of a terrified adventurer · floor · 1 · size:30x30x70 · stone · set:LAI,RUI · var:ruin · aff:cover · mesh · P2 · stone-gaze lairs; the tell before the monster
- **nest-giant** — giant nest of branches and bones · floor · 2x2 · size:110x110x36~0.6-2 · organic · set:LAI!,GRV,RUI · var:- · aff:loot · mesh · P2 · roc/griffon/wyvern lairs
- **gnawed-carcass** — half-eaten beast carcass · floor · 1 · size:40x70x24~0.5-2 · organic · set:LAI!,CMP · var:- · aff:- · mesh · P1 · something big ate here
- **backpack** — adventurer's backpack with bedroll · floor · tiny · size:14x9x20 · mixed · set:ANY · var:- · aff:carry,loot · mesh · P1 · camps, inns, remains

### R4. Groves & the fey
- **standing-stone** — single standing stone (rings built from these) · ground · sub · size:30x18x96~0.5-1.8 · stone · set:GRV!,RUI · var:ruin,lit,shape · aff:cover,block · mesh · P1 · stone circles, barrow fields
- **obelisk-runed** — engraved obelisk · ground · 1 · size:36x36x144~0.5-2 · stone · set:RUI!,CLT,GRV · var:ruin,lit · aff:cover,use · mesh · P1 · ley lines, cursed sites
- **runestone** — carved runestone · ground · sub · size:24x12x60~0.6-1.6 · stone · set:GRV,RUI,MIN · var:ruin · aff:use · mesh · P1 · lore delivery
- **sacred-tree** — huge ancient tree with a face in the bark · ground · 3x3 · size:200x200x480~0.7-1.8 · organic · set:GRV! · var:lit · aff:block,los,climb · mesh · P1 · the grove's heart; can talk
- **fairy-ring** — ring of mushrooms · ground · 2x2 · size:100x100x8~0.5-2 · organic · set:GRV!,HUT · var:lit · aff:pass · mesh · P1 · don't step in it (or do)
- **druid-altar** — mossy stone table with offerings · ground · 1x2 · size:48x84x34 · stone · set:GRV! · var:- · aff:use · mesh · P1 · grove rituals
- **flowers-glowing** — bioluminescent flowers · ground · sub · size:24x24x18~0.6-1.6 · organic · set:GRV!,MIN · var:lit · aff:lit · thin · P1 · feywild edges, underground gardens
- **log-hollow** — large hollow log · ground · 1x2 · size:36x110x30~0.6-1.6 · wood · set:GRV,CMP · var:- · aff:hide,cover,pass · mesh · P1 · hiding spots, burrows

### R5. Puzzles & dungeon mechanisms
- **door-rune-sealed** — heavy door sealed by glowing runes · kit · edge · size:48x8x96 · stone · set:DUN!,CRY,ARC,RUI · var:open,lit · aff:pass,los,open · kit · P1 · the puzzle's lock; runes go dark when solved
- **door-face-carved** — door with a carved face that talks · kit · edge · size:44x8x90 · stone · set:DUN,RUI,CRY · var:open · aff:pass,los,open · kit · P3 · riddle doors
- **rune-tile** — floor tile with a glyph · kit · 1 · size:60x60x4 · stone · set:DUN,CRY,ARC · var:lit · aff:trap,use · flat · P1 · step-in-the-right-order puzzles
- **statue-rotating** — statue on a turnable plinth · floor · 1 · size:30x30x72 · stone · set:DUN,TEM,RUI · var:- · aff:use,cover · mesh · P1 · point them all at the door
- **orb-socket-pedestal** — pedestal with an empty orb socket · floor · sub · size:18x18x40 · stone · set:DUN,ARC,RUI · var:lit · aff:use · mesh · P1 · "four crystals must be activated" rooms
- **block-sliding** — pushable stone block · floor · 1 · size:54x54x54~0.6-1.3 · stone · set:DUN,RUI,CRY · var:- · aff:block,cover,use · mesh · P1 · push puzzles
- **floor-mosaic** — decorative floor mosaic with a clue · floor · 2x2 · size:110x110x0.3~0.5-2 · stone · set:TEM,RUI,DUN · var:ruin · aff:- · flat · P1 · the map is on the floor
- **decal-glyph-warding** — glowing warding glyph · floor · sub · size:24x24x0.1~0.5-2 · mixed · set:ARC,DUN,TEM,CRY · var:lit · aff:trap · flat · P2 · magical trap marker (GM-hidden)
