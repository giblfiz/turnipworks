# SUCH worker lab notes (culture-roofs, 2026-11-07)

07:43 start. Read rules, PLAN.md, wiki culture-packs-a/b.

## 1. Sliding doors
08:02 The leaves are SKUs of door-plank (jpn-koshido-leaf) and door-panelled (jpn-fusuma-leaf); no shoji leaf
  exists (the chn lattice leaf is Chinese and swings: left alone). Data: sku field `slides: true` (library.json, by hand
  now; build_data.py emits it from the run manifest's flags column `slides`, set in catalog/runs/jpn-01/manifest.tsv).
  Engine: openlook.js motionRig returns SLIDE_ALONG for any leaf whose SKU says slides (before the per-kind RIGS);
  rigOpenRoot 'slide-along' = rigParts with a two-stage move (out to just off the wall face over the first 20% of t,
  the same rest a swung leaf takes, then 98% of its width along -X, toward its hinge side). No look.js edit needed:
  the tuner shows doors shut; the game rigs them in assets.js -> openlook.js.
  First run of engine/test/browser_sliding_doors.py: 13/14 (moved -4.25 ft along, 0.79 off, 0 turn; sync, shut,
  fusuma on a turned wall, a hinged door still turns 175, replay) — mid-slide check missed because it waited on idle()
  after Mira's open; restructured so the GM opens and watches. settle() timed out at 120 s per call (something in a
  culture room never 'settles' in this worktree): cut to 30 s.
## 3. Stepwell
08:02 Mesh measured (trimesh, 12x12 height map): paved rim at 0.56-0.65 of its height, gallery side 0.95-1.0,
  pool 0.03. PIT_CATS['ind-stepwell'] = { to: 'below', open: 0.97, bottom: -4, sunk: 0.6 }: the ground over its 3x3
  squares is cut as the mine shaft's floor is; client/holes.js sinkPit lowers the visual by 0.6 of its drawn height
  (not clipped). Pawns over it are offered the fall to its bottom (main.js pitAt; height.js untouched).
## 2. Ballcourt
08:02 osides extended (ends/rest/across -> the I; E.P.alley), new op ofield (a painted field that must fit the
  alley). Program: benches + ring in the middle sections, mes-court-endwall (NEW, for ASSETS) round the end zones,
  decal-mes-court-alley (NEW flat, mine), mes-court-ball (NEW, for ASSETS). Codex sensitivity read running.

08:28 Codex sensitivity read (reads/sensitivity-codex.md) changed the designs: end walls plain (no red band:
  plausible but unsubstantiated), the centre line black/dark green (Duran, 95%), NO red border and NO centre dot, quadrants
  only in codex imagery (Mendoza 36r) so not painted; ball brown-black, ~8 in attested (I catalogued 10 in as a table-
  distance exaggeration); hip guard leather (Sahagun Book 8), never a Veracruz stone yoke. Plates (tools/gen.py, Codex
  image_gen, free): mes-court-endwall, mes-court-ball, mes-court-hip-guard -> plates-for-assets/ (README for ASSETS);
  decal-mes-court-line -> flats/ (chroma blue, keyed 0.795, 512x42 webp via tools/flat_one.py).
08:28 Ballcourt solve debug (tools/dbg_court.mjs): the plot's interior is inset (X0 55 for a room at 50), so a
  14-wide room gave an EVEN run of 6 sections and the ring sat 5 ft off the centre line; and hutAt's grid fit test dropped
  one bench in three (shared edges count as overlap; the pre-existing 10x4 court had 7 of 10). Fix: an odd run (k--),
  sections laid by measurement (hutLay, as crop patches are), room 16x6. Now 5 benches a side, ring at mid-court, line on it.
  Regen: build_data.py in a scratch COPY of this worktree, run twice (HEAD inputs vs mine) and diffed: the only deltas are
  slides x2, the decal object, the ballcourt record. (A full regen here loses ~250 lines of sprawl data whose sources are
  not in the worktree: never run build_data in place.) Spliced those deltas into library.json / rooms.json by text insert.
  Tests on old code (scratch copy of a7b5c59e): browser_sliding_doors 9/14, browser_stepwell_sunk 4/9, ballcourt_i fails
  (6 kinds); on this tree 14/14, 9/9, 57/57; cultures_b 82414/0, cultures (A) 156124/0.

## Reads (Gemini via agy-run, blind, random names, isolated folder)
10:07 read1 (17 pictures) was CONTAMINATED: shots.py's CSS did not hide the game UI (the "Ballcourt" room
  pill was in frame) and spawnRoom takes SQUARES, so the stepwell/house/wall shots looked at empty table. Kept as
  reads/read1.json, not used as evidence except for the plates (endwall "stone block", ball "ball", hip guard "ballplayer
  yoke and sash", decal "floor decal"; all Mesoamerican) and the koshido pair (shut / "open, slide").
  shots.py fixed (browser_cultureroofs.py's CSS: everything hidden but the canvas; squares not feet).
10:07 read2 (16 pictures, clean): BALLCOURT before = "ballcourt" WITH "missing end walls, gap in the lower wall"
  (the dropped benches); after = "ballcourt ... sloped side walls, low stone end barriers, a green dividing line, and a
  central black ball", nothing wrong. (Before ALSO named a ballcourt once the UI was hidden: the 11-06 "council chamber"
  read was from the tuner at another angle; the after read names every new feature.) KOSHIDO open = "open, slid
  sideways"; shut = "shut". PAYPHONE: mes-stucco walls alone and in a Mexica house, both skus: modern = none ("one plain
  plaster, the other a framed fresco painting"); the 11-06 "wall with payphone" verdict was a plate/mesh-gate render, not
  the piece at table distance. No change made. (Side finding for the pack, not this lane's item: the Mexica house reads
  "Minoan / ancient Mediterranean throne room" in this shot.) STEPWELL after (first sink): "stepwell", but "large gaps
  around it revealing the black void".
10:07 Stepwell gaps: trimesh ray map showed the mesh's plan ragged (no geometry in corners, along one side); in
  the browser 19 of 29 misses were inward-facing triangles. Fix: stretch the measured solid core (tools/core_rect.py,
  most-square fully-solid rectangle after closing pinholes, stored in GLB units: three's geometry bounding box holds
  unused vertices, fractions of it were wrong) over the cut, draw double-sided. Test FILL: 225 rays down the cut, 0 misses
  at the default faces tier (10 at faces=1500: the decimated Low tier has pinholes). 9/9; on main 4/9.
11:05 read3 (core-stretched, double-sided): "a sunken stepped well filled with green water" (both shots), no void;
  new defect "stretched/distorted mesh fragment clipping near the edge". Fix: fragments outside the cut discarded in the
  shader (test 10/10). read5: still "a stretched and distorted wall fragment along one edge" — it is the mesh's own ragged
  side, stretched 1.4x to cover the cut. Code cannot fix that: plate ind-stepwell-v2 (square, whole rim, nothing above it)
  for a later pod (open item). End-wall marks (ASSETS' read): plate mes-court-endwall-v2, read blind: marks none.
