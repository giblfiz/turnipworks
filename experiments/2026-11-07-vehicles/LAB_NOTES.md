# Vehicles (helicopters, armoured and police cars, drones), lab notes

Lane `vehicles`, 2026-11-07. Harry: "we maybe need a few more vehicle options... take a peek at 'simplified shadowrun 2' on
your box, and grab a few things from there... choppers, APC, cop car." Source: his rules sheet
`~/projects/dnd/SimplifiedShadowrun2v1.4.pdf` (vehicles and drones list). Generic names only, no licence implied.

- 15:00 orient. Already in the game: car-sedan, car-hatchback (City), motorbike, drone-parked, car-sedan--near-future
  (Cyberpunk). Roster, 10 meshes (tools/make_specs.py): helicopter (light passenger), helicopter-gunship, car-police,
  suv-armoured, van-armoured (the APC / "battlewagon"), drone-quad-light (pistol), drone-quad-heavy (SMG turret),
  drone-hexapod (2 m gun walker), drone-rover-arm, drone-rover-sentry. Left out: the motorcycle and compact car (have them),
  the milspec armoured car (the APC and the SUV cover it), the 10-cm insect spy drone (a speck at table distance).
- Sizes real-world, long axis D (the sprawl cars' convention). The police cruiser is the sedan's box (72x180) so it parks in
  a sedan's place; the helicopters are the game's biggest props (rotor 27 ft and 36 ft): fp `big`, the engine's convention
  for the shipping container (there is no other oversize rule: dims() scales the mesh's largest side to the catalog's).
- Rebase-safe layout (denserooms is tuning the same rooms): own catalog file (objects-vehicles.catalog.md), own recipe file
  (rooms-vehicles.md, BORROWED by nine Modern rooms through build_data.py type:veh), own solver block (veh:solver2, wraps
  KEY programs, edits none). Shelf: a new SECTIONS entry `vehicles` ("Vehicles") in library-index.js.
- 15:03 three Codex plate workers (BRIEF-v-1..3). 15:30 seven plates in; tight margins as before (early_mask pads 6%).
- 15:10 pod c44sd438tkttcn (RTX 4090 $0.89/h, EUR-IS-1, 1.5 h timer + pod dead-man), setup 233 s. 15:18 wave 1 (10 vehicles,
  EARLY=1: meshed before the plate gate answered). Plate gate (plate_read.py, one call): 10 of 10 named as wanted, no text.
- 15:19 Harry, through Fauna: "for modern, we need security cameras for the wall. Also a bunch of desk debris (laptop, CRT,
  mouse, donut)". Added to this batch (pack `desk`, library source moddesk-03, catalog objects-modern-desk.catalog.md): wall
  camera, ceiling dome camera, laptop, CRT, flat monitor, keyboard, mouse, donut, box of donuts, paper coffee cup, desk phone,
  paper stack (12). Plates on three Codex workers; wave 2 on the same pod at 15:29.
- Mesh rules (NOVISION): 21 of 22 accept; camera-security had a floating piece (2%): re-meshed (new seed), accepted.
- Blind table-distance sheet read of the vehicles: 8 of 10 named; drone-quad-heavy read "spider drone" (its landing struts as
  legs), drone-rover-arm "supply crate". Re-plate of the quad: no struts, as if hovering. The rover's re-plate hit the Codex
  plan's usage limit (until Nov 11): the rover was re-meshed from its first plate with a new seed instead.
- Plate read of the desk things: every one named as wanted except that the phone and the papers came back swapped (the
  worker's log and the files' own sizes say each file is what its name says; the mesh read decides).
- Desk tops MEASURED (tools/desk_tops.py, rays down on the cubicle, terminal, reception desks and the workbench) ->
  solver2 DESK_TOPS: the desk things stand on the real work surface, facing the desk's front.
- Orientation (orient_read.py, four turns): car-police front = A, the same as the City sedan's (ref-car-sedan, read with it):
  the cruiser swapped into a sedan's spot faces the traffic as the sedan did.
- 16:17 pod c44sd438tkttcn deleted, verified (REST v2 GET 404, no pod named tw-vehicles): 1.116 h x $0.89 = **$0.99**.
  Split by mesh runs (29): vehicles 12 runs = **$0.41**; cameras and desk things 17 runs = **$0.58**. Plates $0 (Codex
  plan), reads $0 (agy-run).
