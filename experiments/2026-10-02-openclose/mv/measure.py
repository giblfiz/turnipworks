"""Measure multi-view (and single-view) chest parts: cavity depth, rim level, holes, lid underside.
blender --background --python mv/measure.py"""
import sys, json, math
HERE = "experiments/2026-10-02-openclose"
sys.path.insert(0, HERE)
import bpy
from mathutils import Vector
import build as B

SRC = {"single-body": f"{HERE}/models/chest-ib--body.glb", "single-lid": f"{HERE}/models/chest-ib--lid.glb",
       "trellis-body": f"{HERE}/mv/models/trellis-body.glb", "trellis-lid": f"{HERE}/mv/models/trellis-lid.glb",
       "hunyuan-body": f"{HERE}/mv/models/hunyuan-body.glb", "hunyuan-lid": f"{HERE}/mv/models/hunyuan-lid.glb"}
out = {}
for k, p in SRC.items():
    B.reset()
    o = B.load_joined(p, k)
    src = len(o.data.polygons)
    B.decimate(o, 60000)
    # normalise: width (x) = 1, bottom-centre origin
    B.to_bottom_centre(o)
    lo, hi = B.bounds(o)
    s = 1.0 / (hi.x - lo.x)
    B.scale_mesh(o, s, s, s)
    lo, hi = B.bounds(o)
    d = hi - lo
    bvh = B.bvh_of(o)
    nb = sum(1 for e in __import__("bmesh").new().edges)  # placeholder
    import bmesh
    bm = bmesh.new(); bm.from_mesh(o.data)
    boundary = sum(1 for e in bm.edges if e.is_boundary); bm.free()
    rec = {"src_faces": src, "dims_xyz": [round(x, 3) for x in d], "boundary_edges": boundary}
    vs = [v.co for v in o.data.vertices]
    if "body" in k:
        H = d.z
        # rim heights per side (top of each wall)
        sides = {"front(-y)": [v.z for v in vs if v.y < lo.y + 0.12 * d.y and abs(v.x) < 0.35],
                 "back(+y)": [v.z for v in vs if v.y > hi.y - 0.12 * d.y and abs(v.x) < 0.35],
                 "left(-x)": [v.z for v in vs if v.x < lo.x + 0.1 and abs(v.y - (lo.y + hi.y) / 2) < 0.25 * d.y],
                 "right(+x)": [v.z for v in vs if v.x > hi.x - 0.1 and abs(v.y - (lo.y + hi.y) / 2) < 0.25 * d.y]}
        rim = {kk: round(max(z) / H, 3) for kk, z in sides.items() if z}
        rec["rim_top_frac_by_side"] = rim
        rec["rim_level_spread_frac"] = round(max(rim.values()) - min(rim.values()), 3)
        # cavity: rays straight down at a 3x3 grid inside the rim
        cy = (lo.y + hi.y) / 2
        hits = []
        for fx in (-0.2, 0, 0.2):
            for fy in (-0.2, 0, 0.2):
                h = bvh.ray_cast(Vector((fx * d.x, cy + fy * d.y, hi.z + 1)), Vector((0, 0, -1)))
                hits.append(h[0].z if h[0] else None)
        rimz = min(rim.values()) * H
        fl = sorted(z for z in hits if z is not None)
        floor = fl[len(fl) // 2] if fl else None
        rec["cavity_depth_frac_of_rim"] = round((rimz - floor) / rimz, 3) if floor is not None else None
        # holes: horizontal rays from outside; a hit far deeper than a wall (or none) means we saw through the wall
        holes = n = 0
        for f in (0.15, 0.35, 0.55, 0.75):
            z = f * min(rim.values()) * H
            for g in (0.15, 0.3, 0.5, 0.7, 0.85):
                x = lo.x + d.x * g; y = lo.y + d.y * g
                for org, dirv, face in (((x, lo.y - 1, z), (0, 1, 0), lo.y), ((x, hi.y + 1, z), (0, -1, 0), hi.y),
                                        ((lo.x - 1, y, z), (1, 0, 0), lo.x), ((hi.x + 1, y, z), (-1, 0, 0), hi.x)):
                    h = bvh.ray_cast(Vector(org), Vector(dirv)); n += 1
                    depth = abs((h[0] - Vector(org)).dot(Vector(dirv))) - 1 if h[0] else 9
                    holes += depth > 0.2  # 0.2 of chest width ~ 7 in: through the wall
        rec["see_through_rays"] = f"{holes}/{n}"
    else:
        H = d.z
        cy = (lo.y + hi.y) / 2
        ups = []
        for fx in (-0.2, 0, 0.2):
            for fy in (-0.15, 0, 0.15):
                h = bvh.ray_cast(Vector((fx * d.x, cy + fy * d.y, lo.z - 1)), Vector((0, 0, 1)))
                ups.append(round((h[0].z - lo.z) / H, 3) if h[0] else None)
        good = sorted(u for u in ups if u is not None)
        med = good[len(good) // 2] if good else None
        rec["underside_first_hit_frac_of_height"] = med
        rec["underside"] = "hollow" if med is not None and med > 0.35 else ("solid block" if med is not None else "open/no hit")
    out[k] = rec
    print("MEASURE", k, json.dumps(rec), flush=True)
json.dump(out, open(f"{HERE}/mv/measurements.json", "w"), indent=1)
