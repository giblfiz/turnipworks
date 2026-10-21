#!/usr/bin/env python3
"""Measure the slope-kit meshes instead of eyeballing them (run in a venv with trimesh, scipy, shapely):
    ~/.local/share/tw-trimesh-venv/bin/python measure.py            # web-models/*.glb (see select.py) -> kit.json
For every mesh: orient it (uphill = -Z; corners: high corner at -X,-Z), scale it to its target footprint, then from a
0.25-ft height map of the top surface and one of the underside report
  bounds, the slope of the main face, how flat the underside is, whether the low edge feathers out or stands on a
  slab, and AUTO-DETECTED flat standing zones: connected patches whose surface is within 15 degrees of level (measured
  at ~1 ft scale so paint-bump noise does not count) that hold a 5-ft or a 2.5-ft circle (a miniature's base).
"""
import json, math, sys
from pathlib import Path
import numpy as np, trimesh
from scipy import ndimage as ndi
from shapely.geometry import MultiPoint
HERE = Path(__file__).resolve().parent
CELL = 0.25       # ft
FLAT_DEG = 15.0
KIND = {"slope-bank-5": "wedge", "slope-bank-10": "wedge", "slope-ramp-path": "wedge", "slope-ledges": "wedge", "slope-ledges-2": "wedge", "slope-scree": "wedge",
        "slope-corner-out": "corner", "slope-corner-in": "corner", "slope-mound": "round", "slope-outcrop": "round"}

def heightmaps(pts):
    """pts: Nx3 (x, y up, z). -> top H, bottom B (nan outside), x0, z0"""
    x0, z0 = pts[:, 0].min(), pts[:, 2].min()
    ix = np.floor((pts[:, 0] - x0) / CELL).astype(int); iz = np.floor((pts[:, 2] - z0) / CELL).astype(int)
    nx, nz = ix.max() + 1, iz.max() + 1
    flat = iz * nx + ix
    H = np.full(nx * nz, -np.inf); B = np.full(nx * nz, np.inf); N = np.zeros(nx * nz)
    np.maximum.at(H, flat, pts[:, 1]); np.minimum.at(B, flat, pts[:, 1]); np.add.at(N, flat, 1)
    H, B, N = H.reshape(nz, nx), B.reshape(nz, nx), N.reshape(nz, nx)
    mask = ndi.binary_fill_holes(ndi.binary_closing(N > 0, iterations=2)) & (N > 0)
    H[~mask] = np.nan; B[~mask] = np.nan
    return H, B, mask, x0, z0

def smooth(H, mask, sigma_ft):
    s = sigma_ft / CELL
    v = ndi.gaussian_filter(np.where(mask, H, 0.0), s); w = ndi.gaussian_filter(mask.astype(float), s)
    out = np.where(w > 1e-6, v / np.maximum(w, 1e-6), np.nan); out[~mask] = np.nan
    return out

def grads(Hs, mask):
    gz, gx = np.gradient(np.where(mask, Hs, np.nan), CELL)
    ok = mask & np.isfinite(gx) & np.isfinite(gz)
    return gx, gz, ok

def roty(pts, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)   # three.js rotation.y = a
    out = pts.copy(); out[:, 0] = c * pts[:, 0] + s * pts[:, 2]; out[:, 2] = -s * pts[:, 0] + c * pts[:, 2]
    return out

def disc(r_ft):
    n = int(math.ceil(r_ft / CELL)); jj, kk = np.mgrid[-n:n + 1, -n:n + 1]
    return (np.hypot(jj, kk) * CELL) <= r_ft

