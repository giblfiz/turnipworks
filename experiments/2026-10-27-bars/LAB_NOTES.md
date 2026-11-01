# 2026-10-27 bars: `cell-bars-post` (one kit piece, mesh only)

Goal: one accepted TRELLIS.2 GLB for `cell-bars-post`, the 8 x 8 x 108 in wrought-iron corner/end post that goes with
`cell-bars` (castle-01 panel: dark forged iron, a little rust-brown, worn bright edges). Integration (build_data,
library, catalog, deploy) is the parent's, not this folder's.

## Route (copied from experiments/2026-10-24-faction-pillars, Route section)
- assets.json: the one spec (size, house prompt, gate desc/must/must_not). BRIEF-bars.md by tools/write_brief.py.
- Plate: Codex worker `codex exec` (built-in image_gen, ChatGPT plan, no API key), prompt on stdin -> plates/, LOG.md.
- Plate gate tools/gate_plates.py (pillars copy; agy -t 900, "Do NOT create, crop or write" preamble, 256-px read
  because a 1:13 post is a few pixels wide at 128, match asked in an empty folder). Accepted -> masked/.
- Mesh: src/fal_trellis.py (1024, $0.30) on a folder holding only inputs/<id>.png. Spend in spend.log.
- Mesh gate tools/qa.sh (pillars copy; the scratchpad tw-slot limiter it called no longer exists -> plain blender;
  BATCH_MATCH off: one sku, and the batched path in qa_gate.py has a NameError on spec_of anyway).

## Log
2026-10-27T04:14:33-07:00 START codex image worker plate v1
2026-10-27T04:17:07-07:00 plate v1 from codex (3 tries, kept 3). plate gate start
2026-10-27T04:20:40-07:00 fal mesh v1 done (59 s). mesh gate start
2026-10-27T04:21:21-07:00 v1 mesh rules: base-slab (foot 12.8 in, bbox 1:8.4; shaft ~6 in). START codex worker plate v2 (foot/cap barely wider than shaft); v1 kept in plates/v1/
2026-10-27T04:24:16-07:00 v1 mesh gate: rules reroll-plate (base slab = the requested foot plate); Gemini blind 'metal post' 0.9 reads clearly, match ok. Archived qa/v1, models/v1. Plate v2 in (codex kept try 1); plate gate
2026-10-27T04:26:16-07:00 v2 mesh: rules base-slab again (foot 1.64x shaft), bbox 1:9.7. START codex worker plate v3 (one-inch lip, no flare). Gemini read of v2 in parallel
2026-10-27T04:27:35-07:00 v2 mesh gate: Gemini blind 'pillar' / 'support column' 0.9, match ok; rules base-slab. Archived qa/v2, models/v2

2026-10-27 — BRIEF-bars.md: generated three candidates using built-in image_gen and the prompt verbatim; retained attempt 1 for thin foot plate and margin. PIL verified 1024x1536 RGBA and zero-alpha corners. Raw preview halo was hidden RGB; background carries only trace alpha noise. Saved plates/cell-bars-post.png, appended LOG.md, wrote plates/DONE-bars.
2026-10-27T04:29:26-07:00 plate v3 in (codex kept try 1); plate gate
- v3 mesh: bbox 13.6 x 13.6 x 108 in (1:7.9), shaft ~8.7 in; rules base-slab -> ladder reject (3rd failing sha). Fails the
  proportion ask on measurement, so no Gemini read spent on it. Archived qa/v3, models/v3. Plate budget (3) used.
- ACCEPTED: mesh v2 by reviewed override (qa/overrides.json): the base-slab rule is the requested foot plate (Gemini on v1
  and v2: no extra base; match ok). models/cell-bars-post.glb = models/v2 = fal2/models, sha256 3c5cfe73...
  Own frame: glTF +Y up, centred on the origin (y -0.501..+0.501, NOT grounded at 0), foot at -Y;
  extent 0.1036 x 1.0019 x 0.1034 units (x, y-up, z) -> 11.2 x 11.2 x 108 in at 9 ft. Shaft ~6.8 in, bands ~8.6 in.
  Stretched to an 8 x 8 x 108 box (x0.71 in plan) the shaft lands near 4.9 in.
- Spend: fal $0.90 (three meshes at $0.30), no other paid calls. Codex plates on the ChatGPT plan; Gemini on agy-run.
- masked/cell-bars-post.png reset to the accepted v2 plate (= plates/v2 = fal2/inputs); plate-qa/ holds the v3 gate record, v1/v2 plate gates were identical accepts ('iron post' / 'stanchion').

## Integration (parent, 2026-10-27)
- In the game at play distance (engine/test/browser_bars.py `bars-corner.png`) Gemini read the accepted v2 post as "a light stone/masonry pillar" beside the dark bars. `tools/grade_post.py` maps its colour map's luminance onto `cell-bars`' (mean 0.381 -> 0.216, chroma x0.56), written into `models/cell-bars-post.glb` (original: `models-ungraded/`). After: "dark forged/cast iron ... the same heavy ironwork". No new spend.
- Shipped as sku `cell-bars-post` (src `bars-01`, catalog/fantasy-core.catalog.md), kit, snaps like a post. Total spend for the batch: $0.90 (fal).
