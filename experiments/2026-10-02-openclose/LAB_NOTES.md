# Open/close pilot — LAB_NOTES (2026-10-02)

Live: https://implausible.enterprises/projects/turnip-works/openclose/ (deploy: `./deploy.sh`, world-readable).
Harry approved the pilot on 2026-10-02, and the multi-view follow-up the same day.

## Rule (Harry, 2026-10-02)
**Generated surfaces beat procedural patches.** After looking at the raw generated body GLB, Harry found it
"considerably better than the programmatic patches". Fix bad geometry with better reference images (multi-view),
not with geometry patches. On generated meshes only these ops are allowed: decimation, a clean planar trim when
needed, placement transforms, and the hinge rig. No rim rings, caps, or dark interior boxes.
(The patched variant is kept behind the raw/patched toggle on station 1 for comparison only.)

## Spend (fal.ai) — full log in `spend.log`
| run | what | $ |
|---|---|---|
| 1 | trellis-2 @1024: body, lid, open, closed (single image each) | 1.20 |
| 2 | trellis/multi (TRELLIS v1 multi-image): body, lid | 0.04 |
| 2 | hunyuan-3d **v3.1 pro** image-to-3d, multi-view: body, lid ($0.375 + $0.15 multi-view each) | 1.05 |
| | **total** | **2.29** |
Run 1 was capped at $1.50 and run 2 at $1.50. No balance errors. The v3.1 Pro endpoint exists
(`fal-ai/hunyuan-3d/v3.1/pro/image-to-3d`, with top/bottom/left-front/right-front slots), so it was used instead of v3.
Its price is the same as v3: $0.375 base + $0.15 for multi-view, and a custom face_count adds $0.15. TRELLIS multi costs $0.02.
Gemini plates and edits are not counted here.

## Stations on the page
1. **Separate parts, raw (lead).** Body and lid are trellis-2 single-image results from Gemini edits of the inn-01b
   chest-ironbound plate. Body: one planar trim at the front-rim height. Without the trim, 406/674 wedge-wall
   vertices poked out through the closed lid. The body material is double-sided. Toggle to "patched" to see the
   old rim ring and dark recess.
1-multi trellis / 1-multi hunyuan: raw multi-view parts, with decimation, orientation and lid placement only.
2. **Cut and cap.** The existing inn-01 chest-ironbound is cut at 60% height (middle of the seam band). Both cuts
   are capped (rectangle outline, inset, dark recess), and stray TRELLIS inner shells inside the cavity are deleted.
   Ray audit: inside 32/32, outside 0/140. This is procedural patching, now against the rule.
3. **Two-state swap.** trellis-2 open and closed meshes from the same plate, with a short crossfade and a scale pop.
4. **Door.** The existing door-plank--leaf is hinged inside the existing wall-doorway--dressed-stone. No generation.
   The leaf is narrowed to fit, because the doorway's opening is only 23% of its width.

Data: `runtime/openclose.json` gives per asset `{glb, mode, parts{static, moving, pivotNode}, pivot, axis,
openAngle, duration, ease}`. Pivots are glTF empty nodes (`lid_hinge`, `leaf_hinge`) at the hinge, so the tuner
can rotate a node and needs no extra math. Coordinates: glTF Y-up, front +Z, GLB-local units. `size_in` is the
catalog size. `fit:"height"` is set for the door.

## Measurements (`mv/measurements.json`, `build-report.json`)
| part | rim level spread | cavity depth / rim | lid underside | see-through rays | depth/width |
|---|---|---|---|---|---|
| single body (trellis-2) | 0.268 (wedge) | 0.36 | – | 0/80 | 0.76 |
| single lid | – | – | solid block (first hit 18% up) | – | – |
| trellis/multi body | 0.010 | 0.81 | – | 0/80 | 1.01 (too square) |
| trellis/multi lid | – | – | hollow (76%) | – | – |
| hunyuan v3.1 body | 0.000 | 0.88 | – | 0/80 | 0.97 (too square) |
| hunyuan v3.1 lid | – | – | hollow (88%) | – | – |
Every hinge passes the lid-in-body check at open (0 lid vertices inside the body box).

## Findings
- Multi-view fixes both faults of the single-image parts: the wedge rim (0.27 → 0.00–0.01) and the solid lid
  (both multi-view lids are hollow).
- Hunyuan v3.1 gives the best geometry: a hollow lid with planks and strap backs, and the deepest cavity, with a
  readable interior. Its texture turns noisy at runtime tier, and **the noise comes from decimation**: renders at 40k
  faces are clean, 4k shows smears, and decimating with UV delimit only helps a little. Fix: use the native
  `face_count` option (+$0.15), or re-bake the 500k texture onto the decimated mesh.
- The TRELLIS v1 multi-image textures are clean but dark. Its interior is close to black, and the lid underside is
  smooth (no planks). Gemini ranked TRELLIS first for cohesion. I rank Hunyuan first for geometry.
- Both multi-view bodies are nearly square (depth/width about 1.0 against the catalog's 0.56). The Gemini view set
  drew a square box, so the next view set needs the proportions locked (for example a measured top view).
- Gemini will not draw a lid on its own when editing the full-chest image. Chaining the edits off the lid-only
  plate (`inputs/chest-ib--lid.jpg`) worked.
- Vision is triage. Gemini claimed a "hinge gap" and "lid wider than body" on approach 1. Measurement showed the lid
  narrower by about 0.45 in per side, and no gap at the pivot.

## Traps
- TRELLIS "solid" props contain stray inner shells. Bisect boundaries are not fillable loops, which is why the
  patch code was geometric. That code is now retired by the rule.
- `bmesh.ops.inset_region` does nothing on an isolated face unless `use_boundary=True`.
- `BVHTree.FromObject` with the evaluated depsgraph went stale after bmesh edits. Build the BVH from mesh data instead.
- Collapse-decimating after a planar cut lifts vertices off the plane. Decimate first, then cut.
- Headless software GL: a 1000×800 page lost its context. 1400×900 is reliable.

## Files
`build.py` (Blender: every asset plus the sidecar), `bl_common.py`, `mv/` (view prompts, views, fal_multi.py,
measure.py, models), `test/check.py` (Playwright: load, pose, measure, toggles, screenshots), `shots/`, `spend.log`.