- Re-meshes after the blind table-distance sheet read: quad-heavy (re-plated: no struts) -> "drone / quadcopter"; rover-arm
  (new seed) -> "rover / tracked robot". The small desk things read poorly ALONE at table distance (first meshes: keyboard
  "pipe segment", donut "apple", box of donuts "pizza box", papers "floor hatch", phone "stapler"; four re-meshed with new
  seeds: still crates and boxes), while the close four-turn reads name them right (keyboard 100, desk phone 100). In the room
  (primed read, cam-read.json): office, lobby and safehouse desks "worked-at", with keyboards, monitors, paperwork, coffee,
  "an open pizza box" (the donuts); the wall camera seen in the office and the lobby, not in the store or server room.
- Rebased on main ffc1ea31 (modtypes: Modern is six buildings; my roles land in them by their rooms, no mapping) and f939b9b7.
  main's local build_data drops the City pack's 62 objects (their GLBs are on no machine): merge_lib.py ADDS this batch to
  main's committed library.json instead (verified: 0 removed, 0 changed, +22; rooms.json: only slots/borrow of 12 rooms,
  no slot entry lost; orient.json +17).
- Golden: the first version put the cameras and desk things in the rooms' `dress` slot and the classic v1 engine scattered
  them on the floor (hideout, office). Now a `gadgets` slot (shelved under Dressing, library-index.js SLOT_ALIAS): golden
  vs main = 74 differences, all in the seven hooked rooms (office, store, lobby, server, rigger, safehouse, rooftop), none
  elsewhere (the street's 4x4 golden rooms are too narrow to park a car).
- Room reads (blind, one call, reads-r1/read-table.json): 9 of 9 named; street "police cruiser with emergency lights";
  rooftop "rooftop helipad" (98) but "helicopter out of scale for the compact rooftop", "no helipad markings"; rigger
  "drones / quadcopters on floor"; safehouse "workstation desk with CRT monitor".
- Targeted read of the street still (work/street-read.txt): the hatchback and the police cruiser at the same kerb both point right, 'same way' (sure 100): the blind read's 'two vehicles head-on' was wrong. The cruiser's facing is the City cars' (all three read front = A in the four-turn read).
- Rebased on main 8c7a9056 (modrooms landed): conflicts in build_data.py (both lanes' blocks kept) and world.js CEILING_FIT
  (range-hood | camera-dome); generated data taken from main, then regen.sh main: library +22, 0 removed, 0 changed;
  rooms.json only slots/borrow of 12 rooms, no slot entry lost; orient.json +17.
- Suites on 8c7a9056 + branch: vehicles.test 1159/1159 (on unchanged main 164/246: fails on old code); library-index 35/35;
  engine npm test green; mod.test 102,968/0; cyb.test 60,668/0; golden vs main 2,772 scenes, 74 differences, all in the seven
  hooked rooms; browser_barcat 8/9 (the "bar" must: the same on unchanged main; every vehicle and desk case passes);
  browser_build 98/99 on 8c7a9056 (PiP label-layout aspect 0.86: the same on unchanged main; an F2-rename miss in an earlier run did not repeat and passes on main).
- After merging, Fauna runs: experiments/2026-11-07-vehicles/integration/regen.sh main (catalog_tool, build_data, orient_set,
  merge_lib, build_types, library_spawns), then copies the binaries (models/*.glb; tools/spawn-tuner/assets/{m,lod,tex}
  and prep/tex-src for the 22 skus) and runs prep/delivery.py.
- Rebased on main 89ba4045 (denserooms: modDense/modTops fill the Modern rooms toward their density): no conflicts; regen.sh
  main: library +22, 0 removed or changed; rooms.json slots/borrow only. The rigger's second drone had less floor left
  (7 of 20 garages): it now takes any free floor, else the small quad (16 of 20). The desks are ours alone: 267 desk
  things on desks over 30 rooms, 0 of anyone else's. Suites: vehicles 1159/1159, mod.test 334,506/0, cyb.test 208,127/0,
  library-index 35/35, engine npm test green.
