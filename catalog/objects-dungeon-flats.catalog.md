# Dungeon & prison: floors, strips and decals (2026-10-11)

Flat images for the Dungeon type (`experiments/2026-10-11-types/dun/flats/`). Meshes are in `objects-dungeon.catalog.md`.
A "strip" is an opaque 5-ft tile that repeats left to right; a row of them is a chasm or a sewer channel painted on the
floor (terrain below floor level does not exist yet: see docs/VERTICAL.md).

## J Dungeon, prison & traps — flats

- **floor-cut-rock** — floor hewn from living rock, chisel-scored, no joints · kit · 1 · size:60x60x1 · stone · set:DUN!,MIN,LAI · var:- · aff:- · flat · P1 · hewn dungeons, dens, shrines
- **floor-water-flooded** — a flooded stone floor: dark still water with flagstones dim beneath · kit · 1 · size:60x60x1 · mixed · set:DUN!,RUI,MIN · var:- · aff:hazard · flat · P1 · flooded chambers, cisterns; difficult terrain
- **floor-flagstone-dungeon** — big dark worn dungeon flagstones with black joints · kit · 1 · size:60x60x1 · stone · set:DUN!,CAS,CRY · var:- · aff:- · flat · P1 · cell blocks, guard rooms, corridors
- **chasm-strip** — a bottomless chasm across the floor, one 5-ft tile of a row · floor · 1 · size:60x60x0.1 · stone · set:DUN!,MIN,LAI · var:shape · aff:hazard,block · flat · P1 · laid in a row from wall to wall; a bridge crosses it
- **chasm-strip-wide** — a 10-ft-wide chasm, one 5-ft tile of a row · floor · 1x2 · size:60x120x0.1 · stone · set:DUN!,MIN,LAI · var:- · aff:hazard,block · flat · P2 · the wide crossing
- **sewer-channel-strip** — a sewer channel of murky water between stone kerbs, one 5-ft tile of a row · floor · 1 · size:60x60x0.1 · mixed · set:DUN!,MKT · var:shape · aff:hazard · flat · P1 · laid in a row down a sewer
- **pit-open** — an open square pit, sheer sides falling to black · floor · 1 · size:60x60x0.1 · stone · set:DUN!,CRY,RUI,MIN · var:- · aff:trap,hazard · flat · P1 · the pit trap, sprung
- **decal-slime** — patch of green slime · floor · sub · size:36x30x0.1~0.5-2 · organic · set:DUN,LAI,MIN · var:shape · aff:hazard · flat · P2 · sewers, dens; slippery
- **decal-rubble-scatter** — stone chips and dust · floor · sub · size:36x30x0.1~0.5-2.5 · stone · set:RUI,DUN,MIN · var:shape · aff:- · flat · P2 · round rubble piles and collapses
- **decal-straw-scatter** — loose straw on the floor · floor · sub · size:40x36x0.1~0.5-2 · organic · set:DUN,HUT,TAV · var:shape · aff:- · flat · P3 · cell floors
- **decal-claw-marks** — long claw gouges across the floor · floor · sub · size:40x30x0.1~0.5-2.5 · stone · set:LAI,DUN · var:- · aff:- · flat · P2 · the warning before the reveal
- **decal-web-floor** — thick sheet of spider web spread on the floor · floor · 1 · size:60x60x0.1~0.5-2 · organic · set:LAI,DUN,CRY · var:- · aff:hazard · flat · P2 · difficult terrain; burn it
- **decal-drag-marks** — scrape track of a dragged stone block · floor · sub · size:60x24x0.1~0.5-2 · stone · set:DUN,RUI · var:- · aff:- · flat · P3 · beside a sliding block
