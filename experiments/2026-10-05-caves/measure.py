#!/usr/bin/env python3
"""Measure cave-wall chunk meshes instead of eyeballing them (venv with trimesh, scipy, pillow):
    ~/.local/share/tw-trimesh-venv/bin/python measure.py DIR_OR_GLB... [--kit]     # --kit writes kit.json from web-models/
Each mesh is stood up (glTF y up), turned so its thin horizontal axis is depth with the bulging FRONT toward +Z (the
back is the flatter of the two broad faces; ties are settled by yaw.json, filled from a blind Gemini read), and scaled
so its height is the designed height. Then, in feet:
  size w x d x h; underside: share of the footprint whose lowest surface is within 0.25 ft of the ground plane, and the
  largest gap under the piece; foot: how far the front of the bottom 3 ft stands from the back plane (the push-out
  rule needs it) and the furthest any part reaches forward (overhang); unpainted: share of the surface whose texture
  was never painted (alpha 0 or black), for everything a player can see (front, both ends, top) and per side.
"""
import json, math, sys
from pathlib import Path
import numpy as np, trimesh
from scipy import ndimage as ndi
HERE = Path(__file__).resolve().parent
TARGET_H = {"cave-rubble-low": 4.0}; DEFAULT_H = 10.0
# free stretch, like any prop: the column came out 7 ft across (asked 4.5), so it is narrowed in plan
STRETCH = {"cave-corner-column": [0.64, 0.64]}
YAW = json.loads((HERE / "yaw.json").read_text()) if (HERE / "yaw.json").exists() else {}
CELL = 0.25

def roty(p, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)   # three.js rotation.y = a
    o = p.copy(); o[:, 0] = c * p[:, 0] + s * p[:, 2]; o[:, 2] = -s * p[:, 0] + c * p[:, 2]; return o

def extreme(pts, ax, sign, cell):
    """index of the outermost sample per grid cell seen from direction sign along ax"""
    o = [a for a in (0, 1, 2) if a != ax]
    key = np.floor((pts[:, o[0]] - pts[:, o[0]].min()) / cell).astype(np.int64) * 100000 + np.floor((pts[:, o[1]] - pts[:, o[1]].min()) / cell).astype(np.int64)
    order = np.lexsort((sign * pts[:, ax], key)); k = key[order]; last = np.r_[k[1:] != k[:-1], True]
    return order[last]

def relief(pts, sign):
    """RMS distance (ft) of one broad face from its own best plane: small = flat (the back), large = bulging (the front)"""
    idx = extreme(pts, 2, sign, 0.4); q = pts[idx]
    A = np.c_[q[:, 0], q[:, 1], np.ones(len(q))]; coef, *_ = np.linalg.lstsq(A, q[:, 2], rcond=None)
    return float(np.sqrt(((A @ coef - q[:, 2]) ** 2).mean()))

