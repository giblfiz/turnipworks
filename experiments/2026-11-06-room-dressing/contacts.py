#!/usr/bin/env python3
"""Where a mesh touches the ground: the vertices within `tol` (fraction of height) of its lowest point, clustered on a
coarse x/z grid, and the footprint's convex hull vs the mesh's own footprint box. usage: contacts.py file.glb [tol]"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import importlib.util
spec = importlib.util.spec_from_file_location('gb', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'glbbox.py'))
src = open(spec.origin).read().replace('\nmain()\n', '\n')
ns = {}; exec(compile(src, 'glbbox', 'exec'), ns)
js, bin_ = ns['load'](sys.argv[1]); tol = float(sys.argv[2]) if len(sys.argv) > 2 else 0.02
allv = []
def walk(ni, M):
    n = js['nodes'][ni]; M = M @ ns['mat'](n)
    if 'mesh' in n:
        for p in js['meshes'][n['mesh']]['primitives']:
            v = ns['verts'](js, bin_, p['attributes']['POSITION']); h = np.c_[v, np.ones(len(v))] @ M.T; allv.append(h[:, :3])
    for c in n.get('children', []): walk(c, M)
for ni in js['scenes'][js.get('scene', 0)]['nodes']: walk(ni, np.eye(4))
V = np.vstack(allv); lo, hi = V.min(0), V.max(0); H = hi[1] - lo[1]
print('size', (hi - lo).round(3))
for t in (tol, 0.05, 0.1, 0.2):
    S = V[V[:, 1] <= lo[1] + t * H]
    cells = {}
    for x, y, z in S: k = (round(x / 0.05) * 0.05, round(z / 0.05) * 0.05); cells[k] = cells.get(k, 0) + 1
    print(f'within {t*100:.0f}% of height ({t*H:.3f}): {len(S)} verts in {len(cells)} 0.05-cells:', sorted(cells.items())[:30])
