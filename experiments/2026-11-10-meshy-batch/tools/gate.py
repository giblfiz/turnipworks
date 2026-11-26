#!/usr/bin/env python3
"""Proportion check for Meshy results (2026-11-10; revised the same day after Harry's review of the rejects: "none of these
should be disqualified"). Props scale uniformly by their largest dimension (solver.js Ctx.dims), so the world size is
bounds * (box largest / mesh largest), where the box is the one solver.js places: the sku's own `size` when it has one
(build_data, e.g. bookshelf--fine--s3's 54x15x42 in), else the catalog's. Result per attempt: `ok` when width, depth and
height are all within 10% of that box, or width and depth within 10% of the shipped mesh; otherwise `review`. A review
flag is a cue to LOOK at the before/after pair, never an automatic rejection: on repeated-unit fixtures the better mesh
usually wins even when it is off the box (2026-11-10: 18 of 18 flagged meshes were judged better by eye).
Width = the longer horizontal side, depth = the shorter (orientation is checked by eye in the renders).
  Run it BEFORE the drop-in: afterwards the library's "shipped" record is the new mesh itself.
  gate.py [stem ...]   -> work/gate.json  (default: every *--t25.glb on the USB)"""
import json, sys
from pathlib import Path
import numpy as np, struct
E = Path(__file__).resolve().parents[1]; R = E.parents[1]
U = Path('/mnt/usb/turnip-works/lanes-2026-11-10/meshy-batch/meshy')
L = json.loads((R / 'tools/spawn-tuner/data/library.json').read_text())['objects']
SKU = {s['sku']: (cid, s) for cid, o in L.items() for s in o['skus']}
sys.path.insert(0, str(E / 'tools')); from make_briefs import SHOTS  # noqa: E402


def world(b, cat):
    x, y, z = b; s = max(cat) / max(b); W, D = max(x, z) * s, min(x, z) * s
    return W, D, y * s


def _m(n):
    if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
    t = np.eye(4); t[:3, 3] = n.get('translation', [0, 0, 0]); x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    r = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    sm = np.diag(n.get('scale', [1, 1, 1])); t[:3, :3] = r @ sm; return t


def glb_bounds(p):
    """extent of every mesh's POSITION min/max box corners under its node's world transform (x / up / z)"""
    b = Path(p).read_bytes(); n = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20 + n])
    pts = []
    def walk(i, M):
        nd = j['nodes'][i]; M = M @ _m(nd)
        if 'mesh' in nd:
            for pr in j['meshes'][nd['mesh']]['primitives']:
                a = j['accessors'][pr['attributes']['POSITION']]; lo, hi = a['min'], a['max']
                for c in range(8):
                    v = np.array([(hi if c >> k & 1 else lo)[k] for k in range(3)] + [1.0]); pts.append((M @ v)[:3])
        for ch in nd.get('children', []): walk(ch, M)
    for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    P = np.array(pts); return list(P.max(0) - P.min(0))


def main(stems):
    out = json.loads((E / 'work/gate.json').read_text()) if (E / 'work/gate.json').exists() else {}
    for st in stems:
        base = st.split('--r2')[0]; cid, rec = SKU[base]; w, d, h = rec.get('size') or L[cid]['size']; box_src = 'sku.size' if rec.get('size') else 'catalog'
        catW, catD = max(w, d) / 12, min(w, d) / 12
        b = glb_bounds(U / f'{st}--t25.glb')
        nW, nD, nH = world(b, (w / 12, d / 12, h / 12)); sW, sD, sH = world(rec['bounds'], (w / 12, d / 12, h / 12))
        off_ship = float(max(abs(nW / sW - 1), abs(nD / sD - 1))); off_cat = float(max(abs(nW / catW - 1), abs(nD / catD - 1), abs(nH / (h / 12) - 1)))
        ok = off_ship <= 0.10 or off_cat <= 0.10  # off_cat: off the PLACED box (all three sides)
        out[st] = dict(sku=base, raw=[round(v, 4) for v in b], new_WDH_ft=[round(nW, 2), round(nD, 2), round(nH, 2)],
                       shipped_WDH_ft=[round(sW, 2), round(sD, 2), round(sH, 2)], catalog_WD_ft=[round(catW, 2), round(catD, 2)],
                       off_shipped=round(off_ship, 3), off_box=round(off_cat, 3), box=box_src, depth_axis='x' if b[0] < b[2] else 'z', flag='ok' if ok else 'review')
        print(f"{st:36s} new {nW:5.2f}x{nD:5.2f}x{nH:5.2f}  shipped {sW:5.2f}x{sD:5.2f}  catalog {catW:5.2f}x{catD:5.2f}  "
              f"off ship {off_ship:5.1%} cat {off_cat:5.1%}  depth-axis {out[st]['depth_axis']}  {'ok' if ok else 'REVIEW (look, do not reject)'}  box={box_src}")
    (E / 'work/gate.json').write_text(json.dumps(out, indent=1))


if __name__ == '__main__':
    main(sys.argv[1:] or sorted(p.name[:-9] for p in U.glob('*--t25.glb')))
