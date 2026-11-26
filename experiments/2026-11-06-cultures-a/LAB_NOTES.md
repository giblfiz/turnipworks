# Culture packs A (Japan, China, India): lab notes, lane cultures-a

Brief: scratchpad tw-lanes-common.md + the cultures-a lane prompt (Harry: "cultures meaning Japan/China/middle East/mezo
America/Russia/India/barbarian north asset packs ... The asset packs probably don't need be huge"). Worktree
.claude/worktrees/agent-ae26e6116fac3df22 (branch worktree-agent-ae26e6116fac3df22). Sibling lane cultures-b (Middle
East, Mesoamerica, Russia, Norse); coordination note in the session scratchpad (cultures-coord.md): one Build tray genre
`cultures` (engine/tools/build_types.py GENRE_OF), codes JPN/CHN/IND here, prefixes jpn-/chn-/ind-.

## Log
- 2026-11-06 22:05 worktree; tools/link_ignored.py linked 88,869 git-ignored binaries from main file by file (copies for
  files a build rewrites). Baseline build_data.py in the worktree: library.json and rooms.json byte-identical to main's.
- 22:20 DESIGN.md (rosters, one period per culture). Sensitivity / accuracy read by codex (text, isolated folder):
  all three "OK WITH FIXES"; every fix applied (DESIGN.md and the spec docstrings list them): Japan's shop is a sake
  merchant, the garden a tea garden, fusuma inside and a lattice door to the street; China's house is grey brick and
  dark timber (red is the temple's), a console table not an ancestral altar, the yingbi screen wall; India's kitchen a
  household kitchen, the shop a grain merchant, the temple a Shiva temple with Nandi and a screened sanctum, the stepwell
  a baori form, the jharokha window, a temple wall family of its own.
- 22:21 Japan plates: four Codex image workers (BRIEF-1..4, tools/write_brief.py), 36 plates in 22 min, transparent
  PNGs (no matte). Worker self-checks: faint alpha haze reaches the frame on many: tools/gate_plates.py clean_alpha()
  zeroes alpha < 48 and drops specks before meshing.
- 22:34 Japan flats (flats/gen.py, Codex, one request at a time): tatami is painted as ONE mat and composed two to a
  cell (flats/compose.py: borders meet borders, the tile repeats exactly); cedar boards finished as a coursed floor.
- 22:38 China plates started (4 workers). India spec written (31 plates).
- agy-run is the bottleneck: four lanes queue on /tmp/agy.lock; the first plate-gate call waited ~10 min. Decision: plates
  are staged for meshing after the measured checks only (tools/stage_plates.py), and the blind read of the MESH
  (tools/mesh_read.py: four turns on one sheet, three meshes a call: name, culture, soundness and front in one read) is the
  gate. A rejected mesh costs a cent of pod time; a plate read cost the queue.
- 22:44 RunPod: one RTX 4090 pod 788uc96ju5khvt (EUR-IS-1, $0.89/h), 3 h deletion timer + pod-side dead-man. Balance before
  $34.17 (shared with cultures-b and sprawl, each on its own 4090).
- 22:47-23:07 Japan wave: 36 meshes on the 4090 in 20 min (model load 148 s, median 20 s a mesh), 0 failed.
- 23:08 Geometric rules (tools/qa.sh NOVISION=1; its Blender tile renders fail on Blender 5 `bpy_struct` errors, the
  trimesh measurements stand): 33 accept; andon (a floating piece, 21% of the mesh) and maple (32% unpainted) re-meshed
  with a new seed; the shop platform came out 8 x 7 ft (catalog 8 x 4): a deep raised platform is the real form, shipped
  at its own proportions (manifest size 96x84x40, qa/overrides.json).
- 23:10 China wave (27 plates, then 8 more) queued behind it; India wave (24 plates) after that. The India plain lime
  wall plate came with a jali window in it (worker self-check): re-plated (BRIEF-5: "a PLAIN SOLID wall"), v1 kept.
- 23:20-23:45 Japan integration (integration/apply.py jpn: appended `ca:solver2` skeleton + `jpn:` blocks, one-line hooks;
  data in tools/spawn-tuner/cultures_a.py, catalog/objects-japan.catalog.md, catalog/rooms-japan.md). test/cultures.test.mjs
  drove the skeleton's fixes: the kamidana is mounted at an exact spot (caMountAt: ctx.mount rolls a random one), never
  over a door or window, with nothing standing under it (no racks on its wall); the tea hearth sits beside the walk, not
  on it; the low table steps aside from the walk when it must; floor lamps take their corners BEFORE the wall runs fill
  them and never a corner beside a door; a tiny room's last light goes as far from its doors as fits; the torii slides
  along its own width to stand on the ground. Densities set to what the rooms are (a dojo is an empty floor).
  The maple re-meshed with a new seed still came out 33% unpainted: re-plated as one solid dome of red (v2 plate), 0%.
- Suites (worktree, Japan only): cultures.test 50,061 checks 0 failures (450 rooms x 5 sizes x 6 seeds x 3 arrangements,
  180 grounds, 264 rooms of other types placing no culture piece); golden 1,968 scenes of 147 existing room types, 0
  differences; npm test green (library-index 30/30 after `HAND_KIT.push('fence-bamboo')` and the library-spawns re-run:
  154 room types); browser_build 99/99 on ports 18963/18964 (the new genre, its icons); buildings 40 --all-types 0 real
  failures; engine buildings, focal, factions green.
- COMMIT 6733837a: Japan, land-ready (binaries: tools/land_binaries.sh jpn).
- 23:10-23:35 China: 35 meshes in two waves (median 19 s), all 35 pass the geometric rules; the screen wall (yingbi) came
  with a broad stepped plinth, 10 x 4.7 ft: shipped at its own proportions (size 120x56x108). Floors: the square-brick
  floor finished by its exact 4 x 4 grid (seam 0.36); herringbone paving by the cut. The Buddha's catalog height 120 ->
  104 in (it stood through the 9-ft ceiling); the market stall is placed beside the path first (a must), then the
  stall row along the edges; a 15-ft strip between two buildings is excused its signature (test).
- 23:55 RunPod pod DELETED and verified (state gone, no pods named tw-cultures-a): 1.205 h x $0.89 = $1.07 for all
  105 meshes of the three cultures + 3 re-meshes. (The account balance moved $3.74 in that time: the sibling lanes' pods.)
- China suites (worktree): cultures.test jpn+chn 111,797 checks 0 failures; golden vs the Japan commit 2,052 scenes of
  154 room types (Japan's seven included), 0 differences; library-index 30/30 after the spawns re-run; core 748/748.
- COMMIT 2c3ef46f: China, land-ready (binaries: tools/land_binaries.sh chn).
- India: 31 meshes (the plain lime wall re-plated, then re-meshed), all pass the geometric rules. Floors: the temple's
  strict 3 x 3 slab grid and the lime floor's inlaid grid would not close at their edges (seam 6-11): re-painted as
  irregular slabs and plain mottled lime (v1 kept), seams 1.4 / 1.6; red sandstone finished as coursed slabs.
  The gaddi throne (120 in) and the sanctum doorway (108 in) stood through the 9-ft ceiling at the scale roll's top:
  catalog heights 96 in. Nandi faces the sanctum on the axis (test: facing).
- agy-run queue: my mesh reads three to a call were taking 2+ hours behind four lanes; China's and India's remaining
  reads restarted six sheets to a call (CHUNK=6). (A kill loop aimed at those also cut two Japan calls short: their
  ids are read again.)
- COMMIT (India), then rebased all three on main 478bcb13 (clean); after the rebase: golden vs main 1,968 scenes 0
  differences, cultures 161,509/0, library-index 30/30, core 748/748.
- The taiko read "barrel on stand" (mesh read): re-plated standing on edge in a tall stand, its painted mitsudomoe head
  facing out (v1 plate and mesh kept); a second pod k4j2so4ksqkg2b (the first verified gone) meshed it: 0.161 h x $0.89
  = $0.14, deleted and verified. RunPod total $1.21. (pod-ever-created renamed: one pod at a time, not one per batch.)
- docs/site/assets-packs.json: a sentence for japan, china, india (tools/build_site.py refuses a Build-menu type with
  rooms and no entry; no hero still yet: the card shows four of the pack's own pictures). assets_page 18/18.
- Stills, room shots and icons for Harry, and a backup of every landing binary (binaries-<code>.txt lists them, relative
  to the repo): /mnt/usb/turnip-works/lanes-2026-11-06/cultures-a/.
- Room reads (blind, table distance, ROOM_READS.md), the first five: every one names its culture (95-98) and its room
  (85-95): dojo, tea garden, tatami room ("washitsu"), Chinese courtyard, Rajasthani spice merchant's shop. Fixed from
  their problem lists: two tansu side by side read as doubled (the room's third wall piece is now the armour chest),
  two pomegranate tubs side by side (corners only now), baskets of grain repeated round the bazaar walls (water pots on
  the walls; the baskets stay before the merchant and by the door). Re-shot (shots-r3). Not changed, noted: the yingbi
  stands beside the path inside the gate, not across it (a screen across the path would block the walk; the real wall
  is walked round); the tea garden's basin "floating at the lantern's roof height" is the camera angle (4 ft apart,
  both on the ground: the crypt lesson on wide-view "floating" calls).
- 2026-11-07 ~01:00 rebased on main c46046ea (the sprawl lane's Modern genre had landed: it brought GENRE_OF/GENRES
  first, so apply.py now appends `cultures` to its list: Fantasy, Modern, Cultures). Each conflicted step resolved by
  tools/rebase_step.sh: main's side of every conflicted file, the culture hooks put back, the generated files rebuilt
  (catalog/out, types, library, rooms, orient, flats-out, library spawns 162 -> 168 -> 174 room types). The tip rebuilds
  byte-identical. 11 of 19 room reads were never run (agy-run queue); the read processes were stopped.
- SUPERSEDED, and the lesson of the night: that rebase's library.json had DROPPED the sprawl batch's 87 skus (golden:
  mod-warehouse differed). Their GLBs were in neither this worktree's link farm nor main's checkout, and build_data.py
  silently leaves out a sku whose GLB it cannot find. A generated file that depends on binaries must never be rebuilt
  wholesale in a tree that lacks some batch's binaries. Fix: replayed every commit onto main fe520c67 (sprawl AND
  cultures-b landed by then) with tools/replay.sh: main's side of every conflicted shared file, the hooks put back
  (apply.py: the `cultures` genre is cultures-b's now, nothing to add), and library.json / rooms.json = MAIN's committed
  files plus this batch's own objects, skus and rooms (tools/merge_lib.py: refuses if anything else differs; a culture
  sku already there is replaced, so the re-meshed taiko carries its new mesh), then the library spawns
  (186 -> 192 -> 198 room types). Old branch kept as `cultures-a-backup`.
- Japan flats blind read (tools/flats_read.py, one call): tatami, cedar, stepping stone and all 8 icons named right
  (tea room, dojo, sakaya, haiden, shrine approach, roji, washitsu, minka); the moss read "grass with flowers" with a
  repeating blotch: re-painted with no leaves or specks (v1 kept), blotch 0.16 -> 0.06.
