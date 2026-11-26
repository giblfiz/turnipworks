#!/usr/bin/env python3
"""World-space bounds of a .glb (node transforms applied to POSITION accessor min/max corners), and the lowest
vertices: how much of the mesh sits at its bottom. usage: glbbox.py file.glb [--verts]"""
import json, struct, sys
import numpy as np

def load(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    off, js, bin_ = 12, None, None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off); ch = b[off + 8: off + 8 + ln]; off += 8 + ln
        if ty == 0x4E4F534A: js = json.loads(ch)
        elif ty == 0x004E4942: bin_ = ch
    return js, bin_

def mat(n):
    if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
    t = np.array(n.get('translation', [0, 0, 0]), float); r = n.get('rotation', [0, 0, 0, 1]); s = np.array(n.get('scale', [1, 1, 1]), float)
    x, y, z, w = r
    R = np.array([[1 - 2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1 - 2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1 - 2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = t; return M

def verts(js, bin_, acc_i):
    a = js['accessors'][acc_i]; bv = js['bufferViews'][a['bufferView']]
    assert a['componentType'] == 5126 and a['type'] == 'VEC3'
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 12)
    out = np.empty((a['count'], 3), np.float32)
    for i in range(a['count']): out[i] = struct.unpack_from('<3f', bin_, start + i * stride)
    return out

def main():
    js, bin_ = load(sys.argv[1]); allv = []
    def walk(ni, M):
        n = js['nodes'][ni]; M = M @ mat(n)
        if 'mesh' in n:
            for p in js['meshes'][n['mesh']]['primitives']:
                v = verts(js, bin_, p['attributes']['POSITION']); h = np.c_[v, np.ones(len(v))] @ M.T; allv.append(h[:, :3])
        for c in n.get('children', []): walk(c, M)
    sc = js['scenes'][js.get('scene', 0)]
    for ni in sc['nodes']: walk(ni, np.eye(4))
    V = np.vstack(allv); lo, hi = V.min(0), V.max(0); size = hi - lo
    print('min', lo.round(4), 'max', hi.round(4), 'size', size.round(4))
    y = V[:, 1]; h = size[1]
    for f in (0.01, 0.03, 0.05, 0.1):
        sel = V[y <= lo[1] + f * h]
        print(f'verts within {f*100:.0f}% of the bottom: {len(sel)} of {len(V)}; their x range {sel[:,0].min():.3f}..{sel[:,0].max():.3f} z range {sel[:,2].min():.3f}..{sel[:,2].max():.3f}')

main()
