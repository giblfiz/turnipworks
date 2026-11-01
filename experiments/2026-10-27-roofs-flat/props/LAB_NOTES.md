# 2026-10-27 roofs-flat props: roof-bartizan, roof-cistern, roof-flagpole (three generated floor THINGS)

Goal: three accepted TRELLIS.2 meshes for a flat castle roof, in the tuner library as ordinary placeable things
(place floor, fp 1, gen mesh; catalog/objects-roof.catalog.md; src roof-props-01), house style of the castle-01 kit.

## Route (copied from experiments/2026-10-27-bars, which copied the faction-pillars route)
- assets.json: the one spec (size, prompt, a per-shot Check line, gate desc/must/must_not). BRIEF-roofprops.md by tools/write_brief.py
  (bars copy; check (3) now reads each shot's own Check line instead of a hard-coded kind).
- Plate: Codex worker `env -u OPENAI_API_KEY codex exec` (built-in image_gen, ChatGPT plan, no API key), prompt on stdin -> plates/, LOG.md.
- Plate gate tools/gate_plates.py (bars copy; MATCH synonyms made generic: turret/bartizan, tank/vat, flagpole/banner pole).
  agy-run serially under flock /tmp/agy.lock, "Do NOT create, crop or write any files." in every prompt. Accepted -> masked/.
- Mesh: src/fal_trellis.py (1024, $0.30) on a folder falN/ holding only inputs/<id>.png. Every charge in spend.log.
- Mesh gate tools/qa.sh (bars copy, unchanged): Blender measurements + tiles, unpainted share, Gemini blind read + match.
- Runtime: prep/blender_runtime.py + prep/blender_lod.py on props/jobs-roofprops01.json, prep/lod_tex.py; entries added
  by hand (not a full build_data run) to library.json, prep/jobs.json, prep/tex-ladder.json.

## Log
2026-10-27T22:49:26-07:00 START. assets.json + BRIEF-roofprops.md written. START codex image worker (3 plates, v1)
2026-10-27T22:52:11-07:00 plate roof-bartizan v1 in (codex: 3 tries, kept 2; it flagged a faint halo). plate gate
2026-10-27T22:54:05-07:00 plate v1 roof-bartizan ACCEPTED (Gemini blind 'turret' / alt 'bartizan', match ok, margin 53 px). fal mesh v1

2026-10-27 roofprops: Generated three attempts per shot in brief order with built-in image_gen, verbatim prompts, transparent_background=true; no image-processing edits. Saved best candidates and LOG.md before proceeding to each next shot. All three saved RGBA files checked with Pillow; remaining defects logged. Cistern dimensions differ because built-in interface exposes no size parameter. DONE-roofprops lists saved files, not an all-QA-pass claim.
2026-10-27T22:56:37-07:00 fal mesh roof-bartizan v1 done. plates cistern + flagpole v1 in. plate gate (2) + mesh gate bartizan
2026-10-27T22:58:14-07:00 plates v1 roof-cistern ACCEPTED (Gemini blind 'barrel' / alt 'vat', match ok; codex returned 1214x1295, not 1024 square), roof-flagpole ACCEPTED (blind 'banner' / alt 'flagpole', match ok). fal meshes v1 (both, in sequence)
2026-10-27T23:07:19-07:00 mesh gate roof-bartizan v1: ACCEPT (rules clean, unpainted 0%; Gemini blind 'watchtower' / 'gazebo' 0.9, match ok). fal cistern + flagpole v1 done; mesh gate
2026-10-27T23:14:32-07:00 mesh gate cistern v1 ACCEPT (Gemini 'wooden barrel on a stand' / 'wooden water vat' 0.95, rules clean), flagpole v1 gate ACCEPT ('banner pole' / 'hanging signpost' 0.95) but measured 66 x 34 x 180 in at its own proportions: the crossbar is a one-sided arm, not short; overriding the gate to reroll-plate. START codex worker plate v2 flagpole (T crossbar centred, 2 ft, banner as wide). v1 kept in plates/v1, qa/v1, models/v1

## 2026-10-27T23:17:22 — roofprops-v2 plate
Used built-in image_gen with the brief prompt verbatim on all three attempts, no API keys or image drawing/editing code. Selected attempt 2 for its slimmer silhouette, two-band foot and simpler base. PIL verified 1024x1536 RGBA and four zero-alpha corners; visual QA still fails clean cutout, exact proportions, banner width and generous vertical margin. Saved best per three-attempt cap and recorded limitations in LOG.md; DONE-roofprops-v2 lists the saved id.
2026-10-27T23:17:44-07:00 plate v2 flagpole in (codex kept try 2 of 3; it flagged ~18 px top/bottom margin, ~4.7:1). plate gate
2026-10-27T23:20:25-07:00 plate v2 flagpole ACCEPTED (blind 'banner' / alt 'flagpole', match ok; alpha box 326 x 1502 px, 1:4.6, v1 was 1:3.3). fal mesh v2
2026-10-27T23:21:04-07:00 fal mesh flagpole v2 FAILED: HTTP 403 'User is locked. Reason: Exhausted balance.' (no charge; the fal account is out of credit). Not stalling: flagpole v1 (gate accept, 'banner pole' 0.95, one-sided arm, 66 x 34 x 180 in at its own proportions) ACCEPTED as the shipped mesh; plate v2 waits in masked/ and fal/roof-flagpole-v2/inputs (re-run: tools/mesh.sh roof-flagpole 2 once fal has balance). Runtime build for the three
2026-10-27T23:33:32-07:00 runtime: prep/blender_runtime.py + blender_lod.py on prep/jobs-roofprops01.json (results-roofprops01.jsonl, lod-roofprops01.jsonl, so a later full build_data keeps the bounds), lod_tex.one per sku. Written through the worktree's symlinks into main's asset store: assets/m/<sku>.glb (+ .owner), assets/lod/f{full,20000,10000,5000,3000,1500}/<sku>.glb, assets/tex/t{64..2048}/<sku>.webp; prep/tex-src/<sku>.png in the worktree (git-ignored: in land-files.txt).
- Orientation: prep/orient_views.py + orient_sheets.py -> prep/orient-sweep-roof-props-01; Gemini (agy, blind sheet): bartizan front A ("arched window facing camera", 0.95), cistern none (round), flagpole front A ("broad face of banner facing camera", 0.95). Tile A = glTF +Z, so all three already face +Z: yaw 0 in data/orient.json (decisions.json carries the source sha256).
- Integration, by hand (no full build_data run): catalog/objects-roof.catalog.md (3 lines), build_data.py glob block (src roof-props-01), library.json / prep/jobs.json / prep/tex-ladder.json: only these three entries (checked: no other key changed). data/orient.json: three yaw-0 lines.
- Delivered copies: main's prep/delivery.py --dir <worktree tuner> (main has the meshopt node_modules): 39 new, 25 stale copies pruned (its normal 14-day prune). assets_check.py: worktree 24454 checked 0 missing, delivered 0 missing; main still 0 / 0. node loads library.json.
- ACCEPTED: roof-bartizan v1 (models/roof-bartizan.glb = fal/roof-bartizan-v1), runtime bounds 0.423 x 1.003 x 0.425 -> 55.7 x 56.0 x 132 in.
  roof-cistern v1, bounds 0.890 x 1.005 x 0.890 -> 53.1 x 53.1 x 60 in (all three at the tuner's auto rule: largest dimension = the catalog's largest).
  roof-flagpole v1 (stand-in quality: one-sided arm), bounds 0.367 x 1.007 x 0.189 -> 65.6 x 33.8 x 180 in (catalog 30x30x180).
  masked/roof-flagpole.png is the v2 plate (accepted, not yet meshed); the shipped flagpole's plate is fal/roof-flagpole-v1/inputs and plates/v1.
- Spend: fal $0.90 (three meshes at $0.30); the fourth request (flagpole v2) refused 403 'Exhausted balance', not charged. Codex plates on the ChatGPT plan; Gemini on agy-run. No paid LLM API.