def find_zones(H, mask, X, Z):
    """Flat standing zones. A cell is level if the surface (smoothed over ~0.3 ft so paint bumps do not count) is within
    15 degrees of horizontal. A base of radius r stands at a cell if every cell under it is level AND the surface under
    it rises or falls by no more than a 15-degree tilt would (2r tan 15). Bases are then packed without overlapping."""
    Hs = smooth(H, mask, 0.3)
    gx, gz, ok = grads(Hs, mask)
    ang = np.degrees(np.arctan(np.hypot(gx, gz)))
    level = ok & (ang < FLAT_DEG)
    Hf = np.where(mask, H, np.nan)
    out = {"level_share": round(float(level.sum() / max(1, ok.sum())), 3)}
    taken = {}
    for name, r in (("5ft", 2.5), ("2.5ft", 1.25)):
        d = disc(r - CELL / 2)
        fits = ndi.binary_erosion(level, structure=d)
        hi = ndi.maximum_filter(np.where(mask, H, -1e9), footprint=d); lo = ndi.minimum_filter(np.where(mask, H, 1e9), footprint=d)
        rng = hi - lo
        fits &= rng <= 2 * r * math.tan(math.radians(FLAT_DEG))
        score = np.where(fits, -rng, -np.inf)                  # best seat first: the least height change under the base
        bases = []
        while np.isfinite(score.max()) and len(bases) < 60:
            j, k = np.unravel_index(np.argmax(score), score.shape)
            bases.append({"x": round(X(k), 2), "y": round(float(Hs[j, k]), 2), "z": round(Z(j), 2), "range_ft": round(float(rng[j, k]), 2)})
            jj, kk = np.indices(score.shape); score[np.hypot(jj - j, kk - k) * CELL < 2 * r] = -np.inf
        lab, n = ndi.label(fits)
        out[name] = {"bases": bases, "regions": int(n), "heights_ft": sorted({round(b["y"] * 2) / 2 for b in bases})}
    return out, Hs, ang, ok

def wedge_profile(H, nx, nz, Z):
    xs = slice(int(nx * 0.2), int(nx * 0.8))
    with np.errstate(all="ignore"):
        import warnings; warnings.simplefilter("ignore")
        prof = np.nanmedian(H[:, xs], axis=1)
    zz = np.array([Z(j) for j in range(nz)]); good = np.isfinite(prof)
    lo, hi = np.nanpercentile(prof[good], 5), np.nanpercentile(prof[good], 95)
    mid = good & (prof > lo + 0.15 * (hi - lo)) & (prof < lo + 0.85 * (hi - lo))
    m, b = np.polyfit(zz[mid], prof[mid], 1)
    rms = float(np.sqrt(np.mean((np.polyval([m, b], zz[mid]) - prof[mid]) ** 2)))
    g = np.where(good)[0]
    back = float(np.nanmedian(prof[g[:4]])); front = float(np.nanmedian(prof[g[-2:]]))
    return abs(math.degrees(math.atan(m))), rms, back, front, prof

