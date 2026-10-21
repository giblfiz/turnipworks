import sys, json, math
sys.path.insert(0, "experiments/2026-10-02-openclose")
import bpy
from mathutils import Vector
from bl_common import load_joined, bounds
bpy.ops.wm.read_factory_settings(use_empty=True)
o = load_joined("experiments/2026-09-30-inn-01-500/models/chest-ironbound.glb", "closed")
lo, hi = bounds(o); H = hi.z - lo.z
vs = [v.co for v in o.data.vertices]
for i in range(16, 34):
    a = lo.z + i*H/40; b = a + H/40
    sl = [v for v in vs if a <= v.z < b]
    # wood front face depth at x=+-0.25 (avoid lock + bands roughly)
    fr = [v.y for v in sl if 0.15 < abs(v.x) < 0.3]
    print("SEAM", round(i/40,3), "dY", round(max(v.y for v in sl)-min(v.y for v in sl),3), "wX", round(max(v.x for v in sl)-min(v.x for v in sl),3), "frontY", round(min(fr),3) if fr else None)
# ortho side + front renders
scn = bpy.context.scene
scn.render.engine = "BLENDER_WORKBENCH"; scn.display.shading.color_type = "TEXTURE"; scn.display.shading.light = "FLAT"
scn.render.resolution_x = scn.render.resolution_y = 600
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scn.collection.objects.link(cam); scn.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 1.2
c = (lo+hi)/2
for nm, loc, rot in [("front", (c.x, -5, c.z), (math.radians(90),0,0)), ("side", (5, c.y, c.z), (math.radians(90),0,math.radians(90)))]:
    cam.location = loc; cam.rotation_euler = rot
    scn.render.filepath = f"experiments/2026-10-02-openclose/shots/closed-{nm}.png"
    bpy.ops.render.render(write_still=True)
print("SEAM lo", tuple(lo), "H", H)
