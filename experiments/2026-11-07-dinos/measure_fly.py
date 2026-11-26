#!/usr/bin/env python3
# COPY of ../2026-11-06-pawns/fly/measure_fly.py (dinos lane, 2026-11-07): the same size rule and tiers, on THIS pack's
# pterosaurs: standing rows from set/published/manifest.json, flying meshes set/models/<id>-fly.glb, everything written to
# set/published/fly/ (qa/, tiers/, models -> USB, thumbs/, manifest.json), the PACK's own fly manifest that
# tools/spawn-tuner/build_figures.py reads (2026-11-07). Gemini's blind reads of the flying poses: set/published/fly/blind.json.
"""Measure each flying mesh, size it to its standing figure, cut the two shipping tiers, and write the manifest row.
    ~/.local/share/tw-trimesh-venv/bin/python measure_fly.py [ids...]      -> qa/<id>.json, tiers/, manifest.json

THE SIZE RULE (one line): the flying figure gets the SAME BODY VOLUME as its standing figure, in cubic feet.
  k_fly = cbrt(V_standing_ft3 / V_fly_native)     V = the solid volume (the mesh voxelised at 1/120 of its size, filled).
  Volume does not change with pose: a creature that unfolds its wings and stretches out its neck and tail keeps the
  same body, where height (the standing rule) or length would shrink or grow it with the pose.
The rest is the standing figure's frame: yaw so it faces +Z, y0 its lowest point, centre the middle of its body in plan
(the volume centroid: over a base there is nothing touching the ground to centre on), all in the engine's terms."""
import hashlib, json, subprocess, sys, time
from pathlib import Path
import numpy as np, trimesh
sys.path.insert(0, str(Path(__file__).resolve().parent))
LANE = Path(__file__).resolve().parent; ROOT = LANE.parents[1]
SET = LANE / "set/published"; HERE = SET / "fly"; HERE.mkdir(parents=True, exist_ok=True)
MODELS = LANE / "set/models"
FLIERS = ["foe-pterodactyl", "foe-quetzalcoatlus"]
def standing(): return {f["id"]: f for f in json.loads((SET / "manifest.json").read_text())["figures"]}

TIERS = {"hero": ("20k1024", 20000, 1024), "horde": ("8k512", 8000, 512)}
YAW = json.loads((HERE / "yaw.json").read_text()) if (HERE / "yaw.json").exists() else {}
GEM = json.loads((HERE / "blind.json").read_text()) if (HERE / "blind.json").exists() else {}


def load(p):
    s = trimesh.load(p, force="scene")
    return s.to_geometry() if hasattr(s, "to_geometry") else s.dump(concatenate=True)


def volume(m, n=120, close=4):   # (4: the red dragon's gap closes at 4; from 4 to 8 voxels every mesh tried moves under 8%)
    """The solid volume. These meshes are not closed (TRELLIS: open seams, doubled shells), and a voxel shell with a gap
    fills to nothing (the standing red dragon: shell 65231 voxels, filled 65278). So the shell is CLOSED first: grown by
    `close` voxels, the inside filled, then shrunk back by the same amount (a morphological closing round the fill)."""
    from scipy import ndimage
    pitch = float(np.max(m.extents)) / n
    sh = m.voxelized(pitch); g = np.pad(sh.matrix, close + 1)
    g = ndimage.binary_dilation(g, iterations=close); g = ndimage.binary_fill_holes(g); g = ndimage.binary_erosion(g, iterations=close)
    g |= np.pad(sh.matrix, close + 1)
    idx = np.argwhere(g) - (close + 1)
    pts = trimesh.transform_points(idx.astype(float), sh.transform)
    class V: pass
    v = V(); v.points = pts; v.filled_count = int(g.sum())
    return float(g.sum()) * pitch ** 3, v


def roty(p, deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a)
    return p @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]]).T   # three.js rotation.y: x' = x cos + z sin, z' = -x sin + z cos