def measure(path, target, kind, aid):
    mesh = trimesh.load(path, force="mesh")
    rec = {"faces": int(len(mesh.faces)), "raw_extents": [round(float(v), 4) for v in mesh.extents]}
    pts, _ = trimesh.sample.sample_surface(mesh, 3_000_000)
    pts = np.asarray(pts, dtype=np.float64)
    # --- orientation: the footprint's minimum rectangle gives the axes; the mean uphill direction picks which of the four turns
    hull = MultiPoint(pts[::200, [0, 2]]).convex_hull
    rect = np.array(hull.minimum_rotated_rectangle.exterior.coords)[:4]
    e = rect[1] - rect[0]; rect_deg = math.degrees(math.atan2(e[1], e[0]))
    p0 = pts * (20.0 / np.ptp(pts, axis=0).max())
    H, B, mask, _, _ = heightmaps(p0)
    gx, gz, ok = grads(smooth(H, mask, 0.75), mask)
    up = np.array([np.nanmean(gx[ok]), np.nanmean(gz[ok])])
    want = {"wedge": (0, -1), "corner": (-1, -1), "round": None}[kind]
    best, yaw = -9, rect_deg
    for k in range(4):
        if want is None: break
        cand = rect_deg + 90 * k
        if kind == "corner":
            # outside corner: the HIGHEST footprint corner goes to -X,-Z. inside corner: the LOWEST goes to +X,+Z.
            q = roty(p0, cand); qx = (q[:, 0] - q[:, 0].min()) / np.ptp(q[:, 0]); qz = (q[:, 2] - q[:, 2].min()) / np.ptp(q[:, 2])
            top = lambda sel: float(np.percentile(q[sel, 1], 98)) if sel.sum() > 50 else -1e9
            if aid.startswith("slope-corner-in"): score = -top((qx > 0.75) & (qz > 0.75)) + 0.25 * (top((qx < 0.25) & (qz > 0.75)) + top((qx > 0.75) & (qz < 0.25)))
            else: score = top((qx < 0.25) & (qz < 0.25)) - 0.5 * (top((qx > 0.75) & (qz < 0.25)) + top((qx < 0.25) & (qz > 0.75)))
        else:
            a = math.radians(cand); c, s = math.cos(a), math.sin(a)
            u = np.array([c * up[0] + s * up[1], -s * up[0] + c * up[1]])
            score = float(np.dot(u / (np.linalg.norm(u) + 1e-9), np.array(want) / np.linalg.norm(want)))
        if score > best: best, yaw = score, cand
    yaw = (yaw + 180) % 360 - 180
    pts = roty(pts, yaw)
    ext = np.ptp(pts, axis=0)
    s = (target[0] / ext[0]) if kind == "wedge" else max(target[0], target[1]) / max(ext[0], ext[2])
    pts *= s
    lo3, hi3 = pts.min(axis=0), pts.max(axis=0)
    cx, cz = (lo3[0] + hi3[0]) / 2, (lo3[2] + hi3[2]) / 2
    y0 = float(np.percentile(pts[:, 1], 0.2))
    pts -= np.array([cx, y0, cz])                              # canonical frame: footprint centred, underside at 0
    rec.update({"yaw_deg": round(yaw, 2), "scale": round(float(s), 5), "center": [round(float(cx), 4), round(float(cz), 4)], "y0": round(y0, 4), "target_ft": target})

    def analyse(P):
        H, B, mask, x0, z0 = heightmaps(P)
        nz, nx = H.shape
        X = lambda i: x0 + (i + 0.5) * CELL; Z = lambda j: z0 + (j + 0.5) * CELL
        r = {"size_ft": [round(float(np.ptp(P[:, 0])), 2), round(float(np.ptp(P[:, 2])), 2), round(float(np.nanpercentile(H, 99.5)), 2)]}
        zones, Hs, ang, ok = find_zones(H, mask, X, Z)
        r["zones"] = zones
        bins = [("level <15", 0, 15), ("gentle 15-25", 15, 25), ("about 30 (25-40)", 25, 40), ("steep 40-60", 40, 60), ("cliff >60", 60, 91)]
        r["plan_area_share"] = {n: round(float(((ang >= a) & (ang < b) & ok).sum() / ok.sum()), 3) for n, a, b in bins}
        rim = mask & ~ndi.binary_erosion(mask, iterations=2)
        r["rim_h_ft"] = {"p10": round(float(np.nanpercentile(H[rim], 10)), 2), "median": round(float(np.nanmedian(H[rim])), 2)}
        if kind == "wedge":
            deg, rms, back, front, prof = wedge_profile(H, nx, nz, Z)
            r.update({"main_slope_deg": round(deg, 1), "main_slope_fit_rms_ft": round(rms, 2), "top_edge_h_ft": round(back, 2), "foot_lip_ft": round(front, 2),
                      "profile_back_to_front_every_0.5ft": [None if not np.isfinite(v) else round(float(v), 2) for v in prof[::2]]})
            j, k = nz // 2, nx // 2
            r["mid_slope_point"] = [round(X(k), 2), round(float(Hs[j, k]), 2), round(Z(j), 2)]; r["mid_slope_deg"] = round(float(ang[j, k]), 1)
        else:
            sl = ok & (ang >= 15) & (ang < 60)
            r["main_slope_deg"] = round(float(np.nanmedian(ang[sl])), 1) if sl.sum() > 20 else None
            if kind == "corner":
                q = max(3, int(1.0 / CELL)); r["top_edge_h_ft"] = round(float(np.nanmedian(H[:q, :q])), 2)
                r["foot_lip_ft"] = round(float(np.nanpercentile(H[rim], 10)), 2)
            elif aid.startswith("slope-mound"):
                r["top_edge_h_ft"] = r["size_ft"][2]; r["foot_lip_ft"] = round(float(np.nanpercentile(H[rim], 10)), 2)
            else:
                r["top_edge_h_ft"] = round(float(np.nanpercentile(H, 90)), 2); r["foot_lip_ft"] = 0.0
        thick = mask & (H > 0.75)
        r["underside"] = {"flat_on_ground_share": round(float((thick & (B < 0.15)).sum() / max(1, thick.sum())), 3),
                          "hollow_median_gap_ft": round(float(np.nanmedian(B[thick])), 2) if thick.any() else None}
        return r

    rec["native"] = analyse(pts)                               # as generated: only turned and scaled as one
    n = rec["native"]
    # fit: stretch so the footprint is the designed size and the top edge is the designed rise above the ground, with the
    # piece sunk by its foot lip so the low edge meets the ground (what a person placing it would do by hand)
    lip = 0.0 if aid.startswith("slope-ledges") else max(0.0, n["foot_lip_ft"] or 0.0)   # a stepped piece starts with a riser, not a lip
    f = [target[0] / n["size_ft"][0], target[2] / max(0.1, n["top_edge_h_ft"] - lip), target[1] / n["size_ft"][1]]
    Pf = pts * np.array(f); Pf[:, 1] -= lip * f[1]
    rec["fit"] = analyse(Pf); rec["fit"]["f"] = [round(v, 4) for v in f]; rec["fit"]["sink_ft"] = round(lip * f[1], 3)
    return rec

