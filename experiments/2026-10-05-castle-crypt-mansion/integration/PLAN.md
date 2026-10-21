# Integration plan: one new room type into the Spawn Tuner and the game (crypt first)

Written 2026-10-05 by the integration scout. Nothing here has been applied to a shared file: every edit is a draft in
this folder, and has been run only in scratch copies (`sandbox/`). B = `experiments/2026-10-05-castle-crypt-mansion`,
I = `B/integration`, T = `tools/spawn-tuner`. Read `RISKS.md` before step 3.

## What is in this folder

| file | what it is |
|---|---|
| `apply.py` + `hunks/hunks.py` | the whole integration as a list of hunks, applied mechanically to a tuner tree (`--scope once,crypt`; `--check` = dry run). An anchor that no longer matches stops the run before anything is written. |
| `room_types.py` (from `gen_room_types.py` + `room_types.head.py`) | the `ROOM_TYPES` entries for all 26 rooms and the `build_data.py` blocks (flats globs, the four run manifests, exclusive tiers, `borrow`) |
| `programs.js` = `programs/00-common.js` + `10-crypt.js` + `20-castle.js` + `30-mansion.js` | the v2 room programs, one block appended to the end of `solver2.js` |
| `hunks/walls_tail.*.js`, `hunks/solver_tail.*.js` | the registrations appended to the end of `walls.js` and `solver.js` |
| `build_types_patch.py` | the Build tray: what is automatic, the two engine edits, the engine test blocks; `--check` prints what the tray will list |
| `hung_and_lights.md` | HUNG_IDS and `fireType` lines per type, with the reason for each |
| `prep/ccm_prep.py`, `prep/orient_ccm.py` | per-run job list and the front sweep (new files for `T/prep/`) |
| `tests/crypt.test.mjs`, `castle.test.mjs`, `mansion.test.mjs`, `ccm_lib.mjs` | node tests per type (modelled on `yard.test.mjs`) |
| `tests/golden.mjs` | "the inn is unchanged": every existing room type, byte for byte, before and after |
| `tests/room_shots.py` | table-distance pictures and the blind Gemini read per type (modelled on `yard_shots.py`) |
| `make_sandbox.py` | builds `sandbox/NAME`: a copy of T with the hunks applied and fake meshes for skus that do not exist yet |
| `stage_hunks.py` | stages only our hunks of a file that also has someone else's uncommitted changes |

## How the pieces hook in (the answers the brief asked for)

- **The dispatcher.** The game and the tuner's default engine are v2 (`solver2.js`), and v2 dispatches on the room
  **key**, not on `program`: `attempt()` calls `KEY[key](ctx)`, then `MENUS[key]`, then a generic density fill.
  `program` is only what the classic v1 engine runs. So a new room = `KEY['<key>'] = fn` plus one line each in
  `DENSITY`, `FOCAL`, `KEY_RE`; all four are module-level tables, so everything is registered from a block **appended
  to the end of `solver2.js`** and nothing inside the file moves. v1 gets one small `PROGRAMS.generic`.
- **Each program lays the whole room** and returns `approach: null, passage: true` (no walks added by `attempt()`),
  ending with `ccmDone(ctx)`, which empties the generic density fill: that fill draws from the recipe's slots, anchors
  included, and would stand a second altar by a wall as "edge dressing".
- **Shaped rooms** (the other agent's work in progress: an L is solved as rectangles, the extra ones with `args.annex`
  and NO key program): each new type has `MENUS[key] = ccmAnnex(fn)`, one entry that runs only where the key program
  did not, dresses the leg (walls and lights, never the key piece) and closes the generic fill.
- **Reusing an inn program** (castle kitchen, mansion kitchen and cellar): `PROGRAM_OF['mansion-kitchen'] = 'kitchen'`
  and one replaced line in `attempt()` (`key = PROGRAM_OF[type.key] || type.key`); role, density and audit lines stay
  under the room's own key.