def one(i, S):
    src = MODELS / f"{i}-fly.glb"
    if not src.exists(): return None
    st = S[i]
    sm = load(SET / st["files"]["full"]); fm = load(src)
    vs, _ = volume(sm); vf, vox = volume(fm)
    vs_ft = vs * st["scale"] ** 3
    k = float(np.cbrt(vs_ft / vf))
    k_area = float(np.sqrt(sm.area * st["scale"] ** 2 / fm.area))   # a cross-check (area grows with spread wings a little)
    yaw = float(YAW.get(i, 0))
    p = roty(np.asarray(fm.vertices), yaw) * k
    y0 = float(np.asarray(fm.vertices)[:, 1].min())
    cen = roty(np.asarray(vox.points), yaw) * k              # the filled voxels' centres: the body's centroid in plan
    centre = [round(float(cen[:, 0].mean()), 3), round(float(cen[:, 2].mean()), 3)]
    h = float(np.ptp(p[:, 1])); span = float(max(np.ptp(p[:, 0]), np.ptp(p[:, 2])))
    reach = float(np.max(np.hypot(p[:, 0] - centre[0], p[:, 2] - centre[1])))
    m2 = fm.copy(); m2.merge_vertices(merge_tex=True, merge_norm=True)   # (texture seams welded, then pieces counted: fm.split() hangs on these meshes)
    lab = trimesh.graph.connected_component_labels(m2.face_adjacency, node_count=len(m2.faces))
    areas = np.bincount(lab, weights=m2.area_faces); main = int(np.argmax(areas))
    loose = [a_ for k_, a_ in enumerate(areas) if k_ != main and a_ > 0]
    loose_share = float(sum(loose) / m2.area)
    (HERE / "tiers").mkdir(exist_ok=True)
    tris = {"full": int(len(fm.faces))}; kb = {"full": round(src.stat().st_size / 1024)}; notes = []
    for key, (name, faces, tex) in TIERS.items():
        out = HERE / "tiers" / f"{i}-fly--{name}.glb"
        if not out.exists() or out.stat().st_mtime < src.stat().st_mtime:
            r = subprocess.run(["blender", "--background", "--python", str(ROOT / "src/optimize_glb_blender.py"), "--", str(src), str(out), "--faces", str(faces), "--texture-size", str(tex)], capture_output=True, text=True)
            m = next((l for l in r.stdout.splitlines() if l.startswith("TW_OPTIMIZE=")), None)
            if not (m and out.exists()): notes.append(f"tier {name} could not be made"); continue
        tm = load(out); tris[key] = int(len(tm.faces)); kb[key] = round(out.stat().st_size / 1024)
    sha = hashlib.sha1(src.read_bytes()).hexdigest()
    if abs(k_area / k - 1) > 0.25: notes.append(f"volume and area disagree on the size: k {k:.3f} by volume, {k_area:.3f} by area")
    q = {"id": i, "sha1": sha, "scale": round(k, 4), "k_by_area": round(k_area, 4), "y0": round(y0, 4), "centre": centre, "facing_deg": yaw,
         "height_ft": round(h, 2), "overall_ft": round(h, 2), "span_ft": round(span, 2), "reach_ft": round(reach, 2),
         "volume_ft3": {"standing": round(vs_ft, 2), "fly": round(vf * k ** 3, 2)}, "standing_height_ft": st["height_ft"],
         "loose": {"pieces": len(loose), "area_share": round(float(loose_share), 4)}, "tris": tris, "kb": kb, "notes": notes, "at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    (HERE / "qa").mkdir(exist_ok=True); (HERE / "qa" / f"{i}.json").write_text(json.dumps(q, indent=1) + "\n")
    return q


def manifest():
    import os
    if not (HERE / "models").exists(): os.symlink(os.path.realpath(MODELS), HERE / "models")
    rows = []
    for i in FLIERS:
        qf = HERE / "qa" / f"{i}.json"
        if not qf.exists(): continue
        q = json.loads(qf.read_text())
        if q.get("rejected") or GEM.get(i, {}).get("accept") is False: continue
        if not all(k in q["tris"] for k in ("full", "hero", "horde")): continue
        g = GEM.get(i, {})
        rows.append({"id": i, "files": {"full": f"models/{i}-fly.glb", "hero": f"tiers/{i}-fly--20k1024.glb", "horde": f"tiers/{i}-fly--8k512.glb"},
                     "scale": q["scale"], "y0": q["y0"], "centre": q["centre"], "facing_deg": q["facing_deg"], "height_ft": q["height_ft"], "overall_ft": q["overall_ft"],
                     "span_ft": q["span_ft"], "tris": q["tris"], "kb": q["kb"], "sha1": q["sha1"],
                     **({"thumb": f"thumbs/{i}-fly.webp"} if (HERE / "thumbs" / f"{i}-fly.webp").exists() else {}),
                     "gemini": {"blind": g.get("blind"), "flying": g.get("flying"), "creature_guess": g.get("creature_guess")}})
    now = time.strftime("%Y-%m-%dT%H:%M:%S%z"); now = now[:-2] + ":" + now[-2:]
    (HERE / "manifest.json").write_text(json.dumps({"updated": now, "figures": rows}, indent=1) + "\n")
    print("manifest:", len(rows), "flying figures")


if __name__ == "__main__":
    S = standing(); ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--manifest-only" not in sys.argv:
        for i in ids or FLIERS:
            q = one(i, S)
            if q: print(i, "k", q["scale"], "h", q["height_ft"], "span", q["span_ft"], "standing h", q["standing_height_ft"], "vol", q["volume_ft3"], "loose", q["loose"], q["notes"], flush=True)
    manifest()
