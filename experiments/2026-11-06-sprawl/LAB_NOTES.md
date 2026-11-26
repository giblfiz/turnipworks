# Sprawl (modern city pack), lab notes

Lane `sprawl`, 2026-11-06. Harry: "Shadowrun mostly meaning shadowrun assets packs ... SR drags modern in, so it probably
ends up quite large." Generic name, no game's trademarks (DESIGN.md). Wave 1 = the modern core (8 rooms); STOP after it.

- 22:05 orient. Engine already groups types by `genre` (types.json `genres`); only engine/tools/build_types.py hardcoded
  fantasy. Map of fantasy assumptions (an Explore agent): wall families (5 registries), every rendered light is a flame,
  no see-through wall family, rooftop rooms do not work, shelf leakage through taxonomy.js unless every piece is set:MOD.
- Pipeline: plates on the Codex image route (3 workers, transparent PNG, house template text), plate gate on agy-run
  (faction-pillars' gate_plates.py, made genre-neutral; it now REFUSES any plate where Gemini reads text: the trademark
  rule), meshes on one RunPod 4090 (openmesh's pod tools, REST v2), mesh rules in Blender (qa.sh), runtime/LOD/tex in the
  worktree. Flats (8 floors, 3 road/bay strips, 3 decals, 10 icons) on the mine's flats tools.
- 22:16 three Codex workers on 60 parent plates; 22:19 flats queue (one Codex request at a time).
- Renames while the plates were painting: `plant-pot--mod` -> `houseplant` (the role plant-pot is a 6-in herb pot: the sku
  would have been scaled to it); `wall-straight--storefront` -> `wall-storefront--drywall` (shop glass is a special PANEL
  of drywall, walls.js PANELS mod-store, the market shop's rule, not a family of its own: a family would glaze all four
  walls); `wall-roller-shutter--concrete` -> `door-roller-shutter--leaf` and `wall-doorway--storefront` ->
  `door-shopfront--leaf` (look.js does not draw a doorway piece where a door hangs: the LEAF fills the whole 5-ft opening,
  so a door is a leaf; the shutter slides up, openlook.js RIGS).
- Corner pieces: look.js cornerSpec puts post-timber at a family's corners unless its FAMILY_FALLBACK is a stone family;
  so drywall gets `post-timber--drywall` (a plaster column), city-brick and concrete (fallbacks fieldstone, dressed-stone)
  get `pillar-square--city-brick` / `--concrete`. Three more plates.
- Fresh worktree: integration/link_main_binaries.py links main's git-ignored files PER FILE (87k links), copying small
  json/txt state instead (a build that rewrites one in place would write through a link into main). prep/flats.py would
  rewrite every flat: tools/flats_mine.py runs it for ours only. prep/flats.json and prep/jobs.json get the worktree's
  absolute paths from build_data.py: restore them before every commit.
- 22:39 agy queue: 8-9 calls waiting from other lanes; each of ours waits ~5 min. The plate gate (21 plates, 8 calls) took
  over 40 min. Response: mesh plates BEFORE the gate judges them (pod_lib.sh EARLY=1; a mesh costs cents, an idle pod
  more), mesh rules without vision (NOVISION=1), and ONE blind sheet read of 12 meshes a call (tools/sheet_read.py)
  instead of one call a mesh.
- 22:41 pod 64iqph620fyy33 (RTX 4090 $0.89/h, EUR-IS-1, 2 h timer + pod-side dead-man), setup 163 s. 22:46 wave 1: 63 plates.
- Golden (tools/spawn-tuner/test/golden.mjs, pristine = HEAD): 1968 scenes of 147 room types, 0 differences, with the
  walls / build_data / solver blocks in and no modern mesh yet.
- 22:59 the plate gate's blind reads that came back (7 of 7 calls, 21 plates; its final text-match call was still queued
  after 58 min and was stopped): all 21 read exactly as wanted, every one "modern", none with text (work/plate-blind-reads.json).
- 23:11 wave 1 done: 63 meshes, median 17 s, 0 failures; 23:18 siblings + corner posts: 11 more, 74 in all. A Codex
  worker re-saved `plant-pot--mod.png` after the rename; that 74th mesh is discarded (work/discard/). 73 ship.
- Mesh rules (Blender, NOVISION): 73 accept; `door-shopfront--leaf` failed the doorway rule (a closed glass door is a
  leaf, not an opening): accepted by qa/overrides.json. Cars come out 8.3 ft wide and 6.7 ft tall at 15 ft long (stout
  toy proportions); the street's parking lane and the garage's bays are sized from the car's real box.
- 23:32 pod deleted and verified gone (API state gone, no pod named tw-sprawl): 0.861 h x $0.89 = **$0.77**.
- Caught before landing: the modern loader sat BEFORE the castle/crypt/mansion block in build_data.py, whose `had` set
  then saw `sofa--mod` and turned the mansion's own sofa and billiard table tier `noble` (the inn would have stopped
  rolling them). The loader now runs LAST of all batches. Golden after: 1968 scenes, 0 differences, all 73 meshes in.
- mod.test.mjs: 440 failures with no mesh, then 22: a 20-ft street had no centre line (road 9 ft), stools refused at 0.9 ft
  from the bar (the counter's mark rounds up to the 6-in grid cell), the garage as a hub walked a loop through its
  parked cars (now a terminal). After: 95,621 checks, 0 failures.
- Shelves: kit pieces list every wall family in every room (the existing rule); THINGS show only their own genre's look.
- buildings.test.mjs --all-types: unchanged (MOD has no BUILDING_TYPES entry: no whole-city-block generator in wave 1).
- Suites on the branch (rebased on main 2026-11-07): mod.test 94,963 checks 0 failures; golden vs main 1968 scenes 0
  differences; engine npm test green (library-index 33/33); browser_build 99/99 and browser_barcat 9/9 (private ports
  19471-19474); every tuner node suite green (yard.test caught the garage's 2.5 density target, solver2.test a flat too
  small for the sofa: both fixed). Shots served from tools/spawn-tuner on 127.0.0.1:19467 (PID in work/http.pid).
- Orientation: four-turn front read stopped after 8 of 32 (queue): all 8 faced +Z at 100. Only those 8 get orient.json
  entries: an explicit 0 switches off the solver's box rule (dims() turns a mesh whose long side disagrees with its
  catalog box), which the unread meshes still need (the booth seat runs front to back).
- 00:40 the batched read (eight rooms, one call): 8 of 8 named, all modern, conf 92-98 (ROOM_READS.md). Fixes after it:
  cars face their lane, no ceiling fitting over tall things. Open: ceiling fittings read as floor clutter from above.