def measure(f, pid=None):
    pid = pid or Path(f).stem
    m = trimesh.load(f, force="mesh")
    n = 300000
    pts, fi = trimesh.sample.sample_surface(m, n)
    pts = np.asarray(pts, float)
    out = {"file": Path(f).name, "tris": int(len(m.faces)), "native_extent": [round(float(v), 3) for v in np.ptp(m.vertices, axis=0)]}
    # texture: unpainted = alpha 0 or black
    bad = None
    try:
        img = np.asarray(m.visual.material.baseColorTexture.convert("RGBA")).astype(float)
        bc = trimesh.triangles.points_to_barycentric(m.triangles[fi], pts)
        uv = (m.visual.uv[m.faces[fi]] * bc[:, :, None]).sum(1); h, w = img.shape[:2]
        x = np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int); y = np.clip((1 - uv[:, 1] % 1) * h, 0, h - 1).astype(int)
        t = img[y, x]; bad = (t[:, 3] < 8) | (t[:, :3].max(1) < 12); rgb = t[:, :3]
    except Exception as e:
        out["texture_error"] = str(e)[:120]
    # frame: thin horizontal axis -> depth (z); front -> +z
    ex = np.ptp(pts, axis=0)
    yaw = 90 if ex[0] < ex[2] * 0.9 else 0
    p = roty(pts, yaw)
    rf, rb = relief(p, 1), relief(p, -1)
    auto_flip = rb > rf
    if pid in YAW: yaw = YAW[pid]; p = roty(pts, yaw); rf, rb = relief(p, 1), relief(p, -1); out["yaw_from"] = "yaw.json"
    elif auto_flip: yaw += 180; p = roty(pts, yaw); rf, rb = rb, rf; out["yaw_from"] = "flatter face = back"
    else: out["yaw_from"] = "flatter face = back"
    H = TARGET_H.get(pid, DEFAULT_H); s = H / np.ptp(p[:, 1]); p = p * s
    st = STRETCH.get(pid, [1, 1]); p[:, 0] *= st[0]; p[:, 2] *= st[1]; out["stretch"] = st
    y0 = p[:, 1].min(); p[:, 1] -= y0
    cx = (p[:, 0].min() + p[:, 0].max()) / 2
    back = float(np.percentile(p[p[:, 1] < H * 0.8][:, 2], 2))        # the back plane: where the back face mostly is
    p[:, 0] -= cx; p[:, 2] -= back
    out.update(yaw_deg=yaw % 360, scale=round(float(s), 4), y0=round(float(y0), 3), cx=round(float(cx), 3), back_z=round(back, 3),
               size_ft={"w": round(float(np.ptp(p[:, 0])), 2), "d": round(float(np.ptp(p[:, 2])), 2), "h": round(H, 2)},
               relief_ft={"front": round(rf * s, 2), "back": round(rb * s, 2)})
    # underside
    # underside: the generator returns open shells (no bottom face), so two numbers: is the RIM of the footprint on the
    # ground all the way round (what shows), and how much of the inside of the footprint has a bottom at all
    ix = np.floor((p[:, 0] - p[:, 0].min()) / CELL).astype(int); iz = np.floor((p[:, 2] - p[:, 2].min()) / CELL).astype(int)
    low = np.full((ix.max() + 1, iz.max() + 1), np.inf); np.minimum.at(low, (ix, iz), p[:, 1])
    occ = ndi.binary_fill_holes(np.isfinite(low)); rim = occ & ~ndi.binary_erosion(occ); inner = occ & ~rim
    lowf = np.where(np.isfinite(low), low, 99.0)
    colmin = lambda a: np.array([p[a == c, 1].min() for c in np.unique(a)])
    fw = colmin(ix)                                                 # lowest point over each 0.25-ft step of the width
    out["foot"] = {"on_ground_share_along_width": round(float((fw < 0.3).mean()), 3), "max_gap_ft": round(float(fw.max()), 2)}
    out["underside"] = {"rim_on_ground_share": round(float((lowf[rim] < 0.3).mean()), 3), "rim_max_gap_ft": round(float(np.percentile(lowf[rim], 97)), 2),
                        "closed_bottom_share": round(float((lowf[inner] < 0.3).mean()), 3) if inner.any() else None, "watertight": bool(m.is_watertight)}
    # the foot and the reach (z measured forward from the back plane)
    foot = p[p[:, 1] < 3.0]; mid = p[(p[:, 1] > 3.0) & (p[:, 1] < 7.0)]; top = p[p[:, 1] > 7.0]
    q = lambda a, v: round(float(np.percentile(a[:, 2], v)), 2) if len(a) else None
    out["front_reach_ft"] = {"foot_p50": q(foot[foot[:, 2] > np.median(foot[:, 2])], 50) if len(foot) else None, "foot_max": q(foot, 99), "mid_max": q(mid, 99), "top_max": q(top, 99), "all_max": q(p, 99.5), "behind_back_plane": q(p, 0.5)}
    out["half_width_ft"] = {"foot": round(float(np.percentile(np.abs(foot[:, 0]), 98)), 2) if len(foot) else None, "all": round(float(np.percentile(np.abs(p[:, 0]), 99)), 2)}
    # see-through opening at ground level (the tunnel mouth), from the front-view silhouette at 0.25 ft: the widest
    # empty stretch between rock in each row from 0.5 to 4 ft up (median = the opening), and how high its middle is clear
    if "arch" in pid:
        gx = np.floor((p[:, 0] + 20) / CELL).astype(int); gy = np.clip(np.floor(p[:, 1] / CELL).astype(int), 0, 47)
        occ = np.zeros((160, 48), bool); occ[gx, gy] = True
        rows = []
        for y in range(2, 17):
            xs = np.flatnonzero(occ[:, y]); gaps = [(xs[i + 1] - xs[i] - 1, xs[i] + 1, xs[i + 1]) for i in range(len(xs) - 1) if xs[i + 1] - xs[i] > 1]
            if gaps: rows.append(max(gaps))
        if rows:
            x0 = float(np.median([r[1] for r in rows])) * CELL - 20; x1 = float(np.median([r[2] for r in rows])) * CELL - 20; mid = int(round(((x0 + x1) / 2 + 20) / CELL))
            clear = next((y for y in range(2, 48) if occ[mid - 1:mid + 2, y].any()), 47) * CELL
            out["opening"] = {"x0": round(x0, 2), "x1": round(x1, 2), "width_ft": round(x1 - x0, 2), "clear_height_ft": round(clear, 2), "rows_with_gap": len(rows)}
    if bad is not None:
        seen = np.zeros(n, bool); sides = {}
        for name, ax, sign in (("front", 2, 1), ("back", 2, -1), ("end_left", 0, -1), ("end_right", 0, 1), ("top", 1, 1)):
            idx = extreme(p, ax, sign, np.ptp(p, axis=0).max() / 120); sides[name] = round(float(bad[idx].mean()), 3)
            if name != "back": seen[idx] = True
        out["unpainted"] = {"all_surface": round(float(bad.mean()), 3), "seen": round(float(bad[seen].mean()), 3), **sides}
        ok = seen & ~bad
        out["colour"] = {"seen_rgb": [int(v) for v in rgb[ok].mean(0)], "front_rgb": [int(v) for v in rgb[extreme(p, 2, 1, 0.1)][~bad[extreme(p, 2, 1, 0.1)]].mean(0)]}
    return pid, out

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--kit" in sys.argv: args = [str(HERE / "web-models")]
    files = []
    for a in args: files += sorted(Path(a).glob("*.glb")) if Path(a).is_dir() else [Path(a)]
    kit = {}
    for f in files:
        pid, o = measure(f); kit[pid] = o
        print(f"{str(f.parent.parent.name) + '/' + pid:42s} {o['size_ft']}  tris {o['tris']}  foot on ground {o['foot']['on_ground_share_along_width']:.0%} of width (gap {o['foot']['max_gap_ft']}), bottom closed {o['underside']['closed_bottom_share']}  relief f/b {o['relief_ft']['front']}/{o['relief_ft']['back']}  unpainted {o.get('unpainted')}  rgb {o.get('colour', {}).get('seen_rgb')}" + (f"  opening {o['opening']}" if 'opening' in o else ''), flush=True)
    if "--kit" in sys.argv:
        # colour: each piece gets a gain that brings its mean seen colour to the set's median (clamped), and the floor
        # a tint that brings the floor tile to the walls' hue, a little darker
        cols = np.array([k["colour"]["seen_rgb"] for k in kit.values()], float); med = np.median(cols, axis=0)
        for k in kit.values(): k["gain"] = [round(float(np.clip(med[c] / k["colour"]["seen_rgb"][c], 0.8, 1.25)), 3) for c in range(3)]
        try:
            from PIL import Image
            fl = np.asarray(Image.open(HERE / "floor/floor-cave-rock.png").convert("RGB"), float).mean(axis=(0, 1))
            # the floor tile is 1.3 x brighter and more orange than the walls: bring it to the walls' hue, a little darker
            kit["_floor_tint"] = [round(float(v), 3) for v in 1.05 * med / fl]
            kit["_rock_tint"] = [round(float(v), 3) for v in 1.0 * med / fl]   # the same tile used on the solid rock behind and above
            kit["_colour"] = {"walls_median_rgb": med.round(0).tolist(), "floor_rgb": fl.round(0).tolist()}
        except Exception as e: print("floor tint skipped:", e)
    if "--kit" in sys.argv: (HERE / "kit.json").write_text(json.dumps(kit, indent=1) + "\n"); print("kit.json", len(kit), kit.get("_floor_tint"), kit.get("_colour"))
