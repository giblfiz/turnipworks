#!/usr/bin/env python3
"""Open twin against its closed mesh: sizes at auto scale, and whether the open one is HOLLOW (rays straight down over
the footprint: how much of it has its top surface well below the rim). Reads TYPE/assets.json (twin_of) and TYPE/models.
    tw-trimesh-venv/bin/python tools/qa_twin.py TYPE_DIR [sku ...]   -> TYPE_DIR/qa-extra/twins.json (NOT qa/: qa_gate.py takes every qa/*.json for a mesh), one line per twin
low50 / low75 = share of the footprint cells whose top surface is under 50% / 75% of the mesh height. A closed box has
low75 near 0 over its body; an open one with a real cavity has a block of low cells INSIDE (interior_low = share of the
cells not on the outer two rings that are under 75%). The ascii map (9 = full height, 0 = floor, . = no hit) is for the notes."""
import json, sys
from pathlib import Path
import numpy as np, trimesh
T = Path(sys.argv[1]); 
if not T.exists(): T = Path(__file__).resolve().parent.parent / sys.argv[1]
spec = {a["id"]: a for a in json.loads((T / "assets.json").read_text())["assets"]}
want = sys.argv[2:] or [k for k, v in spec.items() if v.get("twin_of")]
def hmap(p, n=28):
    m = trimesh.load(p, force="mesh"); lo, hi = m.bounds; ext = hi - lo; up = 1          # glTF: y up
    a, b = [i for i in range(3) if i != up]
    pts, _ = trimesh.sample.sample_surface(m, 600000, seed=1)        # no ray engine in the venv: bin surface samples, keep the highest
    ia = np.clip(((pts[:, a] - lo[a]) / ext[a] * n).astype(int), 0, n - 1); ib = np.clip(((pts[:, b] - lo[b]) / ext[b] * n).astype(int), 0, n - 1)
    h = np.full(n * n, np.nan); idx = ib * n + ia; order = np.argsort(pts[:, up]); h[idx[order]] = (pts[order, up] - lo[up]) / ext[up]
    return h.reshape(n, n), ext
out = {}
for s in want:
    c = spec[s]["twin_of"]; po, pc = T / "models" / f"{s}.glb", T / "models" / f"{c}.glb"
    if not po.exists() or not pc.exists(): print(s, "missing GLB"); continue
    r = {"twin_of": c}
    for tag, p, sz in (("open", po, spec[s]["size"]), ("closed", pc, spec[c]["size"])):
        h, ext = hmap(p); hit = ~np.isnan(h); inner = np.zeros_like(hit); inner[2:-2, 2:-2] = True
        scale = max(sz) / max(ext)
        r[tag] = {"size_in_at_auto_scale": [round(float(v * scale), 1) for v in (ext[0], ext[2], ext[1])],
                  "low50": round(float((h[hit] < 0.5).mean()), 3), "low75": round(float((h[hit] < 0.75).mean()), 3),
                  "interior_low75": round(float((h[inner & hit] < 0.75).mean()), 3), "interior_low50": round(float((h[inner & hit] < 0.5).mean()), 3),
                  "ascii": ["".join("." if np.isnan(v) else str(min(9, int(v * 10))) for v in row) for row in h]}
    out[s] = r
    print(s, "| open", {k: v for k, v in r["open"].items() if k != "ascii"}, "| closed", {k: v for k, v in r["closed"].items() if k != "ascii"})
    print("\n".join(r["open"]["ascii"]))
(T / "qa-extra").mkdir(exist_ok=True); (T / "qa-extra" / "twins.json").write_text(json.dumps(out, indent=1))
