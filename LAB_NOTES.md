# Lab notes

## 2026-10-15 — isolated ring deployment asset gate

The Ring Tuner's integrated browser suite passed 1,493 assertions, but the first deployment stopped at `assets_check.py`: an isolated Git worktree lacked 166 ignored generated room icons and roof sections under `engine/client/data`. Copying those generated files from the main asset store into the worktree made the gate pass (24,110 checked, zero missing). Task J's painted icon binaries are also ignored; its tracked manifest alone is insufficient for a deployment worktree, so those binaries were copied from Task J's worktree before `deploy.sh`.

## 2026-10-07 — all 518 figures entered the asset rater

The completed figure set now has a distinct `figures-01` queue at `/projects/turnip-works/review-figures/`, using the same three spinning views, concept-plate score, filters, notes and keyboard scoring as the scenery reviewer. The builder hard-links the selected shipping tier and accepted plate rather than duplicating the set. Live Playwright acceptance loaded all 518 records, rendered an actual figure in each view, and saved a sandboxed score under the correct run key without touching Harry's ratings.

Two relocation/publishing traps were caught by the browser check. `gate-manifest.json` preserves the temporary `set/work/<id>.tryN.jpg` provenance path, but promotion moves the durable accepted image to `set/inputs/<id>.jpg`; ingest must use the latter after confirming acceptance. Local group-readable hard links returned HTTP 403 through nginx, so the builder explicitly makes served files 0644. A manifest count is not proof that a browser can see the files.

## 2026-09-30 — live reviewer becomes a keyboard instrument

The inn-01 reviewer now supports `Tab` next, `1`–`5` model scores, `Shift+1`–`5` concept scores, top-row and keypad digits, and type-anywhere model notes. Navigation awaits both rating widgets' dirty/in-flight saves before changing the selected SKU; a failed save leaves the reviewer on the current asset. Browser verification used a delayed intercepted API, proved the final note-bearing POST arrived before the SKU changed, and then repeated the full test on the public deployment without contaminating live ratings. A first test falsely failed because CSS uppercase affected Playwright `inner_text()` while API identity remained lowercase; machine-identity checks should read raw `textContent`.

## 2026-09-30 — inn-01 finished; structural success exposed two upstream gates

The first clean 500-SKU run finished: 483 mesh-bound assets and 17 flat assets, with all 483 GLBs downloaded and all 483 importing successfully in Blender. No worker failed, both Runpod pods were deleted, and the public review contains the complete run. This is mechanical acceptance only, not an art-quality score. Harry's curation found many Gemini plates that misunderstood the requested object and many bad alpha masks, while most meshes made from sane inputs were good. The correct factory order is therefore plate candidates → semantic approval/reroll → BiRefNet mask approval → TRELLIS → mesh approval. The chroma-blue request remains useful, but the simple chroma keyer does not replace semantic foreground extraction.

## 2026-09-30 — inn-01 500-SKU production run launched

Harry approved the clean Fal canary and launched `inn-01`: 500 frozen SKUs (483 mesh-bound, 17 flat) under source-manifest SHA-256 `88d99765…`. Gemini completed all 500 D-style plates with zero API failures; the 483 mesh plates requested a uniform chroma-blue background and all passed the batch mask gate. A clean Runpod worker then proved the NVIDIA-free export seam on an apple: 49,984 triangles, one material, two images, valid Blender reload and a visually correct preview. Production uses three resident A100 workers at 512 internal generation, 50k faces and 1024 textures, with forward/forward/reverse queues and shared-output skip semantics. A seven-hour external deletion timer bounds spend if orchestration disappears.

## 2026-09-30 — Fal is a service boundary, not inherited dependency debt

Fal publicly sells its hosted TRELLIS.2 endpoint for commercial use. We will rely on that representation rather than auditing its undisclosed internal NVIDIA licensing: a supplier-contract failure inside Fal does not follow Turnip Works through an ordinary hosted-service call. This settles the Fal bridge/premium lane. The separate clean-room work remains necessary only for the TRELLIS worker we operate or distribute ourselves.

## 2026-09-30 — BRIA and NVIDIA license exits

The two remaining dependency issues are now narrow substitutions, not license negotiations. BRIA RMBG-2.0 (CC BY-NC self-hosted weights) is replaced by pinned official MIT BiRefNet preprocessing; it produces RGBA plates and TRELLIS receives them with background preprocessing disabled. A source-path audit then found Microsoft's image-to-3D inference is already free of the NVIDIA packages: `nvdiffrast` is needed only for one UV-space rasterization block during textured-GLB export, while `nvdiffrec` is confined to an unnecessary preview renderer. We will replace that one block with an original barycentric rasterizer (BSD PyTorch3D is the fallback for the first proof), avoiding both NVIDIA packages and the previously proposed GPL ComfyUI worker. Remaining work is empirical: implement it and compare one patched GLB against the existing canary before marking it verified.

## 2026-09-30 — sparse multilevel dungeon and lighting baseline

Harry found the alchemist's laboratory slightly too bright. The next D transfer deliberately lowered perceived brightness only about 15 percent and moved from universal warm fill toward separated torch pools and cool quiet stone. It also tested an irregular multi-room dungeon with corridors, stairs, a circular crypt, water chamber and sparse props rather than another single furnished rectangle. The output kept more elevated isometric camera than requested, but successfully changed azimuth, topology, depth layering, density and lighting distribution. Final exposure should remain an engine control; the reference plate defines relative light discipline, not a baked darkness requirement.

## 2026-09-30 — D selected and transferred to an alchemist's lab

Harry selected D, the C-geometry/B-finish hybrid, as the Turnip Works house-style target. A first transfer test used only D's tavern plate as visual reference and generated a dense alchemist's laboratory. The same stout construction, rounded bevels, matte painted gradients and softened material response survived across glassware, copper apparatus, shelves, stone, herbs and magical liquids; this is stronger evidence than a second tavern variation that D is a reusable grammar rather than one successful composition.

## 2026-09-30 — first clean style candidate

Generated `style-references/photorealistic-tavern-v1.png` from text only as a candidate inspiration plate: a populated but people-free tavern shown from an elevated VTT camera. The plate is deliberately photorealistic, materially legible, and navigable rather than a hazy cinematic interior. It is not accepted house style yet; Harry's visual judgment is the gate before it becomes a Gemini reference.

## 2026-09-30 — clean-slate boundary

The exploratory 276-object family, its seed plates, meshes, optimization variants, prompts, manifests, and provider sidecars were deleted. The original application copy and extracted private corpus were also deleted. The useful result retained from the experiment is operational: inexpensive image generation, warm resident mesh workers, resumable batches, Blender validation, and aggressive local optimization all worked.

The next experiment begins with a new functional taxonomy and an independently specified house style. Prior generated assets are not candidates, controls, or style references.

## 2026-09-30 — taxonomy v0: roles, not nouns

First clean catalog: `catalog/fantasy-core.catalog.md`, 407 functional roles in 17 domains, each tagged with placement, 5-ft footprint, material board, setting affinity (with signature marks), variant axes, play affordances, generation method and priority. Derived from `catalog/room-recipes.md` (40 rooms → slots → roles); no competitor catalog consulted. The structural finding: "aristocrat vs peasant" is a wealth axis and "ruins" is a condition axis over shared roles, not separate object lists. `src/catalog_tool.py` validates both files — it caught 17 missing setting tags and two P1 rooms with unfillable slots on first run. Estimate: 123 P1 roles ≈ 495 SKUs; full shelf ≈ 1,300 SKUs across 7 structure families — at the observed ~1.2¢/mesh, generation is still a rounding error next to curation.

## 2026-09-30 — v0.2: toward 3k

Harry's calls: animals only as food-in-preparation props; adjacent settings are first-class and the list should lean into D&D (magic, cults, lairs, groves, puzzles); P1 structure = rough-timber, dressed-stone, cave-rock; target ~3k assets. Three parallel forks added trades/village, loot/arms/gear and environment slices (`expansion-*.catalog.md`, `rooms-*.md`). After merging 4 cross-file duplicates: 960 roles, 133 room recipes, 0 validator errors/warnings, SKU estimate 743 P1 / 2,401 ≤P2 / 3,077 total. Lesson: parallel forks writing one namespace race on shared ids (`dovecote` was deleted by both and restored once); the validator's duplicate check plus a token-overlap scan caught the rest.

## 2026-09-30 — v0.3: object-level granularity

Harry's probe ("knife, fork, spoon… cheese slice, bowl of soup?") exposed that small things were modeled as roles-with-variants; he counts assets as distinct meshes. Rule now in README: one line = one distinct mesh for handheld things. Nine object-level forks (tableware, food, smalls, alchemist, smithing, wood/leather/cloth, earth/fire/paper/food trades, rural, temple/military/bard) with trade-prefixed ids. Merged 30 cross-file duplicates. Result: **2,807 distinct objects** (410 P1 / 881 P2 / 1,516 P3), 266 room recipes, 0 errors/warnings, no P1 orphans. Lesson: when merging duplicates, keep the max priority and union the tags of the dropped twin — the first naive merge silently lost three P1 flags.

## 2026-09-30 — v0.4: real rooms, 2D, render sets

Harry: P2 bleeds into P1 ("the kitchen is real, and will need at least a few veggies"); mark what should be 2D (incl. floor tiles); mark what can be assembled into sets — for the *render engine's* object count, not the library's. Changes: 47 rooms promoted to P1 and a slot-variety rule (each P1 slot needs ≥3 P1 options; strict "everything in a P1 room" would have made P1 ≈1,435). `flat` = 2D (pages, cards, banners, curtains, paintings, grass/vine cards, all floor/ground tiles) — 103 objects. Compounds moved to `catalog/sets.md`: 223 render sets (119 P1, avg 7.9 members), added alongside their members, never replacing them; P1 sets count as P1 slot options. Duplicate room ids now rejected. Final: 2,781 distinct objects (821 P1 / 620 P2 / 1,340 P3), 0 errors.

## 2026-09-30 — inn-01 run manifest (500 SKUs)

Harry wants a ~500-item first generation pass focused on an inn. Added the missing inn rooms (hallway, front desk, privy, fine guest room, storeroom, barn) plus three objects (rug-runner, door-barn-double, floor-hayloft), and `src/build_run_manifest.py`, which selects a run *by room* and expands variants: common/fine wealth tier by room, rough-timber and dressed-stone for kit pieces, three silhouettes for `shape` repeaters, and members of P1 TAV render sets. Result: `catalog/runs/inn-01/manifest.tsv` — 416 distinct objects → 500 SKUs (483 3D, 17 2D). Gates before firing: DINOv3 access GRANTED 2026-09-30 (switch off the mirror); RMBG-2.0 is CC BY-NC, so pre-mask with MIT BiRefNet and feed RGBA to bypass it; house-style grammar still unwritten.

## 2026-09-30 — first clean canary through fal (house style D)

Four objects (chair, barrel, tankard, turnip pile) → Gemini plates in style D → fal TRELLIS.2 → Blender → renders → Gemini QA. $1.20 total. Chair and barrel are game-ready; tankard needs less surface ornament; the turnip *pile* failed (fused, melted back). Main lesson: piles and clusters should be render sets of single objects, not single TRELLIS meshes. That affects 37 SKUs in inn-01. `gemini_batch.py` now reads its style template from `style/` (default: heroic-handpainted), not a hard-coded, retired style. Details: `experiments/2026-09-30-inn-canary-fal/README.md`.

## 2026-09-30 — canary live on the public bench

