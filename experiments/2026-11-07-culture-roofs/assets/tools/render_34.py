"""Every GLB in models/ without a render: one elevated three-quarter view from its FRONT (+Z, the side a placed piece
shows the room), transparent, for the blind mesh read (tools/gate.py renders) and the front check. One Blender session.
  blender --background --python tools/render_34.py -- MODELS_DIR RENDERS_DIR"""
import math, sys, os
import bpy, mathutils
src, out = sys.argv[sys.argv.index("--") + 1:]
os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith('.glb') or os.path.exists(f"{out}/{f[:-4]}-34.png"): continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f"{src}/{f}")
    sc = bpy.context.scene
    try: sc.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError: sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = sc.render.resolution_y = 512; sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"; sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs[0].default_value = (0.9, 0.9, 0.92, 1); bg.inputs[1].default_value = 0.9
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.0; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 60
    meshes = [o for o in sc.objects if o.type == "MESH"]
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    ctr = (lo + hi) / 2; rad = max((hi - lo).length / 2, 0.01)
    # -34: elevated three-quarter from the FRONT; -top: the table view (high, 65 degrees), the way a player sees it (2026-11-07)
    for tag, a, e in (("34", math.radians(30), math.radians(35)), ("top", math.radians(30), math.radians(65))):   # (glTF +Z is Blender -Y: the camera stands on -Y)
        d = mathutils.Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = ctr + d * (rad / math.tan(math.atan(18 / cam.data.lens) * 0.92))
        cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{out}/{f[:-4]}-{tag}.png"; bpy.ops.render.render(write_still=True)
"""(end)"""
