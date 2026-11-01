"""A partner model's look, for the plate of its twin: the GLB as the game turns it (data/orient.json yaw), on a
transparent ground, elevated three-quarter front and straight front, 1024 px.
  blender --background --python tools/render_ref.py -- IN.glb YAW_DEG OUT_PREFIX     -> OUT_PREFIX-34.png, OUT_PREFIX-front.png
"""
import math, sys
import bpy, mathutils

src, yaw, out = sys.argv[sys.argv.index("--") + 1:]
yaw = float(yaw)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
roots = [o for o in bpy.context.scene.objects if o.parent is None]
piv = bpy.data.objects.new("pivot", None); bpy.context.scene.collection.objects.link(piv)
for o in roots: o.parent = piv
piv.rotation_euler = (0, 0, math.radians(yaw))   # three.js rotation.y == Blender rotation about +Z (glTF +Z front -> Blender -Y)
bpy.context.view_layer.update()
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
ctr = (lo + hi) / 2; rad = max((hi - lo).length / 2, 0.01)
sc = bpy.context.scene
try: sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError: sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 1024
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs[0].default_value = (0.9, 0.9, 0.92, 1); bg.inputs[1].default_value = 0.9
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 60
for tag, az, el in (("34", 30, 30), ("front", 0, 12)):
    a, e = math.radians(az), math.radians(el)
    d = mathutils.Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    dist = rad / math.tan(math.atan(18 / cam.data.lens) * 0.92)
    cam.location = ctr + d * dist
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{out}-{tag}.png"
    bpy.ops.render.render(write_still=True)
