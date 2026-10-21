# Farmstead (HUT): the type, its batch and its tools

Sixteen rooms for Build → Fantasy → Farmstead. Rules in words: `tools/spawn-tuner/ROOMS.md` → Farmstead.
Reads: `ROOM_READS.md`. Bench: `BENCH.md`. What is still wanted: `docs/ASSETS_TO_BUILD.md` → Farmstead.

## How it was built
1. **From the library as it stood** (2026-10-11): the image allowance was spent when this type started, so the sixteen
   programs were written against meshes the inn, the stable and the yard already had (`integration/solver2_tail.js`,
   `walls_tail.js`, `room_types.py`; recipes `catalog/rooms-farmstead.md`). Every program asks for a piece with
   `ccmHas()`, so a role that gets a mesh later is used without a code change.
2. **The `hut-01` batch** (2026-10-12, allowance restored): `build_spec.py` → 22 plates (Codex image tool, our style
   reference only; 3 re-rolls) → one A100 pod `tw-hut` (dead-man timer; 30 min of model load with three workers on a
   busy host, 22 meshes in 8 min; **$1.48**, deleted, GET 404) → `tools/qa.sh` → 19 shipped, 3 withdrawn
   (`qa/overrides.json` says why; plates and meshes kept in `models-rejected/`).
   Every sku was checked against the library on main and the in-flight batches before plating (`build_spec.py` asserts
   it): `spinning-wheel` and `cradle` were in another batch and were not made here.
3. **Flats** (`flats/`): 16 painted room icons (magenta key) and `floor-field-furrows`; 17 Codex requests, 0 re-rolls.
4. **Two withdrawals were made at ROOM level**, after the mesh gate had passed them: what a piece is called on its own
   plate and what it does to a room from the table camera are different questions (the grain heap, the barred window).

## Files
| | |
|---|---|
| `integration/solver2_tail.js`, `walls_tail.js` | the appended `type:hut` blocks; `apply.py` puts them into a tuner tree |
| `integration/room_types.py`, `build_batch.py` | the ROOM_TYPES block and the batch block of `build_data.py` |
| `integration/engine_patch.py` | the small edits to shared files (packer, tests, look.js, catalog set tags), idempotent |
| `integration/remerge.sh` | after `git merge main` conflicts: take main's files, put the blocks back |
| `integration/land.sh`, `docs_patch.py` | the landing under `/tmp/tw-main.lock`; the STATUS and ASSETS_TO_BUILD entries |
| `integration/tests/room_shots.py`, `room_reads.py`, `live_game_check.py`, `make_icons.py` | table-distance pictures, blind reads, the game check; an icon renderer (unused: the icons were painted) |
| `integration/one.mjs`, `sweep.mjs` | solve one room and print it; every room at five sizes for crashes and blocked paths |
| `rooms.json` | what each room is meant to read as (for the judged read) |
| `build_spec.py`, `assets.json`, `prompts/`, `qa/`, `own_sizes.py`, `manifest_overrides.json` | the batch |

## Lessons
- **Names are code.** `fireType()` reads "lamp" in "clamp": `root-clamp-sand-box` would have burned. Check a new sku
  name against the flame and water patterns (`tools/tool-sweep/check.py` prints it as "flame with no derived anchor").
- **"Smooth, one solid surface" over-applies**: on a haystack it made a glazed pot. Say what the mass is made of in
  broad layers; keep the phrase for fleece and thatch planes.
- **Catalog sizes lie about depth.** Benches ship 2.5 ft deep, the vegetable patch 5.5 x 9.2: lay pieces that must
  touch (`hutLay`, `hutExact`, `hutDims`) by the mesh's own size, with no scale-variety roll.
- **An outdoor program's fail is silent** in `attempt()`: set `ctx.purposeFail` yourself (`hutPlotFail`).
- **A hub with two doors** gets a closed loop walked AFTER the furniture: walk it first (`hutLoop`).
- **Build in a worktree needs main's `reviews/latest.json`** (uncommitted there): without it 139 skus lose their
  ratings and the golden test differs in rooms that have nothing to do with you.

## Landing
Landed 2026-10-12 20:33 (main 537258d): golden 0 differ of 1,524 scenes, farmstead 453,759 checks, solver2, the
building plans and the engine core green; `assets_check.py --live` 0 missing; `tool coverage OK`.
**`integration/land.sh` and `land_all.sh` predate the rule of 20:41 the same evening** (merge `origin/main` after a
fetch, never local `main`; build and test the merged result on a temporary branch, fast-forward main only when green).
They merge into the main tree first: rewrite them before using them again.
The batch's plates (`inputs/`, `masked/`) were copied to the main tree after the landing so the rater's next sweep finds
their source plates.
