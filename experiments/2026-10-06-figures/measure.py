#!/usr/bin/env python3
"""Measure a generated FIGURE mesh instead of eyeballing it (venv with trimesh, scipy, pillow):
    ~/.local/share/tw-trimesh-venv/bin/python measure.py [--kit]       # --kit writes kit.json from web-models/
Per figure, in feet after scaling to the stated overall height (assets.json height_ft.overall):
  size, triangles, bytes; unpainted share of the surface (all, and what can be seen from above and the four sides);
  pieces: connected parts of the mesh and whether any float free of the main one;
  ground: every separate patch of the figure that touches the ground slab (feet, paws, a staff's foot), how far its
     lowest point is off the ground plane, how much of its sole is level; and base: the share of the figure's plan
     that the lowest slab covers (a sneaked-in disc or ground patch covers most of it; feet cover little);
  columns: horizontal slices, how many separate islands at each height (two legs = 2 islands; a staff standing clear
     of the robe = an extra small island all the way up; a fused web = fewer islands than expected);
  silhouette: the mesh's outline against the plate's cut-out (best match over view angles): intersection over union,
     the share of the plate's figure the mesh LOST (thin parts gone) and the share the mesh ADDED (gaps webbed shut);
     the matching view angle also says which way the mesh faces (the plate is a three-quarter front view).
"""
import json, math, sys
from pathlib import Path
import numpy as np, trimesh
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
HERE = Path(__file__).resolve().parent
SPEC = {a["id"]: a for a in json.loads((HERE / "assets.json").read_text())["assets"]}
PLATES = HERE / "masked"      # set_qa.py points SPEC and PLATES at the default set
YAW = json.loads((HERE / "yaw.json").read_text()) if (HERE / "yaw.json").exists() else {}
N = 400000

def roty(p, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)   # three.js rotation.y = a
    o = p.copy(); o[:, 0] = c * p[:, 0] + s * p[:, 2]; o[:, 2] = -s * p[:, 0] + c * p[:, 2]; return o

def extreme(pts, ax, sign, cell):
    o = [a for a in (0, 1, 2) if a != ax]
    key = np.floor((pts[:, o[0]] - pts[:, o[0]].min()) / cell).astype(np.int64) * 100000 + np.floor((pts[:, o[1]] - pts[:, o[1]].min()) / cell).astype(np.int64)
    order = np.lexsort((sign * pts[:, ax], key)); k = key[order]; last = np.r_[k[1:] != k[:-1], True]
    return order[last]

def mask_of(u, v, res=256):
    """orthographic outline of points (u right, v up), cropped to its own box, height = res"""
    h = np.ptp(v); s = (res - 1) / h; w = int(np.ptp(u) * s) + 3
    m = np.zeros((res, w), bool); m[np.clip(((v.max() - v) * s).astype(int), 0, res - 1), np.clip(((u - u.min()) * s).astype(int) + 1, 0, w - 1)] = True
    return ndi.binary_closing(m, iterations=2)

def fit(a, b):
    """place two cropped masks (same height) on one canvas, centred, and compare"""
    w = max(a.shape[1], b.shape[1]) + 2
    def pad(m): o = np.zeros((m.shape[0], w), bool); x = (w - m.shape[1]) // 2; o[:, x:x + m.shape[1]] = m; return o
    A, B = pad(a), pad(b); inter = (A & B).sum(); return inter / (A | B).sum(), (A & ~B).sum() / A.sum(), (B & ~A).sum() / A.sum()

