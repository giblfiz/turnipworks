import sys, json
sys.path.insert(0, "experiments/2026-10-02-openclose")
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bl_common import load_joined, bounds
SRC = {
 "body": "models/chest-ib--body.glb", "lid": "models/chest-ib--lid.glb", "open": "models/chest-ib--open.glb",
 "closed": "experiments/2026-09-30-inn-01-500/models/chest-ironbound.glb",
}
out = {}
for k, p in SRC.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    o = load_joined(p, k)
    lo, hi = bounds(o); d = hi - lo
    vs = [v.co.copy() for v in o.data.vertices]
    H = d.z
    prof = []
    for i in range(10):
        a, b = lo.z + i*H/10, lo.z + (i+1)*H/10
        sl = [v for v in vs if a <= v.z < b]
        if sl:
            prof.append([round(i/10,1), round(max(v.y for v in sl)-min(v.y for v in sl),3), round(max(v.x for v in sl)-min(v.x for v in sl),3), round(min(v.y for v in sl),3), round(max(v.y for v in sl),3)])
    # front: centre column protrusion at mid-lower height
    mid = [v for v in vs if abs(v.x-(lo.x+hi.x)/2) < 0.08*d.x and lo.z+0.2*H < v.z < lo.z+0.6*H]
    side = [v for v in vs if abs(v.x-(lo.x+hi.x)/2) > 0.3*d.x and lo.z+0.2*H < v.z < lo.z+0.6*H]
    bvh = BVHTree.FromObject(o, bpy.context.evaluated_depsgraph_get())
    cav = []
    for fx in (-0.2, 0, 0.2):
        for fy in (-0.15, 0, 0.15):
            org = Vector(((lo.x+hi.x)/2 + fx*d.x, (lo.y+hi.y)/2 + fy*d.y, hi.z + 1))
            hit = bvh.ray_cast(org, Vector((0,0,-1)))
            cav.append(round((hit[0].z-lo.z)/H, 2) if hit[0] else None)
    # rim heights per side (top 1/3 vertices near each wall)
    rim = {}
    for nm, f in {"front(-y)": lambda v: v.y < lo.y+0.15*d.y, "back(+y)": lambda v: v.y > hi.y-0.15*d.y,
                  "left(-x)": lambda v: v.x < lo.x+0.12*d.x, "right(+x)": lambda v: v.x > hi.x-0.12*d.x}.items():
        s = [v.z for v in vs if f(v)]
        rim[nm] = round((max(s)-lo.z)/H, 3)
    # left wall top z as function of y (slope check)
    lw = [v for v in vs if v.x < lo.x+0.12*d.x]
    slope = []
    for j in range(5):
        a, b = lo.y + j*d.y/5, lo.y+(j+1)*d.y/5
        s = [v.z for v in lw if a <= v.y < b]
        if s: slope.append(round((max(s)-lo.z)/H, 3))
    out[k] = {"faces": len(o.data.polygons), "dims": [round(x,4) for x in d], "lo": [round(x,4) for x in lo],
              "front_minY": round(min(v.y for v in mid),3), "front_maxY": round(max(v.y for v in mid),3),
              "side_minY": round(min(v.y for v in side),3), "side_maxY": round(max(v.y for v in side),3),
              "profile[zfrac, depthY, widthX, minY, maxY]": prof, "cavity_hit_zfrac": cav, "rim_top_zfrac": rim, "leftwall_top_by_y": slope}
print("ANALYSIS", json.dumps(out))
