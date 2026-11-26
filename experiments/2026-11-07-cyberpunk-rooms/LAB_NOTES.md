# Cyberpunk rooms (the cyberpunk pack, wave 2), lab notes

Lane `cyberpunk-rooms`, 2026-11-07. Harry: "let's call it cyberpunk. It is ok to use TM words, as long as we don't
pretend we have a license." Earlier: "Shadowrun mostly meaning shadowrun assets packs ... SR drags modern in, so it
probably ends up quite large." Wave 1 (2026-11-06, `../2026-11-06-sprawl/`) is the City type; this is the near-future layer.

- 07:33 orient. Pipeline = wave 1's tools copied to tools/ (pod_lib/launch_wave/harvest/qa/runtime), flats/ copied.
  Worktree: engine/node_modules linked; main's git-ignored files linked per file (integration/link_main_binaries.py,
  94,896 links, 1,943 copies).
- NAMING DECISION: genre stays **Modern**; two types under it: **City** (MOD, wave 1: the plain modern rooms, findable by
  a modern-day game) and **Cyberpunk** (CYB, this wave). The pack is "the cyberpunk pack" in docs and on the assets page
  (both cards' blurbs say so); the bar answers "cyberpunk", "shadowrun", "sprawl". No logo, no "official", no SR art.
- Roster (10 rooms): street clinic, corporate lobby (glass front), server room, noodle bar, capsule hotel, gang hideout
  (chain-link lock-up), magic-supply shop (talismonger), rigger's garage, safehouse, rooftop. 50 mesh specs (tools/make_specs.py).
- 07:45 three Codex plate workers on 42 plates (BRIEF-w2-1..3).
- 07:47 codex sensitivity read of the 8 culture-adjacent props BEFORE their plates (work/sens/RESULT.md): 6 ok, 2 changed
  (the talismonger's counter: no feathers or carved charms; its neon sign: a flask, not an eye). 07:52 fourth worker (BRIEF-w2-4).
- vision.js: GLASS AND CHAIN-LINK rule (SEE_THROUGH grows: wall-storefront, wall-glass-curtain, door-shopfront,
  fence-chain-link, gate-chain-link; a wall edge whose `panel` is glass is seen through; `walk` counts every see-through
  barrier that is not a door as a wall; solidEdges() for dice and first-person steps). Found on the way: a bars section
  laid by hand off the wall line was walked through by the movement rings (only one standing in for a generated wall
  stopped feet); it stops them now. vision.test 13/13; on old vision.js the new test fails (12/13).
- barwords: "bar" -> the modern bar (removed from the tavern's type words; the tavern keeps "tavern", "pub", "inn",
  "bar room"); Cyberpunk type and room words.
- world.js CEILING_FITTINGS = 'eyes': a light-fluorescent's MESH is drawn only from a pawn's eyes (first person); from the
  table only its light (fx/fire.js lights by the group's visibility, not the mesh's). 'always' = the old look.

2026-11-07T07:56:06.917243 Built-in image_gen w2-4: transparent outputs repeatedly have tight margins and variable dimensions despite verbatim prompts plus the brief size line; checked with PIL. Preserve generated pixels, cap attempts at three, record failures honestly, keep best per brief. No API or procedural image fallback authorized.
- 08:04-08:13 no 4090, L4 or A100 free in EUR-IS-1 (the TRELLIS volume's DC; two sibling lanes held 4090s). tools/pod_wait_up.sh
  retried every 4 min; 08:13 an A100 80 GB came up ($1.79/h, 3 resident workers). Setup 185 s, model load 180 s.
- Plates: 50 on 4 Codex workers (07:45-08:13), 2 re-plates (capsule-pod, locker-bank: the mesh gate's footprint rule,
  "squarer by 1.7x / 2.8x"). 12 plates only touched the frame (a cart's wheels on the bottom edge): tools/early_mask.py pads
  them with 6% transparent margin (plates/orig/ keeps the worker's file). Plate gate = tools/plate_read.py, BATCHED (15 a
  call, random names): batch 1, 29 plates: all named as asked, no text on any, every one "near-future/cyberpunk" except the
  chain-link fence ("modern") and the curio shelf ("medieval": an apothecary's shelf; it is a magic shop). Batch 2 queued.
- Meshes: 52 runs (50 + 2 re-meshes), median 36-40 s with three workers sharing the A100 (the host's load average was 40).
  Mesh rules (Blender, NOVISION): 50 of 50 accept after the re-plates. Pod 1i311dlmka5o7v deleted 08:45, verified gone
  (API state gone, no pod named tw-cyberpunk-rooms): 0.534 h x $1.79 = **$0.96**.
- Integration: the local build has no wave-1 GLBs (they are on no machine), so data = main's library + this batch
  (integration/merge_lib.py, the culture lanes' method; it also unions `only` and works the Cyberpunk rooms' slots out
  against the merged library). integration/regen.sh rebuilds everything from inputs.
- LOOKS: the wave-2 looks of shared roles (sign-neon--s2/--s3, car-sedan--s2) are tier `cyb` (exclusive), Cyberpunk rooms
  list tiers ['cyb', 'mod']. First try was a src filter inside modOnly: golden caught 9 City scenes changed (the v1 engine
  has no modOnly, and rolled the noodle neon in the City bar). With the tier, City is untouched by construction.
- cyb.test: 400 rooms, 57,753 checks, 0 failures (after: the monitor cart on the side away from the door; a rack / capsule
  seen from the door as the feature; the lock-up's two runs trimmed where they meet; no gear in a 5-ft lock-up; the shop's
  flask neon by the door). mod.test 95,050 / 0. browser_cyberpunk 12/12 (rooftop, glass, lock-up, ceiling; on the old
  engine files 8/11: each of the three sight/roof checks fails). browser_fpv --only ceiling 9/9 (the fitting is drawn from
  Mira's eyes, not from the table, and stays lit).
- ROOFTOP over a building: world.js roofInputs left every outdoor room out ("no roof over a yard"), so a rooftop at 10 ft
  over an office let the office's roof draw through it. Now an outdoor room above the ground is a `none` roof (open to the
  sky, still covering). Only roofInputs changed; look.js / roofs.js untouched (the culture-roofs lane's ground).
- 09:00-09:45 reads. Round 1, ten rooms in one blind call: 10 of 10 named (ROOM_READS.md). Fixes after it (turnstile
  banks, one noodle counter, one motorbike, the mast off the parapet, the crystal off the threshold, no windows behind
  capsules); round 2 queued. The game's own stills (browser_cyberpunk --stills): rooftop read as a roof (98), glass and
  chain-link read as see-through, the office's fittings no longer read as floor capsules.
- Suites (branch, rebased on main 816c4dc2): cyb.test 58,166 / 0; mod.test 95,050 / 0; golden vs main 2,580 scenes, 0
  differences; engine npm test green (library-index 35/35); vision.test 13/13; darkness.test 12/12; browser_cyberpunk
  12/12; browser_fpv 81/81; browser_barcat 9/9 (old bar words: the "bar", "shadowrun", "ripperdoc", "talismonger" musts
  fail); browser_build 98/99 (the PiP label-layout aspect, 0.86: the same on unchanged main, 98/99). Tuner suites: all
  green but dice.test (1 fail, the same on unchanged main) and solver2.test (33 fails in rus-yard and jpn-shrine-court,
  the same 33 on unchanged main). buildings.test 40 --all-types: 14,087/16,320 with its 2,233 XFAIL plans.
- A throwaway worktree of main on USB for the baselines (removed after).