def fit_free(a, b):
    """the same, but the mesh outline b may also be resized a little and slid, feet kept near the bottom: a missing
    spear tip or a taller hat must not spoil the whole comparison"""
    best = (0, 0, 0, 1.0); H, W = a.shape[0] + 80, max(a.shape[1], b.shape[1]) * 2 + 80
    A = np.zeros((H, W), bool); ax = (W - a.shape[1]) // 2; A[40:40 + a.shape[0], ax:ax + a.shape[1]] = a; an = A.sum()
    for sc in (0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2):
        bb = np.asarray(Image.fromarray(b).resize((max(2, round(b.shape[1] * sc)), max(2, round(b.shape[0] * sc))), Image.NEAREST))
        for dy in (-8, -4, 0, 4, 8):
            y0 = 40 + a.shape[0] - bb.shape[0] + dy     # bottoms together
            if y0 < 0 or y0 + bb.shape[0] > H: continue
            for dx in range(-40, 41, 4):
                x0 = (W - bb.shape[1]) // 2 + dx
                if x0 < 0 or x0 + bb.shape[1] > W: continue
                B = np.zeros((H, W), bool); B[y0:y0 + bb.shape[0], x0:x0 + bb.shape[1]] = bb
                iou = (A & B).sum() / (A | B).sum()
                if iou > best[0]: best = (iou, (A & ~B).sum() / an, (B & ~A).sum() / an, sc, A, B)
    return best

def silhouette(pts, plate_png, dump=None):
    al = np.asarray(Image.open(plate_png).convert("RGBA"))[:, :, 3] > 128
    ys, xs = np.nonzero(al); al = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    res = 256; pm = np.asarray(Image.fromarray(al).resize((max(2, round(al.shape[1] * res / al.shape[0])), res), Image.NEAREST))
    sub = pts[::4]; cands = []
    for el in (0, 8, 16):
        e = math.radians(el)
        for yaw in range(0, 360, 5):
            p = roty(sub, yaw)   # camera on +Z looking at the origin, raised by el
            u, v = p[:, 0], p[:, 1] * math.cos(e) - p[:, 2] * math.sin(e)
            mk = mask_of(u, v, res); cands.append((fit(pm, mk)[0], yaw, el, mk))
    cands.sort(key=lambda c: -c[0]); best = None
    for iou0, yaw, el, mk in cands[:6]:
        r = fit_free(pm, mk)
        if best is None or r[0] > best[0][0]: best = (r, yaw, el, iou0)
    r, yaw, el, iou0 = best
    if dump:   # red = only in the painting (lost), green = only in the mesh (added), white = both
        A, B = r[4], r[5]; im = np.zeros(A.shape + (3,), np.uint8); im[A & B] = 255; im[A & ~B] = (255, 40, 40); im[B & ~A] = (40, 220, 40); Image.fromarray(im).save(dump)
    return {"iou": round(float(r[0]), 3), "plate_lost_share": round(float(r[1]), 3), "added_share": round(float(r[2]), 3), "mesh_resized_by": r[3], "iou_box_fit": round(float(iou0), 3), "view_yaw_deg": yaw, "view_elev_deg": el}

def islands(p, y0, y1, cell):
    s = p[(p[:, 1] >= y0) & (p[:, 1] < y1)]
    if len(s) < 20: return []
    ix = np.floor((s[:, 0] - s[:, 0].min()) / cell).astype(int); iz = np.floor((s[:, 2] - s[:, 2].min()) / cell).astype(int)
    occ = np.zeros((ix.max() + 3, iz.max() + 3), bool); occ[ix + 1, iz + 1] = True
    occ = ndi.binary_closing(occ, iterations=1); lab, n = ndi.label(ndi.binary_fill_holes(occ), structure=np.ones((3, 3)))
    out = []
    for k in range(1, n + 1):
        cells = np.argwhere(lab == k)
        if len(cells) < 3: continue
        c = cells.mean(0); ext = np.ptp(cells, axis=0) + 1
        sel = lab[ix + 1, iz + 1] == k
        out.append({"x": float((c[0] - 1) * cell + s[:, 0].min()), "z": float((c[1] - 1) * cell + s[:, 2].min()), "area": float(len(cells) * cell * cell), "w": float(ext.min() * cell), "l": float(ext.max() * cell), "pts": s[sel]})
    return sorted(out, key=lambda o: -o["area"])


