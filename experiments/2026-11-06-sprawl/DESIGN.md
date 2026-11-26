# Sprawl (working name): the modern / near-future city pack, 2026-11-06

Harry: "Shadowrun mostly meaning shadowrun assets packs ... SR drags modern in, so it probably ends up quite large."
The pack is a generic modern-city and near-future-street pack. It uses no game's trademarks or setting names: no
megacorps, no world names, no places, no characters, no logos, and no legible words or numbers on any asset (the plate
gate rejects any plate where Gemini can read text).

**Name, proposed (Harry picks):** 1. **Sprawl** (the working name; one generic word. Note that Gibson's novels call
their city "the Sprawl". It is a common noun, not a mark, but the echo is there). 2. **Neon & Concrete**. 3. **Streetlevel**.
Whether TW may say "for Shadowrun-style games" anywhere is Harry's question. Nothing here says it.

## Where it sits in the Build menu

There is a new genre, **Modern** (genre key `modern`, beside `fantasy`), with three room types:

| type code | label | what | wave |
|---|---|---|---|
| `MOD` | City (the modern core) | apartment, office, bar & nightclub, street, alley, parking garage, convenience store, warehouse | **1** |
| `CYB` | Cyberpunk (the near-future layer) | street clinic, corporate lobby, security checkpoint, server room, fixer's back room, squat, rooftop, noodle stall | 2 |
| `STM` | Street magic | talisman shop, lodge (ritual room) | 2 |

Every modern mesh carries the exclusive sku tier `mod` (`build_data.py` EXCLUSIVE), so no fantasy room ever rolls a sofa,
a car or a fluorescent tube. Modern rooms list `tiers: ['mod']`, which makes `chooseSku` prefer the modern sku of a
shared role (`sofa--mod` over the fantasy sofa). New roles (`car-sedan`, `dumpster`) are modern-only by construction
(`o.only`). Modern room recipes name only roles that have a `mod` sku, or genre-neutral ones (a cardboard box).

## Full roster (all three waves)

Counts are meshes to generate (TRELLIS), plus flats (floor and decal textures on the free Codex image route; no mesh).

### Shell kit (structure), shared by every modern room

| family | pieces | wave | count |
|---|---|---|---|
| `drywall` (painted plaster interior, skirting board) | wall-straight (+ s2), wall-doorway, wall-window-small (aluminium casement) | 1 | 4 |
| `city-brick` (red city brick, concrete sill and lintel) | wall-straight (+ s2), wall-doorway, wall-window-small (steel-framed sash) | 1 | 4 |
| `concrete` (cast concrete, form-tie dots) | wall-straight (+ s2), wall-doorway, wall-window-small (high wired-glass strip), wall-roller-shutter | 1 | 5 |
| `storefront` (aluminium-framed shop glass) | wall-straight (glass with a stall riser), wall-doorway (glass door) | 1 | 2 |
| doors (leaves in a doorway) | door-flush (painted interior door), door-steel (grey fire door with a push bar) | 1 | 2 |
| `glass-curtain` (office tower glazing) | wall-straight, wall-doorway (revolving door) | 2 | 2 |
| `corrugated` (corrugated sheet on steel, the warehouse and the squat) | wall-straight (+ s2), wall-doorway | 2 | 3 |
| `chain-link` fence (kit edge) | fence section, gate | 2 | 2 |
| elevator doors, security door (keypad) | wall-elevator--concrete, door-security | 2 | 2 |

### Lights (meshes; the engine supplies the glow)

| sku | wave | note |
|---|---|---|
| `light-fluorescent` | 1 | ceiling tube fitting: steady cool-white light, no flicker |
| `sign-neon` | 1 | wall sign, a cocktail-glass shape in pink and cyan tube, no words |
| `streetlight` | 1 | 18-ft pole with a cobra head: warm sodium light, outdoors |
| `lamp-floor--mod` | 1 | apartment floor lamp |
| `sign-neon--s2`, `--s3` | 2 | more shapes (noodle bowl, an eye, an arrow), more colours |
| `screen-wall` | 2 | wall screen (a glowing panel; no image on it) |

### Wave 1: the modern core (8 rooms, about 58 meshes and 13 flats)

| room key | label | cells | walls | signature (what names it from above) | new meshes |
|---|---|---|---|---|---|
| `mod-apartment` | Apartment | 6x5 | drywall | sofa facing a TV, a bed, a kitchenette run | sofa--mod, armchair--mod, coffee-table, tv-stand, bed-double--mod, kitchenette, fridge, table-dining--mod, chair-plain--mod, plant-pot--mod (10) |
| `mod-office` | Office floor | 8x6 | drywall | a grid of cubicle desks with monitors | cubicle-desk, office-chair, filing-cabinet, water-cooler, photocopier, whiteboard (6) |
| `mod-bar` | Bar & nightclub | 8x6 | city-brick | long bar with stools, neon, booths, a pool table | bar-counter--mod, back-bar-shelves--mod, stool-bar--mod, booth-seat, table-cafe, table-billiards--mod, jukebox, dj-booth, speaker-stack (9) |
| `mod-street` | City street | 10x5 | none (outdoor) | parked cars on asphalt, a crosswalk, streetlights | car-sedan, car-hatchback, fire-hydrant, trash-can-city, newspaper-box, traffic-cone, bench-street--mod (7) |
| `mod-alley` | Back alley | 8x2 | city-brick | a dumpster and trash bags | dumpster, trash-bags, cardboard-boxes, pallet-stack, oil-drum, ac-unit (6) |
| `mod-garage` | Parking garage | 8x6 | concrete | cars in painted bays between concrete pillars | pillar-concrete, jersey-barrier, parking-barrier (3; the cars are shared) |
| `mod-store` | Convenience store | 6x5 | storefront + drywall | aisles of stocked shelves and glowing drink coolers | store-shelving, drinks-cooler, checkout-counter, atm, coffee-station (5) |
| `mod-warehouse` | Warehouse | 8x8 | concrete | tall pallet racking, a forklift, a shipping container | pallet-racking, pallet-boxes, forklift, shipping-container (4) |

