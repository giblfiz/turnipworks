# Modern rooms — the penthouse, bathroom, restroom, restaurant kitchen, fire escape and elevator (modrooms lane, 2026-11-07)

Harry, 2026-11-07: "we probably also need a lux apartment option, and definitely need bathroom and fire escape"; then a
restaurant kitchen and "oh and elevators!". Objects those rooms want and the library lacked (`experiments/2026-11-07-modrooms/`).
Every new sku is tier `mod` (exclusive: no fantasy room rolls one; `tools/spawn-tuner/build_data.py`, block
`type:modrooms`). What the library already had is REUSED, not made again: the modern sofa, lamp, plants, sculpture, wall
screen, glass wall, bar stools and brick walls, and many fantasy roles that read as present-day at table distance (food,
kitchenware, rugs, linen: their own catalog lines carry `MOD` in `set:`; the vetted list is
`experiments/2026-11-07-modrooms/reuse-borrow.json`). Nothing carries words, numbers or logos (the trademark rule).

## X1. Modern rooms — structure, connectors (2026-11-07)

- **wall-tiled** — wall section tiled in white subway tiles with a sage band · kit · edge · size:60x12x108 · stone · set:MOD · var:- · aff:block · kit · P1 · bathrooms, restrooms, kitchens (walls.js PANELS: a special panel of drywall)
- **stair-fire-escape** — steel fire-escape stair flight with handrails, one storey · kit · 1x2 · size:40x110x120 · metal · set:MOD!,CYB · var:- · aff:pass,climb · kit · P1 · a fire escape: one flight a landing (core/stairs.js STAIR_ROLES: walked)
- **ladder-fire-escape** — steel fire-escape drop ladder · wall · edge · size:24x8x120 · metal · set:MOD,CYB · var:- · aff:pass,climb · thin · P1 · from the lowest landing down to the street (hopped, as a ladder)
- **elevator-car** — open-topped elevator cab, a platform pawns stand on · floor · 1 · size:60x60x96 · metal · set:MOD!,CYB · var:- · aff:pass,carry · mesh · P1 · rides its shaft (engine/core/elevator.js): moved up or down a floor
- **elevator-doors** — elevator landing doors in a steel frame · wall · 1 · size:60x10x96 · metal · set:MOD,CYB · var:lit · aff:pass · mesh · P1 · one on each floor the shaft serves

## X2. Modern rooms — furniture and fittings (2026-11-07)

