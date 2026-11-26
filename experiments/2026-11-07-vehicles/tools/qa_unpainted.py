#!/usr/bin/env python3
"""Mesh QA, step 2 of 3: the UNPAINTED-SURFACE FRACTION of each GLB, the slope pilot's measure
(experiments/2026-10-05-slopes/surf_unpainted.py, which found 29-69% on the big sloped pieces): 300k random points on
the surface, each looked up in the base-colour texture; a point is unpainted when its texel has alpha < 8 or is pure
black (max channel < 12). `visible` = the same share over the points a player can see: the first surface met from above
and from the four sides. Written into QADIR/<sku>.json as "unpainted": {all_surface, top, +x, -x, +z, -z, visible}.
    ~/.local/share/tw-trimesh-venv/bin/python tools/qa_unpainted.py TYPE_DIR [--out QADIR] [--models DIR] [--redo] [sku ...]
"""
import json, sys
from pathlib import Path
import numpy as np, trimesh

def share(f, n=300000, seed=7):
    m = trimesh.load(f, force='mesh')
    tex = getattr(getattr(m.visual, "material", None), "baseColorTexture", None)
    if tex is None or getattr(m.visual, "uv", None) is None:
        return {"error": "no base-colour texture or no UVs"}
    img = np.asarray(tex.convert('RGBA')).astype(float)
    pts, fi = trimesh.sample.sample_surface(m, n, seed=seed)
    bc = trimesh.triangles.points_to_barycentric(m.triangles[fi], pts)
    uv = (m.visual.uv[m.faces[fi]] * bc[:, :, None]).sum(1)
    h, w = img.shape[:2]
    x = np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int); y = np.clip((1 - uv[:, 1] % 1) * h, 0, h - 1).astype(int)
    t = img[y, x]
    bad = (t[:, 3] < 8) | (t[:, :3].max(1) < 12)
    out = {"all_surface": round(float(bad.mean()), 3)}
    c = np.ptp(pts, axis=0).max() / 120
    seen = np.zeros(len(pts), bool)
    # glTF axes: y is up. top = +y; the four sides = +-x, +-z
    for name, ax, sign in (("top", 1, 1), ("+x", 0, 1), ("-x", 0, -1), ("+z", 2, 1), ("-z", 2, -1)):
        o = [a for a in (0, 1, 2) if a != ax]
        key = np.floor((pts[:, o[0]] - pts[:, o[0]].min()) / c).astype(int) * 1000 + np.floor((pts[:, o[1]] - pts[:, o[1]].min()) / c).astype(int)
        order = np.lexsort((sign * pts[:, ax], key)); k = key[order]; last = np.r_[k[1:] != k[:-1], True]
        idx = order[last]; out[name] = round(float(bad[idx].mean()), 3); seen[idx] = True
    out["visible"] = round(float(bad[seen].mean()), 3)
    out["texture_px"] = [int(w), int(h)]
    out["texels_alpha0_share"] = round(float((img[:, :, 3] < 8).mean()), 3)
    return out

if __name__ == "__main__":
    argv = sys.argv[1:]
    def opt(name):
        if name in argv:
            i = argv.index(name); v = argv[i + 1]; del argv[i:i + 2]; return v
    out, models = opt("--out"), opt("--models"); redo = "--redo" in argv
    if redo: argv.remove("--redo")
    if argv and argv[0].endswith(".glb"):                 # plain use: print the share of the files given
        for f in argv: print(f, share(f))
        sys.exit()
    T = Path(argv[0]).resolve(); out = Path(out) if out else T / "qa"; models = Path(models) if models else T / "models"
    for g in sorted(models.glob("*.glb")):
        if argv[1:] and g.stem not in argv[1:]: continue
        j = out / f"{g.stem}.json"
        if not j.exists(): print("UNPAINTED skip (no measurements yet)", g.stem); continue
        rec = json.loads(j.read_text())
        if "unpainted" in rec and not redo and "error" not in rec["unpainted"]: continue
        try: rec["unpainted"] = share(str(g))
        except Exception as e: rec["unpainted"] = {"error": repr(e)[:200]}
        j.write_text(json.dumps(rec, indent=1)); print("UNPAINTED", g.stem, json.dumps(rec["unpainted"]), flush=True)
