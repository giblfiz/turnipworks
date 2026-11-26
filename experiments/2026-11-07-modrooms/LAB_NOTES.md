# Modrooms lane (Modern genre: penthouse, bathroom, restroom, restaurant kitchen, fire escape, elevator), lab notes

Lane `modrooms`, 2026-11-07. Harry on the Modern City / Cyberpunk packs: "we probably also need a lux apartment option, and
definitely need bathroom and fire escape." Then: a commercial kitchen; "is there anything we can bring over or re-use from
our existing model sets?"; "oh and elevators!"; ruling: "fire escape is basically just a stairwell ... elevator is maybe
just ... a shaft and an object, and if a pawn stands on the object (car) and you move it up, it takes everything on it up".
Carrying riders is the `riders` lane's (a global rule); this lane builds the shaft and the car.

- 15:05 orient. Precedent tools copied from ../2026-11-07-cyberpunk-rooms (tools/, integration/, flats/), lane names
  renamed (src modrooms-03, flats modrooms-flats-03, run prefix modrooms, pod tw-modrooms). Main's git-ignored files linked
  per file (integration/link_main_binaries.py: 100,384 links, 2,017 copies).
- Vertical map (an Explore read of engine/core/stairs.js, height.js, holes.js, vision.js, docs/VERTICAL.md): a level is a
  10-ft band; a stair is an object of the LOWER room whose catalog ROLE makes it a connector (STAIR_ROLES); flights are
  walked (stairWalk), ladders and spirals hopped (stairHop); a rolled stair under no floor is silent furniture and opens
  the floor the day a room is drawn above. stairCore = the switchback the building generator uses. No metal stair, no
  mod-tier stair in the library; modOnly / cybOnly refuse any role without a modern sku.
- RunPod balance $21.57, no pods. fal empty (not used).
- 15:15 31 mesh specs (tools/make_specs.py): penthouse 9, bathroom + restroom 10 (one a tiled wall panel), kitchen 8,
  fire escape 2 (a steel flight, a drop ladder), elevator 2 (an open-topped cab, landing doors). Four Codex plate workers.
  Flats (4 floors, 6 icons) on flats/gen.py, one request at a time.
- Reuse first (Harry): a sub-agent renders the plausible fantasy/regional roles (food, kitchenware, books, plants, rugs,
  linen) and gets ONE batched Gemini era read per sheet; accepted roles join the Modern rooms by catalog multi-set
  membership (set:...,MOD) and an explicit borrow list in the solver block (reuse-borrow.json).
- 15:28 RunPod: no 4090 in EUR-IS-1 (create refused, no pod made); one A100 80 GB pod 5w9dg77tifyfgx ($1.79/h), setup
  185 s, model load 180 s. 29 plates EARLY-meshed (3 resident workers), then the last 2; median 43 s a mesh, 0 failures.
  Deleted 16:01, verified gone by the API (no pod named tw-modrooms): 0.567 h x $1.79 = **$1.01**.
- Plates: 31 on four Codex workers (15:15-15:32), $0. Flats: 4 floors + 6 icons on gen.py, $0. Then Codex's image quota
  ran out ("usage limit ... try again at Nov 11th"): the elevator doors' re-plate (their mesh is a 3.3-ft-deep frame,
  the gate's footprint rule) could not run; accepted by qa/overrides.json and laid squashed to a 1-ft panel instead.
- Plate gate blind read, batch 1 (15 plates, one agy call): every one named as asked, "modern", no text.
- Mesh rules (Blender, NOVISION): 31 accept (one by override, above).
- Engine: the steel flight and the drop ladder join STAIR_ROLES; the range hood is a CEILING_FIT (drawn from the eyes only);
  light types for the mirror, the lift's lamp, the range, the reach-in; core/elevator.js (the car's deck is ground in
  height.js baseUnder; the shaft's stops are read off the holes over the car); client/elevator.js + three commands.