- **A new wall family** (`crypt-stone`, `castle-rough`, `noble-panel`, `noble-paper`, `conservatory`) is registered in
  `walls.js`, in the appended block: `WALL_FAMILIES.push(f)` (the game's family list; the tuner's Walls select also
  needs an `<option>` in `index.html`), `FAMILY_FALLBACK[f] = '<nearest existing family>'`, `TO_KIT[f]`. The pieces
  themselves reach the library through `build_data.py` with `family` set from the sku (`wall-straight--crypt-stone`).
  A room type with no line in `FAMILY_ODDS` always takes its own `family` (that is what the seven crypt rooms do).
- **Pieces a family lacks.** `look.js kitSpec()` takes the family's own piece, else `FAMILY_FALLBACK[family]`'s, else
  the first usable piece of any family. *Corners:* `cornerSpec()` chose stone pillars only for `dressed-stone` and
  `fieldstone` by name; one replaced line makes it follow `FAMILY_FALLBACK`, so `crypt-stone` (→ dressed-stone) and
  `castle-rough` (→ fieldstone) get pillars, the noble families (→ noble-interior) keep posts. Without that line a
  crypt gets timber posts at its corners. *Window:* `edgeSpecs()` asks `familyUsable('wall-window-small', family)`,
  which does NOT follow the fallback, and shows plain wall when the family has none (that is how the conservatory's
  glass walls work). *Doorway:* not drawn by generated rooms at all (a door edge is two jamb posts and a leaf).
  *Floors and family-keyed props:* `meshFamily()` follows the fallback.
- **A room with NO windows** is a room type in `NO_WINDOWS` (`walls.js`, a `Set`: `NO_WINDOWS.add(key)` in the
  appended block). `computeEdges` then rolls no window edges for walls that room owns, so the solver sees none
  (no window seat, no drapes, nothing kept off the wall). A wall the crypt room shares with an older room of another
  type is owned by that room, and is interior anyway. The cellar is the existing example.