Plus the wave-1 shell kit (17) and lights (4): **about 75 meshes in wave 1** (54 props + 17 kit + 4 lights).

Flats, wave 1 (13): floor-carpet-office, floor-laminate, floor-vinyl-tile, floor-concrete, floor-concrete-garage,
floor-asphalt, floor-sidewalk, floor-tile-bar, decal-crosswalk, decal-road-line, decal-parking-bay, decal-oil-stain,
decal-manhole.

### Wave 2: the near-future layer (8 rooms, about 45 meshes and 6 flats)

| room key | label | signature | new meshes |
|---|---|---|---|
| `cyb-clinic` | Street clinic | a reclined surgical chair under a lamp ring, monitors, cooler boxes | surgical-chair, med-monitor-rig, iv-stand, med-cabinet, cooler-medical, tool-tray-cart (6) |
| `cyb-lobby` | Corporate lobby | a long reception desk, turnstiles, glass walls, an abstract sculpture | reception-desk, turnstile-gate, lobby-sofa, sculpture-abstract, planter-modern (5) |
| `cyb-checkpoint` | Security checkpoint | a walk-through scanner arch and a bag belt | scanner-arch, xray-belt, guard-desk, barrier-post (4) |
| `cyb-server` | Server room | rows of blinking racks on a raised floor | server-rack (+ s2), cooling-unit, cable-tray, terminal-desk (5) + flat floor-raised-tile |
| `cyb-fixer` | Fixer's back room | a desk of screens, a safe, crates of gear, a leather couch | desk-terminal, safe-floor, weapon-locker, couch-leather, gear-case-stack (5) |
| `cyb-squat` | Squat | mattresses, a burning barrel, tarp shelters | mattress-floor, oil-drum-fire, tarp-shelter, shopping-cart, sofa-salvaged (5) |
| `cyb-rooftop` | Rooftop | HVAC boxes, a water tank, a dish, the access hut | hvac-unit, water-tank-roof, satellite-dish, roof-access-hut, antenna-mast, roof-vent (6) + flats roof-gravel, roof-membrane |
| `cyb-noodle` | Noodle stall | a food cart under an awning, stools, steam | noodle-cart, stool-street, propane-tank, crates-produce--mod (4) |

Plus near-future props shared by many rooms: vending-machine, terminal-kiosk, drone-parked, motorbike (4) and the wave-2
shell/light rows above (about 14). **About 63 meshes in wave 2.**

### Wave 3: magic in the city (2 rooms, about 11 meshes and 3 flats)

| room key | label | signature | new meshes |
|---|---|---|---|
| `stm-talisman` | Talisman shop | crammed shelves of jars, bones and crystals over a glass counter; dried herbs hanging | shelf-curios--mod, display-case-glass, counter-shop--mod, herb-drying-rack, crystal-display (5) |
| `stm-lodge` | Lodge (ritual room) | a painted circle on the floor, a low altar, cushions, candles, a totem post | altar-low, candle-cluster, floor-cushions, totem-post, incense-stand, bookshelf--mod (6) + flats ritual-circle, rug-woven--mod, decal-chalk-sigils |

### Totals and cost

| | meshes | flats |
|---|---|---|
| wave 1 (modern core) | ~75 | 13 |
| wave 2 (near-future) | ~63 | 6 |
| wave 3 (street magic) | ~11 | 3 |
| **all** | **~150** | **22** |

Plates and flats are on the Codex image route (ChatGPT plan, $0). Gemini reads are on agy-run ($0). The cost is
meshing: a RunPod RTX 4090 at about $0.69 an hour (A100 $1.39-1.79) meshes about 150 an hour once warm; setup and model
load take about 6 min a session. Measured precedents: inn-02 $0.87 per 100 meshes, the mine $6.20 for 30 (mostly a
pod left idle), openmesh $1.23 for 27. Fal TRELLIS.2 is $0.30 a mesh (no fal key in this session's environment).

- **Wave 1 estimate: $2-5 on RunPod** (75 meshes plus about 30% re-rolls = ~100 runs, one 4090 pod for 1.5-3 h).
  On fal the same would be about $30.
- **Waves 2 and 3 estimate: $3-7 on RunPod** (~75 meshes + re-rolls), or about $30 on fal.
- Ceiling I hold myself to for wave 1: $15 (stop and report long before $40).

**Wave 1 actual (2026-11-06):** 74 meshes in two waves on one RTX 4090 pod (0.861 h, median 17 s a mesh, 0 worker
failures), **$0.77**; 73 ship (one stray re-plate discarded). Plates (77 Codex images), 8 floors, 3 strips, 3 decals and
10 icons on the Codex route, $0; Gemini reads on agy-run, $0. The cost of the wave was TIME on the shared Gemini lock
(8 to 22 calls queued by seven lanes), not money. **Estimate for waves 2 and 3: about 75 meshes + 20% re-rolls = ~90
runs, $1-2 on one 4090 pod** (fal would be ~$27); the time is the agy queue, so read in batches (12 meshes or 8 rooms a call).
