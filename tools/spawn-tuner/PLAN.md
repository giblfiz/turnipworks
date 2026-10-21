# Spawn Tuner — plan (draft for Harry, 2026-09-30)

A tool-level "DA light" demo reel: drag out a room, watch it fill and animate in, tune the pop-in by feel, read what the layout solver did, watch FPS. **Not product code** (it may be raided later). Lives at `tools/spawn-tuner/` and deploys to `/projects/turnip-works/tuner/`.

## What it is for (draft commander's intent; confirm with Harry)

One judgment: **does a generated room read right — plausible layout, believable sizes, delightful arrival — and what dial values and layout rules make it so?** Three outputs flow downstream:
1. **An animation preset** (JSON), which becomes the spec for the real engine's spawn-in.
2. **Readable layouts**: every generated room is a plain JSON recipe plus a one-paragraph summary, so we can discuss and fix the solver's rules.
3. **Performance numbers** (FPS, draw calls, triangles, texture memory) as rooms and effects pile up.

Delete it when the real engine's builder does all three better.

## The pieces

**Scene and camera.** three.js (CDN ES modules, no build step). A 5-ft grid floor and a clearly marked **north edge** (N label, compass rose, tinted border). Orbit camera with a top-down preset and a table-distance preset. One shared environment light plus a "lights" layer for later fire and torch tests.

