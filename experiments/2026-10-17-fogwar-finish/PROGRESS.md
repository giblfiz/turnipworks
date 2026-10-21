# Fog-of-war look — finish (Claude Opus 5.5, 2026-10-17)

Branch `gemini4-fogwar`, worktree `<repo>`. Brief: `~/scratch/claude-fogwar-finish-2026-10-17.md`.
If resumed: read this file and `git log --oneline origin/main..HEAD` first.

## Log
- 2026-10-17 start. origin/main == ae371394 (nothing to merge). Gemini WIP d424060a reviewed (notes below).
  Copied Gemini's `run_tuner_tests.py` / `bench_cost.py` here (its brain scratch) as the starting harness.

## Review of Gemini's diff (running notes)
- ratings_server.py: only adds "fogwar" to HOUSE_FIELDS (read-side merge; append-only). Safe. Needs `systemctl restart tw-ratings` after landing (service runs from the main checkout).
- tuner.js/world.js/index.js plumbing: house.fogwar -> fogwar.set. OK.

## Next
- run Gemini's fogwar_ui.py as-is, look at results.
- Ran Gemini's fogwar_ui.py as-is: 10/12 pass; FW7b/c fail (door at z 210-215 corner: pawn never sees beacon -> FW6
  "0 secret pixels" is vacuous, no positive control). Stills: spill floods the visible room bright white.
- Findings: (1) spill source samples ONE midpoint for walls -> fog leaks through walls from the unseen outside;
  (2) unseen pixels = checker+atmos fx composed AFTER bloom/exposure, visible spill composed BEFORE -> colour seam,
  blown-out white spill; (3) place data (room fog heights, indoor haze, pool) still shapes fog over never-seen
  cells -> could outline hidden rooms when the bank is stirred; (4) measure() also drops invisible walls when
  vision is off (scope creep); (5) panel vision footprint hard-coded, door span ignored by test.
- Plan (option C): move FogWarPass BEFORE the atmos pass (substitute never-seen with checker in HDR, /exposure),
  atmos draws bank/veil/spill uniformly over it, bloom/tone after; overlays (rulers, cursors, labels) drawn after
  the composer. Wall-marching spill. Zero place data in never-seen cells.
- Done (commits 4fc1bfe4, next): option C implemented (fogwar pass before atmos; drawLateOverlays after composer);
  wall-marching spill with half-cell steps + opening-width weight + nearest vision; place data zeroed under never-seen
  (sim target, wind in vort/advVel/scroll, volume room fog/indoor/pool); walls hold no fog; lowZ = floor-ray distance
  for never-seen; depth-aware 7-tap blur of the volume when vision is on (kills the dot screen at grazing bank tops);
  tuner panel culls never-seen items like the game (main.js honours userData.fogHidden).
- Next: rewrite fogwar_ui.py (positive control, in-frame A/B pixel-diff secrecy test for beacon/pawn/baffle wall,
  Low/Medium/High + plain, stirring), then game-level check, cost bench, stills, docs, land.
- Tests: tools/spawn-tuner/test/fogwar_ui.py 12/12 (run via run_tuner_tests.py: own ratings server copy, since live
  tw-ratings predates the fogwar field); engine/test/browser_fogwar_game.py 7/7. Known limit recorded (FW6 NOTE:
  low-camera outline of DRAWN hidden test objects; the game never draws them).
- Docs: UI.md, NETCODE.md, PLAN.md (tuner), server docstring; matrix entries added. STATUS.md pending bench numbers.
- Bench: base worktree ../3d-vtt-fogbase (detached ae371394, asset symlinks) -> bench_cost.py --tag before/after,
  results in bench_results.json (remove ../3d-vtt-fogbase when done: git worktree remove).
- Next: existing fog suites (fogpass, fog, fogtweaks, atmos_parity, house_buttons, fx_ui?) then landing.
- 20:03 bench 'before' failed: base worktree lacked engine symlinks (node_modules, client/data/{cursors,icons,roof}); added. 'after' running; re-run before next. land.sh written (experiments/.../land.sh). npm test + tool-sweep green on branch.
- BENCH (2x DPR, Medium, RTX 3060, house look from live tw-ratings = atmos-harry-v2, so the atmosphere runs anyway),
  whole-frame GPU median of 4 rounds: one room fog-on 2.537 -> 2.602 ms (+0.065), 50-room town 2.582 -> 2.659 (+0.077);
  GM view (no fog) drift in the same runs +0.038 / +0.060. Programs identical (68/72). Caveat: with CLEAR air the bank
  starts the atmosphere itself: tuner probe atmos sim 0.42 + draw 0.62 ms at 1x (fx 410x424).
- 20:33 pre-landing suites green (fogpass after check update, fog 43, fogtweaks 65, atmos_parity 12, house_buttons 9, npm test). STATUS entry committed. LANDING started (flock land.sh, log scratchpad/land.log). After: restart tw-ratings, verify live.
- 20:46 LANDED main a3a10b58, client 20261017204407, tuner 20261017204353; tw-ratings restarted (house unchanged). Live: fogwar_ui 12/12, browser_fogwar_game 7/7. DONE except final report.
- 21:59 FIX2 LANDED main 0368f8b8 (client 20261017215739, tuner 20261017215726): spill tongues were dead (inline comment swallowed maxU update); sliders FW3b; Room types fold. Live: left_fold 6/6, fogwar_ui 13/13. NEXT: item 3 walls known through thickness (own landing).
- 22:22 WALLS LANDED main b0e75003 (client 20261017222015, tuner 20261017222004). Live: game 8/8 (G7), tuner 14/14 (FW12). Stills experiments/2026-10-17-fogwar-finish/landing-20261017T220917/fogwar-stills/fogwar-7-known-walls-*.
