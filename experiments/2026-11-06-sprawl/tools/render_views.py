"""A new mesh turned four ways (yaw 0/90/180/270, as data/orient.json would turn it), each from the elevated
three-quarter front camera render_ref.py uses for the partners, so the view that matches the partner's render names
the mesh's yaw. One Blender session per mesh.
  blender --background --python tools/render_views.py -- IN.glb OUT_PREFIX      -> OUT_PREFIX-y{0,90,180,270}.png
"""
import math, sys
import bpy, mathutils

src, out = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
roots = [o for o in bpy.context.scene.objects if o.parent is None]
piv = bpy.data.objects.new("pivot", None); bpy.context.scene.collection.objects.link(piv)
for o in roots: o.parent = piv
sc = bpy.context.scene
try: sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError: sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 768
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs[0].default_value = (0.9, 0.9, 0.92, 1); bg.inputs[1].default_value = 0.9
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 60
for yaw in (0, 90, 180, 270):
    piv.rotation_euler = (0, 0, math.radians(yaw)); bpy.context.view_layer.update()
    meshes = [o for o in sc.objects if o.type == "MESH"]
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    ctr = (lo + hi) / 2; rad = max((hi - lo).length / 2, 0.01)
    a, e = math.radians(30), math.radians(30)
    d = mathutils.Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = ctr + d * (rad / math.tan(math.atan(18 / cam.data.lens) * 0.92))
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{out}-y{yaw}.png"
    bpy.ops.render.render(write_still=True)
