#!/usr/bin/env python3
"""Mesh gate: BLIND Gemini read of the QA sheet tiles (qa_mesh.py), then a text-only match against the spec plus the
measurements. Judged at TABLE DISTANCE (tile A): props are background pieces; close-up defects are notes, not verdicts.
    python3 qa_gate.py QADIR [sku ...]   -> QADIR/<sku>.verdict.json
"""
import json, sys, concurrent.futures as cf
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "src"))
import plate_gate_batch as pgb
SPEC = {a["id"]: a for a in json.loads((HERE / "assets.json").read_text())["assets"]}
BLIND = """These four renders show ONE 3D model from four cameras. You are not told what it is meant to be.
Tile A: seen from high above at a distance, on green ground with a 5-ft grid; the plain grey cylinder-and-ball figure is 5 ft 9 in tall and is only a scale marker.
Tile B: close, from low at the side. Tile C: from straight above. Tile D: close, from high on the other side.
Ignore the grey scale figure, the green ground and the grid lines; describe only the model.
1. From tile A ALONE: what is it (best name and a second guess)? How confident? Does it read clearly at that distance?
2. From B, C, D: its parts; whether surfaces are solid and continuous or broken into shards, spikes, blobs, holes or thin floating flakes; anything hovering unattached; anything melted or fused; whether it stands on its own or on an added slab, disc or patch of ground; whether the underside sits flat on the ground; colours and materials.
3. From tile C alone: what does it look like from straight above?
4. About how tall and wide is it compared with the 5 ft 9 in figure?
Return JSON: {"table_distance_name": "...", "second_guess": "...", "confidence": 0-1, "reads_clearly_at_distance": true|false, "description": "...", "from_above": "...", "defects": ["..."], "extra_base_or_ground": "none | <what>", "height_vs_figure": "..."}"""
def gate(qa, sku):
    spec = SPEC.get(sku) or SPEC.get(sku.replace("--chunky", ""))
    parts = []
    for t in "ABCD": parts += pgb.img_part(qa / f"{sku}.{t}.png", f"tile {t}")
    seen, _ = pgb.vision(parts, BLIND)
    m = json.loads((qa / f"{sku}.json").read_text())
    w, d, h = spec["size"]
    match = f"""You are the mesh gate of a 3D asset factory for a tabletop game. Props are BACKGROUND pieces seen from a high three-quarter camera at table distance: judge them at that distance. Close-up roughness, soft detail and small artefacts are NOTES, not reasons to fail.
An observer who was NOT told what to expect described the 3D model as follows:
{json.dumps(seen, ensure_ascii=False)}

Measurements of the mesh (trust these over the observer where they disagree): {json.dumps({k: m[k] for k in ("size_ft_at_auto_scale", "ratio_mesh_long:short:height", "ratio_catalog", "loose_parts_over_1pct", "floating_parts_over_1pct", "base_slab_suspect", "bands_span_xy")})}
(bands_span_xy: for each height band from the bottom, the fraction of the full footprint that band spans in x and y.)

It was requested as: {spec['gate']['desc']}. Intended real size about {w/12:.1f} ft x {d/12:.1f} ft footprint, {h/12:.1f} ft tall.
Requirements: {'; '.join(spec['gate']['must'])}
Must not: {'; '.join(spec['gate']['must_not']) or '-'}

FAIL (ok=false) only if, at table distance: it does not read as the requested thing; OR it is visibly broken (foliage or surfaces shattered into shards or spikes, big holes, large parts floating free, a melted lump); OR it carries an extra base slab / ground disc that would show on grass; OR its proportions are badly off (for example a tree that came out as a ball with no trunk, or a long section that came out square); OR a must / must-not above is plainly violated.
Return JSON: {{"ok": true|false, "reads_as": "<what the observer called it>", "problems": ["<short>"], "notes": ["<close-up defects that do not fail it>"]}}"""
    verdict, _ = pgb.vision([], match)
    verdict["blind"] = seen
    (qa / f"{sku}.verdict.json").write_text(json.dumps(verdict, indent=1, ensure_ascii=False))
    return sku, verdict
if __name__ == "__main__":
    qa = Path(sys.argv[1]); skus = sys.argv[2:] or sorted(p.stem for p in qa.glob("*.json") if not p.stem.endswith(".verdict"))
    skus = [s for s in skus if not (qa / f"{s}.verdict.json").exists() or "--redo" in sys.argv]
    skus = [s for s in skus if s != "--redo"]
    with cf.ThreadPoolExecutor(6) as ex:
        for sku, v in ex.map(lambda s: gate(qa, s), skus):
            print(("PASS " if v.get("ok") else "FAIL ") + sku, "|", v["blind"].get("table_distance_name"), "|", "; ".join(v.get("problems", [])), flush=True)