REF_GRASS = None
def lin(c): c = np.asarray(c, float) / 255; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def grass_colour(path):
    """Mean colour of the piece's grass (green-dominant texels on the surface seen from above) against the game's grass
    tile, and the multiplier that brings it onto the tile's colour (linear light; the viewer applies it as a tint)."""
    global REF_GRASS
    from PIL import Image
    if REF_GRASS is None:
        REF_GRASS = np.asarray(Image.open(HERE.parents[1] / "tools/spawn-tuner/assets/flat/floor-grass.webp").convert("RGB")).reshape(-1, 3).astype(float)
    m = trimesh.load(path, force="mesh")
    img = np.asarray(m.visual.material.baseColorTexture.convert("RGB")).astype(float)
    pts, fi = trimesh.sample.sample_surface(m, 400000)
    bc = trimesh.triangles.points_to_barycentric(m.triangles[fi], pts)
    uv = (m.visual.uv[m.faces[fi]] * bc[:, :, None]).sum(1)
    h, w = img.shape[:2]
    t = img[np.clip((1 - uv[:, 1] % 1) * h, 0, h - 1).astype(int), np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int)]
    c = np.ptp(pts, axis=0).max() / 150
    key = np.floor((pts[:, 0] - pts[:, 0].min()) / c).astype(int) * 1000 + np.floor((pts[:, 2] - pts[:, 2].min()) / c).astype(int)
    order = np.lexsort((pts[:, 1], key)); k = key[order]; top = order[np.r_[k[1:] != k[:-1], True]]
    t = t[top]; g = t[(t[:, 1] > t[:, 0] * 1.08) & (t[:, 1] > t[:, 2] * 1.3) & (t.max(1) > 30)]
    if len(g) < 200: return None
    mean = g.mean(0); ref = REF_GRASS.mean(0)
    tint = np.clip(lin(ref) / np.maximum(lin(mean), 1e-4), 0.5, 2.0)
    return {"grass_rgb": [int(round(v)) for v in mean], "ground_rgb": [int(round(v)) for v in ref], "grass_share_of_top": round(len(g) / len(t), 2),
            "tint_linear": [round(float(v), 3) for v in tint]}

def main():
    spec = {a["id"]: a for a in json.loads((HERE / "assets.json").read_text())["assets"]}
    src = HERE / "web-models"
    out = {}
    only = set(sys.argv[1:])
    for glb in sorted(src.glob("*.glb")):
        aid = glb.stem; base = aid.split("--")[0]
        if only and aid not in only: continue
        if base not in spec: continue
        out[aid] = measure(glb, spec[base]["dims_ft"], KIND[base], aid); out[aid]["kind"] = KIND[base]; out[aid]["file"] = glb.name; out[aid]["colour"] = grass_colour(glb); print(aid, "colour", out[aid]["colour"])
        for m in ("native", "fit"):
            r = out[aid][m]; print(aid, m, r["size_ft"], "slope", r.get("main_slope_deg"), "top", r["top_edge_h_ft"], "lip", r["foot_lip_ft"], "| 5ft bases", len(r["zones"]["5ft"]["bases"]), r["zones"]["5ft"]["heights_ft"], "| 2.5ft bases", len(r["zones"]["2.5ft"]["bases"]), r["zones"]["2.5ft"]["heights_ft"], "| underside", r["underside"], flush=True)
    kit = HERE / "kit.json"
    old = json.loads(kit.read_text()) if kit.exists() and only else {}
    old.update(out); kit.write_text(json.dumps(old, indent=1) + "\n")
if __name__ == "__main__":
    main()
