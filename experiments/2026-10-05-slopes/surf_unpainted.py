#!/usr/bin/env python3
"""Share of each mesh's SURFACE AREA whose texture was never painted (alpha 0 / pure black texels): the black holes.
    tw-trimesh-venv/bin/python surf_unpainted.py a.glb b.glb"""
import sys, numpy as np, trimesh
def share(f):
    m = trimesh.load(f, force='mesh')
    img = np.asarray(m.visual.material.baseColorTexture.convert('RGBA')).astype(float)
    pts, fi = trimesh.sample.sample_surface(m, 300000)
    bc = trimesh.triangles.points_to_barycentric(m.triangles[fi], pts)
    uv = (m.visual.uv[m.faces[fi]] * bc[:, :, None]).sum(1)
    h, w = img.shape[:2]
    x = np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int); y = np.clip((1 - uv[:, 1] % 1) * h, 0, h - 1).astype(int)
    t = img[y, x]
    bad = (t[:, 3] < 8) | (t[:, :3].max(1) < 12)
    # the part a player can see: the first surface met from above and from the four sides (extreme point per grid cell)
    out = {"all_surface": round(float(bad.mean()), 3)}
    c = np.ptp(pts, axis=0).max() / 120
    seen = np.zeros(len(pts), bool)
    for name, ax, sign in (("top", 1, 1), ("+x", 0, 1), ("-x", 0, -1), ("+z", 2, 1), ("-z", 2, -1)):
        o = [a for a in (0, 1, 2) if a != ax]
        key = np.floor((pts[:, o[0]] - pts[:, o[0]].min()) / c).astype(int) * 1000 + np.floor((pts[:, o[1]] - pts[:, o[1]].min()) / c).astype(int)
        order = np.lexsort((sign * pts[:, ax], key)); k = key[order]; last = np.r_[k[1:] != k[:-1], True]
        idx = order[last]; out[name] = round(float(bad[idx].mean()), 3); seen[idx] = True
    out["visible"] = round(float(bad[seen].mean()), 3)
    return out
if __name__ == "__main__":
    for f in sys.argv[1:]: print(f, share(f))