The bench at `https://implausible.enterprises/projects/turnip-works/` now shows the inn-01 canary: a plate plus a model-viewer per object, QA scores, GLB downloads, and the plate-vs-mesh grid. The page is data-driven from `web/canary/<run>/canary.json`, and every URL is versioned. Deployed with rsync plus explicit 755/644 modes: all URLs return 200. In headless Chromium all four viewers load with no console errors and no horizontal scroll, on both desktop and 390-px phone. Gemini confirmed each viewer renders its object. Two test-harness gotchas, not page bugs: `--use-gl=swiftshader` crashed headless Chromium with four viewers, and `loading="lazy"` viewers only load after being scrolled into view, so a phone test has to visit each one.

## 2026-09-30 — downsample ladder on the bench

Harry: "these are *all* great — a tiny thing on a table in the background of play, not a hero piece." Verdicts are corrected on the page, and the rule is saved as feedback memory: grade at table scale. `src/build_downsample_matrix.py` makes a face × texture matrix with Blender, 6 × 6 per object (faces ×¼ steps, textures halving 2048→64), exporting a GLB and a thumbnail for every cell: 144 variants in about 4 minutes, four objects in parallel. **Decimation floor:** Blender collapse bottoms out at ~270–330 faces for these meshes, and 1/256 and 1/1024 give identical results. Welding seam vertices raised the floor to ~995, and gltfpack `-sa -sp` bottoms at ~870–1,600 or collapses to nothing, so Blender's floor stands. **Sizes:** at full geometry, texture size barely matters (2.3 MB at 2048 vs 1.5 MB at 256); geometry dominates. At 3k faces / 512 px an object is ~210–245 KB (~10× smaller); at ~770 faces / 256 px it's ~72–83 KB (~30×). Bench UI: one object selector drives the viewers and the matrix; source and selected viewers share a synced camera; there's a "table distance" toggle; tapping a matrix cell scrolls the viewers back into view; on phones the matrix scrolls sideways with pinned row labels. Browser-tested at desktop and phone widths with no errors.

## 2026-09-30 — shipping tier decided: ~5k faces, 256 px, one map

Harry reviewed the ladder: 5k faces is the stop (3k often works); 256 px looks great on all four, 128 is often fine; drop to a single texture map "for sure". Ladder rebuilt with a 5k stop and colour-only ("-bc") exports; thumbnails and default view now show the shipping format; toggle adds the second map back for comparison. At 5k/256 an object is ~250 KB, mostly uncompressed vertex data, so meshopt/Draco is the next transfer lever. Harry flagged GPU interaction as the real constraint, which points to atlases for objects that go together (render sets and rooms give the grouping), KTX2 textures, and instancing. Recorded in SPEC.md "Runtime asset format".

## 2026-09-30 — real-world size on every object

Harry: record each object's real size so the placement engine knows a turnip isn't chair-sized. Some sizes are ranges ("a barrel could be anything from 2 ft to 10 ft"). Size is independent of the 5-ft `fp` field: fp is grid occupancy, and a turnip claims no square, its table does. New field after fp: `size:WxDxH[~MIN-MAX]`, in inches; the optional range is proportional scale multipliers; no range means rigid (±10%). Four forks sized all 2,784 objects, 634 of them scalable; the validator now requires the field. `src/build_scale_lineup.py` scales generated meshes to catalog height and lays them on a 5-ft grid; the bench has a "True scale" section. **Finding:** scaled by height, the heroic style comes out ~1.3× stouter than a realistic catalog box (chair, barrel, tankard all 1.30–1.37×; turnip pile 0.68×). That's the house style, not an error, and the placement engine should scale by height and expect ~1.3× footprints.

## 2026-09-30 — ratings on the bench

