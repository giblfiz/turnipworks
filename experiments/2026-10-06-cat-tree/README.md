# Cat tree (2026-10-06): one prop, for a playtester

A playtester asked for a cat tree while playing on the live game; Harry: "can you pull that out of fal real quick?"

    python3 build_spec.py                                          # assets.json (prompt + gate text)
    ~/.local/share/tw-birefnet-venv/bin/python gen.py . --ids cat-tree   # plate: free Codex image route -> blind describe -> match -> BiRefNet matte -> mask gate
    python3 mesh_fal.py trellis2 cat-tree                          # fal-ai/trellis-2, $0.30 -> fal-trellis2/models/ ; copied to models/cat-tree.glb
    blender --background --python ../2026-10-05-yard-props/qa_mesh.py -- qa sizes.json models/cat-tree.glb
    # library: catalog/fantasy-core.catalog.md (cat-tree), tools/spawn-tuner/build_data.py (source cat-tree-01),
    # prep/jobs-cattree01.json -> blender_runtime.py, blender_lod.py, lod_tex.py, prep/orient_cattree01.py, deploy.sh
    TW_GPU=1 browser-venv/bin/python live_check.py                 # live: the bar finds it by four phrasings, Enter + click places it

- Plate: accepted on the first try. Mesh: fal `trellis-2`, one call, **$0.30** (`spend.log`). No RunPod.
- Measured (`qa/cat-tree.json`): 2.5 x 3.0 x 5.0 ft at the library's size; nothing over 1% of the mesh loose or floating;
  the base board spans the footprint at the bottom (stands flat); 46,059 faces, 2048 colour map. **27,217 loose shells**: the
  plush carpet came out as flakes.
- Front: Gemini blind, tile B ("cat condo entrance", 0.95) -> yaw -90 in `data/orient.json`.
- Live since tuner v=20261006205817: `/` then `cat tree` (also `cat tower`, `scratching post`, `cat furniture`), Enter, click a square.
- **Known defect.** Blind reads of the live game (`gemini/`): leaning in, "a dice tower or cat tree ... platforms and a ring at
  the top appear fragmented and semi-transparent"; at table distance it was read as "an ornate, throne-like chair" with a spindly
  frame. The full-detail mesh is named a cat tree, with the carpet "fragmented ... loose, flaky-looking". The flakes do not
  survive the 5,000-face game tier. A second plate with smooth felt carpet (`cat-tree-felt`) is specified for a re-mesh.
- Not done: other detail tiers judged, room recipes (it is in no room's recipe, so rooms never generate one), the Alignment Bench,
  engine/client/data/types.json (tools/build_types.py) for the Build menu's type lists.

## Second mesh (same evening): smooth felt carpet. In the working tree, NOT deployed

Plate `cat-tree-felt` (accepted first try), fal `trellis-2` again ($0.30; **$0.60 in all**). It replaces `models/cat-tree.glb`
under the same sku; the first mesh is in `try1/`.

- Measured: 3.7 x 2.7 x 5.0 ft, 45,113 faces, **6,393 loose shells** (first mesh 27,217; the yard batch: median 2,230, 90th
  percentile 6,488), nothing over 1% loose or floating. Front: tile B again, yaw -90.
- **Trap found:** `prep/blender_lod.py` saves `prep/tex-src/<sku>.png` once and never overwrites it. Replacing a mesh under
  the same sku leaves the OLD colour map on the NEW UVs (Gemini: "camouflage"). Delete the PNG before re-running the ladder.
- Blind reads in a local game at the 5,000-face tier (`live_shots.py --local`, `FACES=5000`; `gemini/felt-read-*`):
  leaning in, "a multi-level cat tree or scratching post ... base, red cube, and green platforms appear solid and whole".
  At table distance from four sides it is solid every time but **never named a cat tree**: "a stylized pawn or figure",
  "a small, ornate table", "a two-tiered stand or a tall, ornate stool", "a table ... shaped like a three-leaf clover".
  (`felt-read-41..43` are the stale-texture shots.)
- The deploy gate was "reads as a cat tree at table distance, platforms solid": solid yes, named no. Not deployed.
  The game's own dial loaded the 10,000-face tier by default in this test, not 5,000.

## Later the same evening

- **The felt mesh went live** (second deploy, tuner v=20261006212253), and wore the first mesh's colour map: the `.webp`
  ladder is cached four hours. Fixed with a third deploy (v=20261006212545): `rev` on the sku, `?r=` on the skin's URL
  (LAB_NOTES.md, 2026-10-06, trap 2). `live_replace.py before` / `after` round a deploy shows what an already-placed tree
  loads: the new geometry (615,844 bytes at the 10,000 tier), same entity, same box as when it was placed.
  Blind read on live after the fix (`gemini/live-felt-lean-fixed.txt`): "a cat tree, also known as a cat tower or cat
  condo ... surfaces appear solid and whole".
- **Third plate `cat-tree-stagger`** (fal, $0.30; **$0.90 in all**): designed for the table camera. Plate blind read at 110 px:
  "This is a cat tree". Mesh: 4.3 x 4.1 x 5.0 ft, 3,628 loose shells. In a local game (`shots/stagger/`, `gemini/stagger-*`):
  10,000 faces, table distance, four sides: "a cat tree or scratching post" twice, "table with coasters", "a multi-tiered
  stand"; 5,000 faces: 0 of 4 ("a small wooden table or stand", "signpost or stand", "multi-level stand or signpost",
  "a wooden stand ... for displaying game pieces"). Leaning in it is a cat tree at both tiers, with the three side platforms
  "like a see-through net or mesh". The gate was most table reads: 2 of 8. **Not deployed**; the mesh is `try3/cat-tree.glb`,
  the felt mesh is back in `models/` and the tree's cat-tree files are byte-identical to live.