- walls.js: an EN SUITE rule (ROLES[type].suiteOf): a bathroom against a flat opens into it; the flat keeps its own doors.
- Traps found: tile PANELS are walls, not windows (ccmPanels made every tiled wall a "window": nothing tall against it);
  runtime.sh run with a sku list wipes the results file for every other sku (build_data then drops their bounds and every
  room "fails"): always finish with a full run.
- REUSE (Harry: "fantasy surely has some useful stuff"): a sub-agent pruned 481 candidates to 154 roles, rendered 177
  looks at table distance and read them blind in 6 agy calls: 85 roles accepted (reuse-borrow.json; overrides in
  reuse-overrides.json). Almost every container (barrels, kegs, sacks, buckets), every book, bottle, mug, knife, candle,
  broom and mop read medieval. 45 are used now (integration/borrow_sync.py: MX_BORROW in solver2.js, `MOD` added to their
  own catalog lines' set:): the kitchen's food, pans, plates, crates and wall racks; the penthouse's rugs, plants, bust,
  flowers, tea tray, wine rack; the bathroom's towels, mat, pot plant; the fire escape's pot plants; the iron railing.
- Rebased on main ffc1ea31 (modtypes: Modern = six buildings). modern_buildings.json: penthouse APT+OFC, exec penthouse
  OFC+APT, bathroom APT+BAR+OFC, restroom BAR+OFC+SHP, kitchen BAR+SHP, fire escape APT; the elevator car and doors are
  on the penthouses' shelves (APT, OFC). Then on 1abdda72 (riders): the car moves by app.liftTo, its carry list inside the
  car's own object.move; the riders' topOf asks core/elevator.js carDeckY for a car (the cab's floor, 12.4% of its box:
  measured), so an AI seat's data agrees with the drawn floor. The car sized to its own proportions at 5 ft wide (the
  catalog's 60x60x96 box made it 8 ft wide).
- Generated data after each rebase: integration/regen.sh starts from main's committed library and adds only this batch
  (library.json: +35 objects, 0 removed, 0 others changed; rooms.json +6; library-spawns.json: +6 rooms, 0 others changed).
- Blind reads of the game's stills (integration/engine_read.py, one agy call a set): all six rooms named at 95-98, every one
  "modern", nothing called medieval (the borrowed food, rugs, plants and bust pass in the room). Round 1 called the tiled
  wet-room walls "distressed", "torn, paper-like" in all three: the tiles are OFF by default now (walls.js MX_TILES) and
  round 2 lost the complaint. A targeted read of the fire escape from above: "outside stair: yes", two landings and a
  flight seen, but it called the flight "rotated 10-15 degrees, clipping the grating"; the mesh is axis-aligned (PCA of its
  plan: 90.1 deg) and the data's flights stand square on their cells (mx.test climb), so that one needs a human look.
  The elevator stills read as an office; the cab itself is not named from the table (it reads as a cabinet).
- Rebased on main bc5cdd64. Data regenerated (regen.sh), then kept to main + this lane only: library.json +35 objects
  (0 removed, 0 others changed), rooms.json +6, library-spawns.json +6 rooms (main's mes-ballcourt line kept: it re-solves
  differently on main's own code), catalog/out: only this lane's lines (other lanes' undrifted outputs restored).
- Suites (branch on bc5cdd64): mx.test 28,964 / 0; elevator.test 14/14; mod.test 95,058 / 0; cyb.test 58,206 / 0;
  modern_buildings 93/93; engine npm test green (library-index 35/35, riders 29/29); stairs 95/95, levels 37/37,
  grandstair 555/555, riders_relay 20/20, vision 13/13; browser_modrooms 34/34, browser_cyberpunk 28/28, browser_riders
  36/36, browser_fpv 81/81. browser_barcat 8/9 ("bar": a figure outranks the bar) and darkness 11/12 (flavor-lamp) fail
  the same on unchanged main (a throwaway worktree of f939b9b7 on USB, removed).