def shaft(p, H):
    """A thin straight part (staff, spear, blade), found by slicing the figure along each axis in turn and following a
    THIN island from slice to slice. The longest such run is the shaft. Along its span, each slice is CLEAR (the shaft
    is its own island, background all round it), JOINED (it runs into something bigger: the hand that grips it, or a
    web or slab it has fused into) or BROKEN (nothing there). Sizes in feet."""
    U = max(H, 4); n = 64; best = None
    for ax in (1, 0, 2):
        o = [a for a in (0, 1, 2) if a != ax]; q = p[:, [o[0], ax, o[1]]].copy(); lo0 = q[:, 1].min(); q[:, 1] -= lo0; L = q[:, 1].max(); st = L / n
        sl = [islands(q, i * st, (i + 1) * st, U / 300) for i in range(n)]
        thin = [[k for k in S if k["l"] < 0.13 * U] for S in sl]
        for i0 in range(n):
            for k0 in thin[i0]:
                if k0.get("used"): continue
                run = {i0: k0}; k0["used"] = True
                for step in (1, -1):
                    i, cur, vel, miss = i0, np.array([k0["x"], k0["z"]]), np.zeros(2), 0
                    while 0 <= i + step < n and miss < 10:
                        i += step; pred = cur + vel
                        c = [k for k in thin[i] if math.hypot(k["x"] - pred[0], k["z"] - pred[1]) < 0.05 * U]
                        if c:
                            k = min(c, key=lambda k: math.hypot(k["x"] - pred[0], k["z"] - pred[1])); k["used"] = True; new = np.array([k["x"], k["z"]])
                            vel = 0.5 * vel + 0.5 * (new - cur) / (miss + 1); cur = new; run[i] = k; miss = 0
                        else: cur = pred; miss += 1
                if len(run) < 6: continue
                ii = sorted(run); span = ii[-1] - ii[0] + 1
                P3 = np.array([[run[i]["x"], (i + 0.5) * st, run[i]["z"]] for i in ii]); length = float(np.linalg.norm(P3[-1] - P3[0]))
                if best is None or length > best["length"]: best = {"length": length, "ax": ax, "o": o, "run": run, "ii": ii, "st": st, "lo0": lo0, "sl": sl, "P3": P3}
    if best is None or best["length"] < 0.25 * U: return None
    run, ii, st, sl, P3 = best["run"], best["ii"], best["st"], best["sl"], best["P3"]
    c = P3.mean(0); _, _, vt = np.linalg.svd(P3 - c); d = vt[0]; walk = ""
    for _ in range(3):   # a hand's width of grip can hide the shaft for longer than the follower waits: pick up every thin island on the fitted line
        run = {}
        for i, S in enumerate(sl):
            tpar = ((i + 0.5) * st - c[1]) / d[1] if abs(d[1]) > 1e-6 else 0; pt = c + d * tpar
            cands = [k for k in S if k["l"] < 0.16 * U and math.hypot(k["x"] - pt[0], k["z"] - pt[2]) < 0.045 * U]
            if cands: run[i] = min(cands, key=lambda k: math.hypot(k["x"] - pt[0], k["z"] - pt[2]))
        ii = sorted(run); P3 = np.array([[run[i]["x"], (i + 0.5) * st, run[i]["z"]] for i in ii])
        c = P3.mean(0); _, _, vt = np.linalg.svd(P3 - c); d = vt[0]
    best["length"] = float(np.linalg.norm(P3[-1] - P3[0]))
    for i in range(ii[0], ii[-1] + 1):
        if i in run: walk += "-"; continue
        tpar = ((i + 0.5) * st - c[1]) / d[1] if abs(d[1]) > 1e-6 else 0; pt = c + d * tpar
        hit = any(abs(k["x"] - pt[0]) < k["l"] / 2 + 0.03 * U and abs(k["z"] - pt[2]) < k["l"] / 2 + 0.03 * U for k in sl[i])
        walk += "#" if hit else " "
    def world(P):   # back to x, y, z
        W = np.zeros(3); W[best["o"][0]], W[best["ax"]], W[best["o"][1]] = P[0], P[1] + best["lo0"], P[2]; return W
    e0, e1 = world(P3[0]), world(P3[-1])
    if e0[1] > e1[1]: e0, e1 = e1, e0; walk = walk[::-1]
    dv = (e1 - e0) / np.linalg.norm(e1 - e0); v = p - e0; t = v @ dv; dist = np.linalg.norm(v - np.outer(t, dv), axis=1)
    # the whole part along that line (a spear's head or a pommel is wider than the shaft and ends the thin run): step
    # outward from both ends while there is material on the line that is not the body
    near, wide = dist < 0.035 * U, dist < 0.13 * U; stp = 0.02 * U; t0, t1 = 0.0, best["length"]
    def ok(a, b): nn = int(((t >= a) & (t < b) & near).sum()); return nn >= 6 and int(((t >= a) & (t < b) & wide).sum()) < nn * 4
    while ok(t1, t1 + stp): t1 += stp
    while ok(t0 - stp, t0): t0 -= stp
    w0, w1 = e0 + dv * t0, e0 + dv * t1
    N = len(walk)
    return {"thin_run_ft": round(best["length"], 2), "length_ft": round(float(t1 - t0), 2), "low_end_ft": [round(float(x), 2) for x in w0], "high_end_ft": [round(float(x), 2) for x in w1], "tilt_from_upright_deg": round(math.degrees(math.acos(min(1, abs(dv[1])))), 1),
            "thickness_ft": round(float(np.median([k["w"] for k in run.values()])), 2), "clear_share": round(walk.count("-") / N, 2), "joined_share": round(walk.count("#") / N, 2), "broken_share": round(walk.count(" ") / N, 2),
            "walk_low_to_high": walk, "_mask": (dist < 0.1 * U) & (t > t0 - 0.05 * U) & (t < t1 + 0.05 * U)}

