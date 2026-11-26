"""Reuse vetting: one small render per existing (fantasy/regional) sku, elevated 3/4 table camera, for a blind era read.
One Blender session renders a whole list (factory-reset between meshes).
  blender --background --python tools/reuse_render.py -- LIST.tsv OUT_DIR
LIST.tsv: one line per mesh, "<sku>\t<glb path>". Writes OUT_DIR/<sku>.png (256 px RGBA, transparent background;
the sheet builder flattens it onto neutral grey). Camera: 35 deg elevation, 30 deg azimuth (the render_views.py
three-quarter front), framed to the bounding sphere so every prop fills its tile the same way."""
import math, sys
from pathlib import Path
import bpy, mathutils

lst, out = sys.argv[sys.argv.index("--") + 1:]
out = Path(out); out.mkdir(parents=True, exist_ok=True)
jobs = [l.rstrip("\n").split("\t") for l in open(lst) if l.strip()]

def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    try: sc.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError: sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = sc.render.resolution_y = 256
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs[0].default_value = (0.9, 0.9, 0.92, 1); bg.inputs[1].default_value = 0.9
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 60
    return sc, cam

for sku, src in jobs:
    dst = out / f"{sku}.png"
    if dst.exists(): continue
    try:
        sc, cam = setup()
        bpy.ops.import_scene.gltf(filepath=src); bpy.context.view_layer.update()
        meshes = [o for o in sc.objects if o.type == "MESH"]
        pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
        lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
        ctr = (lo + hi) / 2; rad = max((hi - lo).length / 2, 0.01)
        a, e = math.radians(30), math.radians(35)
        d = mathutils.Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = ctr + d * (rad / math.tan(math.atan(18 / cam.data.lens) * 0.92))
        cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = str(dst)
        bpy.ops.render.render(write_still=True)
        print(f"REUSE-OK {sku}", flush=True)
    except Exception as ex:
        print(f"REUSE-FAIL {sku} {ex}", flush=True)
