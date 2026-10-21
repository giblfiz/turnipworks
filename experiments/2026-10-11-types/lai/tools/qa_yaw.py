#!/usr/bin/env python3
"""Is a mesh lying DIAGONALLY in its box? (A long piece painted in three-quarter view often comes back turned about 45 degrees:
its axis-aligned footprint is then nearly square although the piece is long.) Minimum-area rectangle of the footprint
(convex hull of the vertices seen from above) against the axis-aligned box.
    ~/.local/share/tw-trimesh-venv/bin/python tools/qa_yaw.py TYPE_DIR [sku ...]     -> qa-extra/yaw.json
Prints only pieces whose best rectangle is turned more than 10 degrees and at least 15% smaller in area."""
import json, sys
from pathlib import Path
import numpy as np, trimesh
from scipy.spatial import ConvexHull
T = Path(sys.argv[1]); out = {}
for g in sorted((T / "models").glob("*.glb")):
    if sys.argv[2:] and g.stem not in sys.argv[2:]: continue
    m = trimesh.load(g, force="mesh"); p = m.vertices[:, [0, 2]]; h = p[ConvexHull(p).vertices]
    best = None
    for deg in np.arange(0, 90, 1.0):
        c, s = np.cos(np.radians(deg)), np.sin(np.radians(deg)); q = h @ np.array([[c, -s], [s, c]])
        e = q.max(0) - q.min(0)
        if best is None or e[0] * e[1] < best[1]: best = (deg, e[0] * e[1], e)
    aa = p.max(0) - p.min(0); deg, area, e = best; hgt = m.bounds[1][1] - m.bounds[0][1]
    k = max(aa.max(), hgt)                                 # report in units of the largest axis-aligned dimension
    rec = {"yaw_deg": float(deg if deg <= 45 else deg - 90), "aligned_xz": [round(float(v / k), 3) for v in aa], "best_rect": [round(float(v / k), 3) for v in e],
           "area_ratio": round(float(area / (aa[0] * aa[1])), 3), "height": round(float(hgt / k), 3)}
    out[g.stem] = rec
    if abs(rec["yaw_deg"]) > 10 and rec["area_ratio"] < 0.85: print(g.stem, json.dumps(rec))
(T / "qa-extra").mkdir(exist_ok=True); (T / "qa-extra" / "yaw.json").write_text(json.dumps(out, indent=1) + "\n")