Harry asked for 0–5 ratings on anything he looks at, including the Gemini concept image (a bad image means a bad 3D model), a note box, and a one-click "masking problem" flag for the recurring background-removal failure. Built `server/ratings_server.py`: systemd unit `tw-ratings` on 127.0.0.1:8096, nginx `/api/tw-ratings/` (config backed up to `/etc/nginx/implausible-enterprises.bak-20260930-twratings`). It keeps an append-only log in `reviews/ratings.jsonl` plus `reviews/latest.json`. Widgets appear on each card (concept image and source model), on the currently selected ladder variant (the matrix shows ★ and M badges), and on the true-scale lineup. Browser-tested: saves, survives reload, masking toggles, no overflow (measured in the DOM; Gemini's "clipped" reports were text flush against the screenshot crop). Test saves archived; the live log starts empty. Endpoint is unauthenticated, like the other picker APIs here: low stakes, validated and size-capped, and notes are treated as data.

## 2026-09-30 — ratings moved to the live inn-01 review page

Harry's rating request and his "3-column grid on the left, no horizontal scroll across the top" were meant for the live review page at `/projects/turnip-works/review/`, which another session is building and populating (`src/build_live_review.py`). I had first applied them to the canary bench, where they're harmless and stay. Edited `web/review/{index.html,review.js,review.css}` only: a left-hand 3-column thumbnail grid scrolling vertically (above the viewer on phones), names wrapping to two lines, concept-plate and 3D-model rating widgets with the masking toggle and a note, and badges on rated thumbnails. Keys are `inn-01/<sku>/{plate,model}`, in the same `tw-ratings` store. I deployed only those three files, not the other session's assets, and messaged session giblfiz-46 so a redeploy doesn't clobber them. Browser-tested at both widths; test saves archived.

## 2026-09-30 — first inn-01 ratings: handles everywhere → inn-01b plate reroll

Harry rated 20 items. 7 of the 9 low concept-image scores cite invented handles (bacon, bottles, canopy bed, barrels, blankets). Root cause: my style file carried "oversized handles and fittings", copied from the tavern *scene* prompt, and every inn-01 prompt inherited it. Fixed: fittings only where the real object has them, never invented, and no multi-view grids. Other findings:
- Kit descriptions listing variants in parentheses produced grid plates (bar counter). `build_run_manifest.py` now expands those lists into one SKU per piece for kit/flat roles.
- Descriptions fixed: tip hat, smashed lute, straw pallet, trestle table, chamber pot.
- Wine bottles: the catalog had four, but only `bottle-wine-green` was in the inn recipes. Added the generic, dusty and half-drunk bottles.
- Prompts now carry each object's real size in inches.

The Gemini plate screen caught 3 of Harry's 6 handle flags (missed barrels and the broken bottle): useful for triage, not a substitute. inn-01's manifest and outputs stay frozen (sha 88d99765…); the reroll is `experiments/2026-09-30-inn-01b` with 494 3D plates. The session that ran the inn-01 meshes wasn't reachable; giblfiz-46 was the Klepto session. My heads-ups there were misdirected, and it said so.

The canonical regression specimen is now **the handled pretzel**. `inn-01/inputs/pretzel.jpg` put a decorative metal padlock/handle around the dough; the corrected prompt produced a clean handle-free pretzel at `inn-01b/inputs/pretzel.jpg`. At 318 saved review records, 33 notes mention handle/handel variants (29 concept plates, 4 models), spanning bread, bacon, cheese, hay, pillows, plates, a ledger and even a pillar. Future prompt/evaluator checks should explicitly ask whether any grasping hardware, rings, straps or fittings were invented on an object that does not normally have them; the pretzel pair is the replay fixture.

## 2026-09-30 — inn-01b: plates fixed, targeted remesh

- **Plate reroll** (494, $~20 Gemini): the screen's invented-handle flags dropped 46 → 7. A targeted second pass on 30 problem plates (per-item corrections: three legs, waist-high trestle table, single object, zoom out) took that to 0 handles and 9 minor issues. Old plates are kept in `inputs-rejected/`.
- **Harry's inn-01 ratings** (317 items): plates were bad (34 of 52 rated 1, mostly handles), but **meshes were mostly fine**: 235 of 246 scored models are ≥3, and 17 carry masking flags. At table scale the plate-level handles wash out.
- **Decision: remesh only 74**: new SKUs 13, masking 17, model ≤2 9, plate 1 with no better model 35. About $22 on fal, in `experiments/2026-09-30-inn-01b-remesh`. The other 420 inn-01 meshes stand.
- **Plates page** `/projects/turnip-works/review-01b/` for gating plates before meshing. Ratings key `inn-01b/<sku>/plate`; it keeps the keyboard flow another session added to review.js (Tab next, digits rate, typing notes).
- **Gotcha:** a `pgrep -f` wait loop matched its own command line and never exited. Use `wait $PID` or match on something the waiter's own argv doesn't contain.

## 2026-09-30 — inn-01b remesh landed (69/74); fal balance exhausted

69 meshes are done on fal ($20.70), and all 69 pass Blender validation. One CDN 500 on a download crashed the whole batch. `fal_trellis.py` now retries downloads, resumes (skips assets that already have a manifest), and records per-asset failures instead of sinking the batch. The final 5 (plate-eggs-bacon, bottle--s2, pillows-cushions--common, plate--common--s1, plate-wood-round) failed with HTTP 403 "User is locked. Exhausted balance": **the fal account needs a top-up**. Their inn-01 meshes still stand. The review-01b page now shows each new mesh above its plate, with model and plate ratings (digits rate the model, Shift+digits the plate) and "why remeshed"; models are listed first, and searching `has:3d` filters to them. Browser-tested at desktop and phone widths.

## 2026-09-30 — next: Spawn Tuner (planning only, awaiting Harry's go)

Harry asked for a tool-level "DA light" demo reel: drag out a room, spawn its contents, tune in/out animations (spin, easing, sweep direction, simultaneous waves, expansion rate, overshoot), see layout and sizes, measure FPS (and later fire effects), with a north-marked edge and a readable generated layout. Not product code. The plan is in `tools/spawn-tuner/PLAN.md`: draft commander's intent, deterministic recipe-driven layout solver as the smart layer, catalog-size scaling, a runtime asset tier (5k/256 default, 3k/128 for objects ≤ ~14 in), the bench, and a trivial-case build ladder. Six open questions for Harry. Build starts on his "goal" call after compaction.

## 2026-09-30 (evening): Spawn Tuner built, deployed, acceptance-tested

Harry's goal call: "design, build, and acceptance test the demo-tuning-panel". It's live at `/projects/turnip-works/tuner/`; the code is in `tools/spawn-tuner/` (PLAN.md has the status section).

**Mesh fixes:**
- Runtime tier: 493 GLBs at 5k faces / 256 px, or 3k / 128 px for objects ≤14 in, all with a single colour map. Blender took about 0.7 s each on 4 workers.
- Kit "edge" pieces had baked floor slabs, lay flat or were turned sideways. They're fixed automatically in `prep/blender_runtime.py` (`kit_fix`).
- A trap along the way: Blender's `obj.bound_box` is stale after `mesh.transform` or a bmesh edit. Read the vertices instead.

**Solver:**
- A seeded procedural program per room type: hearth, bar run with a barkeep lane, table clusters with walkway rings, corner piles, surfaces, wall mounts, ceiling items, rugs.
- Two bugs found and fixed: a signed `>>` in the door hash put doors in the corners, and "free" sampling around a point missed tiny radii.
- Defaulted prop scaling to largest dimension after a lute case came out 6.4 ft.

**Measure, then believe:**
- Gemini reported "furniture through walls" and "chairs clipping tables" from screenshots. Measured world-space boxes found 0 overlaps and 0 props outside walls across 22 rooms.
- The same image got contradictory Gemini answers on two runs. Vision is triage; boxes are ground truth.

**Headless traps:**
- `--enable-unsafe-swiftshader` crashes Chromium on screenshots; default flags work.
- `page.evaluate` of a function returning three.js objects serializes them and can kill the page. Use `void`.
- `Object3D.clone()` JSON-copies `userData`, so a self-reference throws "circular structure".
- Long-lived headless pages run out of GL memory; use a fresh page for heavy steps.

**Results:** 27/27 browser acceptance checks pass on the live URL, plus ~70k solver checks and the animation checks. The write-back test records are archived in `reviews/tuner/fauna-test-20260930.jsonl`.
- 21:35: Harry's first-look notes are fixed and deployed: no pre-animation flash, camera-side walls last, benches long side to the wall (mesh long-axis pre-turn), richer front desk. 30/30 live. Headless trap: run the 11-room and phone checks in fresh browser processes, because software GL's GPU memory is per browser, not per page.
- 21:56: faces & skins GPU dials live (1.6 GB ladder); 31/31 live. Restored Harry's 21:28 preset that a whole-file test cleanup had swept into the test archive; cleanup now filters by test tag.
- 2026-10-01 ~09:55: round 3 live (floors ×16 ×4 versions, 12 rugs, masking/≤2★ filter, middle-drag orbit, background preload, door variety + 10/15/20 ft openings, wall families). 37/37 live.
- 2026-10-01 midday: round 4 (harry-v1 default, 10k faces default, 3-letter object tags + click-select, bandwidth meter, R-key orientation fixes + orient.json). Headless traps: 10k faces roughly doubles headless GPU memory, so bench and room-coverage stages run at the shipping tier in fresh browsers.
- 2026-10-01 ~12:40: layout engine v2 (js/solver2.js) built by a fork; walls.js gained an engine-aware v2 door policy; v1 untouched (76k checks still pass). Fuzz found and fixed a sealed-building case (an entrance covered by a later room).
- 12:35: 10 fal walls + 2 leaf doors live ($3.60 total); full-width doors, slim jambs; 51/51 live. Engine v2 agent notified to wire main.js.
- 13:13 v2 wired + deployed (v=20261001131345): accept 51/51 live, accept_v2 8/8 live; Gemini doorway read prompted a 6-ft entrance landing for hubs/passages.
- 16:46: Send whole map + per-object notes live (kind map, 3 MB). Harry's GPU: 56-60 fps / 258 calls at 10k faces.
- 2026-10-01: storeroom/cellar aisles of shelving (v2 aisleStore) built + tested (stacks 1333 checks; all suites green); not deployed (parent deploys).
- evening: floor expansion 2 (fork): composed exact-grid patterns + 20-ft supertiles, Voronoi flagstones, hay/dirt scatter floors for stables/barns; measured repetition; ready for parent deploy.
- 2026-10-01 evening, stable grammar (v2): 5×10 stall rows with gates, mangers and hay; one/both-wall rolls; middle double rows from ~60 ft deep; cross aisles. 30×20 gets 4 stalls (was 3); 75×75 gets 25–34 (was 8).
  - Lesson: the occupancy grid has 0.5-ft cells, so thin kit pieces must be cell-aligned or neighbours collide (0 gates; a whole middle side missing).
  - Lesson: Gemini's "blocked aisles / missing gates" came from a camera aimed from behind the wall plus the straw floor. The measurements were clean.
  - Not deployed; parent deploys.
- 2026-10-01 evening: zones agent built ROOMS.md into v2 (anatomy, growth modes, new zones, rolls); zones test 2,450/0, v2 220/0, stacks/stable/fuzz/v1/anim green. Traps:
  - the anatomy broke "key feature visible from the door" twice (a notice board, a settle), so the door→feature sight line is now protected for tall items;
  - grid alignment again: touching 5-ft gates must centre on half-foot multiples;
  - Gemini claimed missing hearths in a kitchen the test measures at ≥2.
  Not deployed.
- 2026-10-01 late (fork): v2 repeat growth + generalization. Dorm middle rows, industrial kitchens (aisles of work rows), kitchen density ≥ target at all sizes, one-wall stable bare-wall fill, axial focal placement (Principle 8), grade floor (Principle 9). New tests repeat (341,920) + focal (694); all suites green. Not deployed; the parent deploys.
  - Lesson: a 2.7-ft chair needs 3.5 ft behind a counter on a 0.5-ft grid (cell rounding ate the 3.0-ft gap: the keeper went missing in half the focal desks).
  - Lesson: a single-door desk's through-line ran door → far wall, i.e. exactly through the axial spot. Dead-end lobbies now place the counter first and end the line at it.
  - Lesson: windows stopped centred focal pieces (tall things avoid windows). Centring now wins and the window loses its drapes.
  - Gemini said a fine bed had a nightstand on one side only; browser measurement showed both (±4.6–5.2 ft). Its "empty band" on a one-wall stable was the 15-ft door.

## 2026-10-02 — review page rebuilt for throughput (three spinning views, score-and-advance)

Harry's spec: filters, better quick-keys ("the shift# thing isn't working out"), and "three views of the object, front, top, side… all rotate in different directions at 6rpm". Rebuilt `web/review/{index.html,review.js,review.css}` (old copies in `web/.review-backup-20261002/`); model-viewer is gone.
- **Views:** one three.js renderer (r170, jsdelivr) with scissor viewports in a 2×2 grid: Front spins about vertical, Top tumbles end over end (X), Side rolls (Z, reversed), all 6 rpm; plate is the fourth cell. Drag any view to turn it, double-click resets. Each model is normalised to its bounding sphere so nothing clips while it turns. The next 3 assets in filter order (GLB + plate) are preloaded and their textures uploaded; measured key→model-on-screen ≈ 20 ms.
- **Keys:** 0–5 score the model, save and advance · M masking flag · N note (Enter saves) · U/Backspace undo last score and go back · J/→/Tab next · K/←/Shift+Tab back · Space pause spin · R reset · / name filter · Shift+C clear. Plate scores are click-only. Legend sits in the right column.
- **Filters:** name (all words must match name/sku/hint/role), status (default Unreviewed), score (0–5, ≤2, ≥3, masking; picking one switches status to All), role (catalog `##`/`###` headings), theme (catalog `set:` codes; universal ANY items count under every theme), generated (GLB mtime; hour buckets while everything is from one day). Opens on the first unreviewed asset matching the saved filters. Metadata: `src/build_review_meta.py` → `web/review/meta.json`.
- **Write-back unchanged:** same POST `{key, stars, note, tags}`, keys `inn-01/<sku>/{model,plate}`. Posts per key are serialised so masking-then-score can't land out of order. `?run=fauna-test` puts test writes under `fauna-test/…`.
- **Deploy:** `src/deploy_review.sh` copies page files only and stamps content hashes (Cloudflare caches js/css for hours; a fixed `?v=` served stale code once on staging). `sync_live_review.sh` still works but doesn't stamp.
- **Verified live:** `tests/review_fast_accept.py`, 23/23 (spin 36.0°/s on all three axes, preload, drag, key-3 write-back, M+N+1, undo, J/K, all six filters, phone has no horizontal scroll). The 15 test writes were moved to `reviews/fauna-test-ratings-20261002.jsonl` by `tests/archive_review_test_writes.py`; `ratings.jsonl` is back to Harry's 600 lines, byte-identical. Gemini's phone read claimed a clipped note box and broken wrapping, but DOM measurement found everything inside 16–374 px with no overflow. The keys legend is hidden on phones.
- `tests/reviewer_hotkeys.py` encodes the old Shift+digit contract and is superseded. review-01b is untouched.
- 11:10 follow-ups: (1) "size ports to window": the 2×2 stage fills the window at every desktop size and the side columns slim down below 1150 px. The cause of the earlier overflow was the plate `<img>` inflating the `1fr` grid rows; rows are now `minmax(0,1fr)` and the img is absolute. Renderer, scissor and aspect follow the window on resize (checked at 1600×950, 1920×1080, 1280×720 and 1000×700: no scroll, canvas = views box, aspect = w/h). (2) "Reviewed" is now computed, never written: any model or plate score, flag or non-empty note counts. That gave 470/483 at switch-over (was 374 model-scored); it drives the filter, the open-on-first-unreviewed choice and the header counter. Live acceptance 30/30; 10 test writes archived. Harry's 11:02 rating (bard-lute-broken 0) landed mid-test and is kept.

## 2026-10-02 — GitHub
Pushes go to the project's private workshop repo at each verified milestone. Generated binaries are git-ignored and stay on the box and web server. `reviews/*.jsonl` passes through a local clean filter (`filter.noip`) that strips client IPs.

## 2026-10-02: Spawn Tuner LIGHTING + FIRE panels (Fauna, Claude Opus 5.5, FX agent)

Harry's direction: "super duper class A+" effects, WebGL today, no paid editor, our own effect-language panels.
**Stayed on three r170.** Every library's peer range covers r170 (quarks 0.16 not 0.17, good-godrays <=0.182,
postprocessing >=0.168), so the importmap did not need the r182 bump and nothing else in the tuner was touched.

Built (all new files, main.js/walls.js untouched while the walls agent works):
- `tools/spawn-tuner/js/fx/lighting.js`: pmndrs EffectComposer (HalfFloat): RenderPass, N8AOPostPass, GodraysPass
  (biggest fire), EffectPass [SMAA, exposure, bloom, tone map, grade, vignette]. Fire-shadow budget = N casters,
  biggest then nearest the camera focus; the caster count stays fixed so swapping casters never recompiles.
  Point shadow maps are refreshed by budget: every 2nd frame with "shadow dance" on, else 1 Hz / on room change.
- `js/fx/fire.js`: hearth/oven/brazier/torch = raymarched volume flame (@wolffo/three-fire, sheared downwind via its
  model matrix) + own flickering PointLight + quarks embers (stretched billboards) + smoke. Candles, candelabra (3),
  stubs (4), chandeliers (ring of 8), lanterns = ONE instanced billboard draw for all, lit by a fixed pool of shared
  clustered lights (default 4). One flicker signal per fire drives flame height, light intensity and colour (Kelvin).
  Fire sources follow their item group's world matrix, so flames ride the spawn animation and vanish with the item.
- `js/fx/index.js`: createFx facade + panels (built from ui.js dialGroup into details[data-key=light|fire]),
  presets: built-ins, this browser, Send (POST /tuner kind "fx", data.fx lighting|fire, names prefixed light-/fire-).
- `server/ratings_server.py`: kind "fx" + GET /tuner/fx (fx.jsonl, apart from animation presets); tw-ratings restarted.
- `fx.html` + `js/fx/harness.js`: the real tuner with FX hooked in via Scene.prototype.onBeforeRender (r170 assigns
  renderer.render per instance, so a prototype patch of WebGLRenderer.render does nothing). `?mode=trivial` = one
  hearth in an empty room (+`&candles=1`, `&nohearth=1` debug, `setView('close'|'candle'|'top')`).
- Tests: `test/fx_shots.py` (cost ladder + shots), `test/fx_ui.py` (11 checks, all pass; send verified against the
  live server, test record archived by archive_test_writes.py, now fx-aware). Vendored libs + licences: `js/vendor/`.

Lessons (results, not verdicts):
- three-fire's shader writes alpha = red; with AdditiveBlending (SrcAlpha, One) that squares brightness away and the
  flame vanishes. Use pure One/One blending. Its turbulence lifts every lookup upward, so the flame texture must stay
  bright over most of its height; a "tongue-shaped" texture gives a low band.
- AgX turns firelight salmon-pink; ACES keeps it orange. Default ACES; AgX stays a choice.
- Near-field point light (decay 2) blows out the firebox stone; hang the light ~1.6 ft out at the mouth.
- main.js FIRE_RE also lights `rug-hearth-halfmoon` and `trade-oven-rake`; fire.js `fireType()` excludes them.

