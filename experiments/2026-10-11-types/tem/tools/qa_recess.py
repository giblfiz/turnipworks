#!/usr/bin/env python3
"""Wall panels with niches: are the recesses real depth or painted? Surface samples binned over the broad face; per
side, the share of cells whose surface lies more than 25% / 50% of the panel thickness behind that side's front plane.
    tw-trimesh-venv/bin/python tools/qa_recess.py TYPE_DIR sku [sku ...]    (prints; a plain wall is near 0 on both sides)"""
import sys
from pathlib import Path
import numpy as np, trimesh
T = Path(sys.argv[1])
if not T.exists(): T = Path(__file__).resolve().parent.parent / sys.argv[1]
for s in sys.argv[2:]:
    p = T / "models" / f"{s}.glb"
    if not p.exists(): print(s, "missing"); continue
    m = trimesh.load(p, force="mesh"); lo, hi = m.bounds; ext = hi - lo
    thin = 0 if ext[0] < ext[2] else 2; broad = 2 - thin; n, nz = 20, 36
    pts, _ = trimesh.sample.sample_surface(m, 600000, seed=1)
    ia = np.clip(((pts[:, broad] - lo[broad]) / ext[broad] * n).astype(int), 0, n - 1); iz = np.clip(((pts[:, 1] - lo[1]) / ext[1] * nz).astype(int), 0, nz - 1)
    t = (pts[:, thin] - lo[thin]) / ext[thin]; idx = iz * n + ia; out = []
    for side in (+1, -1):
        v = t if side > 0 else 1 - t; f = np.full(n * nz, np.nan); o = np.argsort(v); f[idx[o]] = v[o]       # front-most sample per cell
        hit = ~np.isnan(f); plane = np.nanpercentile(f, 90); d = plane - f
        out.append((round(float((d[hit] > 0.25).mean()), 3), round(float((d[hit] > 0.5).mean()), 3), f.reshape(nz, n), plane))
    best = max(out, key=lambda x: x[0])
    print(f"{s}: thickness {ext[thin]/ext[1]:.2f} of height; recessed >25% of thickness: side A {out[0][0]:.0%}, side B {out[1][0]:.0%}; >50%: {out[0][1]:.0%} / {out[1][1]:.0%}")
    for row in best[2][::-1]: print("  " + "".join("." if np.isnan(v) else ("#" if best[3] - v > 0.5 else "+" if best[3] - v > 0.25 else "-") for v in row))
