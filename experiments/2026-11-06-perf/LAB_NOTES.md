# SPEED lane (perf), 2026-11-06/07: lab notes

Goal: light use (pan, orbit, zoom, hover, select, place, drag, ring) crisp on the weakest PC of a party. Measuring
stick first (tools/perf-bench/), calibrated on the build box (RTX 3060) and the front web server (Intel HD 4600 ≈ 2012 MacBook HD 4000).
Times below are PT.

## Log
- 22:05 the front web server reachable as fauna; snap Chromium 156; HD 4600 via ANGLE Vulkan with the wiki's flags;
  EXT_disjoint_timer_query_webgl2 present. Driven from the build box through ONE ssh: -L CDP (17633), -R relay (17631),
  -R site (17632). The far browser only ever sees 127.0.0.1 (our stack); niced; profile under ~/snap/chromium/common/twperf,
  removed on exit; killed by its own PID.
- Harness: tools/perf-bench/{lightuse.py, stack.py, maps.py, remote.py, probe.js, cpuprof.py, compare.py}. Built maps in
  ~/.cache/tw-perf-bench (our own throwaway relay data, never live data). Static server falls back to the main checkout for
  git-ignored meshes/textures (read-only), code always this checkout's (or TW_PERF_CODE=<tree> for a true before).
- Builds: inn 10 rooms / 433 things in 9 s; cave map: a hill's y is its TOP (10; a terrace 20), not 0 (first try failed two
  hills); town 104 rooms / 3,700 things in 808 s (building in one GM tab slows per room, as the megamap study found).
- 22:4x FIRST FIND, both machines: dragging/selecting a pawn costs ~130 ms of JS a frame. Probe's per-listener timing put
  it in ring.js's frame listener; a V8 CPU profile (cpuprof.py) put it in ringlab/model.js curveSlots: the slot search
  re-run every frame; a too-long row tries 50 grown ovals, each a fresh 2,048-pt table, and the 64-table cache was cleared
  by that very search. First guess (boundsOf's computeBoundingBox) was wrong: fixed anyway (cheap, correct), but the
  number did not move until curveSlots was memoised. Lesson: profile before fixing the plausible thing.
- 23:00 Baseline on the front web server (base code via git archive): see BASELINE.md. Auto picked Low on inn/caves, but KEPT HIGH on
  the town: 20 skip frames at ~400 ms outlasted the 4 s measurement, 0 frames measured -> "not slow". Fixed.
- git archive drops export-ignored files (assets/ui-icons/manifest.json, build scripts ...): a base tree served raw fails
  to start a GM tab; the bench's static server hides that by falling back to main. For running the NEW tests on the OLD
  code I filled the missing files with `cp -rn` from the worktree.
- 23:3x First lever A/B (results/levers-the front web server.*): CONFOUNDED: the static server serves the worktree live, and I edited
  interact.js mid-run, so town/cave pages ran newer code than the inn page. Kept for the record, superseded by final-*.
  Findings that survive: dynres ALONE never fires (the pixel stage is the 5th, each trial 8 frames at 15 fps; a 1 s
  stroke never gets there); and the pixel trial was judged on frames that include the resize itself -> "no gain" ->
  rejected for 60 s. Fixes: skip 2 frames when judging pixels; try pixels FIRST when frames are 3x the target.
- Cave map, that run: Auto stopped at High (Medium 117 vs High 133 ms: under the 10% gain asked -> "not the picture").
  Fixed: one more step before concluding.
- target.js walked every entity every frame for the few pawns with a target (town: 3,700). Now app.pawnList.
- browser_interaction "brought up to date a few times" fails on base too (pre-existing). browser_beyond20 B15a fails on base
  too (pre-existing, 'crosshair' vs 'reticle'). browser_graphics' idle-rate check flaked once ('picture' job), passed on
  rerun, passes on base.
- Panic-detector fired twice on scratch scripts: checked what was live each time (one the front web server run, one Gemini read); no
  spiral, carried on.
- 00:3x Final clean A/B on the front web server (no code edits during it): results/final-the front web server.*.
