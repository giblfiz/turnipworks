# Cyberpunk — the Modern genre's near-future type (the cyberpunk pack, wave 2, 2026-11-07)

The cyberpunk pack is the Modern genre's two types: **City** (wave 1, `objects-modern.catalog.md`: the everyday modern city,
useful to any modern-day game) and **Cyberpunk** (this file: the near-future layer, for Shadowrun-style and other cyberpunk
games). Harry, 2026-11-07: "It is ok to use TM words, as long as we don't pretend we have a license": nothing here is
official or licensed, no logo, no setting's own art; nothing carries words, numbers or logos (the trademark rule). The
magic-supply shop's pieces passed a sensitivity read before any plate (no sacred objects, no symbols: Shadowrun mixes magic
and tech, and the shop sells reagents). Every new sku is tier `mod` (exclusive), so no fantasy room rolls one; the wave-2 LOOKS of roles that had a City mesh (sign-neon--noodle-bowl, --flask, car-sedan--near-future) are tier `cyb`, rolled only by a Cyberpunk room. Glass and
chain-link are seen through and stop feet (`engine/client/vision.js` GLASS AND CHAIN-LINK). Experiment:
`experiments/2026-11-07-cyberpunk-rooms/`.

## C1. Cyberpunk — structure: glass, chain-link, the roof's edge (2026-11-07)

- **wall-glass-curtain** — floor-to-ceiling glass wall section of an office tower · kit · edge · size:60x12x108 · glass · set:CYB! · var:- · aff:block · kit · P1 · a corporate lobby's street front (walls.js PANELS cyb-lobby); seen through, stops feet
- **fence-chain-link** — 5-ft section of chain-link fence on thick posts · kit · edge · size:60x6x96 · metal · set:CYB! · var:- · aff:block · kit · P1 · lock-ups, cages, yards and rooftops; seen through, stops feet
- **gate-chain-link** — chain-link gate with a padlock · kit · edge · size:60x6x96 · metal · set:CYB · var:open · aff:pass,open · kit · P1 · the way into a chain-link cage
- **parapet-roof-low** — low concrete roof parapet section with a coping stone · kit · edge · size:60x12x42 · stone · set:CYB! · var:- · aff:cover · kit · P1 · the edge of a flat roof; half cover, never in the way of sight

## C2. Cyberpunk — rooms' furniture (2026-11-07)

