"""Stills of a flying figure, drawn with the engine's numbers (figure scale 0.67, the grey 4-ft-per-square disc with a
seat-coloured rim on the floor, the figure lifted over it with a beam), in Blender.
    blender --background --python render_fly.py -- MODE OUT.png JSON
MODE  table : the flying figure alone, 10 ft up over its base, table distance (3/4 from above), on a 5-ft grid floor
      pair  : the standing figure on its base and the flying one beside it (same scale), closer: is it the same size?
      yaw   : the flying mesh alone from one side; JSON has "view_deg" (0 = from +Z)
JSON  {"fly": glb, "k": feet/unit, "y0": .., "c": [x, z], "yaw": deg, "size": squares, "stand": glb?, "sk": .., "sy0": .., "sc": [..], "syaw": ..}"""
import bpy, json, math, sys
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]; MODE, OUT, J = a[0], a[1], json.loads(a[2])
FS = 0.67
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.samples = 24; sc.cycles.device = "CPU"   # (the GPU is shared with the matte and other lanes; CUDA hung here once)
try: sc.cycles.use_denoising = True
except Exception: pass
sc.render.resolution_x, sc.render.resolution_y = (1280, 800) if MODE != "yaw" else (640, 640)
sc.render.film_transparent = MODE == "yaw"
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.55, 0.58, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
FT = 1.0   # one Blender unit = one foot; Blender is Z-up: game (x, y, z) -> blender (x, -z, y)


def mat(name, rgb, rough=0.7, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    if emit:
        for k in ("Emission Color", "Emission"):
            if k in b.inputs: b.inputs[k].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def figure(glb, k, y0, c, yaw, at, lift=0.0):
    """the engine's turn group: yaw, scale k, then (-c, -y0*k) so its lowest point is at the holder; holder scaled FS"""
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=glb); new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new("fig", None); bpy.context.collection.objects.link(root)
    for o in new:
        if o.parent is None: o.parent = root
    turn = root
    turn.rotation_mode = "XYZ"; turn.rotation_euler = (0, 0, math.radians(yaw)); turn.scale = (k, k, k)
    hold = bpy.data.objects.new("hold", None); bpy.context.collection.objects.link(hold); turn.parent = hold
    turn.location = (-c[0], c[1], -y0 * k)   # game -c along x, -c along z -> blender y = +c[1]
    hold.scale = (FS, FS, FS); hold.location = (at[0], -at[1], 0.3 + lift)
    return hold


def base(at, size, rim=(0.85, 0.35, 0.1)):
    r = size * 5 * 0.8 / 2
    bpy.ops.mesh.primitive_cylinder_add(radius=r * 0.9, depth=0.3, location=(at[0], -at[1], 0.15)); bpy.context.object.data.materials.append(mat("disc", (0.46, 0.49, 0.53)))
    bpy.ops.mesh.primitive_torus_add(major_radius=r * 0.95, minor_radius=r * 0.06, location=(at[0], -at[1], 0.2)); bpy.context.object.data.materials.append(mat("rim", rim, 0.5, 0.4))


def beam(at, h, rim=(0.85, 0.35, 0.1)):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=h, location=(at[0], -at[1], 0.3 + h / 2)); bpy.context.object.data.materials.append(mat("beam", rim, 0.5, 1.0))


def floor():
    bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, 0)); f = bpy.context.object
    m = mat("floor", (0.42, 0.36, 0.3), 0.9); f.data.materials.append(m)
    # the 5-ft grid as thin dark strips
    g = mat("grid", (0.22, 0.19, 0.16), 0.9)
    for i in range(-12, 13):
        for horiz in (0, 1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=((i * 5, 0, 0.01) if not horiz else (0, i * 5, 0.01)))
            o = bpy.context.object; o.scale = ((0.06, 120, 0.01) if not horiz else (120, 0.06, 0.01)); o.data.materials.append(g)


def sun():
    bpy.ops.object.light_add(type="SUN", location=(10, -10, 30)); s = bpy.context.object; s.data.energy = 3.2; s.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))


def cam(target, dist, elev, az):
    t = Vector(target); d = Vector((math.sin(math.radians(az)) * math.cos(math.radians(elev)), -math.cos(math.radians(az)) * math.cos(math.radians(elev)), math.sin(math.radians(elev))))
    bpy.ops.object.camera_add(location=t + d * dist); c = bpy.context.object; c.data.lens = 40
    c.rotation_euler = (t - c.location).to_track_quat("-Z", "Y").to_euler(); sc.camera = c


size = J.get("size", 1); sun()
if MODE == "table":
    floor(); base((0, 0), size); lift = J.get("lift", 10.0); beam((0, 0), lift)
    figure(J["fly"], J["k"], J["y0"], J["c"], J["yaw"], (0, 0), lift)
    cam((0, 0, lift * 0.6), J.get("dist", 55), 52, 20)
elif MODE == "pair":
    floor(); off = max(5.0, size * 5 + 1)
    base((-off / 2, 0), size); figure(J["stand"], J["sk"], J["sy0"], J["sc"], J["syaw"], (-off / 2, 0))
    base((off / 2, 0), size); lift = J.get("lift", 6.0); beam((off / 2, 0), lift); figure(J["fly"], J["k"], J["y0"], J["c"], J["yaw"], (off / 2, 0), lift)
    top = max(J.get("sh", 6) * FS, lift + J.get("h", 4) * FS)
    cam((0, 0, top / 2), J.get("dist", 14 + 9 * size + top * 1.6), 28, 15)
else:
    figure(J["fly"], J["k"], J["y0"], J["c"], J["yaw"], (0, 0), 0)
    cam((0, 0, J.get("h", 4) * FS / 2 + 0.3), J.get("dist", 10), 20, J["view_deg"])
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