**Room tool: the DA-light core.**
- Palette of room types from our recipes. v0 uses the inn rooms we have meshes for: common room, kitchen, storeroom/cellar, guest room, fine guest room, privy, hallway, stable/barn. Number keys select a type.
- Drag a rectangle that snaps to 5-ft cells and shows its size in feet; release to spawn.
- Click a room to select it. Inspector buttons: **Roll again** (new seed, same rectangle), **Delete room** (plays the exit animation), change type, lock/unlock objects (DA's missing feature, cheap here).

**The smart layer: layout solver.** Deterministic and seeded, driven by data we already have.
- **Recipe slots**: anchor → furnish → store → light → dress.
- **Catalog placement semantics**: wall, floor, surface, ceiling, kit; real **size** in inches plus the ~1.3× stoutness allowance; footprint (fp) as grid occupancy; affordances.
- **Rules, v0:**
  - Anchors go against walls (hearth centred on a long wall, bar counter along a wall), and the door gets a clear path.
  - Furniture comes in clusters (a table plus N chairs facing it; benches along trestles).
  - Storage hugs walls and corners.
  - Wall lights go on walls, ceiling lights hang from the ceiling.
  - Dress items sit on surfaces (tankards on tables), or render sets are used whole.
  - Collision is checked on a 6-inch sub-grid.
- **Output:** the room recipe JSON plus a plain-English summary ("Common room 30×20 ft, door S; hearth on N wall; 3 tables…"). Shown in a panel and saved through a write-back endpoint so I can read it. Later (v1): an LLM writes or edits the recipe and the solver places it, per the project's "AI writes recipes, fixed solvers do geometry" architecture.

**Walls.** One rough-timber family to start: wall-straight, corners, doorway, window, door-plank, with each segment scaled to its catalog size (60 in wide). A toggle hides walls for cut-away viewing. TRELLIS kit pieces won't tile perfectly, and seeing exactly how badly is part of the point.

**Animation tuner: in and out, separate presets.** Sensible defaults (our own; not copied from any product's timing).
- **Per object:**
  - duration
  - start scale (e.g. 1%)
  - overshoot amount
  - easing curve: ease-in-out, back-out, elastic, linear
  - spin degrees and axis
  - drop height
  - fade
- **Choreography:**
  - layer order and delay (floor → walls → doors → anchors → furniture → clutter → lights fade up)
  - sweep: E→W, W→E, N→S, S→N, radial from the door, radial from the centre, random
  - stagger per foot of distance, or the **expansion rate** of the ring
  - **simultaneous waves**: quantize into N groups that land together
  - jitter
- **Playback:** replay, slow-mo (0.25×), pause and scrub. Presets save, load and A/B.
- **Out animation:** mirrored by default, tunable separately.

**Bench** (diagnostics, required by the toolsmithing method):
- FPS and frame-time graph, draw calls, triangles, textures and estimated texture memory (`renderer.info`).
- **Cube swap**: every object becomes a box at its catalog size, to separate layout bugs from mesh bugs.
- **Catalog size vs mesh bounds** overlay, so the stoutness shows.
- **Grid occupancy** overlay (which cells each object claims).
- Placement-type colours (wall / floor / surface / ceiling).
- Axes and north.
- **Stress**: duplicate the room ×N to find where FPS breaks.
- A slot for **fire and particle FX** as they get built.

## Asset prep (before building)

- Derive a **runtime tier** for every inn mesh: 486 inn-01 plus the 69 inn-01b remeshes, with the remeshes winning.
  - **Default**: ~5k faces, 256 px, single colour map.
  - **Small objects** (largest catalog dimension ≤ ~14 in: cutlery, cups, food, candles): ~3k faces, 128 px.
  - **Kit pieces**: walls at ~5k with snap edges unprotected for now.
- **meshopt compression** for load time.
- **Scaled at load** to catalog height; texture-only flat assets (floor tiles, rugs, curtains) as textured planes.
- Expected: ~550 objects × ~150 KB ≈ 80 MB total, loaded on demand per room. That fits Harry's 5k/3k guidance.

## Build ladder (trivial case first; each rung verified before the next)

1. Grid, north marker, camera presets, FPS readout. One cube.
2. Drag-to-rectangle on the grid with snapping and a size label; click select; delete.
3. Spawn cubes sized from the catalog (cube swap) inside the rectangle via a dumb solver; verify placement types.
4. Animation engine on cubes; every dial live; replay and slow-mo. This is where Harry starts tuning.
5. Swap in real meshes (runtime tier, catalog scaling); check bounds against size.
6. Real solver rules (anchors, clusters, surfaces, walls); readable recipe JSON plus summary; roll again.
7. Walls, doors and windows (rough timber); cut-away toggle.
8. Bench complete, stress test, write-back endpoint for presets and layouts.
9. FX slot (fire) once FX exist.

## Decisions (Harry, 2026-09-30)

1. **Purpose: all three outputs**: animation spec, layout rules and performance numbers. This is the first stab at testing and low-stakes correction.
2. **Camera: free scroll/rotate/zoom, borrowing Map Garden's control scheme.**
   - Dragging *grabs the world*: the ground point under the cursor stays under it.
   - Left-drag orbits around that pinned point; right- or middle-drag pans literally; the wheel zooms toward the cursor (×0.9 per notch); Q/E rotate; pinch on touch.
   - Conflict rule, as in Map Garden: with a room tool selected, left-drag draws a room; with no tool (Esc), left-drag grabs and orbits. Right, middle and wheel always navigate.
3. **Walls in v0.** "We will fix 'em."
4. **Adjacent rooms share walls.** A room dragged against another reuses the shared wall run (no doubled walls) and gets a connecting door on it.
5. **Layout is a procedural program Fauna writes ahead of time**: seeded randomness within rules, **no LLM at runtime**. The earlier "LLM writes recipes later" idea is dropped.
6. **"Simultaneous" means waves.** A front sweeps from one corner (or edge) to the opposite. Objects are banded by their distance along the sweep axis, and each band lands together, more than one object at a time. Dials: sweep origin (8 corners/edges, plus door or centre), band width (ft) or objects per wave, wave interval, intra-band jitter, plus layer ordering on top.

## Status: built and acceptance-tested (2026-09-30)

**Live:** https://implausible.enterprises/projects/turnip-works/tuner/ (deploy with `./deploy.sh`, which version-stamps every module and data URL).

All nine rungs of the ladder are in, except real fire FX: the FX slot is flickering point lights at fire sources until FX exist.

**Results come back to Fauna.** "Send preset" and "Send room + note" POST to `/api/tw-ratings/tuner`, the ratings service extended with a `/tuner` route. They land in `reviews/tuner/{preset,layout,note}.jsonl`. Read them with `python3 tools/spawn-tuner/read_writeback.py`.

**Files:**
- `js/solver.js` holds the layout program: seeded, pure, node-testable.
- `js/walls.js` holds shared walls, sticky exterior doors and windows.
- `js/anim.js` holds the wave choreography, easing and poses.
- `js/camera.js` is the Map Garden grab-the-world camera.
- `js/main.js` holds the scene, rooms, bench, UI and test hooks.
- `js/ui.js` generates the dial panels.
- Data comes from `build_data.py`, which writes `data/{library,rooms}.json` from the catalog, the recipes, the inn-01 meshes (with the inn-01b remeshes winning) and the ratings.
- `prep/blender_runtime.py` makes the runtime tier: 5k faces / 256 px textures (3k / 128 px for things ≤14 in), a single colour map, origin at bottom-centre.
- `prep/flats.py` chroma-keys the flat items.

**Tests:**
- `node test/solver.test.mjs` runs ~70k checks: every room type, sizes from 2×2 to 8×6, 12 seeds each. It checks for no floor overlap, nothing outside the walls, surface items sitting on their parents, and determinism.
- `node test/anim.test.mjs` checks the wave sweep, bands, per-wave cap, layer order, out-reverse and pose endpoints.
- `test/accept.py URL [--writeback]` runs 27 browser checks with real mouse and keys:
  - drag-draw, shared wall plus door, overlap refusal, select, roll, lock survives roll, delete;
  - camera pin error 0.000 ft on orbit, pan and zoom;
  - dials persist and replay, an E sweep lands east tiles first, A/B, scrub;
  - cube swap, cut-away, fire lights, stress ×4;
  - all 11 room types, write-back, phone width, no page errors.
- 27/27 pass on the live URL.

**Findings so far (inputs for Harry):**
- **Kit meshes needed surgery.** TRELLIS baked the plate's floor in as a slab under every wall piece, laid `door-plank--rough-timber` flat on its back, and turned `wall-doorway--dressed-stone` sideways. The runtime pass now stands thin "edge" kit pieces up, turns them to face Z and cuts the slab off where the cross-section narrows.
- **Scaling props by height blows up meshes that lie down** when the catalog has them standing (a lute case came out 6.4 ft). The default is now largest-dimension-to-largest-dimension. "By height" stays as a bench option.
- **Facing:** all 10 directional meshes checked have their front on glTF +Z (Gemini read of 4-view renders).
- **Performance shape** (software GL here, so fps is meaningless headless; the real numbers come from Harry's machine):
  - one 30×20 common room is about 100 draw calls, 300k triangles and 30 MB of loaded textures (estimated);
  - all 11 room types together are 910 draw calls, 2.4M triangles and 72 MB.
  - This argues for instancing repeated props, the 3k tier for more things, and texture atlases.
  - Runtime GLBs have a median of 210 KB; 490 meshes total 99 MB.

**Known gaps (deliberate for v0):**
- Render sets (dressed tables etc.) aren't assembled yet.
- When a neighbour adds a door after a room is laid out, the room's summary warns if furniture blocks it ("roll again to re-plan") rather than re-planning automatically.
- Barns use the plank door, since the double barn door is 2 cells wide.
- Corner posts are `post-timber` for both families.
- Floor tiles are one draw call each so they can spin individually; instancing comes later.
- An oversized room (≥2.5× the usual size) gets a "will read sparse" note instead of extra contents.

### Harry's first look (2026-09-30, same evening) → fixed

Verdict: "10 out of 10 for a oneshot." His four notes, each now fixed and covered by an acceptance check:
1. **Walls and floor flashed before warping in.** Fix: every piece is born hidden, and only its animation or its final rest pose reveals it. The walls toggle no longer reveals unplayed pieces. A16 runs a per-frame flash detector over create and roll: 0 flashes.
2. **Camera-side walls should come in later.**
   - At play time, wall pieces that sit between the camera and the room become a `walls-near` layer.
   - On the way in they start only after everything else has started. On the way out they leave first.
   - The dial "Camera-side walls arrive last" defaults to on. Checked by A17 and the anim tests.
3. **Benches long side toward the wall.** Two of the three `bench-long` meshes (and the water trough, the kitchen prep table, and one single bed) are modelled long front-to-back, against their catalog box. The solver now pre-turns any prop whose long axis disagrees with its catalog W/D by −90°. Checked by A18.
4. **More stuff, mainly the front desk** (Harry narrowed it). The desk program now adds:
   - the keeper's chair, shelves and strongbox behind the counter, and 4–7 things on the counter;
   - waiting benches, luggage and guests' odds;
   - wall dressing, a mat inside the door, and a lantern and chandelier.
   - Result: 11 → 20 objects at 15×15 ft, 11 → 33 at 30×30.

The suite is now 30 browser checks; 30/30 pass on the live URL.

### Faces & skins GPU dials (Harry 2026-09-30, late)

- **What's in the bench:** "Faces per object" (shipping tier, 1.5k / 3k / 5k / 10k / 20k / full ≈50k), "Skin (texture) size" (shipping tier, 64–1024 px source, 2048 upscaled) and "Apply to" (props, or props + walls).
  - Every object swaps live to a real geometry level (`assets/lod/f*/`, geometry-only GLBs from `prep/blender_lod.py`, with the same kit fixes and recentring) and a real texture (`assets/tex/t*/`, from `prep/lod_tex.py`).
  - Total size is 1.6 GB.
  - Texture orientation was checked: Gemini compared the shipping tier against 20k / 1024 on the same view and found no mirrored or scrambled skins, and no visible sharpening at that distance.
- **Bench memory is now counted from the scene:** unique textures actually on visible meshes (w × h × 4 × 1.33) and geometry bytes. Before, it was everything ever loaded.
- **Measured in one common room:** shipping tier is 301k triangles, 17 MB texture, 8.5 MB geometry. Full faces is 2.15M triangles and 55 MB geometry. 1024 px skins is 215 MB texture. Fps has to come from Harry's GPU.
- **Write-back recovery:** a whole-file test cleanup swept Harry's first preset (21:28) into the test archive. It's restored, and `test/archive_test_writes.py` now moves only records tagged as tests.
- The suite is 31 checks (A19 = the faces & skins dials); 31/31 pass live.

### Round 3 (Harry, 2026-10-01 morning)

- **Floors:** 16 flat floor materials (catalog `floor-*`, all in the `any-shell` floor slot), each with 4 colour-matched versions.
  - Generated with `style/heroic-handpainted.floor.md` (Gemini, flat only, no 3D).
  - Processed by `experiments/2026-10-01-floors/make_seamless.py`: low-frequency flattening, a periodic crop for patterned floors, an edge cross-fade for the rest. Then `normalize_variants.py`: grain direction plus colour matching.
  - Each room type has a floor list; the room panel has a Floor dropdown.
  - Bench "Floor tiling" dial: continuous (default, no seams) / shuffle (versions + rotate + mirror) / smart. Gemini still rates the 5-ft repeat visible; Harry's eye decides.
- **Rugs:** 11 new catalog rugs (round, oval, braided, fine round, half-moon hearth, striped, rush mat, sheepskin, bearskin, wolfskin, cowhide), plus `rug-hay-scatter` (3 shapes) for stables and barns. Floor flats use the image's own aspect.
- **Ratings filter:** masking-flagged meshes and anything under 3★ are hidden by default (unrated kept). This hides `table-trestle--s2`, the rough-timber doorway and window, `wagon`, and others. Timber rooms fall back to stone doorways, and to plain wall where the window is hidden.
- **Camera:** left-drag pans; middle-drag (or shift-drag) orbits with yaw and pitch, never below the floor.
- **Background preload** of the whole shipping tier while idle (`?nobg` turns it off for tests).
- **Doors and walls:**
  - 4 door types by context.
  - Wide openings of 10/15/20 ft (barns; stables 10/15; grand doors 10), with jamb posts.
  - Per-room wall family (seeded stone odds, plus a Walls dropdown) and stone pillars at stone corners.
  - Stall doors in stables.
- **Tests:** 37 browser checks in staged fresh browsers; 37/37 pass live.

### Round 4 (Harry, 2026-10-01): default preset, 10k faces, object tags, bandwidth meter, orientation fixes

- **Default preset = "harry-v1"**, his 21:38 send, in `js/anim.js` `defaultPreset()`. Fauna's first defaults remain a built-in "fauna-default-v1" in the Load list. Storage key bumped to `tuner.current.v2` so old browsers land on harry-v1.
- **Faces default 10k, applied to props + walls.**
  - Ladder visuals size themselves from their own bounds. The ladder kit pieces differ from the shipping GLBs by up to 48% in wall depth, because the slab was cut before decimating.
  - Background and foreground preloading follow the current faces/skins dials.
  - A common room is 760k triangles at 10k against 339k at the shipping tier.
- **Object tags:** every object except floor tiles gets a stable, scene-unique 3-letter tag (hash of room seed + uid; walls hash their edge key).
  - A plain click selects an object: cyan box, floating tag, and an Object panel with id, sku, rule, sizes, position, yaw and rating.
  - Esc clears the selection.
  - Tags also appear in the tooltip, the layout JSON and the "Send room + note" payload (`selectedObject`).
  - A bench toggle shows every tag in the selected room.
- **Bandwidth meter in the HUD** (`js/net.js`):
  - wire bytes from Resource Timing, spread over each transfer into 250 ms buckets;
  - the rate against the best sustained 1.5 s rate (green / amber / red);
  - session total, spawn and preload queues with an estimated drain time;
  - a LOADING-BOUND flag while a spawn waits on the network.
  - The same numbers go into stats and write-back.
- **Orientation:**
  - `data/orient.json` (Gemini front sweep) replaces the long-axis heuristic; the footprint is the AABB of the yaw-rotated bounds.
  - R / Shift+R (or ↺/↻) turn the selected mesh ±45° (kit pieces ±90°, since they're stretched per axis). Every instance of that sku turns.
  - Corrections persist in localStorage and POST as write-back kind `orient`. `GET /tuner/orient` applies them on load.
  - Since 2026-10-02 every correction belongs to a **mesh**, not a sku: `library.json` sku.mesh = `<src>/<sku>@<hash>`, orient.json and `tuner.orient.v2` are keyed by it, and new records carry `data.mesh`. Older sku-only records apply to the mesh that sku showed when they were made (`was`). Inn-02 front sweep: `prep/orient-sweep-inn02/`.
  - Camera tilt keys moved to PageUp/PageDown.

### Layout engine v2: principles (2026-10-01, fork build)

`js/solver2.js` (v1 `js/solver.js` intact) implements the principles Harry and Fauna worked out. Room **roles** come from `walls.js` `ROLES`:
- **hub:** common room.
- **passage:** front desk, hallway.
- **terminal:** guest, fine, privy, storeroom, cellar.
- **uses:** the kitchen uses the cellar and storeroom.
- **mixed:** stable and barn; "who counts" is recorded per type.

Order of operations per room:
1. **Key purpose first, with pride of place by role.**
   - terminal: the destination, deep and diagonal from the door, with no coffin bed; the privy seat stays out of the door's line;
   - passage: the checkpoint beside the through-line, keeper out of the entrance's blast line;
   - hub: the hearth and bar are the poles, with the hearth on a short wall of a long room;
   - uses: the work triangle, off the guest line.
   - If it fails: `purposeFail`, shown on the summary's first line.
2. **Desire lines.** A* on the occupancy grid, 3 ft wide, reserved as keep-clear: approach, aisle, through, loop, service, lane. Hubs place their core islands *before* the loop, so the swirl wraps them.
3. **Zones** from an ordered menu per type, growing with area: rug + inward seating + focus + light, with size fallbacks.
4. **Edges to a density target** (props per 100 sq ft).
5. **Checks:** command position (tortoise / phoenix / flanks / door view), key feature in view from the doorway (privacy rooms: out of its line), paths clear.

Best of 4 candidates per seed; the score is exposed.

**Door policy v2** (`computeEdges(rooms, {engine: 'v2'})`):
- terminals never open into each other, and keep one door (to the best passage or hub neighbour);
- a terminal's street door closes once it has an interior door;
- no door straight across a non-passage room;
- hubs spread their doors, passages want opposite doors with an offset, terminals' doors hug a corner;
- reachability is enforced: a stranded room gets a door, and a sealed building gets a fresh entrance.

**Tests:**
- `test/solver2.test.mjs`: about 66k checks over 220 rooms, the v1 invariants plus principle cases (5×5 privy gets a seat, no coffin beds, desk through-line clear, hub loop, terminals, reachability, density at 60×40 ≥ 85% of 30×20, zones grow).
- `test/v2_fuzz.mjs`: 60 random buildings.
- `test/compare.mjs`: v1 vs v2 under the same engine-neutral `audit()`.
- `test/accept_v2.py`: browser checks.

UI: `js/overlay2.js` (paths, zones, sight lines, purposeFail outline) and `GrabCamera.doorView()`.

### Walls and doors (Fauna, 2026-10-01 midday)

- **10 new wall meshes on fal ($3.00).** New families half-timber, fieldstone and noble-interior (panelled plaster); rough-timber s2 (braced) and s3 (log); dressed-stone s2 (replacing the masked one); windows for each new family plus a timber replacement.
  - The images forbade floors and slabs; all came out thin and upright.
  - Rooms pick a family by weighted odds per type (walls.js FAMILY_ODDS), or via the Walls dropdown. Segments pick among a family's versions per edge.
- **Doors.**
  - Every door fills its whole opening between jamb posts. Single doors get slim 8-in jambs and a 52-in door.
  - The inn-01 plank and grand door meshes had frames baked in, so two leaf-only doors were made on fal ($0.60) and are preferred.
  - Gemini confirms the barn, grand and plank doors fill their openings.
- **Bug fixed:** the Walls, Floor and filter handlers weren't counted as busy, so tests and the loading-bound flag saw rooms mid-rebuild.
- 49/49 local, 51/51 live (the first live attempt was a headless GPU-memory flake on Roll).
- **Wired in (13:13):** a bench "Layout engine" selector (v2 by default), overlays for paths, zones and sight lines, a red purpose-fail outline, and a "Doorway view" button. Switching engine re-plans every room with the same seeds; write-back carries role, checks, zones, paths and score.
- **After Gemini's doorway read** ("a table right inside the entrance"), hub and passage doors get a ~6-ft landing.
- **Tests:** browser 51/51 live (second attempt; the first hit headless GPU memory) and `accept_v2.py` 8/8 live.

### Whole-map send and object notes (2026-10-01 evening)

- **Object notes.** The Object panel has a note box (Ctrl+Enter or blur saves), one note per tag. Notes persist in localStorage and are listed under Layout; clicking a tag re-selects its object, × removes the note.
- **Send whole map + notes** (write-back kind `map`): every room's compact layout with tags, roles, zones, paths and checks; all doors; all object notes (each with id, sku, rule, why, zone, room, position, facing); room summaries; preset, camera, solver, engine and bench. Notes clear after a successful send. "Copy whole map" is the paste fallback.
- **Server:** the ratings server accepts `map`, up to 3 MB; nginx's body limit is 4 MB. `read_writeback.py` prints maps with their notes.
- Tested end to end live: 2 rooms → 28 KB.
- **First real numbers from Harry's machine** (kitchen sends): 56–60 fps at 258 draw calls, with 10k faces.

### Storerooms and cellars: aisles of shelving (v2, 2026-10-01; Harry's spec)

Function `aisleStore()` in js/solver2.js, called from KEY.storeroom / KEY.cellar after the deep-wall key feature.

- **When it applies.** Rooms from about 20×20 (interior ≥ 330 sq ft and ≥ 17 ft on the short side) fill the middle with parallel rows of shelving. Smaller rooms, or rooms where no row unit fits, keep wall storage; the fallback restores the grid, so there are no phantom aisles.
- **Four choices, random per generation.** They're seeded from the room's base seed, so all best-of-4 candidates share them and Roll again re-rolls them. The summary's "Aisles:" line reports them all.
  - rows: single or double (back to back);
  - aisles: point away from the door, or run along the long axis;
  - receiving area by the door: yes or no (dropped and reported if it would starve the rows);
  - cellar rows: casks & wine racks only, or mixed with shelving.
- **Geometry.**
  - Aisles are 3.5–4 ft. A cross aisle sits at the door end, or at the door when the door is on a side wall. Extra cross aisles come every 25–35 ft, spaced from the door's.
  - End caps (one per face of every row end at a cross aisle) are sized to the biggest cap item.
  - Wall shelving goes on every wall but the door's. Lanterns hang over the aisles about every 16 ft.
  - The cellar stair or trapdoor is placed after the aisles are reserved, so it can't block them.
  - Receiving stock flanks a clear corridor from the door to the cross aisle.
  - The wall band on the key feature's wall grows to the feature's real depth (cask rack 4 ft, tun 9 ft), so no aisle runs into it.
  - Unit depths, lengths and cross-aisle edges are snapped to the 6-in occupancy grid. Before that, back-to-back faces and units beside cross aisles "collided" in shared half-cells: 7 of about 30 units placed, 0 end caps.
- **Paths.** Aisles and cross aisles are recorded as paths (overlay) and reserved. Their lines stop just short of the far shelving they dead-end at. Stacked rooms drop the generic door→feature walk (the aisles are the desire lines), and the doorway-view check passes when an aisle is visible from the door ("down the aisles").
- **Numbers** (20 seeds each):
  - 40×60 storeroom: stacks 20/20, objects 69 → 88, floor coverage about 25%;
  - 40×60 cellar: stacks 20/20, objects 114 → 117, coverage about 33%;
  - 20×20 storeroom: stacks in about half the seeds (the rest fall back);
  - 20×20 cellar: none (rack rows are deep), from about 25×25 up.
- **Density.** Props per 100 sq ft is the wrong yardstick for stacks: a 40×60 storeroom reads about 3.5 against a target of 11, because one shelving unit covers about 14 sq ft. The summary now also reports floor coverage. **Harry to decide:** a coverage target for storage rooms instead.
- **Tests.**
  - test/stacks.test.mjs (1,333 checks): middle-third coverage (min 41%, mean 59%); every aisle end walkable from the door (BFS); choices vary across seeds; very long rooms get extra cross aisles; a 40-room random-size fuzz; no drawn aisle or cross-aisle crosses a blocked cell.
  - The existing suites are unchanged and pass: solver2 (220 rooms), v2_fuzz (60 buildings), v1, anim.
  - In-browser: 0 blocked samples on every path, and the rendered boxes of 62 props have 0 overlaps.
  - Gemini twice read "cross aisle runs over shelving" on top-down and angled shots. The measurement shows the only object within 1 ft of the cross walkway is the far-wall shelf it dead-ends at, so it's a vision misread (likely the end-cap barrels).

### Floor expansion 2 (fork, 2026-10-01 evening): flat images only, no fal

- **Composed patterned floors** (`experiments/2026-10-01-floors2/compose.py`).
  - Gemini paints single tile surfaces (red, white, black, terracotta, delft; centre-cropped to drop bevels). PIL lays them on an EXACT grid with grout, plus random variant, rotation and tint jitter per tile.
  - The layout is a 20 × 20 ft periodic composition cut into 16 cell tiles (`--gIJ`). The tuner picks the tile from the world cell (mod N), so cells and neighbouring rooms continue exactly and repeat only every 20 ft.
  - New floors:
    - `floor-checker-red`, `floor-checker-bw`: 4 × 4 per cell, 15-in squares;
    - `floor-brick-herringbone-bw`: rule from `find_herringbone.py`, coloured by diagonal strand (Gemini A/B: colouring by orientation read as basketweave);
    - `floor-tile-kitchen-small`, `floor-tile-delft`, `floor-tile-harlequin`, `floor-tile-hex`.
- **Flagstones** (`compose_flag.py`): a relaxed periodic Voronoi stone layout (20 ft) filled with painted Gemini flagstone texture (sampled without wrap), with mortar joints and a bevel. `floor-flagstone-broken` drops ~18% of stones to dirt and cracks ~30% of the rest.
- **Scatter floors** for stables and barns (main.js `SCATTER`):
  - `floor-earth-straw` = the new low-feature `floor-earth-bare` base laid straight, plus seeded decals: 7 hay scatters (`rug-hay-scatter` s1–s7) and 4 `decal-dirt-patch`.
  - Decals get random position, turn, mirror and stretch, soft alpha (feathered, blue spill removed; dirt gets an irregular oval falloff), and stay inside the walls.
  - Bare and packed earth get sparse dirt.
- **Measured repetition** (top-down self-correlation one cell over, minus half a cell over; old planks = +0.33):
  - earth-straw −0.19, earth-bare −0.19;
  - flagstones −0.03 / −0.01 (repeat at 20 ft only);
  - kitchen tiles and delft ≈ 0;
  - checkers, herringbone, harlequin and hex score high at every lattice shift by construction (pattern geometry, not texture repetition).
  - Gemini rates the straw floor repetition 1.
- **Room floor lists:**
  - kitchen + B&W herringbone, both checkers, kitchen tiles, hex;
  - stable + bare earth, rough boards, large/broken flagstones;
  - barn + bare earth, large flagstones;
  - fine room + delft, harlequin, B&W checker;
  - desk + harlequin, hex, delft, B&W checker;
  - cellar + broken/large flagstones; hallway + harlequin, large flagstones; privy + bare earth.
- 11 catalog entries (`floor-*` ×10, `decal-dirt-patch`); the catalog is clean at 2,823.
- **Follow-up idea:** the old Gemini-painted plank and board floors still repeat at 5 ft (+0.33). Composing planks from painted board strips, with random lengths and staggered joints, would fix them the same way.

### Stables: rows of 5×10-ft stalls (v2, 2026-10-01 evening)

`js/solver2.js` `stableStalls()` replaces the old one-row, 10-ft-spaced stable. Harry's spec as must / rolls / grows:
- **Must, stalls:** 5 ft wide × 10 ft deep.
  - A 10-ft `stable-stall-partition` every 5 ft, running out from its back line.
  - A `stable-stall-gate` across each 5-ft front.
  - A wall manger (`rural-manger-wall--s2`, 75%) or a water bucket at the back.
  - Dense hay: 2–3 hay-scatter decals per stall, plus a bale or pile in about 40% of stalls.
  - Stall interiors are claimed and blocked, so zones and edge dressing stay out. Tack never mounts on a wall that stalls back onto.
- **Must, centre aisle:** at least 9 ft, about 10 ft nominal. It's the horses' through-line, reserved as keep-clear and drawn on the path overlay; the main door walks onto it.
- **Rolls (seeded per generation, shared by best-of-N):** stall rows on one long wall or both. "Both" is dropped and reported when the room is too narrow. One-wall rooms cap the aisle at 13 ft and leave an open band by the bare wall.
- **Grows:**
  - Back-to-back middle double rows (a shared back line of partitions end to end) whenever the depth allows; in practice from about 60 ft deep with both walls.
  - Rows longer than about 40 ft get cross aisles every ~30 ft.
  - An end band of 6 ft for tack, feed and muck zones at the end away from the door, at both ends in stables ≥ 50 ft long.
- **Grid alignment matters.** Partitions sit in whole 6-in cells, and middle back lines snap to cells, with aisles measured from the snapped line. Otherwise gates or whole middle-row sides collide with partitions straddling a cell line (0 gates; one middle side missing).
- **Summary:** a `Stalls:` line (count, walls choice, middle rows, aisle width, cross aisles, gates / mangers / buckets / hay, floor coverage). The key feature is the nearest stall gate visible from the door.
- **Tests:**
  - `test/stable.test.mjs` (555 checks, 0 failures): stalls 5 ft on centre, 10 ft deep, gate and hay in every stall, aisle ≥ 9 ft and walkable from the door to both ends, one/both varying, 75×75 with middle rows and 25–34 stalls.
  - All other suites unchanged and passing.
- **Measured against Gemini:**
  - Gemini claimed blocked aisles, missing or floating gates, overlapping middle rows, and hay everywhere.
  - In the browser: 0 objects in aisles; every gate between two partitions; 0 overlaps (layout and rendered); stall hay 100% inside stalls.
  - "Hay everywhere" is the room's `floor-earth-straw` floor.
  - A correctly aimed close-up from the aisle reads gates spanning the fronts, none missing.

### Zones from ROOMS.md in v2 (2026-10-01 evening)

Built into `js/solver2.js` from ROOMS.md (the status marks there are updated); tests in `test/zones.test.mjs` (2,450 checks).

- **Zone anatomy** (new `Ctx2` machinery):
  - **working faces** (oven 4 ft, cooking hearth 4, wardrobe and cupboard 2.5, washstand and vanity 2, fireplace 2, privy seat 1.5, bed sides) are kept clear after placement, and checked free when the anchor itself is placed; `wall()` routes face items through `put()`;
  - **`companion()`**: within reach, never in the face;
  - **`divider()`**: a folding screen on a zone's open edge, between the zone and the door, never wall dressing;
  - **like with like** (barrels, crates, sacks, bales join their kind in the edge fill; tubs stay in the bathing zone);
  - **privacy gradient** (fine room: bathing and dressing deep, sitting nearer the door);
  - **floating seating** (from 450 sq ft, zone seats stand ≥ 2.5 ft off walls; no chairs as edge dressing);
  - **one camera angle protected:** once the key feature is placed, nothing tall may stand on the door → feature sight line.
- **Growth modes:**
  - promote: the fine-room bed becomes a central island from 30 ft both sides and 1,000 sq ft (never in the door's line), with a rug, nightstands and a foot chest;
  - repeat: kitchen cooking lines ×1 → ×3 along the walls; privy seat banks;
  - extend: the bar, via `barRun(…, maxN)` (v1 default unchanged);
  - the guest room becomes a dormitory from 380 sq ft.
- **New zones:**
  - common: entry landing, serving station (when a kitchen door opens off it);
  - kitchen: bake corner (the oven picks a spot with clear wall for the peel), serving pass, prep island, staff table;
  - guest: window seat;
  - fine: bathing, dressing, private dining, window seat, servant's corner;
  - cellar: cold store, tapping spot; storeroom: tally desk (door-side fallback);
  - desk: notice wall; hallway: display wall;
  - barn: animal pens (stall partitions + gates), feed store.
- **Style rolls** (`ctx.roll`, once per generation, shared by best-of-N): tubs, window seat, servant's bed, staff table, dormitory beds. Shown on a `Rolls:` line. New summary lines: `Anatomy:`, `Growth:`, `Rolls:`.
- **v1 fix:** random ceiling items keep their whole rotated footprint inside the walls (margin = half their diagonal).
- **Open:** very big fine rooms and kitchens still sit under their density targets (the middle stays empty). Gemini agrees.

## 2026-10-01 late: repeat growth, aisle-room grammar, axial focal, grade floor (v2)
- **One aisle grammar:** `aisleStore(ctx, kind, feature, cfg)` is now shared. The cfg sets:
  - the row item, a mixed unit pool and a foot item;
  - aisle width, wall and end bands, caps and ceiling hangings;
  - a downgrade (double → single), fill-slack (a single row in leftover depth) and avoid-blocked (slide the pattern off anything already placed, and push the door cross aisle inward).

  Storeroom and cellar defaults are byte-identical (0/54 rooms differ).
- **Dormitory middle rows** (`dormRowCfg`): rows run head to head (double or single, rolled), each bed with a foot chest; 3–4-ft aisles, wall beds on the long walls. Summary line `Dorm: N beds in M rows`. A 50×60 holds ~22–34 beds (11–16 in the middle); a 30×30 keeps wall beds only.
- **Kitchen, uncapped:**
  - cooking lines 1 + 1 per 350 sq ft over 450 (≤10); bake corners repeat per 700 sq ft (≤4); the scullery repeats per 1,100 sq ft;
  - **industrial kitchen** (≥700 sq ft, short side ≥24 ft, via `kitchenRowCfg`): work rows of prep tables with cauldron and chopping-block segments and end caps, 4–5-ft working aisles, cross aisles, hung hams, onions and kettles;
  - the serving pass sits against a wall before the rows; candidates without rows lose 15 points in best-of-4;
  - **`kitchenFill`**: wall racks, larder runs and stacks, and loaded surfaces. Density is ≥ target at every size (30×30 min 13.4, 40×60 min 11.6, 60×60 min 10.7; target 10).
- **One-wall stables:** the bare long wall gets tack, feed and grooming clusters (mean 98% of that wall within 3 ft of tack or feed); the aisle stays clear.
- **Principle 8, axial focal** (`focalPlace`): guest and fine beds, the front-desk counter, and the common hearth when the facing wall is short go centred on the wall opposite the main door, with symmetric flankers.
  - The focal piece is exempt from coffin and blast.
  - It falls back for a small room, a short wall or a door on that wall. A window doesn't stop it: the piece stands in front, and that window has no drapes.
  - A one-door desk takes the axial spot before the through-line, which then ends at the counter.
  - Summary line `Focal: …`.
- **Principle 9, grade floor:** `ROOM_WEALTH`, `WEALTH_FLOOR`, `POOR` and `gradeOf()`. `ctx.has()` refuses below-grade objects, so a fine room never gets a straw pallet, a three-legged stool or chipped and broken things. The servant's corner grew to 8×8 for a common bed.
- **Tests:** new `test/repeat.test.mjs` (dorms, kitchens, one-wall stables; 341,920 checks) and `test/focal.test.mjs` (focal beds, counters, hearths, grade floor; 694 checks). All suites green.
- **Open:**
  - big dorms are under density (~3–4 against 8);
  - very big fine rooms are still under;
  - the staff table isn't guaranteed in an industrial kitchen;
  - the peel is by its oven in ~85–95% of kitchens.

## 2026-10-04: Selection lab (Harry: "I'm not loving what 'Selection' looks like")
- **Shared renderer** `js/fx/selection.js`, used by the tuner and the game (engine/client/world.js `sharedSignal`, loaded
  through engine/client/tuner.js). API: `select(item, 'selected'|'hover'|'hidden'|'pending', seatColor, {style, parent, tag})`,
  `clear(item?, state?)`, `tick(dt, now, camera)`, `set(params)`. Everything is depth-tested; the per-state **ghost** dial
  is the only see-through (ground styles only).
- **Ten styles**, each with its own dials: glow halo, footprint outline, ground ring (solid/dashed/rotating/disc), rim
  light, ink outline (constant pixel width), spotlight (scene dim with a bright pool, and/or a light cone), corner
  brackets (world corners or HUD), lift & bob (carries what sits on it; contact shadow), orbiting motes, tint wash.
  Hover and hidden-from-players each pick their own style. Colour: the seat's or fixed. Multi-select: each / each +
  group outline / group only.
- **Panel** `js/fx/selpanel.js` (folded "Selection" group): style tiles, per-state tabs, compare (one style per
  object, labelled), hover · selected · hidden side by side, multi-select ×3, presets (save / load / send as kind
  "fx", data.fx "selection"), **Use in game** (kind "house", data.selection; GET /tuner/house returns `selection`).
- **Default** = the game's halo as it was (0.16 ft, pulsing, seat colour; hover 0.07 white; hidden violet), with the
  hull's normals averaged per position (the split normals tore it into spikes).
- **Found on the way** (Gemini blind reads + measurement): ground styles sat under rugs (now on what the thing stands
  on); lifting a table left its plates inside it (riders now lift too); the HUD brackets floated over near
  neighbours (world corners are the default now).
- Tests: `test/sel_ui.py` (panel, every style draws, dials, hover, synthetic and real-room occlusion, compare, presets,
  Use in game), `test/sel_shots.py` (numbered shots for a blind read).

## 2026-10-04: Atmosphere: fog & smoke (Harry: "super duper class A+"; fog "that will swirl when you pass your mouse through it")
- **Shared module** `js/fx/atmos.js`, created by `fx/index.js` (`fx.atmos`), so the game gets it through the same
  `fx/index.js` import as lighting and fire. It is a 2-D stable-fluid sim (Stam / Pavel Dobryakov's method, written
  here) on the floor plane, over a domain that covers the rooms and grows in 20-ft steps:
  - **velocity + density**: ping-pong half-float targets at 128 / 192 / 256 cells on the long side;
  - **mask** canvas: R = wall at fog height (doorways open), G = indoors (*landed* floors), B = wall at the ceiling;
  - **walls are obstacles**: zero velocity, Neumann pressure, nothing advects through them.
  - Fog detail (the fog bank's noise) lives in the simulated field, so a stir carries it round. A stirred place keeps
    its eddies while it moves, then heals back to the bank.
- **Stirring**: the cursor projected to the floor, anything that moves (dragged things, game objects and pawns, spawn
  flights), fire puffs, and room arrivals. Vortex confinement is applied only where something stirred; uniform
  confinement fed on numerical noise and the fog boiled forever. Slow residue is damped, and a weak "breathing" churn
  keeps still fog alive.
- **Render**: one pass in the post stack (after N8AO), at 0.35 / 0.5 / 0.75 resolution, capped at 720 / 1100 / 1800 px.
  - It raymarches the fog slab and the room air against the scene depth;
  - then draws the soft particles, candle wisps and dust motes, depth-faded;
  - and composites with a joint-bilateral (depth-aware) upsample, premultiplied, before bloom / tone mapping.
  - Light comes from two 2-D light maps (fog height, under the ceiling): every fire light, shadowed in 2-D by the wall
    mask, so fog never glows through a wall.
  - The final EffectPass now dithers (8-bit contour rings around big glows).
- **Smoke**:
  - hearth smoke moved into the soft batch (three.quarks soft particles against the stable depth: no hard lines at
    the mantel), firelit at the mouth;
  - a ceiling pool fed by the fires (spreads, stops at walls including doorway tops, thickens with fire count);
  - candle wisps (one instanced draw);
  - a puff when a fire goes out (the game's light toggle; the tuner's "Put fires out").
- **Heavy fog** (density G channel):
  - **the unbuilt world** under a fog sea (a dial; also past the simulated domain). A room's arrival blows it away
    tile by tile as floors land;
  - **fog of war**: `fx.atmos.setRegions([{id, rect|poly, fog, hidden}])` fogs hidden places near-opaque (dilated
    over their walls) and swirls away on reveal. Per-room `fog` overrides the preset's density (for the room /
    building menus later).
  - *Presentation only*: the relay's visibility filtering still decides what a player receives.
- **Panel**: folded "Atmosphere: fog & smoke" with groups ground fog / swirl / light / haze & dust / smoke / unbuilt &
  fog of war / quality, plus a debug view (density, velocity, mask, light, pool, heavy).
  - Built-ins: clear, morning mist, crypt fog, smoky tavern, storm haze.
  - Save / load / Send (kind "fx", data.fx "atmos") and **Use in game** (kind "house", data.atmos; ratings_server
    returns `atmos`). The game stays clear until then; `?atmos=<built-in>` previews it in tuner or game.
  - New dial type `color` in ui.js.
- **Game**: engine/client/tuner.js passes `house.atmos`; world.js passes `initial.atmos` and `structure` (its shell
  entries).
- **Cost** (`test/atmos_bench.py`, RTX 3060, 1620×1128 canvas), the module's own GPU timers:
  - sim 0.07 / 0.10 / 0.15 ms (low / medium / high);
  - volume + particles + composite 0.25 / 0.48 / 1.45 ms;
  - 15–31 sim passes plus 3–6 draw calls; CPU ≈ 0.3–0.7 ms a frame.
  - Laptop iGPU estimate: GPU part ×6–10 (~3–5 ms at medium): medium is the default, low is for laptops.
- Tests: `test/atmos_ui.py` (27 checks; `ATMOS_GPU=1` runs it on the GPU), `test/atmos_bench.py`.

## 2026-10-04: Water (Harry: "let's try the pool demo. For today let's stay on WebGL ... there will be rivers, canals, fire, etc, so you know, let's get something good"; bar "super duper class A+")
- **Shared module** `js/fx/water.js` (+ `js/fx/waterpanel.js`, tuner-only tools), wired through `fx/index.js`, so the
  game gets it through the same import. Built from techniques, not code: three.js's MIT examples (webgl_gpgpu_water's
  heightfield update, Water2's two-phase flowmap advection) and the published pool-demo ideas (Evan Wallace's WebGL
  Water: heightfield, refraction, caustics; it has no licence, so none of its code). Nothing new is vendored; Three
  Water Pro is not used (its licence forbids open source).
- **Vessels**: every placed thing whose MESH has a water record gets a surface clipped to its footprint at its level.
  Records: the Alignment Bench's (`GET /tuner/water_surfaces`, kind `water_surface`, mesh-keyed, fractions of the
  GLB bbox) win per mesh; else `data/water_auto.json`, the bench's own auto fit run headlessly over its whole queue
  by `prep/water_auto.py` (29 meshes; barrels, the cauldron and the washboard tub are skipped until Harry confirms
  them). The surface follows the mesh root's world matrix every frame (spawn, settle, drag, LOD swap). The edge is
  pushed back out by the bench's inset (an edge-parallel offset) so the water meets the wall; the depth test hides
  what reaches into it. Footprints ≥ 1.25 ft use the full program; smaller ones the cheap one (fewer waves, no
  SSR).
- **Look** (one pass in the post stack right after the scene, before contact shadows and the atmosphere, so both see
  the water): copy the frame (half res on laptop) as the refraction source, then draw every surface into the frame
  against the scene depth: Beer-Lambert absorption over the real path to the floor, refraction along the rippled
  normal, caustics on the floor as seen through the water (the wave field's focus, 1 / (1 + depth · Laplacian)),
  Fresnel reflection (room / sky; screen-space reflection of the vessel walls and banks), every fire light's glint
  (a sharp GGX core plus a broad streak), a "sheen" term (how the ripples change the mirrored light: flat water adds
  nothing, ripples read as bright and dark bands even at night), and a meniscus that lights the far wall.
- **Ripples**: one GPGPU heightfield atlas (ping-pong half-float, 1024² on laptop / high, 512² on low) in 4×4
  blocks; a surface borrows a block while something disturbs it (cursor, a dragged / dropped thing, a wading pawn,
  `fx.water.touch()`), with a boundary (ripples bounce off the bucket wall) and, for bodies, a per-texel flow field so
  ripples ride the current round the bends. Idle surfaces use an analytic wave field (domain-warped sines, filtered
  by pixel footprint), so a room full of buckets simulates nothing.
- **Bodies**: `fx.water.setBodies([{id, kind: 'channel'|'pond', pts, width, depth, flow, dir, y, ground}])`. A
  channel is a ribbon along a centripetal Catmull-Rom spline (flow fastest mid-stream), a pond a ring surface. Each
  draws its own bed (bank gradient), wet banks, foam at the banks and around anything standing in it (bow upstream,
  a wake drawn out downstream), current lines and sparse flecks. A channel's surface detail lives in its own
  (arc length, across) frame and drifts downstream as one rigid layer (no cross-fade), so it visibly flows; ponds use
  the two-phase flowmap. The scene depth tells the ground (the bed replaces it) from things standing in the water.
- **Panel** (Water): on/off, Water demo (a yard of the bench's vessels, a brazier, a lantern post, a river with a
  crate in it, a millpond; it clears the default morning mist), Pawn wades, Drop a stone, Draw a river / a pond
  (click points, Enter or double-click) with width, flow and depth, Clear. Dials: shallow / deep colour, clarity,
  deep glow; reflection, refraction, gloss, firelight glints, meniscus; ripple size, speed, damping, idle breeze,
  interaction; flow speed, foam, bank gradient, bed colour; caustics amount and size; vessels on / auto-fill; quality
  (low / laptop default / high). Presets: well-water, clear-stream, murky-canal, millpond-night, rain-barrel (+ off).
  Save / Load / Send (kind `fx`, `data.fx = "water"`), **Use in game** (kind `house`, `data.water`; the server's
  `GET /tuner/house` now returns `water`).
- **Game**: `fx/index.js` fetches the house water itself (no engine change for the look). Without a house water the
  game's vessels stay dry and placed bodies draw with well-water. Engine hooks (tiny): `core/commands.js`
  `water.set {id, body}` / `water.remove {id}` (area commands, class `object`, validated, undoable; entity kind
  `water`); `client/world.js` passes the area's water entities to `fx.water.setBodies` on sync, skips them in
  `add()`, and hands its pawns to the water as movers (they leave wakes). Placing one today: the command (relay / GET
  API / console); a draw tool in the game UI is the engine's next step.
- **Costs** (`test/water_bench.py`: RTX 3060, ANGLE/Vulkan, 1620×1128 stage, GPU timer queries on the water's own
  pass and sim; whole-frame GPU time, 3.5–5.8 ms, was too noisy to separate costs this small): 9 vessels in view
  0.08 ms low / 0.10 laptop / 0.18 high, one draw call each plus one frame copy; the live ripple sim (5–6 blocks)
  0.05 ms at 512², 0.10–0.17 ms at 1024²; the river + pond covering ≈40% of the screen (SSR 10 / 20 steps) bring the
  pass to 0.7–1.2 ms; 71 vessels (64 small) 0.12 ms and 68 calls. CPU ≈0.1–0.2 ms a frame. Expect roughly 5–10× on
  a laptop iGPU: the bodies are the cost to watch there (the low quality dial halves the sim and drops SSR).
- **Tests**: `test/water_ui.py` (W1–W16: panel; dials drive params, uniforms and the picture; level and footprint
  measured against each record through the vessel's own mesh root and by a ray, ±0.005 ft / ±0.03 ft, for the
  bucket, washtub, rain barrel, both troughs and the well; a synthetic cursor drag disturbs the heightfield along its
  path, read back from the GPU; ripples visible across frames; the river carries a ripple ~1.4 ft downstream in 1 s,
  the millpond barely; wading pawn, dropped stone, river drawn with the tool; presets, Send, Use in game; Lighting FX
  off; ?nofx; quality: 42 checks), `test/water_bench.py` (the costs above), `engine/test/water.test.mjs` (16 checks),
  `engine/test/water_game.py` (the deployed game: river + pond through water.set, a wading pawn's ripples,
  water.remove, ?water=<preset>; 9 checks).
- **Found on the way**: the bench saves an entry when you navigate away, so the first headless auto-fit run wrote
  28 "Harry" records to `water_surface.jsonl` (archived, never seen by Harry; the prep script is read-only now). The
  tuner's ground spans 0..300 ft (a demo at negative x floated in the void). A sin() hash breaks into streaks ~250 ft
  from the origin, and so does noise rotated into a per-pixel flow frame. Nearest-filtered sim textures silently
  swallow a sub-texel advection step. Gemini's blind reads drove the presence fixes (a shallow tub read as an empty
  tub with a glass lid; then as an opaque black disc; a uniform meniscus as a drawn ring; a river cross-fading its
  pattern read as "boiling in place": measured by cross-correlating frames, the rigid channel layer moves 46 px in
  0.43 s against 45 px predicted, and Gemini then calls it flowing, 100%, from frames 0.4 s apart). Its verdicts
  swing between runs; containment and the cursor wake came out right in most passes.
- **Box note**: headless Chromium's default GL path here (ANGLE over Vulkan SwiftShader) now loses its WebGL context
  on load, even at HEAD; the suites ran with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`
  added by a sitecustomize shim (the real-GPU path is fine).
- **Suites (2026-10-05, after water)**: node suites all pass; engine core 116, relay 78, framing 7, migrate 125,
  water 16. water_ui 42/42 on SwiftShader and on the GPU; water_game 9/9 on the live game. fx_ui, fx_regress,
  sel_ui pass. accept_union (?nofx, water off): every reachable check passed on one backend or the other (A12 and
  A26b need --writeback); A19 fails now and then on SwiftShader (it reads triangles 1 s after the loader hides) and
  A25b on the GPU (downloads finish before the loading-bound flag can show). atmos_ui A5 and A7c fail on SwiftShader
  identically with and without the water (A/B against 3deb7f2): pre-existing, not water's.

## 2026-10-05: Outdoors: the Yard (Harry: "a room with NO walls"; "sparse on purpose"; "only assets we already have")

**Intent.** A yard, garden or forecourt as a room type: its own ground, open edges, the neighbours' doors opening onto it, dressed from meshes that exist, and a wishlist for what is missing. The rules are in `ROOMS.md` → Outdoors; the wishlist is `docs/ASSETS_TO_BUILD.md`.

**What was built**

- **walls.js**: role `outdoor` (`isOutdoor(type)`). `computeEdges` strips a yard's side from every edge: an edge with only yards on it is open ground and leaves the map (nothing is built, no post); an edge shared with a building is the building's exterior wall and carries `e.yard`. It returns `open` (each yard's open boundary segments) and gives a yard "openings" that describe its surroundings: every building-wall segment (wall / window / door, `to` = the room behind) and the gate. `yardDoors()` is the door policy (back doors for hubs and hallways; the one outside door of a kitchen, stable or barn moves to the yard; terminals only when they have no inside door; none for the front desk). `chooseExteriorDoor` treats a yard next door as outside.
- **solver2.js**: `yard(ctx)`, its own grammar (no zone menu, no density fill): focal thing → paths → beside each door by what it leads to → lamp post → woodpile → gate and wall things → the `plants` slot → edge outbuildings → like-with-like at the wall. `YARD` holds the numbers; `yardTarget(area)` is the tapering density target. The summary gets `Yard:`, `By the doors:` and `Plants:` lines. `solver.js`: a small v1 program so the classic engine still runs, and the base class skips opening kinds it does not know.
- **look.js**: `SCATTER['floor-grass']` (tufts and worn patches over one calm base). **main.js**: the palette key `=`, the summary's ground line, the Walls select disabled for a yard, and `replanYards()` (a yard is laid out again, same seed, when a neighbour arrives, leaves or changes type). **overlay2.js**: the gate marker. **fx/atmos.js** (three small hunks in the atmosphere module): an outdoor room is *built open ground*, so it stays outdoors for wind and fog profile but the fog sea over the unbuilt world does not lie on it.
- **Data**: room type `yard` in `build_data.py` (floors = ground materials), recipe `tav-yard` (slots include `plants` and `edge`), 20 new catalog lines in `catalog/objects-outdoors.catalog.md`, TAV added to 21 existing outdoor roles. Free images (`experiments/2026-10-05-outdoors/`): the Yard icon, grass (4), gravel (2), grass tufts (4), worn patches (3).
- **Game** (`engine/`): the Yard appears under Fantasy → Tavern & inn by its recipe name; `pack.js` keeps it out of packed buildings; `library.js` has a Plants section. Everything else came along through the shared tuner code.

**Findings**

- **Where the door goes decides whether the neighbour still works.** The first policy added a yard door to every neighbour. A 30×20 stable with a second 10-ft door lost its stalls ("no row fits"), and a front desk with a door cut opposite its street door failed every time. Moving the one outside door (kitchen, stable, barn), skipping the lobby, and putting a work room's yard door at the end of a short wall brought purpose failures beside a yard to 0 of 264.
- **"Door → nearest point of the main path" is the wrong shortcut.** It runs along the building wall from door to door and reserves the very wall the yard's things gather against (a yard came out with no woodpile and no rain barrel). Every door walks to the gate.
- **The focal thing goes in before the paths.** With the path laid first, a 5-ft well could not find room in a 20-ft yard (the path owns the middle). Placed first, as near the middle as it can be while clear of the straight door-to-gate line, it is present in 200 of 200 yards big enough, and the path bends round it where it must.
- **Density outdoors is perimeter-shaped.** A flat 2 per 100 sq ft asked a 60×40 yard for 48 props. The target now thins with the square root of the area past 600 sq ft; yards beside buildings land at 0.7–1.85× of it (the high end is 10×10-ft yards), and a yard with no building beside it stays near-empty until plants exist (0.2×: honest, there is nothing to gather against).
- **Mixed ground variants show the grid.** Grass variants mixed with rotation: 2 of 5 on Gemini's scale; with matched borders: 3 of 5 (each interior reads as its own patch). One base laid straight plus scattered decals: 0 of 5. Fine noise (gravel) mixes invisibly once variants share a border.
- **Gemini at a wide angle** called a bench a floating grindstone and a trough clipped; close-ups of the same frames said bench and trough, both grounded. Its useful catches were the ones about kind, not contact: mud patches as a path, an easel hung as a board, a flat lawn.
- **A catalog bug found on the way:** `bounty-poster` and `proclamation-scroll` list height as depth, so they hang indoors as slivers 0.01 ft tall. The yard works around it; the fix is two catalog lines (in the to-build list).

**Tests**

- `node test/yard.test.mjs`: 272 yards (alone, behind an inn, between inn / kitchen / stable, laid before the inn, a closed court; 2×2 to 12×8 cells; 8 seeds): nothing outside the rect, no overlaps, deterministic, every door walks clear to the gate, never over 1.5× the target, one focal thing where the size allows and nothing else in the middle, every sign and lamp on a plain building wall facing the yard, no wall or post on an open edge, the building owns shared walls even when the yard is older. Then the door policy (privy, hallway, guest room, forecourt vs back door, two yards side by side), the neighbours (264 rooms, 0 purpose fails), and **plants arriving**: with fake bush and tree meshes injected, 2–4 plants land by the edges and doors and a tree becomes the focal thing in some yards.
- A yard case in `solver2.test.mjs`; yards in `v2_fuzz.mjs` (reachability counts a yard as a way in; yard paths, density, nothing hung without a wall); a no-repeat growth check in `repeat.test.mjs`. Engine: a yard case in `core.test.mjs` (121 pass) and two checks in `browser_build.py` (85 pass).
- `test/yard_ui.py BASE OUTDIR [API]` (browser, 20 checks): palette, a lone yard builds no walls, ground tiles, neighbours' doors, the yard laid out again when the inn arrives, the sign on the common room's wall, no wall piece on an open edge, measured overlaps and outside-the-yard, overlays, fog cleared over the yard and blown clear when a second yard arrives in the fog, roll again, the inn deleted. It also takes the pictures for the blind read.

**Not done, on purpose**

- **Edges other than "none"**: no fence, hedge or stone-wall piece has a mesh. The recipe's `edge` slot names them; the to-build list says an edge kind needs a straight section, a corner post and a gate before it is usable.
- **The worn path**: waits for `decal-path-worn`.
- **The game does not lay a yard out again** when a neighbour arrives later (the tuner does). Build the yard after its buildings, or re-roll it.

## 2026-10-05: Atmosphere round 2 (Harry: "amazing, super baller"; three follow-ups)
- **Indoor / outdoor fog.** Two profiles in the preset. Indoor drift is 0 by default.
  - The outdoor **wind is a force inside the fluid** (outdoors only; walls solid; the window's edges open), not a
    scrolling texture.
  - Density heals toward its fog bank only where the air moves with the ambient drift, and sheltered air sheds its
    mist, so there is a wind shadow behind a building.
  - A fog-free room sheds what drifts in unless the `seep` dial is up.
  - Measured: tracer upwind of a wall puts 0 inside and goes round; through a doorway it comes in. A 3 ft/s wind
    stagnates to ~0.4 at the wall and splits at the corners; the change between samples there is under 5% of the
    wind speed.
- **Fog height is THE control, 0 = none.** A room's own height wins (the Room panel slider with a notch at 0; `fog`
  on the tuner's room; `height` in `setRooms` / `setRegions`), then its type's default (`data/fog_defaults.json`:
  cellar 2.5 ft, barn 0.6, inn rooms and stable 0; the preset's `indoor.own` switches these on), then the preset's
  `indoor.height`. Outdoor rooms (yards) follow the outdoor profile. The game passes its rooms (`world.fogRooms`).
- **The sim window follows the viewport** (design agreed with Harry).
  - It has a fixed cell count (128 / 192 / 256) and is fitted to the visible ground. The cell size follows the zoom
    in steps of ×1.25 (0.2 ft at 28 ft camera distance, 11 ft at 900 ft).
  - It pans in whole cells. A zoom step resamples the fields and cross-fades over 0.4 s.
  - At a low pitch the fit is capped at max(160 ft, 5 × camera height).
  - Behaviour is in feet. The cursor's footprint is at least 4.5 cells and its push is capped per cell, so a wiggle
    is equally alive at every zoom.
- **Coverage is separate from simulation.** A coarse whole-map "place" canvas (fog height / indoors / hidden) persists
  outside the window. Past the window the same fog-bank function is drawn with no simulation, cross-faded at the rim,
  out to the horizon where it fades into the sky (the fade distance scales with camera height).
- **Views with no post stack** (the game's PiP, Lighting FX off) get two flat noise sheets. Verified with Lighting FX
  off in the tuner; not yet opened in a game PiP.
- **Multiplayer.** The sim is local and never synced; other seats' cursors (and LLM ghosts) stir it through `stirrers`
  (`world.layers.cursors`).
- **Cost** (`test/atmos_bench.py`, RTX 3060, 1620×1128 canvas, medium): sim 0.13 ms at every zoom.

  | Camera distance | Draw before (fixed 96-ft window) | Draw after |
  |---|---|---|
  | 30 ft | 0.74 ms | 0.75 ms |
  | 62 ft | 0.97 ms | 1.00 ms |
  | 150 ft | 1.55 ms | 1.14 ms |
  | 400 ft | 1.68 ms | 1.39 ms |

  Cost follows screen coverage, not world size: a second building 250 ft away changes nothing.
- **Open.** From 400 ft and farther the sea still reads as texture (Gemini C at 400 ft, D at 900 ft). Thin walls stop
  being obstacles once a cell is over 1 ft (indoors / outdoors still holds by the place mask).
- **Tests.** `test/atmos_ui.py` (51 checks: W wind, H height, Z zoom window, F far field); `test/atmos_game.py`
  (two tabs on the deployed game: rooms, pawn, cursor, another seat's cursor).

## 2026-10-05: Fog parity, tuner against game (Harry: "is the fog really truly the same? it sure feels different")
- **Answer.** The code was the same; the values were not. The game's house atmosphere (`atmos-harry-v1`) had been made
  from the built-in morning mist with the fog sea forced on (2.2 ft mist, 9 ft sea at 0.75, wind 0.5 ft/s). What Harry had
  tuned lived only in his browser: 0.8 ft mist at density 0.42, wind 1.4 ft/s, no sea. He had pressed "Send preset", not
  "Use in game". The house atmosphere is now `atmos-harry-v2`, exactly his sent preset.
- **Measured** (`test/atmos_parity.py`, same room, same camera and viewport, the game's house atmosphere loaded into the
  tuner): 296 fields equal, all 55 volume uniforms included; mist density 0.55 / 0.51; wind (1.23, -0.63) ft/s in both; the
  fog pattern travels 1.34 ft/s in both; a cursor stroke stirs 24 / 21 ft wide at 20 / 17 ft/s and is gone in 2 s in both;
  the ground shows through equally (0.65 to 0.69 of its detail); 60 fps in both.
- **Deliberate differences** (the world around the fog, left alone):
  - default camera: game fov 45 at 95 ft, tuner fov 42 at 110 ft (10.1 against 9.4 px/ft on the same canvas, and the
    game's canvas is the whole window), far plane 3000 against 2000 ft;
  - the tuner's ground has a second, brighter 25-ft grid and the yellow north line; the game's has only the dim 5-ft grid,
    so the same fog hides the game's ground sooner (Gemini reads the game's fog as thicker for this reason; with clear air
    it reads the same difference in the grid);
  - the two room generators furnish and wall the same recipe differently (stone against half-timber, 6 against 7 lights);
  - the sim window can sit one zoom step apart at the same camera, depending on how the camera got there (hysteresis).
- **The fog sea does not travel**, in the tuner or the game: its banks are anchored to the world and only a faint ripple
  moves (0.54 ft/s under a 1.4 ft/s wind; the field changes 15 times less than the mist alone). It also buries the mist
  that does travel. By design, and the same in both.
- **Off by default, to try** (Atmosphere panel): "Fog sea travels with the wind" (`world.drift`, 0 to 1) and "Stir radius
  on screen" (`flow.radiusPx`: the cursor's footprint in pixels, the same at every zoom and window size; 0 = feet).
- **Harry's preset carries Quality: low and Stir radius 0.7 ft.** Low means 128 cells (1.22 ft at the default view), fog
  drawn at 35% size, and a stir footprint of 1.7 ft there. Not changed.
- **The trap, fixed** (`js/fx/houselink.js`, every look panel): "Use in game" is the primary button on its own line; a
  line under it always says what the game is using and whether that is what is on screen; Send says "game unchanged" and
  its toast says the GAME is NOT changed. `test/house_buttons.py` (9 checks).
- **Lesson.** A look approved in the tuner exists only in that browser until "Use in game" is pressed. A "ship it" reads
  the house look from `GET /tuner/house`, or the latest sent preset in `reviews/tuner/fx.jsonl`, never a built-in.

## 2026-10-12: The room palette, grouped (88 room types had squeezed the stage to 38 px)
- **What was wrong.** The palette was one flat wrap of buttons in the title bar. Each new building type added a row, the
  title bar grew, and the stage got what was left: 253 px high on a 1500×950 page at 65 room types, 38 px at 1280×800 at 88.
  Two shot tools worked around it with pages 1500 to 2000 px tall.
- **What it is now.** The palette is the top of the left column, with its own scroll; the title bar is one fixed line and
  the stage is always the window less 52 px (660×748 at 1280×800). Top to bottom:
  - a search box (`/` puts the cursor in it; it looks at the room's name, key, building type and recipes across every
    type; Enter picks the first match; Esc clears);
  - a heading chip per building type with its count, in the Build tray's order and under its names (Tavern & inn,
    Mansion, Castle, …). One type is open at a time; a click on the open one folds it away. The browser remembers the type
    used last (`localStorage tuner.palette.open`). The chip of the type whose room is the active tool is marked;
  - the open type's room buttons, as before (colour, name, hot key for the first twelve).
- **Where the groups come from.** `data/types.json` (code, label, slug), a slim copy of `engine/client/data/types.json`
  written by `engine/tools/build_types.py`; `deploy.sh` runs it. A room belongs to the type its first recipe names
  (`tav-common-room` → TAV), the same join as the Build tray (`engine/client/taxonomy.js`). A new type, or a room in a
  type that had none, appears with no change here. A room no type claims goes under its `group` name, last.
- **Still works.** Click to pick and click again to put down; drag on the grid; keys 1–9, 0, -, = (the tool's type opens
  and the button scrolls into view); Esc; the room panel's type list (now grouped the same way with optgroups);
  `?flavor=`, `?seed=`, `?nobg`, `?nofx`. New: `?room=<key>`, `?type=<code | name>`, `?palette=open`;
  `tuner.setTool(key)`, `tuner.tool()`, `tuner.openGroup(code)`, `tuner.findRoom(text)`, `tuner.palette()`.
- **For scripts.** Every `<button>` in `#palette` is still a room type and all of them are in the page, so counts and
  `querySelectorAll('#palette button')` read as before. The heading chips are `#ptabs .pt[data-code]` (not buttons).
- **Narrow windows** (under 900 px) stack as before: stage first (72% of the height), then the palette (capped at 60%).
- `test/palette_ui.py BASE OUTDIR [API]` (browser, 35 checks, a 1280×800 page): stage size at three window sizes, groups
  against `types.json` and `rooms.json`, one open and remembered, click, drag-out, keys, search, the three URL
  parameters, and a `#stage` clip that is the whole stage.

## 2026-10-12: Far-fire glow (Harry on the painted floor glow: "much much worse than nothing at this point ... it might just need a run in a tuner")
- **What it is for.** On a big map only the nearest N fires are real lights (the game's Settings ▸ Me ▸ Graphics ▸ "Real lights from fires"; `fire.js setCap`). This panel tunes the stand-in for the others. Numbers and diagnosis: `experiments/2026-10-12-glow/README.md`.
- **Module** `js/fx/farglow.js` (`fx.farglow`), made by `fx/index.js` like the other looks: `FARGLOW_DEFAULTS / _SCHEMA / _BUILTINS`, panel `data-key="farglow"`, presets kind "fx" `data.fx = "farglow"`, **Use in game** → house `farglow` (`server/ratings_server.py HOUSE_FIELDS`).
  - `fire.js standins()` lists the lights that are not real right now, each with the real light's own position, colour, brightness, reach and falloff, and how much the stand-in owes (less during a cross-fade).
  - **The light map**: 256 × 256 texels per storey, three storeys (the focus's, one below, one above), four half-float targets, one instanced additive draw. Per texel: the light arriving at the floor, at 3 ft and at 6.5 ft (each sum exact for any number of lights), and their mean direction, distance and height. The window on the ground follows the view's focus and is as wide as the view is far (80 to 640 ft).
  - **Walls**: per light a ring of 128 distances to the nearest wall piece, worked out on the CPU when the light or the walls change (`structure()` items of layer `walls`; a doorway is its two jambs). The quad's shader reads its own direction in the ring.
  - **The picture pass** (`lighting.js setGlowPass`, before the fog pass): world position from depth, facing from the depth's slope, the map read 0.6 ft out from the surface, the three heights blended by the pixel's own height, then `picture × (1 + light / ambient)` with a soft clamp. Ambient = the hemisphere and key lights as three.js applies them.
  - **A swap is a cross-fade in time** (`fire.js applyCap`, `swap.fade`): the light that leaves the pool fades out and only then gives up its place; the one that takes it fades in. It was a fade by distance from the pool's edge.
  - "floor disc" mode = the old painted disc (`fire.js makeGlows`), with a radius and a brightness dial.
- **Panel tools** `js/fx/glowpanel.js`:
  - **Build the test room**: a common room (chandeliers, torches, a hearth, lanterns, candles) plus a floor brazier, two wall sconces, a wall torch and table candles, and a guest room sharing a wall.
  - **Three views, same camera**: 1 Real (every flame a real light) · 2 Pool, no stand-in · 3 Pool + stand-in; the pool size (0 = everything is a stand-in); "Flick between 1 and 3 every second"; "Hold flames steady"; show only what the stand-in adds, or which way it thinks surfaces face.
  - **Difference from real**: views 1, 2 and 3 are drawn at one instant and compared over the lit region (where the real lights change the picture by more than 8 of 255): mean and largest difference for the stand-in and for no stand-in, and whether it is brighter or darker. Re-measured half a second after any dial moves.
- **The game**: `fx.farglow.setViewer('auto' | true | false)` from Settings ▸ Me ▸ Graphics ▸ "Glow under far fires". 'auto' is on only when the house look has a far-fire glow. Nothing is in the house look until Harry presses Use in game, so the game shows no stand-in.
- **Tests**: `test/glow_ui.py --self` (12 checks: panel, views, modes, the number, walls, the cross-fade, Send / Use in game in the sandbox); `test/house_buttons.py` lists the panel; the game's `engine/test/browser_graphics.py` covers the switch and the house rule.


## Wall fit bench (2026-10-13, `wallbench.html`; commander's intent in COMMANDERS_INTENT.md)

Harry: "I need one more tool: a wall approval tool ... a two-story version of the wall tiles so that I can adjust size, mark ones that don't fit together nicely ... the occasional janky wall is still out there (that look great in isolation, just has scale issues!)". Live: `/projects/turnip-works/tuner/wallbench.html` (linked from the tuner's page, the landing page and the "Waiting for you" counts as "wall families to approve").

- **One family at a time**, a queue of every family that has wall pieces of its own (17), pre-sorted worst first (from the pieces' data at once, from the measurements as each family is built: "Measure every family" scans all of them in a few seconds). Status: unreviewed / in-progress / marks / approved.
- **The specimen is the game's own code**, not a mock: the engine's loader (`engine/client/tuner.js loadTuner`: library, orientation fixes, ratings filter, hinge records, house look), `look.edgeSpecs / cornerSpec / floorSpecs / makeVisual`, `walls.computeEdges` for an L-shaped room's real edges and corners, the engine's `roofs.js` for the family's roof style, `figures.js` for a person at the house figure scale. An 80-ft north run (16 squares: four straights, two windows, a single door closed, one with its leaf swung open when the open/shut record exists, a double door, more straights) and a south run carrying every special panel the family has (niches, alcove, secret door, stained glass...), the return walls, an outer and an inner corner; the same plan again as the second storey on the game's 1-ft slab (a stair's hole in it), a floor on each, the roof on top; 5-ft grid. No doorway mesh is drawn by the generated walls (a door is two jamb posts and a leaf), so none is shown.
- **Measured (inches), every joint:** gaps and overlaps between neighbours along a run, one face standing proud of the next, tops and bases; a wall's end against the corner or jamb post; the post's top against the wall; each door leaf against the gap between its posts (left, right, head, floor); the window opening of each version (sill, head, width; versions agree?); wall top to slab and slab to the wall above; a piece's height, length, thickness and room face against the family. Plus, from the data, **stretch**: how far a mesh is pulled out of shape to fill its 5 x 1 x 9 ft box (biggest / smallest axis of `kitScale`; 1.0 = even). A piece pulled 2.9x looks fine alone and wrong in a wall. **Tolerance 1.0 in** (amber to 2.0, red beyond; 1.5 in for heights, 2.0 in for thickness, 3.0 in for a post standing proud, stretch amber from 1.25 and red from 1.5); `js/wallfit.js TOL`. Findings the same in every family (the slab ending on the grid line, the 8-in open head above every door) are listed but kept out of the score.
- **Harry's controls (keyboard first):** `[` `]` family, `n` next open, `Tab` piece, `1`..`5` front / three-quarter / inside / seam close-up / panels, `i` inside-outside, `x` `y` `z` pick a scale axis (`u` all) then `-` `=`, arrows and PgUp/PgDn offset, `,` `.` yaw, `s` snap to fit (the AI guess: a scale and offset that close the measured gaps, shown, Enter keeps it, Esc undoes it; for a mesh that is just badly proportioned it says so: mark it), `m` doesn't fit (with a note), `a` approve piece, `A` approve family, `0` reset, Ctrl-Z undo, `U` use in game. Every change applies live to every instance in both storeys and the joints re-measure.
- **Data path:** a correction is `{ s: [fx, fy, fz], o: [x, y, z] feet, yaw }` per sku, multiplying the catalog fit (`js/look.js applyFit`, pure in `js/wallfit.js`). Working state (corrections, marks, approvals) is saved as append-only `wallfit` records (`POST /tuner`, name = the sku, or `family/<name>`; `GET /tuner/wallfits` latest per name). **"Use in game"** writes the changed pieces as house look `wallfit` (`GET /tuner/house`); `createLook({ wallfit })` is given it by the tuner (`main.js`) and the game (`engine/client/assets.js` via `T.house.wallfit`), and `kitSpec` / the door leaf put `spec.fit` on the piece, `makeVisual` applies it: next load. No entry means no change: every layout, the golden test and every picture are as before until a correction is applied.
- **Tests:** `test/wallfit.test.mjs` (154 checks: stretch = kitScale, tolerances, seams against a deliberately mis-scaled piece, openings from a raster, snap, records, applyFit) and `test/wallbench_ui.py` (27 browser checks: all families build; the mis-scaled fixture is flagged and snap returns it; keyboard flow through three families; marks and approvals round-trip through a reload; Use in game reaches the tuner and the game's asset layer; no-correction is exactly as before). They use their own ratings server on a temp folder (`tests/tw_sandbox.py`), never the live records.

## Fog of war look (2026-10-17; panel "Fog of war look"; STATUS "Fog-of-war look")
Harry 2026-10-16: "high & dense fog bubbling up in the areas you can't see, fluidly spilling over the edge into what you
can see", over a secrecy floor. Started by Gemini 4 (panel, presets, war-fog wiring), finished by Claude.
- **Panel** (`js/fx/fogwarpanel.js`): Build test scene = remembered WEST room (veil), the viewer pawn in the MIDDLE room,
  never-seen EAST room behind a door with a magenta/cyan beacon, a crimson pawn and a baffle wall that are drawn on
  purpose (the game would not draw them; they prove the shader floor alone). Open door, Walk / Move pawn (drag), Wave
  cursor, Reset memory, four cameras, a Low checkbox (fog & mist off). Everything else the scene's viewer has never seen
  is culled the way the game does (`userData.fogHidden`, honoured in `main.js`), so its fires neither light nor smoke.
- **Knobs** (`FOGWAR_SCHEMA`, `js/fx/fogwar.js`): bank height 9 ft, density, colour #8b939e, rolls back/pours in rate;
  veil height 9 ft, density 0.16, colour; spill push, curl, tongue reach 6.5 ft, speed, cap (0 = off); bubble rate,
  billow size, rise 3.2 ft; glow colour #b8d8ff, strength 0.3; feather width 3.5 ft, edge darkening; floor checker /
  flat, checker 2.5 ft, contrast 0.2 (= an image editor's transparency squares), colour. Built-ins: default, calm-veil,
  wild-billows, low-checker. "Use in game" = house look field `fogwar`.
- **How it is drawn.** `fogwar.js` (the vision pass) now runs BEFORE the atmosphere and tone mapping (`lighting.js`): it
  puts the checker, drawn on the floor plane, where the viewer has never seen (÷ the tone exposure, so it keeps its
  colour), tints remembered ground and darkens a feathered band on the seen side of the sight edge. The atmosphere
  (`atmos.js`) then draws the bank (heavy channel G, fed by never-seen cells), the veil (new channel B, remembered cells)
  and the spill (seen cells within reach of the bank through OPEN air, walked in half-cell steps that stop at walls; a
  crack seen from one direction lets nothing through) in the same light as everything else; rulers, cursors and labels
  are drawn after the composer. Secrecy inside the atmosphere: never-seen cells carry no room data (fog heights,
  indoors, wind, ceiling smoke), walls nobody has seen are left out of its mask, no light map there, rays over never-seen
  ground end at the floor plane (the volume, its low-res depth and the upsample), and a depth-aware blur hides the
  dot screen a dense bank top shows at grazing angles.
- **Tests:** `test/fogwar_ui.py` (12; in-frame A/B: drawing the hidden beacon/pawn/wall changes 0 pixels from high and
  3/4 cameras on Plain/Low/Medium/High while a real cursor stirs; no beacon colour from the low camera either; positive
  control) and `engine/test/browser_fogwar_game.py` (7; the game end to end). Known limit: from a LOW camera a thing
  standing in never-seen space, if drawn, hides the seen ground behind it, so its outline can show as checker where
  the bank is stirred thin. The game never draws such things.