Cost (headless SwiftShader; fps meaningless): common room 35x25 at 10k-face LOD, plain = 143 calls / 880k tris.
Post stack +3 calls; volume flame +1-2; all candles +1 (instanced); embers +1, smoke +1 (batched); bloom +16
fullscreen; N8AO +12-15 fullscreen. **Each shadow-casting fire = +216 calls, +1.33M tris on a refresh frame**
(6 cube faces x the room): static map ~+27 calls avg, dance ~+125 calls / +0.66M tris avg. Shafts +3-4 calls.
Shaders 72 -> 91. Gemini (2.5 Pro): reads as a cosy firelit tavern at table distance, flame reads as fire in the
hearth, candles read as candle flames, flicker visible; residual: hot spots on the low-poly logs and firebox stone.
Status: READY TO INTEGRATE (hooks: createFx + fx.frame/fx.render in the loop + importmap entries in index.html).

### 2026-10-02 (later): FX integrated into the live tuner (not deployed)
main.js: `import { createFx }`, one `createFx(...)` replacing the old Fire-lights slot, `fx.frame/fx.render` in the
loop, `fx.setSize` in resize, `lights`/`fx` in bench stats. index.html: importmap entries; Fire-lights checkbox
retired (accept.py A10c now checks the FX lights). Fire lights use decay 1.4 (hot spots on logs/stone gone); default
smoke 0.65. `?nofx` = plain render for headless layout tests. Node suites 9/9, fx_ui 11/11. accept.py: headless
SwiftShader crashes mid-run with FX on (11-19 PASS, 0 FAIL before the crash) and later with FX off (35 PASS); A24
tag stability across reload fails with FX fully off too (not FX; wall kit was mid-edit).

## 2026-10-02 — wall variant B: an exact-module kit beside the generated walls (A)

Harry agreed to try it side by side ("don't be hurt if it doesn't work out"). **Variant A** = today's generated wall meshes scaled onto the 5-ft module. **Variant B** = exact geometry: every wall is stacked layers (plinth, body, cap; half-timber adds a sill beam), each an exact box centred on the grid line; one shared tiling material per family with UVs computed from world position.

