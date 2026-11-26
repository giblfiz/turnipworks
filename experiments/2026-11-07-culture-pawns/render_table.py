"""Stills of standing figures drawn with the engine's numbers (figure scale 0.67, the medium-grey 4-ft disc with a seat-
coloured rim in its 5-ft square, a 5-ft grid floor), in Blender. The flying-pose lane's renderer (experiments/2026-11-06-
pawns/fly/render_fly.py), cut down to standing figures. The disc and grid are the engine's own test fixtures, not art.
    blender --background --python render_table.py -- MODE OUT.png JSON
MODE  table : ONE figure alone at table distance (3/4 from above, the distance a player sees the table from)
      line  : several figures in a row, one square apart, closer (the contact sheet: a culture's seven side by side)
      close : ONE figure close up, from the front, a little above
      trio  : a few figures side by side at TABLE distance (one race's fighter, rogue and caster; a culture's NPCs)
JSON  {"figs": [{"glb": .., "k": feet/unit, "y0": .., "c": [x, z], "yaw": deg}, ...]}"""
import bpy, json, math, sys
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]; MODE, OUT, J = a[0], a[1], json.loads(a[2])
FS = 0.67
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.samples = 24; sc.cycles.device = "CPU"   # (the GPU is shared with the matte and other lanes)
try: sc.cycles.use_denoising = True
except Exception: pass
sc.render.resolution_x, sc.render.resolution_y = {"table": (1280, 800), "trio": (1280, 800), "line": (1800, 720), "close": (720, 900)}[MODE]
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.55, 0.58, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 0.6


def mat(name, rgb, rough=0.7, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    if emit:
        for k in ("Emission Color", "Emission"):
            if k in b.inputs: b.inputs[k].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def figure(f, at):
    """the engine's turn group: yaw, scale k, then (-c, -y0) so its lowest point is at the holder; holder scaled FS"""
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f["glb"]); new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new("fig", None); bpy.context.collection.objects.link(root)
    for o in new:
        if o.parent is None: o.parent = root
    k = f["k"]; root.rotation_mode = "XYZ"; root.rotation_euler = (0, 0, math.radians(f.get("yaw", 0))); root.scale = (k, k, k)
    hold = bpy.data.objects.new("hold", None); bpy.context.collection.objects.link(hold); root.parent = hold
    root.location = (-f["c"][0], f["c"][1], -f["y0"])   # (the set's y0 is already in FEET, measured after scaling: experiments/2026-10-06-figures/measure.py; the flying lane's was in mesh units)
    hold.scale = (FS, FS, FS); hold.location = (at[0], -at[1], 0.3)
    return hold


def base(at, rim=(0.85, 0.35, 0.1)):
    r = 4 / 2   # the disc: 4 ft across in its 5-ft square (2026-10-29), medium grey #757e88, a rim in the seat's colour
    bpy.ops.mesh.primitive_cylinder_add(radius=r * 0.95, depth=0.3, location=(at[0], -at[1], 0.15)); bpy.context.object.data.materials.append(mat("disc", (0.46, 0.49, 0.53)))
    bpy.ops.mesh.primitive_torus_add(major_radius=r * 0.97, minor_radius=0.1, location=(at[0], -at[1], 0.22)); bpy.context.object.data.materials.append(mat("rim", rim, 0.5, 0.4))


def floor():
    bpy.ops.mesh.primitive_plane_add(size=160, location=(0, 0, 0)); f = bpy.context.object
    f.data.materials.append(mat("floor", (0.42, 0.36, 0.3), 0.9))
    g = mat("grid", (0.22, 0.19, 0.16), 0.9)
    for i in range(-16, 17):
        for horiz in (0, 1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=((i * 5 + 2.5, 0, 0.01) if not horiz else (0, i * 5 + 2.5, 0.01)))
            o = bpy.context.object; o.scale = ((0.06, 160, 0.01) if not horiz else (160, 0.06, 0.01)); o.data.materials.append(g)


def sun():
    bpy.ops.object.light_add(type="SUN", location=(10, -10, 30)); s = bpy.context.object; s.data.energy = 3.2; s.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))


def cam(target, dist, elev, az, lens=40):
    t = Vector(target); d = Vector((math.sin(math.radians(az)) * math.cos(math.radians(elev)), -math.cos(math.radians(az)) * math.cos(math.radians(elev)), math.sin(math.radians(elev))))
    bpy.ops.object.camera_add(location=t + d * dist); c = bpy.context.object; c.data.lens = lens
    c.rotation_euler = (t - c.location).to_track_quat("-Z", "Y").to_euler(); sc.camera = c


sun(); floor()
F = J["figs"]
if MODE == "table":
    base((0, 0)); figure(F[0], (0, 0)); cam((0, 0, 2), J.get("dist", 55), 52, 20)
elif MODE == "close":
    base((0, 0)); figure(F[0], (0, 0)); cam((0, 0, 2.2), J.get("dist", 11), 18, 0, 50)
elif MODE == "trio":   # a few figures side by side, one square apart, at TABLE distance (the grid's blind reads: one race's three roles)
    n = len(F); xs = [(i - (n - 1) / 2) * 5 for i in range(n)]
    for x, f in zip(xs, F): base((x, 0)); figure(f, (x, 0))
    cam((0, 0, 2), J.get("dist", 55), 52, 12)
else:
    n = len(F); xs = [(i - (n - 1) / 2) * 5 for i in range(n)]
    for x, f in zip(xs, F): base((x, 0)); figure(f, (x, 0))
    cam((0, 0, 2), J.get("dist", 6 + 5 * n * 0.95), 22, 0, 45)
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
