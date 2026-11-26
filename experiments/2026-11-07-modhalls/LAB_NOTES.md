# Modhalls lane (Modern genre: corridors), lab notes

Lane `modhalls`, 2026-11-07, branch `modhalls` off main 8c7a9056. Harry: "definitely modern hallways as well". Brief: an
apartment-building hallway, an office corridor, a hotel corridor, a service corridor if cheap; study how fantasy does
corridors and make the Modern buildings' generated plans use these where fantasy buildings use theirs; an elevator landing
in an office / apartment corridor if the plan generator allows.

- 17:15 orient. Lane rules read. Precedents: wiki `projects/3d-vtt/whole-buildings/`, docs/BUILDINGS.md, the fantasy halls
  (solver2.js `buildings:solver2.halls`, walls.js `buildings:walls.halls`), the modrooms lane's tools and integration.
- What fantasy does: every building type has ONE hallway room type (`hall` in BUILDING_TYPES; for a type with no table
  entry, programmeFor() derives it: the first `passage`-role room whose key matches HALL_RE /hallway|passage|corridor/).
  The packed solver lays it as the wing's corridor off the hub, the corridor back from the hub on a deep plot, and every
  upper floor's corridor over the stair core; it is dressed LIGHTLY (through-line first, a light every ~12 ft, at 2 cells
  wide now and then one thing against a wall, at 1 cell wide nothing on the floor).