**What's in the tuner:**
- Code: `js/wallkit.js` (pure plan: layers, nodes, doors, windows, hinges, UV rule; node-testable) and `js/wallkit3.js` (meshes). It's wired into `syncWalls` and `makeVisual`.
- Families: "kit: stone" (dressed ashlar, 12-in wall), "kit: half-timber" (plaster with exact timber face boards, 9-in wall) and "kit: plank" (horizontal rough planks on a stone footing, 6-in wall).
- UI, built from JS (index.html untouched):
  - the three families are added to the room Walls dropdown;
  - the bench gets a "Wall kit" select: generated (each room's own choice) or kit (nearest matching kit family).
  - The global select flips every *auto* room. An explicit per-room choice always wins. The flip rebuilds walls, doors and windows inside `busy++`.
  - `?wallkit=kit` and localStorage remember it.
- Mapping from generated to kit: dressed stone and fieldstone → kit stone; half-timber and panelled plaster → kit half-timber; rough timber → kit plank.
  - Props that choose a sku by wall family (trapdoors) use the generated family a kit stands in for (`meshFamily`, in walls.js and solver.js).
- **Nodes.** Where walls turn, end, change family or frame a door, a node box fills exactly the region the slabs would fight over, per layer, so plinth and cap wrap the corner. Slabs stop on the node's faces. Straight joints have no node: the two slabs meet at the vertex.
- **Doors** (Harry's scope addition): an exact casing fills the cut, and the leaves are built from boxes. Styles:
  - ledged with strap hinges (plank);
  - iron-strapped and studded (stone, and reinforced doors anywhere);
  - framed and panelled (half-timber, and grand doors);
  - barn: ledged with a Z brace.
  - Spans: single = 1 leaf; 2/3/4-cell = 2 leaves. Ring pulls on both faces.
- **Windows:** sill board, casing, mullion and transom, glazing. Timber families add shutters hung open on the outside.
- **Hinges:** every leaf and shutter carries `{mode:'hinge', pivot, axis:[0,1,0], openAngle (±100 door into the owner room / ±170 shutter), duration, ease, openEase, rest}`. This matches the open/close pilot's `runtime/openclose.json`. Each pivot is a named group (`leaf_hinge_i`) in the visual.
- **Generated leaf doors stay with A.** A kit room never falls back to a generated door (test K14: 0 generated openings in an all-kit map).
- **Shared-wall rule:** unchanged. The oldest room owns a shared wall, kit or generated. At a vertex where kit meets generated, the kit builds its node and the generated post is kept too (how A joins anything).
- **Spawn:** kit pieces go through `makeItem`, so they're born hidden. No pre-animation flash measured (K5).

**Seams, measured (measurement beats vision):**
- `test/wallkit.test.mjs`: 573,593 checks, 0 failures over 600 random buildings (v1 + v2 door policies; all-kit, mixed with generated, and each family alone):
  - 193,672 boxes and 40.0M box pairs: zero overlap volume;
  - 12,596 straight joints: the end faces meet at the vertex (max gap 0 ft) with identical cross-sections;
  - 21,348 node joints: every slab end lies on a node face and inside it;
  - 314,832 UV samples across joints: max jump 0;
  - door openings = generated leaf spans (52 in single, span×60−16 wide) at 2,517 doors (spans 1/2/3/4 all built), with 3,027 hinges all on leaf edges and swinging into the owner room.
- In the browser, on the **rendered** buffers (`tuner.kitSeams()`):
  - every vertex of the textured kit meshes is bucketed by position + normal + material + UV rule;
  - A|B pair: 624 vertex positions shared across pieces, max UV delta 0;
  - eight-room all-kit map: 3,378 shared positions, UV delta 0, 73 straight joints with 0 rendered gap.
- **Exception, by design:** where a wall turns right at a door jamb (1,631 of 2,517 fuzz doors: terminals hug corners), the jamb grows to cover the crossing wall's plinth. Otherwise a notch opens beside the casing. The opening narrows by up to 4 in per side (stone), 2.5 in (half-timber) or 0.5 in (plank).
  - A has the same conflict, but it shows as the 52-in leaf overlapping an 18-in corner post.
- **Found while building:**
  - walls.js can re-mark a segment inside a wide exterior door as a 'door' (v2 link/reachability). v1 also lets a later room wall across a sticky wide door.
  - The kit treats re-marked segments as inside the opening, and cuts the opening at a crossing wall.
  - **A still hangs two leaves in one opening in that case.**

**Textures (Gemini only; no fal, no RunPod):**
- 6 Gemini flash-image calls: 2 candidates each for stone, plaster and wood, with a new wall-elevation style prompt (`experiments/2026-10-02-wallkit/style.wall.md`).
- Processing: `process.py`, the floors path (flatten tone, crop to whole course/plank periods, cross-fade), plus a Sobel normal map.
- Gemini picked from 2×2 repeat sheets: stone v2, plaster v1, wood v1. This agreed with the seam metric.
- Shipped: 3 albedo + 3 normal maps at 1024, webp, **308 KB on the wire, about 34 MB on the GPU with mips**. Every kit family shares them; e.g. half-timber uses plaster + wood + stone.
- Texel density: stone 8 ft/repeat (12-in courses), plaster and wood 6 ft.

**Cost on the GPU** (4-room map, props and floor hidden, software GL so fps meaningless):
- A: 90 draw calls, 375k triangles.
- B: 177 draw calls, 8.8k triangles.
- B's triangle count is about 2% of A's, but it has about twice the draw calls, because each piece keeps one mesh per material so it can spawn on its own. Merging per room after the spawn would fix that if B wins.

**Gemini A|B read** (test/kit_shots.py: rooms one cell apart, outside / north / corner close-ups / table):
- Stone: B better. It sees A's "vertical seam and identical stones every 5 ft" (repeat 5/5) against B's 2/5, with clean corners and bands.
- Plank: B better, same pattern (A's 3D planks repeat glaringly; B 2/5).
- Half-timber: A better. B "looks flat, like wallpaper on a cardboard box"; it reported "plaster seams every 5 ft" on B, but the measured UVs are continuous, and those lines are the 8-in posts at each 5-ft joint.
  - Response: face boards went from 1 in to 2.5 in proud.
  - Reshoot: Gemini now rates half-timber B better too (no seams, repeat 2, clean corner post, bands continuous; A's identical braced panel repeats three times in a row, 4/5).
  - It still calls B "flatter, less architectural interest". A narrow question confirmed B's timbers read as raised: 3 posts and a rail on the south face, braces only in plain modules.

**Tests:**
- node suites all green (anim, focal, repeat, solver, solver2, stable, stacks, zones, v2_fuzz, wallkit).
- `test/kit_accept.py`: 22/22 local and 22/22 live.
- `test/accept.py --writeback`: 51/51 live on the second attempt; the first lost its headless page in a fresh-browser stage. Write-backs archived (tagged records only).
- Headless now needs `?nofx`: the FX agent's lighting stack crashes software GL. Local runs crashed repeatedly at load average 10–18 until `nofx` was added; the python http.server also stalled under load.
- Run as `accept.py 'URL?nobg&nofx&seed=4242'` (A24 needs a seed in the URL).
- A|B shots: `test/kit_shots.py URL [stone|halftimber|plank]` → `test/shots/kitab-*.png`.

**Honest read:**
- B wins wherever A's texture or geometry visibly repeats per module (stone, plank).
- A's half-timber already hides its joints behind real 3D beams, so B's job there is depth, not seams.
- B's real costs: draw calls, and a flatter silhouette at the top and bottom edges.

## 2026-10-02 — Decision: generated walls, not the kit
Harry rated the exact-module kit (variant B) a **B-**: better than he expected, and usable in another context. He judges the generated asset pipeline at B+ now and A- with some fussing, so **walls stay generated**. The kit code (`js/wallkit*.js`, `test/wallkit*.mjs`) stays in the tree as a dormant option; the Bench "Wall kit" switch defaults to generated. Still worth reusing from the experiment: the hinge data shape for doors and shutters, and the measured seam and repeat findings, which show what the generated walls need to fix (a visible 5-ft repeat, seams at joints).

## 2026-10-02 — inn-02: 441 gated meshes on RunPod for $3.84

Harry approved the batch, then widened it to about 450 SKUs. 444 were specified and 441 meshed; all 441 pass Blender validation. The batch covers:
- 31 OPEN swap states;
- 52 regens of inn-01 problem assets;
- 57 UNLIT wall and ground lights;
- 8 open fires;
- 7 EMPTY vessels for the water shader;
- 8 fire-kit pieces;
- 39 grammar gaps from a v2-solver run over 880 rooms;
- 89 variants of the most-placed props;
- 150 TAV catalog lines that had no mesh.

This was the first run in the corrected factory order (`src/plate_gate_batch.py`): Gemini plate, then a flash vision semantic gate with up to 2 rerolls, then a local BiRefNet matte (the build box 3060) plus a vision mask gate with a chroma fallback, then TRELLIS. About 568 plates gave 107 semantic and 15 mask rejects. Only 3 SKUs failed for good: three open double doors that Gemini will not draw open.

Two lessons:
- **BiRefNet keeps chroma trapped inside closed shapes.** A connected-region chroma cut fixes it (`refine_with_chroma`).
- **A second-model audit on contact sheets is noisy.** Its mask claims were measured false, and its tile numbering slipped on 12-up sheets. Measure first, and ask single-image questions before acting.

RunPod was one A100 for 2.47 h. Model load took 18 min from the network volume, so wave 2 loaded on CPU behind wave 1 (`--wait-pids`). The pod was deleted and the deletion verified by API. Gemini cost about $29.70.

Catalog changes: new optional fields `open_of:` and `mount:`, plus three new files (lighting, open states, inn kit). The validator is clean. Tuner data was rebuilt with runtime and LOD ladders (897 mesh SKUs), and the solver suites are green. The review is at `/projects/turnip-works/review-02/`. Details: `experiments/inn-02/LAB_NOTES.md`.

### 2026-10-02 (round 2): flame anchors, lanterns, the "ghost map in the sky" (Fauna, FX agent)
- **Anchors**: `prep/fire_anchors.py` derives per-sku flame anchors from each GLB (wick tips from an x/z height map;
  torch heads; firebox/oven cavities by ray grid: roof+floor+side walls, open to one of +-z; fire-pit beds by a centre
  ray; lantern bodies at the widest band) -> `data/fire_anchors.json`, normalised to the mesh's own bounds and mapped
  through the mesh root's current world matrix each frame (catalog scale, orient yaw, LOD swap, settle.js all follow).
  Anchor-to-nearest-surface over 89 lit skus: old heuristic worst 15.8 in / mean 4.1 in (chandeliers ~15 in above
  their candles), new worst 6.45 in (lamp-pole--iron) / mean 0.27 in. Live in-page check (fx_regress R1): tip
  flames worst 0.37 in. Edit flames tool (`js/fx/anchoredit.js`): dots, click-to-add, drag (Shift = on surface),
  Delete, Send (kind fire_anchor per sku; GET /tuner/fire_anchors; overrides win), Auto.
- **Lanterns**: own Fire-panel group: intensity, range, falloff, warmth, glow on panes/body (emissive from the
  texture), beam all-around / hooded-down / forward (spot), count of lanterns with their own light, shadows, and a
  pierced-pane cookie (alpha-tested distance/depth material from the texture's bright texels). Candles unchanged.
- **Sky ghost root cause** (Harry: "a shadow copy of the whole map in the sky, moves as I zoom"): lighting.setSize
  also called `N8AOPostPass.setSize(cssW, cssH)` after the composer had sized it to the drawing buffer. On a
  pixel-ratio-2 screen N8AO ran at half size (measured 580x617 vs 1160x1235) and sampled the map's depth/AO from the
  wrong texels: a displaced, zoom-dependent copy of the AO. Headless at DPR 1 can't show it. Fix: composer sizes all
  passes. Regression R7 (DPR 2). Also fixed on the way: godrays cached the shadow map + camera far once (stale after
  shadow-detail change: R6), the caster budget ran on a frame-time modulo (timer now), shadow maps now refresh every
  frame while anything moves (spawn/settle/drag) and once after (R2), fires light only once their item has landed (R3).
- Tests: `test/fx_regress.py` (R1-R7), `test/fx_ui.py` (+ edit-flames drag/add/delete/send/auto), node suites.

## 2026-10-02 — inn-02 integration QA: orientation keyed by mesh, front sweep of all 441 inn-02 meshes
**Why:** `build_data.py` lets inn-02 win over inn-01/01b, and 52 regens kept their sku names. Some came out turned 90° (bed-double--common bounds went from long-along-Z to long-along-X), and sku-keyed orientation (orient.json, Harry's R-key records) could land on a mesh it was never measured on. focal had 36 failures (guest-room nightstands), repeat had 3 (dorm foot chests). The old data (5e3ccc8) passed, so the data was the cause.
- **Mesh identity.** Every mesh sku in `library.json` now carries `mesh` = `<src>/<sku>@<sha1-8 of the source GLB>`. The 52 inn-02 regens also carry `was` (the superseded mesh plus the time inn-02 went live, `SRC_LIVE`). `data/orient.json` is keyed by mesh id. `solver.js orientDeg(sku)` reads `orient[sku.mesh]`, so tests and the engine (same solver and data files) follow automatically. `build_data.py` reports orient keys that match no mesh.
- **Harry's records untouched** (`reviews/tuner/orient.jsonl`). New records add `data.mesh`. `GET /tuner/orient` keys by `data.mesh` when present, else by name (ratings_server, restarted). The tuner files a sku-only record under the mesh that sku showed at the record's time (`was[].until`). Every existing record predates inn-02, and none of the 9 skus is a regen, so all still apply to their inn-01 meshes. Browser corrections moved from `tuner.orient` to `tuner.orient.v2` (mesh-keyed, one-time migration).
- **Sweep** (`prep/orient_views.py` → `orient_sheets.py` → Gemini → `orient_probe.py` → `orient_decide.py`; evidence and decisions in `prep/orient-sweep-inn02/`):
  - Four views per mesh from glTF +Z/+X/-Z/-X, labelled A–D, never named as axes. Sheets hold 4 objects. `gemini-3.8-flash` describes each row blind (object, pose, which tile shows the front), then a text-only call matches the blind description to the catalog entry. 30 suspects got a single-object `gemini-3.1-pro` read.
  - The measurement checks: does the yaw put the mesh's long side along the catalog box's long side, which end is tall (headboards, chair backs), and which sides are flat.
  - Calibration on known meshes matched Harry's corrections (bed-canopy 0, chair-upholstered 0) and the old sweep's table-vanity and shelving. It also showed the 10-01 sweep read headboards as fronts: bed-single--common--s1 and sickbed went from 90 to -90, and bed-canopy went from -90 to 0 (Harry had already corrected it to 0 on the server). The headboard height probe agrees on all three.
  - **Verification:** 40 non-zero-yaw meshes were re-rendered with their yaw applied and read blind again. 38 now show their front on tile A. The other two are ambiguous objects: the manure barrow (wheel end or handle end?) and the garbled bung mallet.
  - **Result:** orient.json holds 236 meshes (14 migrated legacy, 222 inn-02). 85 inn-02 meshes are turned; the rest are pinned at 0 so the long-axis heuristic can't misfire. Kit pieces take only the box rule (which face is "inside" is the wall code's call).
- **Flagged, not turned** (ratings `inn-02/<sku>/model`: masking tag, stars null, note tagged `[fauna orient sweep 2026-10-02, not Harry's rating]`):
  - fish: a flat cut-out standing on its edge;
  - roast-pig: hollow shell, side and back missing;
  - settle--s2: an L-shaped corner seat;
  - wall-window-small--rough-timber: melted window opening.
- **Lying but natural, left alone:** feather-duster, hand-mirror, mallet-meat, leg-of-mutton, flowers-dried, hay-bale--s4 (round bale), rural-straw-bundle. The pro read called a dozen small props "garbled" at the 3k shipping tier (apple-basket--s2, baskets-stack, coin-stack--s2, dice-and-cup, shaving-kit, trade-bung-mallet…). That's low-poly texture rather than broken geometry, so it's left for Harry's review.
- **Solver (dorm foot chests, `solver2.js`):** the foot band is sized from one random chest-plain variant. inn-02's shallow chest-plain--s4 (1.8 ft against 2.2–2.6) made it too shallow for s1–s3, and a rolled linen chest (3 ft) never fit at all. Foot chests now roll among the variants that fit the band (`chooseSku want.maxD`), and they fall back to the other foot items when the rolled one can't fit. The test's assumption ("most row beds get a chest") was right; the solver was fragile.
- **Not done:** fire anchors (`data/fire_anchors.json`, server `fire_anchor` records) are still sku-keyed. candlestick--fine and torch-sconce--s3 are regens; their auto anchors were computed after inn-02 landed, but any hand edit would carry over the same way.

## 2026-10-04 — Alignment Bench: fire, water and open/shut anchors, one object at a time (Fauna)
Harry: "I probably need a 'fire alignment tuner' for objects that have fire … (fire/water and probably open/shut)."
**Live:** https://implausible.enterprises/projects/turnip-works/align/ (source `web/align/`, deploy `web/align/deploy.sh`,
content-hashed module URLs). Door card on the Turnip Works landing page (backup `index.html.bak-2026-10-04-align`).
- **What it is.** Keyboard-first, like the review page: J/K or ←/→ step, Enter = looks right (saves, marks aligned,
  next), A = back to the automatic guess, S = save without aligning, 1/2/3 = Fire / Water / Open-Shut, `/` = name filter;
  Unaligned / Aligned / All filter and a progress counter per mode. One object, big, at its true orientation (the
  tuner's `look.makeVisual`, mesh-keyed orient, the game's LOD dials), orbit/pan/zoom, plus a small table-distance
  view with a 5-ft grid and a 5 ft 9 in person for scale. The bench imports the DEPLOYED tuner's `look.js`,
  `fx/fire.js`, `hinge.js` at the stamp in `tuner/version.json`, exactly as the game does.
- **Queues** (`web/align/js/queues.js`, built from the live library at load, one entry per MESH): Fire 89 (every sku
  `fireType()` lights; all 89 have auto anchors from `data/fire_anchors.json`), Water 29 (inn-02's 7 empties first,
  then the other open water vessels, barrels included so the raycast can judge their tops), Open/Shut 48 (aff `open`,
  catalog `open_of` twins, trapdoors, stall doors/gates, trunks).
- **Fire.** The tuner's live flames at the game's house fire look. Click adds, drag moves (Shift = along the
  surface), Del removes, `[ ]` size the picked flame, L moves a lantern's light. Writes `fire_anchor` (name = mesh id);
  confirming the unchanged auto anchors writes `anchors: null` + `aligned: true`, so a later re-derivation still lands.
  **fire.js extensions (backward compatible):** an anchor may carry a 4th number, a per-flame size (`[u,v,w,size]`);
  a record may carry `light: [u,v,w]` for where a lantern's own light hangs. Per-anchor flame TYPE is not supported
  (type stays per sku); volume fires (hearth, oven, brazier, torch) still use only the first anchor.
- **Server fix:** record names were limited to `[A-Za-z0-9 ._-]`, but fire anchors are keyed by mesh id
  (`inn-02/x@hash`), so the tuner's own "Send flames" had been failing with "bad name" since the mesh keying. Names may
  now carry `/` and `@`. New kinds `water_surface` and `hinge`, GET `/tuner/water_surfaces` and `/tuner/hinges`
  (latest per name). tw-ratings restarted.
- **Water** (`water_surface`, no shader yet: a translucent tinted plane). Auto: rays straight down over a 44-cell grid
  in the GLB frame; a thin overhang is peeled by hit parity (hit 0/1 = a slab, hit 2 = the surface under it) unless it
  is a LID on the rim (>30% of the pool covered, not overhead) — a bucket handle or a well roof is seen through, a
  closed barrel isn't. `vessel.js` priority-floods the map from the border: pooled cells = water would stand there;
  the largest pool is the vessel, its spill level the rim (a spout notch lowers it), its 10th-percentile the floor.
  Footprint = pool cells under the level, as an ellipse (moments) or convex polygon, shrunk until 92% of the outline
  lies over water cells (a handle slot can't stretch it through a wall), then inset (default 0.6 in). Rectangular
  pools (cells fill >90% of their principal-axes box) default to a polygon. Record: `level`, `y/floor/rim` (bbox-height
  fractions), `poly` [[u,w]…] (bbox fractions: what a renderer fills), `ellipse`, `inset_in`, `grow`, `shift`, `tint`,
  `opacity`, `none` ("holds no water"), `auto`. A renderer maps (u, y, w) through the mesh root's world matrix, like
  fire anchors. **Auto found a pool in 26/29;** no pool: bucket--s1, washboard-tub, well (inn-01: capped shaft).
- **Open/Shut** (`hinge`, keyed by the CLOSED mesh, openclose.json shape). New shared `tools/spawn-tuner/js/hinge.js`:
  `rigHinge(root, rec)` bakes the root's (possibly non-uniform kit) scale into the parts, then swings 'whole' (doors,
  gates, trapdoors) or 'above' (cuts the mesh's triangles by centroid at `split` and swings the lid) about pivot/axis;
  `swapPlacement()` for swap offsets. Auto: doors/gates/stall doors → whole-mesh hinge on the back-left vertical edge,
  +95° (pushes to the back); trapdoors → top-back edge lifting; chests/trunks without a twin → lid at 0.62 height on
  the top-back edge; everything with a generated `-open` twin that isn't a single leaf (chests, cupboards, wardrobes,
  windows, double doors, the oven) → swap, variant-matched (`chest-plain--s2` → `chest-plain-open--s2`), offset 0.
  The swing direction is chosen so lids lift and doors push back. Click the mesh snaps the pivot to the nearest of the
  12 box edges (named in the oriented frame); E steps edges, R reverses, `[ ]` angle, ↑/↓ split or swap offset,
  G ghost of the other state, O toggle, C auto-cycle.
- **The game:** fire anchors from the bench reach the tuner and the game at their next load (fx/index.js already read
  `/tuner/fire_anchors`). Hinges: a small hook — `engine/client/tuner.js` loads `/tuner/hinges` into `T.hinges`;
  `assets.specOf` uses a `hinge` record to keep the closed mesh and pass `hinge` + `open` (look.js rigs it; the
  entity's `open` already rebuilds the visual, so it opens instantly, not animated yet), and a `swap` record to pick
  the variant-matched twin with the bench offset (kit twins now get their own catalog depth). No record = the old
  swap. Animated hinges in the game are the next step (`root.userData.hinge.set(t)` is there to drive).
- **Deploys:** the tuner and the engine client were deployed from a git-HEAD export plus only these files, so the
  other agents' uncommitted work (selection lab, engine WIP) did not ship. tw-relay restarted by the tuner deploy.
- **Tests:** `node web/align/test/vessel.test.mjs` (11 synthetic vessels: rim, spout notch, lid, ellipse/poly,
  inset, slot containment). `web/align/test/accept.py URL [--tuner U] [--game U] [--shots]`: queues, fire
  drag/add/delete/size/Enter, water drag/keys/Enter/reload/auto, hinge lid/R/split/Enter, swap toggle/offset/Enter,
  click-snap to a right edge, keyboard flow, filters, phone 390 px, the tuner and the game reading the bench's
  fire_anchor, the game turning hinge/swap records into specs. Writes are tagged and archived with
  `tools/spawn-tuner/test/archive_test_writes.py` (now knows the two new kinds). `survey.py URL MODE` walks a
  queue and prints the auto guesses; `blind_shots.py` makes the Gemini shots.
- **Gemini blind-first** (describe, then judge, gemini-2.5-pro): hinges 4/4 on a sensible edge (trunk lid at the
  back, door and gate on the side that carries the mesh's own strap hinges, trapdoor). Water 6/6 inside the vessel
  after two fixes the first pass caught (washtub water poked through its handle slots → containment; troughs and
  basins read as ovals → auto polygon). Fire 4/6: candelabra, lantern, torch, fireplace yes; candlestick "engulfs
  the wick" (a real flame does; left), **chandelier-ring: a visible gap between flames and candles** — the first
  thing for Harry to fix on the bench.

## 2026-10-04 — Atmosphere: fog & smoke in the Spawn Tuner and the game (Fauna, Claude Opus 5.5)
- Built `tools/spawn-tuner/js/fx/atmos.js`, a fluid ground fog on the floor plane that swirls under the cursor,
  dragged things and walking pawns. It goes with haze and dust, soft hearth smoke, ceiling pooling, candle wisps,
  puffs, the unbuilt-world fog sea and fog of war. Design and costs: tools/spawn-tuner/PLAN.md (2026-10-04
  Atmosphere).
- **Gemini lied twice, so measure**: an early blind read described a "dense uniform fog sheet" in frames where the
  fog was invisible. Readback showed it at 5% coverage, extinction 4× too low. Iterate on numbers (field readback,
  fx-target alpha), and use Gemini for the final blind-then-judged read only.
- **Found on the way**:
  - static world-space detail noise made the fog look motionless under a stir (the detail must live in the
    simulated field);
  - vortex confinement in these units (curl per texel in ft/s) fed on numerical noise and sustained 7 ft/s
    turbulence forever (gated + scaled ×0.2);
  - firelight in thin air blew out to orange discs (soft saturation, thin air takes 45% of it);
  - `warm()` pushed the flame-poll clock 1,000 s ahead (no puffs after a fast-forward);
  - all fires out made the source signature `''`, equal to the reset value (no re-sync);
  - a WebGL context lost on load in SwiftShader under parallel GPU/CPU load (transient: the same tree then loads in
    0.6 s).
- Headless Chrome reaches the RTX 3060 through ANGLE/Vulkan (`--use-angle=vulkan --enable-features=Vulkan
  --ignore-gpu-blocklist`) with timer queries; with `--disable-gpu-vsync --disable-frame-rate-limit` frame time is
  meaningful. A GPU timer around the whole frame counts submission bubbles and overstates.
- Pre-existing, not from this work: the game's WebSocket to /api/tw-relay/ws 404s on both hosts (falls back to SSE).

## 2026-10-05 — Outdoors: the Yard room type, and the first to-build list (Fauna, Claude Opus 5.5)
- Harry approved an Outdoors room on 2026-10-05: **a room with no walls**, sparse on purpose, dressed only from meshes we
  have. Built as the **Yard** in the Spawn Tuner and the game. Rules: `tools/spawn-tuner/ROOMS.md` → Outdoors. Build
  notes and findings: `tools/spawn-tuner/PLAN.md` (2026-10-05 Outdoors). Wishlist: **`docs/ASSETS_TO_BUILD.md`** (new,
  living; Outdoors is its first section).
- **What a yard holds today:** one focal thing in the open (a well and its bucket; sometimes a fire pit with benches or
  a stone horse trough), the inn's hanging sign and a lantern on the wall beside the common-room door, a bench, the
  woodpile with the chopping block in front, the rain barrel and crates by the kitchen door, a trough and hay by the
  stable door, a lamp post at the gate, barrels at the wall; in big yards an outhouse, woodshed or cart shelter on the
  far edge. Ground: grass (new), earth, cobble or gravel (new).
- **Plants:** none exist, so the recipe has a `plants` slot (2–4 bush or tree picks by the edges and doors) that is
  empty and fills by itself when a mesh ships under one of its roles. Tested by injecting fake plant meshes.
- **No money spent.** The Yard icon, grass, gravel and the grass decals came from `codex exec` image generation
  (`experiments/2026-10-05-outdoors/`). No meshes were generated; no RunPod, no fal.
- **Catalog:** `catalog/objects-outdoors.catalog.md` (20 new lines, 16 of them not generated), recipe `tav-yard`, TAV
  added to 21 outdoor roles that already had lines. `catalog_tool.py` is clean (2,894 objects). Its `--fix-tags` no
  longer edits anything (its pattern predates `size:`); the tags were added by hand.
- **Two things for whoever is next in the catalog:** `bounty-poster` and `proclamation-scroll` list height as depth, so
  they hang as slivers indoors; `price-board`'s mesh is an easel, not a board.
- **Shared files:** three agents were in the tuner's files today (atmosphere, log-cabin walls, outdoors). Three small
  hunks of the yard's went into `tools/spawn-tuner/js/fx/atmos.js` while the atmosphere agent was reworking it (search
  "built open ground": an outdoor room clears the fog sea over the unbuilt world); they were committed inside that
  agent's commit d78d7c1. A bulletin (`lane-post`) says so. The yard commit stages only its own hunks of `walls.js`,
  `look.js`, `build_data.py` and `library.json`; the log-cabin and ratings changes in those files are left unstaged.

## 2026-10-05 — Atmosphere round 2: wind as fluid, fog height per room, a view-fitted sim window (Fauna, Claude Opus 5.5)
- Design and numbers: tools/spawn-tuner/PLAN.md (2026-10-05 Atmosphere round 2).
- **What made the drift read as an overlay** (Harry: "uncanny valley"):
  - (1) the wind was an offset added to the advection, the same everywhere;
  - (2) the fog healed toward a scrolling noise bank even where a wall blocked the flow, so mist was painted into
    the lee;
  - (3) the renderer scrolled its own noise with the wind.
  - Fix: the wind is a body force outdoors, healing happens only where the air moves with the drift, and sheltered
    air decays. Gemini went from "overlay with a mask" to A on the same frames.
- **Open window edges matter.** With the window's rim solid the wind stalls against it. Outside is open air:
  pressure 0, nothing solid.
- **Test samplers lie before shaders do.** Three "seams" turned out to be sample points on overlay text, behind the
  camera, or behind the building. The seam check now hides overlays, uses a projection that flags points behind the
  camera, and samples lines beside the building.
- Another agent's yard work edits atmos.js alongside mine (built open ground in the place mask). Scripted
  replace-in-place kept both; whole-file rewrites would not have.

## 2026-10-05 — Log-cabin window, open window and doorway; a second plank wall (fal, $1.20) (Fauna, Claude Opus 5.5)
- **Spend:** 4 meshes on fal `fal-ai/trellis-2` at $0.30 = **$1.20**, no re-rolls. Harry, 2026-10-05: "you can always
  run fal or runpod without double-checking approval". Plates were free (Codex image route).
- **Pieces** (sources in `experiments/2026-10-01-walls/models`, where `build_data.py` reads `<object>--<family>[--sN]`):
  - `wall-window-small--log-cabin`, `wall-window-small-open--log-cabin`, `wall-doorway--log-cabin`: plates and gates
    in `experiments/2026-10-05-log-cabin/`; fal run and manifests in its `fal/` folder.
  - `wall-straight--rough-timber--s4`: `experiments/2026-10-05-plank-s4/` (plate from the s2 plate as reference: two
    horizontal rails, no diagonal brace; first try rejected by the gate for a slotted post on one edge).
- **Input to fal was the masked cut-out (RGBA), not the blue plate**, so a hole in the mask is a hole in the mesh.
- **Measured** (orthographic front silhouette of the kit-fixed mesh): doorway opening clear from the floor, 49% of
  the width; open window has a clear hole 49% of the width x 24% of the height; closed window has only a slit
  between the shutters; width : height 0.49–0.59, depth 0.13–0.15 of the height; no slab cut needed. The open
  window's folded shutters overhang each side edge by 3% of its width (about 2 in).
- **Gemini** (3.8-flash, blind on four views, then against the plate): all four coherent, upright, nothing
  protruding, openings match; accepted.
- **Orientation:** kit pieces take the box rule only. `kit_fix` turned the doorway 90°; all four have their broad
  face along Z, so no `orient.json` entry is needed (the same as the 10/1 walls).
- **Long walls alternate.** `look.js edgeSpecs` picked a piece version by hashing the edge, which gave runs of three
  or four of the same panel. It now steps along the wall run (each wall line starts on a hashed phase), so two
  versions go A B A B.
- **The doorway piece is not drawn by generated rooms.** Since 2026-10-01 a door edge is jamb posts plus a door that
  fills the opening (`edgeSpecs`: no wall piece for `door`). `wall-doorway--log-cabin` is in the library for hand
  placement only.
- **Open twin:** the Alignment Bench pairs `wall-window-small--log-cabin` with `wall-window-small-open--log-cabin` by
  name (`twinOf`). There are no hinge/swap records at all yet (`reviews/tuner/hinge.jsonl` is empty), so in the game
  every opened thing still takes the first usable `-open` mesh of its object. A confirmed swap record on the bench
  is what makes a log window open to the log twin.
- Gemini's read of the plank barn (not from this change): the plank window panel (`--s2`) is paler than the plank
  walls, and there is a slit between the barn-gate posts and the next panel.

## 2026-10-05 — Outdoor batch: trees, plants, edge kits, yard furniture (RunPod, $0.76) (Fauna, Claude Opus 5.5)
- **Spend:** $0.76 on RunPod (one RTX 4090 for 62 min: A100s were out of stock where the network volume lives), measured
  from the account balance. No fal. Plates free (Codex image route). Pod deleted and verified gone. Harry's standing OK
  for fal / RunPod on this project is from the same day. Folder: `experiments/2026-10-05-yard-props/` (README, spend.log).
- **Trees work.** Five were tested first, the trees with two prompts each (plain house style, and a storybook canopy of
  five to seven chunky clumps). All eight passed the plate gate, the measurements and a blind Gemini read; the chunky
  prompt had no notes at all and was used for the rest. The generator makes trees as wide as tall, so they ship smaller
  than the catalog says (per-mesh `size` in `catalog/runs/outdoors-02/manifest.tsv`; `solver.js dims()` reads `sku.size`).
- **54 pieces, 53 shipped.** Rejected: `hoe` (two meshes, both in floating pieces). Re-rolled: two plates after measuring
  the first mesh (`vegetable-patch` came out square, `sign-post-inn` had a 7.6-ft arm), two re-meshes (`trowel-garden`,
  `hoe`), three plates inside the gate. One gate text of mine was wrong (it demanded a domed hedge block and rejected a
  good flat one): the same plate was gated again against the corrected text.
- **Mesh QA is new and reusable:** `qa_mesh.py` (Blender: bounds against the catalog at the tuner's size rule, loose and
  floating parts, footprint span by height band for base slabs, a four-view sheet with a table-distance tile, a 5-ft grid
  and a 5 ft 9 in figure) and `qa_gate.py` (blind read of the sheet, then a text-only match with the measurements).
  Measurement overruled Gemini twice: it passed the square vegetable patch and the wide sign post.
- **Yard edges.** `yard()` lays a fence (post-and-rail, picket, wattle), a hedge or a dry-stone wall on the open sides:
  a section per grid edge on the grid line, a post / block / pier where a run ends or turns, a gate piece at the gate.
  The gate opening carries the yard's truly open segments (`walls.js`: `g.open`), so a side shared with another yard
  stays open. Two new catalog objects end the hedge and wall runs (`hedge-end-block`, `wall-drystone-pier`). Rules:
  `tools/spawn-tuner/ROOMS.md` → Outdoors. Kit boxes follow the meshes: the catalog's heights would have stretched them 1.5×.
- **Plants fill by themselves** (2.5 a yard over 272 test yards). New grammar for the batch's furniture: picnic table,
  kitchen-garden bed, tools by the kitchen door, compost, washing line, trellis, kennel, sign post, log seats, long woodpile.
- **Ground:** `decal-path-worn` ×4, `floor-grass-worn`, `floor-grass-meadow`, `floor-cobble-mossy` (free route; a
  sub-agent; `experiments/2026-10-05-outdoors/README.md`). The yard lays the worn path by itself.
- **Orientation:** `prep/orient_outdoors02.py` and `prep/orient-sweep-outdoors02/` (blind front read + the box rule):
  five of the 53 came in turned 90° and are corrected in `data/orient.json`. `orient_decide.py` now carries later
  sweeps through a re-run instead of dropping them.
- **Catalog fixes:** `bounty-poster` / `proclamation-scroll` height and depth; `catalog_tool.py --fix-tags` (its pattern
  matched exactly four fields before `set:`; lines have five or six now).
- **Found on the way:** pgrep / pkill match their own command line when the pattern is in it (two wait loops spun on
  themselves; the pod sat idle for 8 minutes because of one). Wait on a pid file or on `ps | awk '/[p]attern/'`.
- **Gemini at the table camera** (blind, eight yards): inn courtyard every time; trees, bushes, hedge, wall and fence
  named; hedge joins "very cleanly". Misses: the closed field gate reads as more fence, the kennel was misnamed three
  times, one fence corner read as doubled posts. Details in ROOMS.md.


## 2026-10-05 — Crypt type integrated: seven rooms in the tuner and the Build tray (Fauna, Claude Opus 5.5)
- **Live:** tuner palette (19 room types) and the game's Build → Fantasy → Crypt & tomb (7 rooms, icons, library areas). Commits 8f8da1f, 09e1707, 3e49d1b. No spend, no generation at integration.
- **Path:** `experiments/2026-10-05-castle-crypt-mansion/integration/` (`apply.py --scope once,crypt`: appended blocks plus one-line hooks; `PLAN.md` has the checklist and every correction made on the day). Castle and mansion use the same path.
- **Orientation:** 73 meshes, blind front read plus the box rule; 14 turned (13 quarter turns; the wrapped-body niche panel by a half turn: its niches were on the far face, found by ray-casting both faces), all re-rendered and read again. Rule learned: a wall piece's local +Z faces the room, so a kit panel whose two faces differ needs a measured face, not only the box rule.
- **Real meshes against the spec:** the pall is 3.8 ft wide (spec 3.0) and left 5.45 ft a side for a 5.5-ft bench; four kit catalog boxes followed the meshes instead of code reading `sku.size` for kit pieces; heaps ship larger.
- **Blind reads (Gemini, table distance, four rounds):** `crypt/ROOM_READS.md`. Five rooms named; ossuary and catacomb read as "crypt / tomb / burial chamber". Colour does the reading from above: pale wax and 2-ft skull heaps read as gold. Measurement overruled "upright coffin", "floating" and "clipping" each time.
- **A live fault and its fix:** six castle / mansion floors were listed with no image (build_data globs the batch's flats folder while it is still being filled). Now a flat is listed only when built, both deploys stop on any listed file that is missing (`test/assets_check.py`, 13,708 files), and `--live` checks both hosts: 0 missing.
- **Collision:** another agent committed `engine/test/core.test.mjs` whole (201ce0a) with the crypt block in it before the crypt commit; harmless, the block is the same.

## 2026-10-06 — Castle and Mansion types, the vertical kit in the library (Fauna, Claude Opus 5.5)

Batch `experiments/2026-10-05-castle-crypt-mansion` (the crypt went first: see the entry above). Worked in the `ccm` worktree, one tested merge per type; main was never left dirty. Three deploys of tuner + engine (00:58, 01:55, 02:03 PDT), `tw-relay` restarted by each and twice more to remove the two throwaway campaigns.

**What landed.** Castle: nine rooms. Mansion: ten. Library: `castle-01` 115 meshes, `mansion-01` 119, `vertical-01` 41, the crypt's `rite-bone-candelabra`; castle and mansion floors, 19 room icons, 16 keyed plates. 38 room types in the palette. The tray's NOB type is labelled Mansion.

**Preparation, all three runs at once** (before any program was touched, so that nothing main's `build_data.py` could list lacked its file): runtime builds (one minute for 276 meshes), the faces x skins ladder, the front sweep. Turned by the sweep: castle 12 of 115, mansion 5 of 119, kit 10 of 41; every turned mesh re-rendered and read again (all front A or none, except the mansion's `telescope`, `harp` and `book-stack`, which have no agreed front). 25 new fire anchors, none of the old ones moved. `build_data.py` ran in the worktree: the batch folders' git-ignored binaries are linked in from the main tree (links only, never added to git), and the job lists are written back with the main tree's paths.

**What the real meshes changed** (the drafts passed on fake meshes at spec size):
- `fireplace-grand` and `cook-hearth-spit--great` stood 9.2 ft in a 9-ft room (taller than wide): capped at 104 in in the manifest.
- **The dais** came out 3 ft high: a kit-GENERATED piece placed as a prop was scaled uniformly, and its mesh is twice as tall as its box. New: a batch sku generated as kit, with its own size, placed anywhere but `kit`, carries `fit: 'box'` and `solver.js dims()` stretches it per axis like a kit piece (one condition; the two daises are the only skus that have it).
- `door-cell-bars` was rejected: the cell door is `crypt-gate-iron` (it reads: dungeon 4 of 4).
- Trestles 3.5 to 4 ft deep (no bench fitted), racks 5 ft wide, the plank bed 3.3 ft deep, the cage and pillory tall enough to hide the rack from the door: each a line in the program or the test, said in a comment where it is.

**Results on the live record**: castle, all nine named (great hall 4 of 4 after one more pass; the gatehouse 3 of 4 live but a "guardroom" in half of all reads); mansion, seven rooms 4 of 4, the kitchen 3 of 4, the ballroom 0 of 4, the wine cellar "a cellar".

**Blind reads** (Gemini, three pictures, "what kind of room is this", 4 seeds; `castle/ROOM_READS.md`, `mansion/ROOM_READS.md`). What they taught, beyond the crypt's lessons:
- **From above, what hangs lies on the floor.** Ring and grand chandeliers were "wagon wheels", "floor grates", "chandeliers that have fallen". The great hall and the ballroom hang none.
- **A table with chairs behind it at a wall is a bar.** The high table on its dais was "an L-shaped counter with shelves behind it"; white linen made it a dining table.
- **The inn's kitchen in a big room is a storeroom or a workshop** (four larder corners; the bread oven is "a bellows", the hearth "a forge", a cauldron on a crane "an alchemist's"). The castle kitchen has its own works and fill; the mansion's is the same without the crane.
- **Colour decides before shape**: the green-topped `table-feast--s2` made a great hall "a recreation room with billiard tables".
- **A single thing on a platform is a throne** (again): the harp on a musicians' stage made the ballroom "an audience chamber". Tried, switched off.
- **An empty room has no name.** The ballroom (empty floor, chairs at the walls) is "a reception hall or antechamber"; the gatehouse (two gates, a windlass, a worn way) "a guardroom". Both are recorded as not passing, with what would fix them in `docs/ASSETS_TO_BUILD.md`.
- The judge is a coin near the line: the great hall was named in 6, 5 and 7 reads of 8 over three rounds, the gatehouse in 4 to 5 of 8 whatever was changed.

**New shared hooks** (appended blocks; none changes a room type that does not ask): `WAY_ON[type]` on `THROUGH` (a square room, any wall, the far opening as wide as the entrance, a named far door); `DOOR_ENDS` for the hall, throne room, chapel, gatehouse; `castleKitchenWorks` / `castleKitchenFill` (used by both kitchens); in `chapel()` nothing new. Engine: `pack.js` APART (courtyard, gatehouse, garden, cellar, conservatory), `ROOF_BY_FAMILY` (four families, slate), core.test blocks (rooms at y = 10 and y = -10 included), browser_build blocks, accept.py counts 38.

**Tests at the end**: castle 343,275 checks 0 failures, mansion 471,974 / 0, crypt 141,713 / 0; golden: the inn's twelve types unchanged at every step (the crypt's chapel and ossuary changed by the candelabrum, on purpose); the tuner's node suites 0 failures; engine core 342/342, relay 131/131, roofs 60/60; `accept.py` on the live tuner: with 28 types 48 of 49 (A25c, the known timing one); with 38 types 46 of 49 twice, the room-type checks (A1, A14, A20b, A24e) passing both times and the failures moving between runs (A11 and A23 once, A19 and A25b once, A25c always: all sample the GPU or the download rate while a 38-room scene is still loading); `browser_build.py --local` 89 of 89 after each type; `assets_check.py --live` 0 missing on both hosts.

**Not done**: no per-room-type `tall` default (the great hall is one storey when made); `stairPiece` treats `castle-rough` as a timber family (its `/stone/` test; reported in `vertical/FOR_STOREYS.md`, not changed); `crypt-catacomb` is still not in `pack.js` APART; the other engine browser suites (`browser_ui.py`, `browser_rooms.py`, the storeys ones) were not run by this work.

## 2026-10-06 — Figures: a four-figure pilot on fal, then the default set of 518 on RunPod ($9.18) (Fauna, Claude Opus 5.5)

Folder `experiments/2026-10-06-figures`; everything is in its README (pilot first, then "The default figure set").
Not in the game, the tuner library or the catalog: a pilot page and a gallery.

- **Pilot** (fal TRELLIS.2, 6 meshes, $1.80): painted plate, blind gate, matte, image-to-3D makes a whole, painted,
  base-less figure that stands flat and faces forward. Weak point: a thin held thing is invisible from the table camera.
  Page: https://implausible.enterprises/projects/turnip-works/figures-pilot/
- **Tiers:** 20k triangles / 1024 px could not be told from the 49k original in any blind read; 8k / 512 for hordes.
- **The set:** 518 figures (heroes 168, townsfolk 118, foes 154, large 51, beasts 27), **all published**:
  https://implausible.enterprises/projects/turnip-works/figures-pilot/set/ . Free Codex plates at 16 painters (about
  340 an hour), five RTX 4090 pods, measured QA, two tiers each. RunPod $9.18 from the account balance (cap $15).
- **Blind class test:** 161 of 168 heroes named as their class. Warlocks read as wizards (9 of 14) until the kit was
  rewritten to share nothing with the wizard (coat, imp, green fire, book at the hip): 13 of 14. Harry: do not spend
  more on warlock / wizard / sorcerer look-alikes.
- **the build box crashed at 15:33 mid-run.** Pods kept running; the local deletion timers died with the box. Now every pod
  also carries its own timer (`tools/pod_deadman.sh`, armed by `pod_up.sh`): verified by letting one pod remove itself
  (GET pod 404 after 43 s). Worth copying to the other batch folders' pod tools: they have the same hole.
- **Conveyor faults found and fixed** (README, "Faults in the conveyor"): repaint requests dropped when all pods were
  busy; an old mesh coming home from a figure's first pod; `pod_down.sh` on a volume shared by several pods.
- **Not done:** bases, the ring and the picker (pawn work, waits for Harry); harvest in parallel and small waves so the
  last figures do not queue behind one pod; the three heroes showing a first mesh where a second exists.

## 2026-10-06 — Cat tree: one prop on fal ($0.90, three meshes), and two traps in replacing a mesh under the same id (Fauna, Claude Opus 5.5)

A playtester asked for a cat tree at the table. `experiments/2026-10-06-cat-tree/README.md`; catalog id `cat-tree`, source `cat-tree-01`.
Live: the second mesh (smooth felt), tuner v=20261006212545. `/` then `cat tree`, Enter, click a square.

- **Plush comes out as flakes.** The first plate had plush carpet: 27,217 loose shells, and at the game tiers the platforms
  read as "shattered glass". Asking for "smooth, short felt painted as one flat solid surface" gave 6,393 (the yard batch's
  range) and solid platforms. Say it in the prompt for anything carpeted, furry or woolly.
- **Trap 1: `prep/blender_lod.py` kept an existing `prep/tex-src/<sku>.png`.** A mesh replaced under the same sku wore its OLD
  colour map on its NEW UVs (Gemini: "camouflage"). Fixed: the map is saved again when the source mesh is newer.
- **Trap 2: the colour-map ladder (`assets/tex/t*/<sku>.webp`) is cached four hours, at the edge and in browsers
  (`cache-control: max-age=14400`); the `.glb` is not.** After a replace-in-place deploy, live pages drew the new geometry
  with the old skin (a fresh browser got the old 32,190-byte file while curl got the new one). Fixed for this case:
  `build_data.py` marks a replaced sku with `rev` (its mesh hash) and `look.js` `ladderUrls` puts `?r=<rev>` on the skin's
  URL. Any later replace-in-place needs `"rev": True` on its source block in `build_data.py`, or a new sku name. Flats
  (`assets/flat/*.webp`) presumably have the same four-hour cache: not checked.
- **A placed thing follows a replaced mesh** (it asks for files by sku), but keeps the box it was placed with.
- **The game loads the 10,000-face tier by default**, not 5,000 (`tw.assets.faces()` on live).
- **A tower is hard to name from the table camera.** Felt mesh at 5,000 faces, four sides: named a cat tree 0 of 4 (leaning
  in: yes). A third plate designed for the view from above (staggered platforms, paw prints, wedge cubby; the plate itself,
  shrunk to 110 px, was named a cat tree) meshed worse: 2 of 4 at 10,000 faces, 0 of 4 at 5,000, and its side platforms came
  out as "a see-through net". Not deployed; kept in `try3/`. The paw prints and the thin arms did not survive the mesh.

## 2026-10-11 — orbital-menu/icon design preserved (Fauna, OpenAI)

Harry requested durable notes before pausing the menu geometry discussion. Full record: `docs/design/orbital-menu-2026-10-11/README.md`; eleven generated studies plus two base screenshots copied into its `mockups/` folder. Wiki play-mode child and project UI/Phoenix pointers distinguish design from current code. Circular heroic hand-painted icons strongly liked; Damage A/B remain open. Re-roll = two dice; Resize = nested ghost crate and one up/right arrow; sideways tilt labelled Yaw, expanded only.

Menu pruning: room Replay spawn, Add stair, Floor, Room type and expanded Rename out; roofs uncertain; proposed room primary Hide/reveal not explicitly accepted. Pawn Duplicate/Delete leave orbital, Name/Give control go to sheet, Lock drops; target expanded menu has Conditions, Indicators, Raise/lower, Hide/reveal, Send to area. The arch leaves 3–6 o'clock empty, preserves primaries on its lower-left tail, and puts Conditions in a concentric outer arc. The final mockup is explicitly NOT accepted: Harry wants time to think. No runtime or deployment changes. Validation passed: all 26 local links in the full record/wiki child resolve; eleven generated PNGs and two source screenshots are byte-identical to originals (18.6 MiB total); `git diff --check` clean. No game test needed for documentation-only changes.

## 2026-10-13 — Task B faction picker (Fauna, OpenAI)

Implemented in isolated codex-b worktree: one logged faction command, downward inheritance and explicit overrides, in-place asset swaps, data-driven grid/library/search. Read and retained the paused ring geometry design. Generated worktree inputs (icons/roof meshes/assets) are not tracked; supplied local copies for tests, with deploy planned from the canonical checkout only after tested fast-forward. The initial browser bar failure was a harness Escape clearing selection, not a command failure; corrected and verified 53 checks. Golden comparison falsified the Temple-only assumption: 41 Cult classic scenes had the same blind mix bug. Exact 148 classic scene differences recorded, with all current v2 scenes unchanged. Details, blind reads and remaining judgments: experiments/2026-10-13-faction-picker/README.md.

Visual follow-up before landing: screenshots falsified the DOM-only shelf pass. Preview models loaded and draw counts incremented but were hidden because a body-level shelf sat above the fixed #app stacking context. Moving the shelf beside its preview canvas fixed it; theme tokens fixed light-mode contrast. The drag offer moved below the area breadcrumb. Flat marks now use face-on images so a banner never becomes an edge-on line in its shelf card. Tests assert preview layering, image readiness and breadcrumb clearance.

Task B live verification: client 20261013062020, tuner 20261013062010, relay restarted with campaign backups. Locked landing: all gates passed; core697, relay181, harness5, factions96, catalog5, picker15, browser57; golden1944 with exact148 classic fixes and zero unaccepted differences. Live browser57/57; test campaign removed; live ratings/house look unchanged; cached incremental asset audit zero missing on both hosts. Final evidence in experiments/2026-10-13-faction-picker/README.md.

## 2026-10-13–14 — Task F test-debt investigation (local verification complete)

Harry requested a complete baseline, repeat diagnosis, repaired flakes and one
matrix command. Isolated worktree `codex-f`, initial fetched main `ab07c51`.
Baseline evidence: `~/task-f-evidence/`; frozen source there permits
remaining baseline runs while repairs proceed. The matrix classifies executable
suites, measurement probes, import helpers and legacy data migrations explicitly;
it refuses unclassified new files. All suite children use the shared limiter.
Queue wait is separate from execution time in the new runner (early baseline
wall durations include it). Settings thumbnail cache and Crypt building topology
have concrete reproductions; details and completion evidence go in
`docs/TEST_DEBT.md`. PHOENIX.md deliberately untouched per task instruction.

A shell call accidentally created the two new runner files in the main checkout;
only those two task-owned files were immediately moved to the isolated worktree.
No tracked main file changed. Subsequent mutations specify the worktree explicitly.

The complete 144-suite pre-fog matrix took 55m28s; 143 passed, while a newly
deployed wall-fit queue made the old four-tile landing assertion fail. The
fetched fog/wall-fit merge added eight suites. Its 33-suite targeted run found
two further test assumptions: player thumbnails are intentionally omitted
under active fog, and the command audit was undoing other seats' quiet fog
sequence updates (or Undo offers) rather than only its own submissions.
Corrected complete settings 68/68 ×10 and figures 192/192; all 152 suite paths
are covered by the composite evidence. The golden layout remains exact.
`docs/TEST_DEBT.md` records classifications, 2,233 exact topology expected-fail
plans, repeat results and evidence paths. Landing/live verification is next.

The locked landing passed 11 selected gates (including full figures, settings,
core/relay, solver and exact golden) and fast-forwarded main to `135e16c`.
Tuner `20261014021353` and client `20261014021405` deployed and pushed.
Post-lock live settings 68/68 and tuner acceptance 49/49 passed. The live
figures audit then exposed the fixed-delay upright fixture, and the live turn
suite found an initiative roll missing after the typed bonus. Instrumented
local reproduction separated prompt event ordering from the actual resolver
failure: the fog display filter dropped the owned pawn from `keyPawns`.
The focused upright audit passes locally 34/34; the repaired turn suite passes
55/55 locally. Follow-up landing will gate both complete suites and verify the
public site again. Evidence remains under `~/task-f-evidence/`.

The final fetched wall-fit merge passed 11/11 targeted suites. One complete
merged 152-suite matrix took 3,968.08 seconds, preserving three red rows from
fog-era test assumptions: chatline, pawn-base, and sequential P7a screen
sampling. Their corrected proofs are chatline 34/34 ×10, pawn-base 44/44 ×3,
and parity 12/12 ×10. The unchanged exact golden has 1,944 scenes and zero
differences; 2,233 exact topology plans remain dated XFAIL. The 152-row
before/after inventory is `~/task-f-evidence/report-final/inventory.md`.
The locked follow-up integration and post-lock live checks remain next.

The follow-up locked gate passed and fast-forwarded main to `75e2182`.
Client-only deploy `20261014043805` was pushed; tuner remains
`20261014022820`. Post-lock live turns, chatline, pawn-base, and settings
passed 55/55, 34/34, 44/44, and 68/68; full cached asset audit found zero
missing among 47,536 paths per host. The live command audit found a generated
roof already using shingle and a late `edit.cut` acknowledgement that could
prevent Undo. The test now starts every registry roof style from an alternate
style and waits for submitted commands to settle before undoing. Isolated live
focused audit passed 34/34; final follow-up touches only tests and docs.

## 2026-10-15 — Ring tuner, Task I
The first preview used the archived selected-pawn screenshot as its backdrop; its old UI controls competed with the new ring. I switched to a real no-ring play-distance game still from `engine/test/shots/smalls-fog-off.png`. The first expanded layout also bunched the retained primaries, so the built-ins now allocate a wider lower-left arc and flag collisions. The build-time extractor imports the actual registry/menu planner with representative selections: this is more faithful than copying a handwritten command list but remains a snapshot, so conditional actions follow the fixture. The manifest adapter was exercised against Task J's in-progress schema (two sets, 109 actions, charcoal's two Damage variants) and the line baseline. Browser acceptance wrote only to a test sandbox and passed 1493 checks locally.