- **Doors** by room type: `DOORS[key] = { main, inner, leaf }` in the appended block, one hook line at the top of
  `doorTypeFor`. `look.js` hangs a leaf-only mesh when the door role has one (`piece: 'leaf'`, set by `build_data.py`
  from the sku's `--leaf`).
- **Special wall panels** (burial niches, the wall of skulls, a sealed door; later stained glass): `PANELS[key]` in the
  appended block, one hook line in `computeEdges` before its corners, one line in `look.js edgeSpecs`. The edge stays
  kind `wall` and gains `e.panel`; the room gains `room.panels`, which the programs read. Panels go only on plain
  outside walls (they are 18–24 in thick and grow outward).
- **`sku.size`** is the mesh's own size from the manifest's `size` column (already supported for props; kit pieces
  ignore it, see RISKS). **`tier` / `wealth`**: `chooseSku` prefers `tier: fine` in a `wealth: fine` room. New skus
  under a role the library already had get an **exclusive tier** (`crypt`, `castle`, `noble`, `storey`, `ccm`), rolled
  only by room types that list it in `tiers`; that is what keeps the inn, and its Fine guest room, exactly as they are.

## Done once (type-independent), with the first type

Scope `once` in `hunks/hunks.py`: 18 hunks (14 rows below); the crypt adds 8. Everything else is per type.

| # | file | hunk | kind |
|---|---|---|---|
| O1 | `T/build_data.py` | `data.batch`: flats globs + the four manifests + exclusive tiers | insert before "a remeshed piece set supersedes" |
| O2 | `T/build_data.py` | `data.objects`: `only` / `hung` on objects, `visible()` | insert before "room types: union of recipe slots" |
| O3 | `T/build_data.py` | `data.rooms-loop-1/2`: `recipes + borrow`, `visible(oid, rt)` | 2 replaced lines |
| O4 | `T/js/walls.js` | `walls.door-hook` | 1 line after `export function doorTypeFor(e, byId) {` |
| O5 | `T/js/walls.js` | `walls.panel-hook` | 1 line before "// corners: grid vertices…" |
| O6 | `T/js/walls.js` | `walls.once`: `DOORS`, `specialDoor`, `PANELS`, `specialPanels` | appended block |
| O7 | `T/js/solver.js` | `solver.has`: roles whose every mesh is an exclusive tier | 1 replaced line |
| O8 | `T/js/solver.js` | `solver.tiers`: exclusive tiers, `want.tiers`, `want.shape` in `chooseSku` | 6 lines before `const tier = …` |
| O9 | `T/js/solver.js` | `solver.once`: `PROGRAMS.generic` (v1) | appended block |
| O10 | `T/js/solver2.js` | `solver2.common`: helpers, `ccmAnnex`, `PROGRAM_OF`, `chapel()` | appended block |
| O11 | `T/js/solver2.js` | `solver2.alias` | 1 replaced line in `attempt()` |
| O12 | `T/js/look.js` | `look.corner`, `look.panel`, `look.leaf` | 2 replaced lines, 3 inserted |
| O13 | `T/js/main.js` | `main.edge-sig` (redraw when a panel or leaf changes), `main.palette-keys` (a heading per type; no `undefined` hotkey after the twelfth) | 2 replaced lines |
| O14 | `T/styles.css` | `main.palette-css` | 1 line |

Also once: copy `I/prep/ccm_prep.py` and `I/prep/orient_ccm.py` to `T/prep/`; copy `I/tests/ccm_lib.mjs` and
`golden.mjs` to `T/test/`.

## The checklist for ONE type (crypt; 34 steps)

`TYPE=crypt RUN=crypt-01`. Steps marked **(once)** are skipped for the second and third type.

**A. Before touching anything (5)**

1. Meshes accepted, pod down, `python3 B/tools/make_manifest.py crypt crypt-01` written → `catalog/runs/crypt-01/manifest.tsv`.
   Flats finished in `B/flats/seamless/` and `B/flats/decals/`; icons `B/flats/icons/room-crypt-*.png` (7).
2. `python3 src/catalog_tool.py`: no WARN, no ERROR (it also rewrites `catalog/out/by-setting/*.txt`, which the tray's types are built from).
3. `git status --short T engine`: note every file someone else has open. `python3 I/apply.py --tree T --scope once,crypt --check`:
   all 26 hunks must say they would apply. If an anchor fails, that line was edited: read it, fix the anchor in `hunks/hunks.py`, do not force.
4. Regenerate the drafts if a designer changed `rooms.json` since: `python3 I/gen_room_types.py`.
5. Take the golden reference **now**, from the tree as it stands: `python3 I/make_sandbox.py pristine --pristine`.

**B. Dress rehearsal in a sandbox with the REAL manifest (3)**

6. `python3 I/make_sandbox.py crypt --scope once,crypt` builds with fake meshes for every spec. To rehearse with what was
   really accepted, pass `--accept` or simply compare its `build_data.log` with step 10's output.
7. `node I/tests/crypt.test.mjs` → `crypt: … checks, 0 failures`. `node I/tests/golden.mjs I/sandbox/pristine I/sandbox/crypt` → `0 differ`.
8. In the sandbox, the tuner's own node tests: `cd I/sandbox/crypt && for t in solver solver2 yard repeat zones stable stacks focal wall_items logcabin wallkit anim; do node test/$t.test.mjs | tail -1; done; node test/v2_fuzz.mjs | tail -1`.

**C. Apply (2)**

9. `python3 I/apply.py --tree tools/spawn-tuner --scope once,crypt` (scope `crypt` alone from the second type on is wrong: use `once,crypt,castle`; applied hunks are skipped). `git diff --stat T`.
10. Copy new files (no shared edits): `cp I/prep/ccm_prep.py I/prep/orient_ccm.py T/prep/` **(once)**; `cp I/tests/ccm_lib.mjs I/tests/golden.mjs T/test/` **(once)**; `cp I/tests/crypt.test.mjs T/test/`;
    `cp B/flats/icons/room-crypt-*.png engine/client/data/icons/`.

**D. Data (9), from the repo root unless said**

11. `python3 tools/spawn-tuner/build_data.py`. Read the output: `castle/crypt/mansion: N sku names already in the library, NOT replaced` must be empty for crypt; each crypt room's `missing` list should be the designer's `still_missing`; the object and mesh counts go up by what the manifest holds.
12. Runtime downsample (Blender, 4 workers; writes `T/assets/m/<sku>.glb` and bounds):
    `cd T && python3 prep/ccm_prep.py crypt-01 jobs` then
    `for w in 0 1 2 3; do blender --background --python prep/blender_runtime.py -- prep/jobs-crypt01.json $w 4 prep/results-crypt01.jsonl > prep/runtime-crypt01-$w.log 2>&1 & done; wait`
    (never `pgrep -f` to wait: it matches itself). Then `python3 ../../tools/spawn-tuner/build_data.py` again so `library.json` has the bounds.
13. Faces × skins ladder for the GPU dials: the same loop with `prep/blender_lod.py` → `prep/lod-crypt01.jsonl`, then `python3 prep/lod_tex.py`.
14. Flats: `cd T && python3 prep/flats.py` (keys the decals, writes `assets/flat/*.webp` and `prep/flats-out.json`), then `build_data.py` once more (aspect ratios).
15. `cd T && python3 prep/ccm_prep.py crypt-01 list` (the sweep's list and blind prompt: read the prompt once).
16. `blender --background --python prep/orient_views.py -- prep/orient-sweep-crypt-01/list.txt prep/orient-sweep-crypt-01/views > prep/orient-sweep-crypt-01/views.log 2>&1`
17. `python3 prep/orient_sheets.py prep/orient-sweep-crypt-01/views prep/orient-sweep-crypt-01/sheets 4 $(python3 prep/ccm_prep.py crypt-01 skus)`
18. `~/.local/share/tw-birefnet-venv/bin/python prep/orient_ccm.py crypt-01` (blind front read by Gemini, the box rule, merge into `data/orient.json`). Read the table it prints: every `front` decision that disagrees with the box is worth a look. Long thin pieces whose box is deep (sarcophagus, coffin, slab, bier: 3 × 7 ft) are the ones a 90° error would wreck.
19. Fire anchors: `cd T && python3 prep/fire_anchors.py`; `git diff --stat data/fire_anchors.json` (only crypt lights added). Then `python3 prep/ccm_prep.py crypt-01 check` → `0 problems`.

**E. Tests on the real tree (6)**

20. `node T/test/crypt.test.mjs T` → 0 failures (now against real bounds, not fake ones; a room that fails here and passed in the sandbox has a mesh whose proportions differ from its spec: check `orient.json` and the manifest `size` before touching the program).
21. Inn unchanged: `node T/test/golden.mjs I/sandbox/pristine T` → `0 differ`. If it differs, `--print` names the first placement; do not deploy.
22. The tuner's node tests (the loop of step 8, in `T`).
23. `node engine/test/core.test.mjs` with the crypt block from `build_types_patch.py` (CORE_TEST) added after the yard's block.
24. `python3 I/build_types_patch.py --check tools/spawn-tuner` → Crypt & tomb: 7 rooms, every icon ok, no crypt room under another type.
25. Engine tray tests need the deploy; they are step 30.

**F. Deploy and check live (6)**

26. Tell the other agents first (deploys go from the working tree: what they have half-written in `T/js` ships too). `lane-post` a line.
27. Tuner: `tools/spawn-tuner/deploy.sh` (stamps versions, restarts `tw-relay` onto the new tuner). It prints `deployed v=…`.
28. Engine: `engine/deploy.sh` (runs `build_types.py`; its gate solves a common room with the deployed tuner in Node; restarts the relay; prints `relay: {…}`).
29. Tuner browser tests against the live URL: `python3 T/test/accept.py https://implausible.enterprises/projects/turnip-works/tuner/` after changing its three counts (A1, A14, A20b: 12 → 19 room types; A14's per-type minimum needs a line for the crypt rooms), `T/test/smoke.py`, `T/test/yard_ui.py`.
30. Engine browser tests: `engine/test/browser_build.py` with the CRYPT block (`build_types_patch.py` BROWSER_TEST) added before `print('ICONS')`; its ICONS check fails for any room without `room-<key>.png`.
31. Table-distance blind read: `PY=python3; $PY I/tests/room_shots.py crypt https://implausible.enterprises/projects/turnip-works/tuner B/crypt/shots <API origin, as yard_shots.py> --seeds 11,12 --read`.
    Every room should be named a crypt, tomb, chapel or the like without being told; a `no` is a finding for the designer, "floating" from the wide view is triage (confirm close up). Then one look in the game: Build → Fantasy → Crypt & tomb → each room once.

**G. Commit (3)**

32. Stage our own paths. Files nobody else has open: `git add` them by name (`T/build_data.py`, `T/data/*.json`, `T/prep/*crypt01*`, `T/prep/orient-sweep-crypt-01`, `T/prep/ccm_prep.py`, `T/prep/orient_ccm.py`, `T/test/crypt.test.mjs`, `T/test/ccm_lib.mjs`, `T/test/golden.mjs`, `T/assets/m`, `T/assets/lod`, `T/assets/tex`, `T/assets/flat` for the new skus, `engine/client/data/icons/room-crypt-*.png`, `catalog/…crypt…`, `catalog/runs/crypt-01`, `B/`). Never `git commit -a`.
33. Files that also hold someone else's uncommitted hunks (today: `T/js/walls.js`, `solver2.js`, `look.js`; check `git status`):
    `python3 I/stage_hunks.py tools/spawn-tuner/js/walls.js tools/spawn-tuner/js/solver2.js tools/spawn-tuner/js/look.js …` (see below). Then `git diff --cached --stat` (ours) and `git diff --stat` (theirs, untouched).
34. Commit with a message that says which files were staged by hunk (the yard's did), push, `lane-post`, and add the Crypt section to `T/ROOMS.md`, `T/PLAN.md`, root `LAB_NOTES.md`, `docs/STATUS.md` (STATUS.md, UI.md and VERTICAL.md are open in the other agent's tree: stage those by hunk too, or leave the docs for a second commit when they are free).

## Committing only our hunks when the file also has someone else's changes

The yard commit (291ba21) says: "Only this work's hunks of walls.js, look.js, build_data.py and library.json are staged;
other agents' changes in those files are left in the working tree." It was done by hand with a filtered patch.
`stage_hunks.py` does the same thing mechanically:

    python3 I/stage_hunks.py --dry-run FILE…      # counts: ours / left for their owner / MIXED
    python3 I/stage_hunks.py FILE…

- `git diff -U0 FILE` gives one hunk per changed run of lines. A hunk is ours when it lies wholly inside one of our
  appended `// >>> ccm:<id>` … `// <<< ccm:<id>` blocks, or its added lines are exactly an insert or a replaced line
  from `hunks/hunks.py`. Ours go to `git apply --cached --unidiff-zero`, with the new-side line numbers recomputed for
  the index (git places a zero-context insertion by its NEW line number: without the renumbering the door hook landed
  21 lines too low in a trial, inside another table).
- A hunk that mixes our lines with someone else's (two edits with no unchanged line between them) is refused and named.
  That happened once in the trial (my panel hook sat directly under a line the other agent had just changed); the hook
  now has an anchor of its own (before the corners), clear of their edits.
- Tried in a scratch repository holding HEAD, the other agent's current uncommitted `walls.js` / `solver2.js` /
  `look.js`, and our 26 hunks: 23 hunks staged, 18 left, 0 mixed; the unstaged remainder is exactly their
  46 insertions / 13 deletions; the staged tree on its own imports and knows the crypt roles.
- **`library.json` and `rooms.json`** are generated: if another agent's uncommitted catalog or ratings work is in the
  regenerated file, the honest options are to commit the generated file whole and say so, or to wait. They cannot be
  split by hunk meaningfully.

## Per type: what differs

| | crypt | castle | mansion |
|---|---|---|---|
| scope | `once,crypt` | `once,crypt,castle` | `once,crypt,castle,mansion` (the chapel and several roles are shared) |
| runs | `crypt-01` | `castle-01` | `mansion-01` (+ `vertical-01` when the storey builder wants it; its meshes are tier `storey`, invisible to rooms) |
| wall families | crypt-stone | castle-rough (hall, throne room, chapel use dressed-stone) | noble-panel, noble-paper, conservatory (+ noble-interior doorway) |
| fire.js lines | flame-bowl, sand-tray | cresset; open fires (beacon, oil pot, fire basket, cauldron crane, pig on spit) | none |
| engine edits | none (icons only) | `pack.js` APART (courtyard, gatehouse) | `pack.js` APART (garden, cellar, conservatory); optional label Manor → Mansion |
| extra | – | `yard()` needs an edge-by-type table for the courtyard (castle fork's notes) | `yard()` likewise for the garden; `yard.test.mjs` line 56 must exclude outdoor types and the ballroom target (mansion fork's notes) |

## What the sandbox proves, and what it cannot

Proved with fake meshes at spec size: the programs solve, the registrations work, the hunks apply to today's tree, the
inn does not change, the tuner's own tests still pass. Not proved: anything about real meshes (proportions, which way
they face, whether a niche panel reads), the three.js side (`look.js` hunks were applied and parsed, never rendered),
the engine client, the deploy. Steps 18, 20, 29–31 are where those show up.

## Corrections made on the day (crypt integration, 2026-10-05): read before castle and mansion

1. **Commit early.** As soon as the node tests pass (type test on real meshes, golden, the tuner's suites), commit and
   push; deploy and the live check come after. Other agents merge into main and cannot while our files are dirty. Then
   commit small and often by explicit path. Another agent may commit a shared test file whole with our block in it
   (`engine/test/core.test.mjs` did): harmless.
2. **Hand corrections go into `programs/` and `hunks/`, then `apply.py` again** (tails are replaced whole). The same for
   `room_types.py` AND `gen_room_types.py` (CELLS, FLOORS) AND the applied line in `build_data.py`, or the next
   `apply.py` run sees a changed anchor.
3. **Kit pieces ignore `sku.size`** (`look.js kitSpec` stretches to the CATALOG box). Do not patch look.js: make the
   catalog line of a kit role follow its mesh (crypt: niche panel 60x18x108, sealed door 108 tall, gate and leaf 9 in
   deep), then `make_manifest.py` again. Check with `tuner.wallReport()` in a browser: a panel's box must end at the
   wall's room face (measured: centre 0.25 ft outside the grid line for an 18-in panel).
4. **A wall piece's local +Z faces the owner room.** A kit panel with two different faces (niches, stained glass, a
   portcullis) needs its worked face measured: ray-cast both faces (the snippet is in the root LAB_NOTES entry's
   commit, `orient_ccm.py MANUAL`), yaw 180 where the relief is on -Z. The blind read says the same (front C).
5. **Orientation order:** runtime GLBs → `build_data.py` → `ccm_prep.py RUN list` → views → sheets → `orient_ccm.py RUN`
   → a verify pass: write `verify-list.txt` (`<glb> <yaw>` for every non-zero yaw), `orient_views.py` into
   `verify-views`, sheets, the same blind prompt: every row must read front A or none. Ambiguous pieces (both broad
   faces alike) get a single-object read with neutral file names (`view-A.png` …): `gemini-vision.py` prints the file
   name to the model, so never pass a file named after the object or the room.
6. **Real meshes are stouter than the spec.** The first failures were a 3.8-ft pall against 3.0 (no bench fitted
   beside it) — expect the same for the castle's dais / feast table and the mansion's stair. Debug one room with
   a 15-line script (build → solve → print placements with dims); the type test names the seed.
7. **Room shots before the deploy**: `python3 -m http.server 8793 --bind 127.0.0.1` in `tools/spawn-tuner`, then
   `room_shots.py TYPE http://127.0.0.1:8793 OUT http://127.0.0.1:8096 --sizes default --seeds 11,12 --read`
   (`--keys a,b` re-shoots only the rooms being worked on). Shots after the deploy are the record.
8. **What reads from above is colour and silhouette, not the name of the mesh.** Pale yellow things read as gold,
   bundles on shelves as sacks, a rack as a bookcase, a small heap as coins. Before writing counts into a program, look
   at what Gemini calls each piece in a first shot; drop or enlarge what misreads; keep what reads (crypt: coffin,
   mummy, loose-bone decals, sarcophagi, the altar, the slab, the gold chest). Budget three rounds a type.
9. **"Upright", "floating", "clipping" from the table camera were wrong every time** they were measured (placement
   dims, mesh lowest point, `tuner.outsideReport`). Measure first.
10. **Flats drift.** `build_data.py` globs `B/flats/` while the flats agent is still adding to it. Always
    `build_data.py` → `prep/flats.py` → `build_data.py`, then `test/assets_check.py` (0 missing), and commit
    `data/library.json`, `data/rooms.json`, `prep/flats.json`, `prep/flats-out.json` at once. Both deploy scripts
    now refuse to ship a listing whose file is missing; `assets_check.py --live` after every deploy (both hosts).
    A sandbox build passes `--list-unbuilt` (make_sandbox.py does).
11. **The game check** is `tests/live_game_check.py CODE ROOMKEY W D OUTDIR` (a NEW campaign named `zz-…`; the default
    name in the form is "Dawnhaven": never submit the form without changing it). It hides the room labels: a picture
    that shows the room's name is not a blind read.
12. **accept.py** counts room types (A1, A14, A20b, A24e) and needs a spot and a default size per new type in A14.
13. Deploys restart `tw-relay` (the tuner's deploy once, the engine's once). The relay runs `engine/relay` and
    `engine/core` from the main tree: core and relay tests and `browser_build.py --local` (TW_GPU=1) on the tree AS
    IT STANDS are the gate, every time.

## Corrections from the crypt rework (2026-10-05, night): read before castle and mansion

14. **Work in the `ccm` worktree** (`<repo>`, branch `ccm`), never in the main tree. What git ignores is
    linked in, not copied: `tools/spawn-tuner/assets` (a symlink, listed in `.git/info/exclude`), `engine/node_modules/*` and
    `engine/client/data/icons/*.png` (real folders holding symlinks, so `git status` stays clean). `build_data.py`, the Blender
    steps and the deploy scripts still run in the MAIN tree only (they read the batch's models and write the real assets):
    merge first, then run them there. In the worktree, a change to a room type's `cells` or `floors` is made by hand in
    `room_types.py`, `gen_room_types.py`, `build_data.py` AND `data/rooms.json` (the same values; `apply.py --check` then says
    "already there").
15. **One read is a coin.** The same three pictures are named differently on a second read (the catacomb: "catacomb" in 1 to 3 reads
    of 3). Score a change on 3 reads x 4 seeds x 2 sizes, not on four single reads, and compare arms that differ in ONE thing.
    Reads are cheap when run in parallel (the room_shots.py prompt, 8 at a time: 24 reads in under two minutes).
16. **Ask the judge what it calls each thing before changing counts**: "list every distinct kind of thing you see, one line each:
    what it looks like from here, and what a player would take it for". The crypt's answers: the pall = a throne; the altar cloth =
    an open book; rows of stone benches = cots; a bone rack = a bookshelf; an urn niche = a wine rack; wrapped bodies in niches =
    scrolls or sacks; niche panels = barred cells; a mummy on the floor = a coil of rope (from 115 ft). Asked how to make a room read
    as X it gives usable advice about shape and doors, and bad advice about meshes (it cannot see what it misreads).
17. **A special wall panel between plain panels reads as furniture** (a shelf unit standing at the wall). Run it end to end
    (`every: [1, 1]`) or not at all. Expect the same of the castle's arrow-slit bays and the mansion's bookcase walls.
18. **The single big chair-like or draped thing on the axis decides the room** ("built around"): the shrine made the ossuary a
    throne room, the pall made the chapel one. The castle THRONE room wants exactly that; the castle chapel and the mansion's
    rooms must not have one by accident (a draped table, a high-backed settle against the end wall).
19. **Many identical low rectangles in rows read as beds**: 29 benches = a dormitory, 16 coffins along two walls = a barracks.
    The castle barracks wants that; the great hall's trestles and the chapel's pews need a cap (`maxRows`) or a break.
20. **The table camera hides the floor of a narrow room** (the near wall, 9 ft, hides 6 ft of floor at 55 degrees): a room 2 cells
    wide shows its far wall and little else. Corridors read better 3 cells wide.
21. New shared hooks (all in the appended `walls.once` block, none changes a room type that does not ask): `DOOR_ENDS`, `THROUGH`,
    `PANELS` rule options `ends`, `doorWall`, `shapes` (`e.panelShape`, pinned in look.js), and in the common programs `ccmScaled`
    (one placement at k x its size, inside the catalog's scale range), `chapel()` options `onBier`, `maxRows`, `sideTombs`,
    `endCornerSku`. `specialPanels(rooms, edges, byId, opts)` now takes the room map and the options (the hook line changed).
22. **`accept.py` on the box's GPU**: it launches Chromium with `--no-sandbox` only (software GL: it timed out). Wrap it: patch
    `playwright.sync_api.BrowserType.launch` to append `--use-angle=vulkan --enable-features=Vulkan --ignore-gpu-blocklist --enable-gpu`,
    then `runpy.run_path(accept.py)`. Result on the live tuner after the crypt rework: 47 of 49 in about 12 minutes. The two that fail are
    not the room types': A24 (tags stable across a reload) needs `?seed=N` in the URL it is given (without it every load rolls a
    new seed; with `?seed=7` the tags match), and A25c (the download rate back near 0 three seconds after a spawn) is the known timing one.
23. **Throwaway campaigns** have no delete call. The relay keeps every campaign in memory and writes a snapshot of each when it
    stops, so a folder removed under a running relay would make that write fail. Stop the relay, move `engine/data/cmp_<id>` to
    `engine/data/removed-<date>/` (the loader reads only `cmp_*`), start it: `/health` shows the count. Only campaigns whose
    journal's first line names them ours (`zz-…`, GM `fauna-check`); never "Dawnhaven".

## Corrections from the castle and mansion integration (2026-10-06)

24. **Build every run's runtime files first.** `build_data.py` lists a batch mesh as soon as its source model exists, with or
    without its runtime file. Before touching a program: runtime builds, the ladder (`blender_lod.py`, then `prep/lod_tex.py`:
    `assets_check.py` wants the ladder textures too) and the front sweep for ALL runs whose models are on disk.
25. **`build_data.py` and the Blender steps run in the worktree** once the main tree's git-ignored batch binaries are linked
    in (one link per missing folder or file; never `git add` a folder). Afterwards put the main tree's paths back into
    `prep/jobs*.json`, `prep/flats.json` and the sweep lists (they are tracked and hold absolute paths).
26. **A changed `cells` or the batch block** is edited in `gen_room_types.py` / `room_types.head.py`, `room_types.py` AND
    `build_data.py`, or `apply.py` inserts the block a second time (it tests "is my text there").
27. **A comment at the end of an inserted statement comments out the rest of a one-line block.** Twice tonight (a test, a
    program). Use `/* */` inside a line.
28. **Kit-generated props** (the dais): `place` is not `kit`, so they were scaled uniformly; a batch sku with `gen: kit`, its
    own size and another place now carries `fit: box` and is stretched per axis.
29. **A real mesh taller than wide overtops the wall** when its catalog line is wider than tall (the two great fireplaces):
    cap the height in `manifest_overrides.json` from the runtime bounds, not from the spec.
30. **Read the live record with nothing else on the GPU.** Forty live shots took 45 minutes beside two other browser jobs and
    8 alone.
31. **Lessons for programs** are in the root LAB_NOTES entry of 2026-10-06 (what hangs lies on the floor; a table with chairs
    behind it is a bar; an empty room has no name; one thing on a platform is a throne).
