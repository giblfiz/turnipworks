"""Room icons for the Build tray, RENDERED from our own library meshes (no image model: the Codex image allowance ran
out on 2026-10-11 and the rule is not to switch model). One mesh a room, three-quarter view from above, flat even light
so the hand-painted texture shows as painted, transparent ground, 128 px RGBA like the painted icons.
    blender --background --python tools/render_icons.py -- <out dir>
Provenance: each icon is a picture of one of our own meshes (the sku is in ICONS below and in icons/README.md).
"""
import bpy, sys, math, mathutils, pathlib
OUT = pathlib.Path(sys.argv[sys.argv.index("--") + 1]); M = pathlib.Path("tools/spawn-tuner/assets/m")
ICONS = {"lair-mouth": "skull-pile--s1", "lair-passage": "torch-bracket-rough", "lair-warren": "firepit-log-spit", "lair-beast": "hay-pile", "lair-spider": "rite-mummified-remains",
         "lair-larder": "carcass-hanging", "lair-pit": "cage-floor", "lair-hatchery": "nest-bird", "lair-trophy": "monster-head-trophy", "lair-dragon": "coin-pile"}
def find(sku):
    for n in (sku, sku.split("--")[0]):
        p = M / f"{n}.glb"
        if p.exists(): return p
    c = sorted(M.glob(sku.split("--")[0] + "*.glb")); return c[0] if c else None
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = 384; sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
try: sc.view_settings.view_transform = "Standard"
except Exception: pass
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.85
for name, sku in ICONS.items():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    p = find(sku)
    if not p: print("MISSING", name, sku); continue
    bpy.ops.import_scene.gltf(filepath=str(p))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    lo = mathutils.Vector([min(q[i] for q in pts) for i in range(3)]); hi = mathutils.Vector([max(q[i] for q in pts) for i in range(3)])
    c = (lo + hi) / 2; r = (hi - lo).length / 2
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = r * 2.15
    az, el = math.radians(35), math.radians(38); d = r * 6
    cam.location = c + mathutils.Vector((math.sin(az) * math.cos(el) * d, -math.cos(az) * math.cos(el) * d, math.sin(el) * d))
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun); sun.data.energy = 2.2; sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    sc.render.filepath = str(OUT / f"raw-{name}.png"); bpy.ops.render.render(write_still=True)
    print("ICON", name, sku, p.name)
