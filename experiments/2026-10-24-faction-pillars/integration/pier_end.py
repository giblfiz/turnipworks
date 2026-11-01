#!/usr/bin/env python3
"""Where is a pier's tall end? (the factions convention, tem-01 sun/moon: the pier stands out in the room at local +Z,
the half-arch leans back to the wall). Measures the source GLB: the mean of the vertices in the top 20 % of the height
along each horizontal axis; prints the axis and sign of the tall end and the yaw that puts it at +Z.
    tw-trimesh-venv/bin/python integration/pier_end.py models/<sku>.glb ..."""
import sys, json, hashlib, numpy as np, trimesh
YAW = {'+z': 0, '-z': 180, '+x': -90, '-x': 90}
out = {}
for f in sys.argv[1:]:
    m = trimesh.load(f, force='mesh'); v = m.vertices; lo, hi = v.min(0), v.max(0); ext = hi - lo
    top = v[v[:, 1] > lo[1] + 0.8 * ext[1]]
    ax = 0 if ext[0] > ext[2] else 2
    c = (top[:, ax].mean() - (lo[ax] + hi[ax]) / 2) / ext[ax]
    end = ('+' if c > 0 else '-') + 'xz'[ax // 2]
    out[f] = dict(long_axis='xz'[ax // 2], tall_end=end, offset=round(float(c), 3), yaw=YAW[end], sha256=hashlib.sha256(open(f, 'rb').read()).hexdigest(), ext=[round(float(e), 3) for e in ext])
print(json.dumps(out, indent=1))