- **sofa-sectional** — big L-shaped sectional sofa · floor · 2x2 · size:108x84x32 · cloth · set:MOD!,CYB · var:- · aff:sit,cover · mesh · P1 · THE penthouse's signature, facing the glass
- **lounge-chair** — leather lounge chair with its ottoman · floor · 1 · size:34x54x34 · cloth · set:MOD,CYB · var:- · aff:sit · mesh · P2 · beside the sectional
- **kitchen-island** — marble-topped kitchen island with a breakfast bar · floor · 1x2 · size:96x40x38 · stone · set:MOD,CYB · var:- · aff:cover,use · mesh · P1 · before the fitted kitchen
- **kitchen-run-lux** — luxury fitted kitchen run with an oven column · wall · 1x2 · size:120x26x84 · mixed · set:MOD,CYB · var:- · aff:use · mesh · P1 · a penthouse's kitchen wall
- **bar-cart** — brass bar cart with decanters · floor · sub · size:30x18x34 · metal · set:MOD,CYB · var:- · aff:loot · mesh · P2 · by the sofa
- **art-canvas** — large abstract painting on a deep canvas · wall · sub · mount:54 · size:60x4x42 · mixed · set:MOD,CYB · var:- · aff:- · mesh · P2 · walls that are not glass
- **bed-platform** — low king-size platform bed with an upholstered headboard · floor · 2x2 · size:80x88x36 · cloth · set:MOD,CYB · var:- · aff:sit · mesh · P2 · a penthouse's open loft
- **dining-set-lux** — long stone dining table with six chairs · floor · 2x2 · size:96x66x32 · stone · set:MOD,CYB · var:- · aff:sit,cover · mesh · P2 · by the kitchen
- **piano-grand** — black grand piano with its bench · floor · 1x2 · size:60x78x40 · wood · set:MOD!,CYB · var:- · aff:use,cover · mesh · P1 · a penthouse's far corner
- **toilet** — white porcelain toilet · wall · sub · size:20x28x30 · ceramic · set:MOD!,CYB · var:- · aff:use,sit · mesh · P1 · bathrooms
- **sink-vanity** — bathroom vanity with a basin · wall · sub · size:36x22x34 · ceramic · set:MOD,CYB · var:- · aff:use · mesh · P1 · bathrooms
- **mirror-bathroom** — bathroom mirror with a light bar · wall · sub · mount:52 · size:30x4x36 · glass · set:MOD,CYB · var:lit · aff:lit · mesh · P1 · over a basin
- **bathtub** — white enamel bathtub · wall · 1x2 · size:60x30x24 · ceramic · set:MOD!,CYB · var:- · aff:use,cover · mesh · P1 · THE bathroom's signature, along the far wall
- **shower-stall** — glass-walled shower cubicle · floor · 1 · size:36x36x84 · glass · set:MOD,CYB · var:- · aff:use · mesh · P1 · a bathroom's corner
- **towel-rail** — chrome towel rail with towels · wall · sub · mount:40 · size:24x5x32 · metal · set:MOD,CYB · var:- · aff:- · mesh · P3 · bathrooms
- **toilet-stall** — public restroom toilet cubicle · floor · 1 · size:36x60x72 · mixed · set:MOD!,CYB · var:- · aff:use,hide · mesh · P1 · a restroom's row
- **sink-row** — restroom counter with three basins · wall · 1x2 · size:96x24x34 · stone · set:MOD,CYB · var:- · aff:use · mesh · P1 · a restroom's side wall
- **urinal** — wall urinal with a privacy divider · wall · sub · size:24x18x48 · ceramic · set:MOD,CYB · var:- · aff:use · mesh · P2 · a restroom's other side wall
- **table-prep-steel** — stainless steel kitchen prep table · floor · 1x2 · size:72x30x36 · metal · set:MOD,CYB · var:- · aff:use,cover · mesh · P1 · the prep line facing the range (a surface: food is set on it)
- **range-commercial** — commercial six-burner gas range · wall · 1x2 · size:60x34x36 · metal · set:MOD!,CYB · var:lit · aff:use,hazard · mesh · P1 · THE kitchen's signature, on the far wall
- **range-hood** — stainless canopy extractor hood · ceiling · 1x2 · size:72x42x24 · metal · set:MOD,CYB · var:- · aff:- · mesh · P2 · over the range (drawn from a pawn's eyes only)
- **cooler-walkin-door** — walk-in cooler door in its insulated front · wall · 1 · size:60x10x96 · metal · set:MOD,CYB · var:- · aff:use · mesh · P1 · a kitchen's side wall
- **dish-station** — restaurant dish pit with sinks and a dishwasher · wall · 1x2 · size:96x30x72 · metal · set:MOD,CYB · var:- · aff:use · mesh · P1 · by the kitchen door
- **pot-rack-wall** — wall rack of hanging pots and pans · wall · 1 · mount:60 · size:60x14x48 · metal · set:MOD,CYB · var:- · aff:loot · mesh · P2 · over the prep line
- **shelving-wire** — wire shelving of dry goods · wall · 1 · size:48x20x72 · metal · set:MOD,CYB · var:- · aff:loot · mesh · P1 · kitchens, storerooms
- **fridge-reach-in** — two-door steel reach-in fridge · wall · 1 · size:54x32x80 · metal · set:MOD,CYB · var:lit · aff:use · mesh · P1 · kitchens

## X3. Modern rooms — floors (2026-11-07)

- **floor-tile-bath-hex** — small white hexagonal bathroom tiles · kit · 1 · size:60x60x0.1 · ceramic · set:MOD · var:- · aff:- · flat · P1 · bathrooms, restrooms
- **floor-marble-slab** — pale marble floor of big square slabs · kit · 1 · size:60x60x0.1 · stone · set:MOD · var:- · aff:- · flat · P1 · penthouses, lobbies
- **floor-quarry-tile** — red quarry tile kitchen floor · kit · 1 · size:60x60x0.1 · ceramic · set:MOD · var:- · aff:- · flat · P1 · restaurant kitchens
- **floor-grating-steel** — steel bar-grating walkway · kit · 1 · size:60x60x0.1 · metal · set:MOD · var:- · aff:- · flat · P1 · fire escapes, catwalks
