# Modern corridors — recipes for the four corridors of the Modern genre (modhalls lane, 2026-11-07)

Harry: "definitely modern hallways as well". Room definitions: `tools/spawn-tuner/build_data.py`, block `type:modhalls`;
programs: `tools/spawn-tuner/js/solver2.js`, block `type:modhalls` (one program, four tables, as the fantasy halls'
`buildings:solver2.halls`); walls: `tools/spawn-tuner/js/walls.js`, block `type:modhalls`. Every corridor is a `passage`:
the whole-building generator's spine in the Modern buildings (engine/tools/modern_buildings.json `hall`). Roles without a
modern sku (the runner, the potted palm) are the library's own, reused: only those in MX_BORROW (solver2.js).

### mod-apartment-hallway P2
- anchor: sconce-wall-modern
- furnish: fire-extinguisher, exit-sign, trash-chute-hatch, mailbox-bank, laundry-cart, houseplant, planter-modern, elevator-car, elevator-doors
- light: sconce-wall-modern
- dress: rug-runner, art-canvas

### mod-office-corridor P2
- anchor: light-fluorescent
- furnish: fire-extinguisher, exit-sign, notice-board-cork, water-cooler, vending-machine, recycling-bins, houseplant, planter-modern, lobby-bench, elevator-car, elevator-doors
- light: light-fluorescent
- dress: whiteboard, art-canvas

### mod-hotel-corridor P2
- anchor: sconce-wall-modern
- furnish: fire-extinguisher, exit-sign, ice-machine, room-service-cart, housekeeping-cart, luggage-cart, planter-modern, palm-potted, elevator-car, elevator-doors
- light: sconce-wall-modern
- dress: rug-runner, art-canvas

### mod-service-corridor P2
- anchor: pipe-run-wall
- furnish: fire-extinguisher, exit-sign, breaker-panel, mop-bucket, shelving-wire, locker-bank, tool-chest-rolling, cardboard-boxes, oil-drum
- light: light-fluorescent, light-wall-strip
- dress: trash-bags
