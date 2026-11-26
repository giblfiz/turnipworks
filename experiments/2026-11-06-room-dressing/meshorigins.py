#!/usr/bin/env python3
"""Every library mesh SKU: its shipping GLB's bounds relative to its origin. Prints the SKUs whose origin is not at the
bottom centre (min y != 0, or x/z centre off the origin) by more than a fraction of the longest side.
usage: meshorigins.py [assets dir] [library.json]"""
import json, struct, sys, os
import numpy as np

def glb(path):
    b = open(path, 'rb').read(); off, js = 12, None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off); ch = b[off + 8: off + 8 + ln]; off += 8 + ln
        if ty == 0x4E4F534A: js = json.loads(ch)
    return js

def mat(n):
    if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
    t = np.array(n.get('translation', [0, 0, 0]), float); x, y, z, w = n.get('rotation', [0, 0, 0, 1]); s = np.array(n.get('scale', [1, 1, 1]), float)
    R = np.array([[1 - 2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1 - 2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1 - 2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = t; return M

def bounds(js):
    pts = []
    def walk(ni, M):
        n = js['nodes'][ni]; M = M @ mat(n)
        if 'mesh' in n:
            for p in js['meshes'][n['mesh']]['primitives']:
                a = js['accessors'][p['attributes']['POSITION']]; lo, hi = a['min'], a['max']
                for c in range(8):
                    v = np.array([hi[0] if c & 1 else lo[0], hi[1] if c & 2 else lo[1], hi[2] if c & 4 else lo[2], 1.0]); pts.append((M @ v)[:3])
        for c in n.get('children', []): walk(c, M)
    for ni in js['scenes'][js.get('scene', 0)]['nodes']: walk(ni, np.eye(4))
    P = np.array(pts); return P.min(0), P.max(0)

assets = sys.argv[1] if len(sys.argv) > 1 else 'tools/spawn-tuner/assets'
lib = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'tools/spawn-tuner/data/library.json'))['objects']
out = {}
for cat, o in lib.items():
    for k in o['skus']:
        u = k.get('url')
        if k.get('kind') != 'mesh' or not u: continue
        p = os.path.join(os.path.dirname(assets), u) if u.startswith('assets/') else os.path.join(assets, u)
        if not os.path.exists(p): continue
        lo, hi = bounds(glb(p)); L = max(hi - lo)
        out[k['sku']] = {'cat': cat, 'place': o.get('place'), 'min': lo.round(4).tolist(), 'max': hi.round(4).tolist(), 'dy': round(float(lo[1] / L), 4),
                         'cx': round(float((lo[0] + hi[0]) / 2 / L), 4), 'cz': round(float((lo[2] + hi[2]) / 2 / L), 4)}
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'meshorigins.json'), 'w'), indent=0)
bad = {s: v for s, v in out.items() if abs(v['dy']) > 0.02 or abs(v['cx']) > 0.02 or abs(v['cz']) > 0.02}
print(len(out), 'meshes;', len(bad), 'off bottom-centre by >2% of their longest side')
for s, v in sorted(bad.items(), key=lambda kv: -max(abs(kv[1]['dy']), abs(kv[1]['cx']), abs(kv[1]['cz'])))[:60]:
    print(f"{s:45s} {v['cat']:30s} {v['place']:6s} dy {v['dy']:+.3f} cx {v['cx']:+.3f} cz {v['cz']:+.3f}")