- **surgical-chair** — reclined back-street surgical chair with straps · floor · 1x2 · size:32x78x44 · mixed · set:CYB! · var:- · aff:use,sit · mesh · P1 · THE street clinic's signature
- **surgical-light** — wheeled surgical lamp with a ring of bulbs · floor · sub · size:30x30x84 · metal · set:CYB · var:lit · aff:lit · mesh · P1 · over the surgical chair
- **med-monitor-rig** — rolling cart of medical monitors with glowing pulse lines · floor · sub · size:26x22x62 · metal · set:CYB · var:lit · aff:lit,use · mesh · P1 · beside the chair
- **tool-tray-cart** — steel cart of surgical tools · floor · sub · size:30x18x38 · metal · set:CYB · var:- · aff:loot · mesh · P2 · at the surgeon's hand
- **med-cabinet** — steel medicine cabinet with glass doors · wall · sub · size:36x16x72 · metal · set:CYB · var:- · aff:loot · mesh · P2 · a clinic's walls
- **cyberware-rack** — wall rack of spare robotic arms and legs · wall · 1 · size:60x14x72 · metal · set:CYB! · var:- · aff:loot · mesh · P1 · the ripperdoc's stock; says "cyberpunk" from across the table
- **reception-desk** — long corporate reception desk with a light strip · floor · 1x2 · size:120x36x44 · mixed · set:CYB! · var:lit · aff:cover,use · mesh · P1 · a corporate lobby's signature
- **turnstile-gate** — row of security turnstiles · floor · 1x2 · size:96x30x40 · metal · set:CYB! · var:lit · aff:block · mesh · P1 · between a lobby and the lifts
- **sculpture-abstract** — big abstract chrome ribbon on a plinth · floor · 1 · size:48x48x96 · metal · set:CYB · var:- · aff:cover · mesh · P2 · a lobby's centrepiece
- **planter-modern** — square concrete planter with a clipped tree · floor · sub · size:36x36x66 · stone · set:CYB · var:- · aff:cover · mesh · P2 · lobbies, plazas
- **lobby-bench** — long low padded lobby bench · floor · 1x2 · size:84x30x18 · cloth · set:CYB · var:- · aff:sit · mesh · P2 · lobbies, waiting areas
- **server-rack** — tall server rack with glowing status lights · floor · sub · size:24x42x84 · metal · set:CYB! · var:lit · aff:cover,use,lit · mesh · P1 · in rows; THE server room's signature
- **cooling-unit** — data-centre air-conditioning cabinet · wall · 1 · size:72x36x78 · metal · set:CYB · var:lit · aff:cover · mesh · P2 · the ends of a server room
- **terminal-desk** — workstation desk with three glowing screens · wall · 1x2 · size:72x30x48 · mixed · set:CYB! · var:lit · aff:use,lit · mesh · P1 · the decker's seat: server rooms, safehouses, garages
- **noodle-counter** — steel street-food noodle counter with steaming pots · floor · 1x2 · size:96x30x44 · metal · set:CYB! · var:lit · aff:use,cover · mesh · P1 · a noodle bar's counter, stools along it
- **vending-machine** — glowing drinks vending machine · wall · sub · size:40x34x76 · metal · set:CYB · var:lit · aff:use,lit,cover · mesh · P1 · everywhere: lobbies, capsule hotels, platforms, the noodle bar
- **capsule-pod** — two stacked capsule-hotel sleeping pods · wall · 1x2 · size:48x84x84 · mixed · set:CYB! · var:lit · aff:hide,sit · mesh · P1 · rows of them: a capsule hotel's signature
- **locker-bank** — row of tall steel lockers · wall · 1 · size:72x18x72 · metal · set:CYB · var:- · aff:loot,hide · mesh · P2 · capsule hotels, gyms, back rooms
- **sofa-salvaged** — battered old sofa with taped cushions · floor · 1x2 · size:84x36x32 · cloth · set:CYB · var:- · aff:sit,cover · mesh · P1 · hideouts, squats, safehouses
- **oil-drum-fire** — rusted oil drum with a fire glowing inside · floor · sub · size:24x24x38 · metal · set:CYB! · var:lit · aff:lit,cover · mesh · P1 · the gang hideout's light
- **mattress-floor** — worn mattress on the floor with a blanket · floor · 1 · size:40x76x10 · cloth · set:CYB · var:- · aff:sit · mesh · P2 · squats, hideouts, safehouses
- **motorbike** — chunky near-future street motorbike · floor · 1x2 · size:30x84x46 · metal · set:CYB · var:- · aff:cover,use · mesh · P1 · gangs and riggers
- **gear-case-stack** — stack of hard plastic equipment cases · floor · sub · size:40x28x36 · mixed · set:CYB · var:- · aff:cover,loot · mesh · P1 · a runner's gear: safehouses, hideouts, garages
- **weapon-locker** — open steel weapons locker with rifles inside · wall · sub · size:36x20x72 · metal · set:CYB · var:- · aff:loot · mesh · P1 · safehouses and hideouts
- **curio-shelf** — tall shelf crammed with jars, herbs, bones and crystals · wall · 1 · size:60x16x84 · wood · set:CYB! · var:lit · aff:loot · mesh · P1 · the magic-supply shop's walls
- **display-counter-glass** — glass-topped shop counter of stones and crystals · floor · 1x2 · size:72x26x40 · mixed · set:CYB · var:- · aff:loot,cover · mesh · P1 · the magic-supply shop's counter
- **crystal-display** — big glowing crystal cluster on a wooden stand · floor · sub · size:24x24x40 · mixed · set:CYB · var:lit · aff:lit,loot · mesh · P2 · the magic-supply shop's window
- **drone-parked** — quadcopter drone resting on its case · floor · sub · size:36x36x16 · mixed · set:CYB! · var:lit · aff:use · mesh · P1 · a rigger's garage, a safehouse
- **workbench-garage** — heavy garage workbench with a pegboard of tools · wall · 1x2 · size:84x30x72 · metal · set:CYB · var:- · aff:use · mesh · P1 · garages and workshops
- **tool-chest-rolling** — red rolling tool chest · wall · sub · size:36x20x44 · metal · set:CYB · var:- · aff:loot · mesh · P2 · garages
- **engine-hoist** — yellow shop engine hoist holding an engine · floor · 1x2 · size:36x72x72 · metal · set:CYB · var:- · aff:use,cover · mesh · P2 · a rigger's garage
- **safe-floor** — heavy steel floor safe with a dial · floor · sub · size:24x24x30 · metal · set:CYB · var:- · aff:loot · mesh · P2 · safehouses, back rooms
- **video-screen** — big wall-mounted flat screen glowing · wall · 1 · mount:60 · size:72x6x42 · mixed · set:CYB · var:lit · aff:lit · mesh · P1 · lobbies, bars, safehouses
- **light-wall-strip** — caged fluorescent strip light for a wall · wall · sub · mount:84 · size:48x8x10 · metal · set:CYB · var:lit · aff:lit · mesh · P2 · hideouts, garages, stairwells

## C3. Cyberpunk — the rooftop (2026-11-07)

- **hvac-unit** — big rooftop air-conditioning unit with fans on top · floor · 2x2 · size:60x96x48 · metal · set:CYB! · var:- · aff:cover,climb · mesh · P1 · the rooftop's signature; full cover
- **water-tank-roof** — wooden rooftop water tank on a steel stand · floor · 2x2 · size:96x96x168 · wood · set:CYB! · var:- · aff:cover,climb · mesh · P1 · a city rooftop's silhouette
- **satellite-dish** — satellite dish on a weighted frame · floor · 1 · size:48x48x60 · metal · set:CYB · var:- · aff:cover · mesh · P2 · rooftops
- **roof-access-hut** — the stairwell's hut on a flat roof, a steel door · floor · big · size:96x72x108 · stone · set:CYB! · var:lit · aff:cover,block,lit · mesh · P1 · the way onto the roof
- **antenna-mast** — red-and-white lattice antenna mast · floor · sub · size:30x30x144 · metal · set:CYB · var:lit · aff:lit · mesh · P2 · rooftops
- **roof-vent** — cluster of rooftop vent pipes · floor · sub · size:36x24x36 · metal · set:CYB · var:- · aff:cover · mesh · P2 · rooftops
- **billboard-roof** — rooftop billboard screen on a steel scaffold · floor · big · size:180x36x144 · metal · set:CYB! · var:lit · aff:lit,cover · mesh · P1 · the neon city's skyline
- **floor-roof-gravel** — tar-and-gravel flat roof · kit · 1 · size:60x60x0.1 · stone · set:CYB · var:- · aff:- · flat · P1 · flat city roofs
- **floor-raised-tile** — grey perforated raised-floor tiles · kit · 1 · size:60x60x0.1 · metal · set:CYB · var:- · aff:- · flat · P1 · server rooms