- FOUND: the Modern buildings had no corridor room, so `packed()` fell back to `hallT = hub.key`: a generated apartment
  block's corridors were one-cell-wide "Apartment" rooms, an office tower's "Corporate lobby" rooms (checked on main's code:
  every hall-role room of APT/OFC/BAR/SHP/WHS/HID plans is the hub's type).
- Design: four passage rooms (`mod-apartment-hallway`, `mod-office-corridor`, `mod-hotel-corridor`, `mod-service-corridor`),
  one program with four tables (solver2.js `type:modhalls`, modelled on hallDress), `hall` per building in
  modern_buildings.json, buildings.js `buildingRoles` (hub + hall; a corridor the building lists but does not name is
  `hall: false` and never laid as a leaf: the hotel corridor sits in the Apartment block's tray beside the capsule hotel).
- Reuse first: doors (flush, steel), the runner (MX_BORROW: the modrooms lane's vetted list already had it, and the potted
  palm), houseplant, planter-modern, water cooler, vending machine, lockers, bench, whiteboard, art canvas, fluorescent
  panels and strip lights, wire shelving, oil drums, boxes, tool chest. New: 15 specs (tools/make_specs.py).
- The library's runner is a 6-ft-wide flat: a 5-ft corridor never got one. The corridor lays it smaller, proportions kept,
  pieces end to end.
- PLATES: Codex's image quota is gone until Nov 11 and fal is empty. agy-run's image tool works (Gemini
  `gemini-3.1-flash-image`, subscription): tools/plates_agy.py, 4 prompts a call, flat chroma blue, BiRefNet matte (all 11
  "pass"). 11 plates 17:22-17:31, then `429 RESOURCE_EXHAUSTED ... resets 2026-11-08T06:18Z`: housekeeping cart, pipe run,
  mop bucket and breaker panel left. Those four: FLUX.1-schnell (Apache-2.0) on the RunPod pod (tools/flux_plates.py),
  weights in the pod's /dev/shm (the container disk is 40 GB).
- 17:42 RunPod: one A100 80 GB pod 8dwtlzln8bhvlm ($1.79/h), deletion timer 1.5 h, pod-side dead-man's switch.
- THE LIFT: buildings.js `findLift` (opts.lift; modern_buildings.json `"lift": true` on APT and OFC): one square that is the
  hub on the ground and a corridor on every floor above, its front square circulation on every floor, never a door's or the
  core's square, never cutting a floor's circulation (BFS over door squares, the stair's foot and landing). buildplan.js lays
  the car, the holes and the doors (Build shaft's own objects) before the furniture. First try pinned the WHOLE square in
  front of the doors: in a corridor two squares wide that cut the corridor in two (12 office and 10 apartment corridors
  "through-line is blocked"); now only a 1.5-ft strip before the doors is pinned.
- 17:47 FLUX.1-schnell is GATED on Hugging Face ("Access ... is restricted ... log in"); no token, not pursued. SDXL base
  1.0 (stabilityai, CreativeML Open RAIL++-M: commercial use allowed, ungated) in a venv on the pod, weights in /dev/shm,
  CLIP-sized short prompts (tools/sdxl_plates.py), 3 seeds x 5 ids in 94 s. The ice machine's Gemini plate was REJECTED by
  the blind gate ("trash receptacle / compactor"): re-specced with its bin open on a heap of ice, made on SDXL too.
- Gate (Gemini plates): 10 of 11 accepted. SDXL: tools/pick_plates.py reads the three seeds blind (the gate's own BLIND and
  MATCH prompts), first match with the widest margin: housekeeping cart s0, pipe run s2, mop bucket s0, breaker panel s1
  (s0 read as "a control panel with rotary knobs"), ice machine s2. Recorded in gate-manifest.json with that evidence.
- Wave 1: 10 meshes, median 83 s; Blender QA rules (NOVISION) 10/10 accept. Four-turn blind facing read: all front at
  yaw 0 but the sconce (180); orient.json +entries (additive).
- 18:05 main moved twice under the lane (denserooms 89ba4045, vehicles 8db3e21b): rebased; build_data.py conflict (the
  vehicles block and this lane's at the same marker) kept both. mh.test now also runs ccm_lib's walkCheck (2-ft walker).
- Suites with wave 1's meshes: mh 45,380 / 0; modern_buildings 122/122; modhalls_buildings 869 / 0 (4 XFAIL: a 2- or 3-
  storey Hideout at 14x11 is refused by the relay for an upper warehouse overhanging the alley, the SAME on main 8c7a9056,
  checked in a throwaway worktree); mx 28,964 / 0 and cyb 208,127 / 0 after the corridors were exempted from their leak
  checks (they reuse the art canvas, wire shelving, strip lights, lockers on purpose; mh.test owns them); mod 334,506 / 0;
  dense 2,530 / 0; halls 33,720 / 0; browser_modrooms 34/34, browser_cyberpunk 28/28; browser_modhalls 15/16 (the pipes:
  wave 2).
- New suites FAIL on old code: run in the throwaway main worktree, modern_buildings (new checks), mh and modhalls_buildings
  throw (no buildingRoles, no corridor rooms); on main every Modern plan's corridors are the hub's type.
- Blind read of the game's stills (integration/engine_read.py, one call, 7 stills): every corridor named for what it is
  ("apartment building", "office", "back-of-house service corridor"), elevator seen (yes) in all four lift stills, nothing
  medieval. Its "wrong" list is the derived PROGRAMME, not the corridors: three identical bathrooms side by side, two
  restaurant kitchens in one bar, a wooden stair in a corporate lobby, the lift's doors opening into the ground-floor
  apartment (the Apartment block's hub IS an apartment: the modtypes lane's choice).
- 18:37 Wave 2: 5 meshes (QA 15/15 accept). Pod 8dwtlzln8bhvlm DELETED 18:37, verified by the API (pods named
  tw-modhalls: []). **Spend: RunPod $1.64** (0.915 h x $1.79: the A100 for both mesh waves and the 15 SDXL plates);
  Gemini plates and every blind read on the subscription ($0). Facing reads: all yaw 0 but the sconce (180); the ice
  machine's mesh reads "refrigerated display case" from the four turns (a taste call: kept).
- With the pipes in, two fixes: the fluorescent tubes go in BEFORE the pipes (modTubes keeps off anything that reaches the
  ceiling, and the pipes do); the pipes take the long wall with the most room between its doors (the bar's corridor got
  none on the seeded wall). A 10-ft stub has no 5-ft run between its doors: no pipes there (the suite expects them from 15 ft).
- Rebased on main b1a766e6 (meshy drop-in): clean; library.json = main + 15 objects (nothing removed or changed), orient +15.
- FINAL suites: mh 49,938 / 0; modern_buildings 122/122; modhalls_buildings 869 / 0 (4 XFAIL, predates); browser_modhalls
  16/16; mx 28,964 / 0; mod 336,054 / 0; cyb 186,779 / 0; dense 2,527 / 0; halls 33,720 / 0; elevator 14/14; buildings
  (engine) 120 buildings ok; browser_modrooms 34/34; browser_cyberpunk 28/28; tool-sweep sku_guard OK; tool-sweep check.py
  lists exit-sign and sconce-wall-modern as "not published in the bench's fire queue": deploy.sh's sweep publishes them.
- Final blind read (7 stills): corridors "apartment building corridor", "office corridor", "back-of-house service
  corridor"; elevator yes in all lift stills; nothing medieval but the WOODEN STAIR the generator lays in Modern buildings
  (the stair core's family falls back to a timber flight: predates this lane, flagged for Harry).
- Pictures: /mnt/usb/turnip-works/lanes-2026-11-07/modhalls/ (stills/, plates/, contact-sheet.jpg, read2/read.json).