def measure(f, pid=None):
    pid = pid or Path(f).stem; spec = SPEC[pid]; H = spec["height_ft"]["overall"]
    m = trimesh.load(f, force="mesh")
    pts, fi = trimesh.sample.sample_surface(m, N); pts = np.asarray(pts, float)
    out = {"file": Path(f).name, "tris": int(len(m.faces)), "kb": round(Path(f).stat().st_size / 1024), "native_extent": [round(float(v), 3) for v in np.ptp(m.vertices, axis=0)]}
    # texture: unpainted = alpha 0 or black
    try:
        img = np.asarray(m.visual.material.baseColorTexture.convert("RGBA")).astype(float); out["texture_px"] = list(img.shape[:2])
        bc = trimesh.triangles.points_to_barycentric(m.triangles[fi], pts)
        uv = (m.visual.uv[m.faces[fi]] * bc[:, :, None]).sum(1); h, w = img.shape[:2]
        x = np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int); y = np.clip((1 - uv[:, 1] % 1) * h, 0, h - 1).astype(int)
        t = img[y, x]; bad = (t[:, 3] < 8) | (t[:, :3].max(1) < 4)   # never painted = alpha 0 or pure black; near-black PAINT (a warlock's coat) is not counted (was < 12 in the pilot)
        seen = np.zeros(N, bool); c = np.ptp(pts, axis=0).max() / 160
        for ax, sign in ((1, 1), (0, 1), (0, -1), (2, 1), (2, -1)): seen[extreme(pts, ax, sign, c)] = True
        out["unpainted"] = {"all_surface": round(float(bad.mean()), 4), "seen": round(float(bad[seen].mean()), 4)}
        out["mean_rgb"] = [int(v) for v in t[~bad][:, :3].mean(0)]
        mx, mn = t[~bad][:, :3].max(1), t[~bad][:, :3].min(1); out["mean_saturation"] = round(float(((mx - mn) / np.maximum(mx, 1)).mean()), 3)
    except Exception as e:
        out["texture_error"] = str(e)[:160]
    # pieces
    s = np.ptp(pts[:, 1]); scale = H / s          # first guess: the highest point is the stated overall height
    sh = shaft((pts - [0, pts[:, 1].min(), 0]) * scale, H) if spec.get("shaft") else None
    if sh:   # the creature's own top is the highest point that is not the weapon: size by that, as stated
        body_top = float(np.percentile((pts[:, 1] - pts[:, 1].min())[~sh["_mask"]], 99.9))     # in the mesh's own units
        scale = spec["height_ft"]["figure_top"] / body_top; H = float(s * scale)
        sh = shaft((pts - [0, pts[:, 1].min(), 0]) * scale, H); out["sized_by"] = "the figure's own top, weapon left out"
    else: out["sized_by"] = "its highest point"
    if sh: out["shaft"] = {k: v for k, v in sh.items() if not k.startswith("_")}
    out["overall_ft"] = round(H, 2)
    # connected parts by shared edges, without building a textured mesh per part (m.split copies the 2048 px map each time)
    tm = trimesh.Trimesh(m.vertices, m.faces, process=False); tm.merge_vertices(merge_tex=True, merge_norm=True)   # weld the seams the texture map cut
    groups = trimesh.graph.connected_components(tm.face_adjacency, nodes=np.arange(len(tm.faces)), min_len=1)
    fa = m.area_faces; comps = sorted(groups, key=lambda g: -fa[g].sum()); mainf = comps[0]
    onmain = np.isin(fi, mainf); tree = cKDTree(pts[onmain]); floating = []
    for g in comps[1:]:
        vs = m.vertices[np.unique(m.faces[g])]; d = float(tree.query(vs)[0].min()) * scale
        if d > 0.03: floating.append({"area_share": round(float(fa[g].sum() / m.area), 5), "gap_ft": round(float(d), 2), "size_ft": round(float(np.ptp(vs, axis=0).max() * scale), 2)})
    class _M: area = float(fa[mainf].sum())
    main = _M
    out["pieces"] = {"connected_parts": len(comps), "main_part_area_share": round(float(main.area / m.area), 4), "floating": sorted(floating, key=lambda r: -r["area_share"])[:8], "floating_count": len(floating),
                     "floating_area_share": round(sum(r["area_share"] for r in floating), 5), "watertight": bool(m.is_watertight)}
    # frame: front to +Z (yaw.json, from the blind four-view read), scaled, on the ground
    yaw = YAW.get(pid, {}).get("yaw", 0) if isinstance(YAW.get(pid), dict) else YAW.get(pid, 0); p = roty(pts, yaw) * scale; y0 = p[:, 1].min(); p[:, 1] -= y0
    out.update(yaw_deg=yaw, scale=round(float(scale), 4), y0=round(float(y0), 4), stated_ft=spec["height_ft"], base_ft=spec.get("base_ft", 5), route="fal-ai/trellis-2 1024, 50k faces, 2048 px")
    out["native_bounds"] = [[round(float(v), 4) for v in m.bounds[0]], [round(float(v), 4) for v in m.bounds[1]]]
    # the lighter copies of this figure (tier/): triangles, colour-map size, bytes; and the same file with meshopt or Draco packing
    tiers = {"full": {"file": Path(f).name, "tris": int(len(m.faces)), "tex": int(out.get("texture_px", [0])[0]), "kb": out["kb"], "normal_map": False}}
    for key in ("5k256", "5k512", "8k512", "20k1024", "20kbake"):
        t = Path(f).with_name(f"{pid}--{key}.glb")
        if not t.exists(): continue
        tm = trimesh.load(t, force="mesh"); tx = tm.visual.material.baseColorTexture
        tiers[key] = {"file": t.name, "tris": int(len(tm.faces)), "tex": int(tx.size[0]) if tx is not None else 0, "kb": round(t.stat().st_size / 1024), "normal_map": key == "20kbake"}
    for key, t in tiers.items():
        for pack in ("meshopt", "draco"):
            pf = HERE / "tier/packed" / f"{pid}--{key}.{pack}.glb"
            if pf.exists(): t[f"kb_{pack}"] = round(pf.stat().st_size / 1024)
    out["tiers"] = tiers
    # ground contacts: islands in the lowest slab
    slab = 0.035 * H; cell = H / 240
    feet = islands(p, 0, 0.09 * H, cell); hullpts = p[:, [0, 2]]
    from scipy.spatial import ConvexHull
    hull_area = float(ConvexHull(hullpts[::40]).volume)
    low = p[p[:, 1] < 0.02 * H]; lx = np.floor((low[:, 0] - p[:, 0].min()) / cell).astype(int); lz = np.floor((low[:, 2] - p[:, 2].min()) / cell).astype(int)
    occ = np.zeros((lx.max() + 2, lz.max() + 2), bool); occ[lx, lz] = True; low_area = float(ndi.binary_fill_holes(ndi.binary_closing(occ)).sum() * cell * cell)
    contacts = []
    for k in feet:
        q = k["pts"]; cx = np.floor((q[:, 0] - q[:, 0].min()) / cell).astype(int); cz = np.floor((q[:, 2] - q[:, 2].min()) / cell).astype(int)
        lowm = np.full((cx.max() + 1, cz.max() + 1), np.inf); np.minimum.at(lowm, (cx, cz), q[:, 1]); v = lowm[np.isfinite(lowm)]
        contacts.append({"x": round(k["x"], 2), "z": round(k["z"], 2), "size_ft": [round(k["w"], 2), round(k["l"], 2)], "off_ground_ft": round(float(q[:, 1].min()), 3),
                         "sole_level_share": round(float((v < q[:, 1].min() + 0.06).mean()), 2), "sole_p90_ft": round(float(np.percentile(v, 90)), 3)})
    out["ground"] = {"contacts": contacts, "contact_count": len(contacts), "max_off_ground_ft": max((c["off_ground_ft"] for c in contacts), default=None),
                     "lowest_slab_area_sqft": round(low_area, 2), "plan_hull_area_sqft": round(hull_area, 2), "lowest_slab_share_of_plan": round(low_area / hull_area, 3)}
    # columns: islands per slice
    prof = []
    for i in range(20):
        a, b = H * i / 20, H * (i + 1) / 20; isl = islands(p, a, b, cell * 1.5)
        prof.append({"from_ft": round(a, 2), "n": len(isl), "widths_ft": [round(k["w"], 2) for k in isl[:4]]})
    out["columns"] = prof
    # plan and centre for the base: the middle of what touches the ground; reach = how far anything is from it
    # the base's centre: the middle of the smallest circle round everything that touches the ground
    g2 = p[p[:, 1] < 0.09 * H][:, [0, 2]][::5]; cc = g2.mean(0)
    for it in range(400): far = g2[np.argmax(np.hypot(*(g2 - cc).T))]; cc = cc + (far - cc) / (it + 2)
    gx, gz = float(cc[0]), float(cc[1]); ground_r = float(np.hypot(*(g2 - cc).T).max())
    r = np.hypot(p[:, 0] - gx, p[:, 2] - gz)
    out["plan"] = {"size_ft": {"w": round(float(np.ptp(p[:, 0])), 2), "d": round(float(np.ptp(p[:, 2])), 2), "h": round(H, 2)}, "centre": [round(float(gx), 3), round(float(gz), 3)],
                   "contacts_radius_ft": round(ground_r, 2),
                   "reach_radius_ft": round(float(np.percentile(r, 99.8)), 2), "share_outside_2p5ft": round(float((r > 2.5).mean()), 3)}
    plate = PLATES / f"{pid}.png"
    (HERE / "work").mkdir(exist_ok=True)
    if plate.exists(): out["silhouette"] = silhouette(pts, plate, HERE / "work" / f"{pid}.outline.png")
    return pid, out

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")] or [str(HERE / "web-models")]
    files = []
    for a in args: files += sorted(f for f in Path(a).glob("*.glb") if "--" not in f.name) if Path(a).is_dir() else [Path(a)]
    kit = {}
    for f in files:
        pid, o = measure(f); kit[pid] = o
        print(f"\n== {pid}: {o['plan']['size_ft']} tris {o['tris']} {o['kb']} KB unpainted {o.get('unpainted')} sat {o.get('mean_saturation')}")
        print("   pieces", {k: v for k, v in o["pieces"].items() if k != "floating"}, o["pieces"]["floating"][:3])
        print("   ground", json.dumps(o["ground"]))
        print("   columns", " ".join(f"{c['n']}" for c in o["columns"]), " widths@mid", o["columns"][8]["widths_ft"])
        print("   shaft", o.get("shaft"), "sized by", o["sized_by"], "overall", o["overall_ft"], "scale", o["scale"])
        print("   plan", o["plan"], " silhouette", o.get("silhouette"), flush=True)
    if "--kit" in sys.argv: (HERE / "kit.json").write_text(json.dumps(kit, indent=1) + "\n"); print("kit.json", len(kit))
