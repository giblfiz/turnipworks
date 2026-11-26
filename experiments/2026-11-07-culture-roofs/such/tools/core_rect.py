#!/usr/bin/env python3
"""The largest axis-aligned rectangle of a mesh's plan that is solid all the way (every ray straight down meets the mesh),
as fractions of its own box: core.py GLB [n]. For a sunken piece (core/holes.js PIT_CATS `core`): that rectangle, not its
box, is stretched over its cut, so no void shows where the generated mesh is ragged."""
import sys, numpy as np, trimesh
s = trimesh.load(sys.argv[1]); m = s.to_geometry() if hasattr(s, 'to_geometry') else s; n = int(sys.argv[2]) if len(sys.argv) > 2 else 48
lo, hi = m.bounds
xs = lo[0] + (hi[0] - lo[0]) * (np.arange(n) + 0.5) / n; zs = lo[2] + (hi[2] - lo[2]) * (np.arange(n) + 0.5) / n
O = np.array([[x, hi[1] + 1, z] for x in xs for z in zs]); hit = m.ray.intersects_any(O, np.tile([0, -1, 0], (len(O), 1))).reshape(n, n)  # [i x, j z]
from scipy import ndimage
hit = ndimage.binary_closing(hit, np.ones((3, 3)), border_value=0) | hit  # (pinholes between steps: a ray down a vertical face; not void anyone sees)
W, D = hi[0] - lo[0], hi[2] - lo[2]
P = np.zeros((n + 1, n + 1), int); P[1:, 1:] = np.cumsum(np.cumsum(hit, 0), 1)
best = (0, None)
for i0 in range(n):
    for i1 in range(i0 + 1, n + 1):
        for j0 in range(n):
            for j1 in range(j0 + 1, n + 1):
                a = (i1 - i0) * (j1 - j0); sc = min((i1 - i0) * W, (j1 - j0) * D)  # (the most SQUARE solid core: its shorter side, in the mesh's units)
                if sc <= best[0]: continue
                if P[i1, j1] - P[i0, j1] - P[i1, j0] + P[i0, j0] == a: best = (sc, (i0, j0, i1, j1))
i0, j0, i1, j1 = best[1]
print('GLB units:', [round(lo[0] + W * i0 / n, 3), round(lo[2] + D * j0 / n, 3), round(lo[0] + W * i1 / n, 3), round(lo[2] + D * j1 / n, 3)], 'fractions:', [round(i0 / n, 3), round(j0 / n, 3), round(i1 / n, 3), round(j1 / n, 3)], 'sides (share of box):', round((i1 - i0) / n, 3), round((j1 - j0) / n, 3))
