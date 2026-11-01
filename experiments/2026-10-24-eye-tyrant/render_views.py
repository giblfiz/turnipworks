"""Four plain views of a GLB for the facing read (Blender, background): the mesh's own +Z, +X, -Z, -X sides.
    blender -b --python render_views.py -- in.glb outdir"""
import bpy, math, sys
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]; src, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
mid = (lo + hi) / 2; size = max(hi - lo)
sc = bpy.context.scene; sc.render.resolution_x = sc.render.resolution_y = 512
try: sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    try: sc.render.engine = "BLENDER_EEVEE"
    except TypeError: pass
w = bpy.data.worlds.new("w"); w.use_nodes = True; bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs[0].default_value = (0.8, 0.8, 0.8, 1); bg.inputs[1].default_value = 1.0; sc.world = w
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = size * 1.25
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun); sun.data.energy = 3
# glTF +Z (the figure's front) is Blender -Y
for name, d in (("view1", Vector((0, -1, 0))), ("view2", Vector((1, 0, 0))), ("view3", Vector((0, 1, 0))), ("view4", Vector((-1, 0, 0)))):
    cam.location = mid + d * size * 3 + Vector((0, 0, size * 0.25))
    cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
    sun.rotation_euler = cam.rotation_euler
    sc.render.filepath = f"{out}/{name}.png"; bpy.ops.render.render(write_still=True)
