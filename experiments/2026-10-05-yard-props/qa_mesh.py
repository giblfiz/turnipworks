"""Mesh QA sheet + measurements for one or more GLBs (Blender).
    blender --background --python qa_mesh.py -- OUTDIR SIZES.json a.glb b.glb ...
SIZES.json: {sku: [w, d, h] inches}. The mesh is scaled so its largest dimension equals the catalog's largest (the
tuner's 'auto' size rule), stood on a grass-green ground with a 5-ft grid and a 5 ft 9 in grey figure beside it.
Sheet tiles: A = TABLE DISTANCE (60 deg above, about 30 ft of ground across), B = close, low three-quarter,
C = straight down, D = close, high three-quarter from the other side.
Measurements -> OUTDIR/<sku>.json: bounds, proportions vs catalog, loose parts, cross-section spans by height
(a base slab shows as a bottom band that spans the whole footprint under a much narrower band above it)."""
import bpy, bmesh, sys, json, math
from pathlib import Path
from mathutils import Vector
args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0]); OUT.mkdir(parents=True, exist_ok=True)
SIZES = json.loads(Path(args[1]).read_text())

def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m

def one(glb):
    sku = Path(glb).stem
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ob.data
    co = [v.co.copy() for v in me.vertices]
    lo = Vector([min(c[i] for c in co) for i in range(3)]); hi = Vector([max(c[i] for c in co) for i in range(3)])
    ext = hi - lo
    w, d, h = SIZES.get(sku, SIZES.get(sku.split("--")[0], [36, 36, 36]))
    cat = sorted([w, d], reverse=True) + [h]
    msh = sorted([ext.x, ext.y], reverse=True) + [ext.z]
    k = max(w, d, h) / 12 / max(ext)                      # feet per mesh unit ('auto' size rule)
    # loose parts
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    seen, parts = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        stack, n, zmin, zmax = [v], 0, 1e9, -1e9
        seen.add(v.index)
        while stack:
            u = stack.pop(); n += 1; zmin = min(zmin, u.co.z); zmax = max(zmax, u.co.z)
            for e in u.link_edges:
                o2 = e.other_vert(u)
                if o2.index not in seen: seen.add(o2.index); stack.append(o2)
        parts.append((n, zmin, zmax))
    nv = len(bm.verts); bm.free()
    parts.sort(reverse=True)
    big = [p for p in parts if p[0] >= 0.01 * nv]
    # cross-section spans (fraction of the full footprint in x and y) in height bands
    def band(a, b):
        pts = [c for c in co if lo.z + a * ext.z <= c.z <= lo.z + b * ext.z]
        if len(pts) < 3: return None
        return [round((max(p.x for p in pts) - min(p.x for p in pts)) / ext.x, 2), round((max(p.y for p in pts) - min(p.y for p in pts)) / ext.y, 2), len(pts)]
    bands = {f"{int(a*100)}-{int(b*100)}%": band(a, b) for a, b in [(0, .03), (.03, .08), (.08, .2), (.2, .5), (.5, .8), (.8, 1)]}
    b0, b1 = bands["0-3%"], bands["8-20%"]
    slab = bool(b0 and b1 and b0[0] > 0.9 and b0[1] > 0.9 and b0[0] * b0[1] > 2.2 * b1[0] * b1[1])
    bottom = sum(1 for c in co if c.z <= lo.z + 0.02 * ext.z) / len(co)
    rec = {"sku": sku, "faces": len(me.polygons), "bounds_units": [round(ext.x, 3), round(ext.z, 3), round(ext.y, 3)],
           "size_ft_at_auto_scale": [round(ext.x * k, 2), round(ext.y * k, 2), round(ext.z * k, 2)],
           "catalog_in": [w, d, h],
           "ratio_mesh_long:short:height": [round(v / msh[0], 2) for v in msh], "ratio_catalog": [round(v / cat[0], 2) for v in cat],
           "height_error": round((ext.z * k * 12) / h - 1, 2),
           "loose_parts": len(parts), "loose_parts_over_1pct": len(big),
           "floating_parts_over_1pct": sum(1 for p in big[1:] if p[1] > lo.z + 0.25 * ext.z),
           "bottom_2pct_vertex_share": round(bottom, 3), "bands_span_xy": bands, "base_slab_suspect": slab}
    (OUT / f"{sku}.json").write_text(json.dumps(rec, indent=1))
    # ---- scene: feet, object on the ground at the origin
    ob.scale = (k, k, k); bpy.ops.object.transform_apply(scale=True)
    ob.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, -lo.z * k); bpy.ops.object.transform_apply(location=True)
    S = max(ext) * k; H = ext.z * k; R = max(ext.x, ext.y) * k / 2
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0)); g = bpy.context.object; g.data.materials.append(mat("grass", (0.20, 0.36, 0.13)))
    line = mat("line", (0.13, 0.25, 0.09))
    for i in range(-12, 13):
        for horiz in (0, 1):
            bpy.ops.mesh.primitive_plane_add(size=1, location=((0, i * 5 + 2.5, 0.01) if horiz else (i * 5 + 2.5, 0, 0.01)))
            p = bpy.context.object; p.scale = (120, 0.06, 1) if horiz else (0.06, 120, 1); p.data.materials.append(line)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.75, depth=5.75, location=(R + 2.5, -R * 0.3, 2.875)); bpy.context.object.data.materials.append(mat("fig", (0.55, 0.55, 0.58)))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(R + 2.5, -R * 0.3, 5.75 + 0.3)); bpy.context.object.data.materials.append(bpy.data.materials["fig"])
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.render.resolution_x = sc.render.resolution_y = 640; sc.render.film_transparent = False
    try: sc.view_settings.view_transform = "Standard"
    except Exception: pass
    world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.70, 0.78, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.2; sun.rotation_euler = (math.radians(48), 0, math.radians(35)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
    cam.data.clip_end = 2000
    fov = 2 * math.atan(18 / 50)
    def shot(name, el, az, across, target):
        dist = across / 2 / math.tan(fov / 2)
        el, az = math.radians(el), math.radians(az)
        cam.location = Vector(target) + Vector((dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az), dist * math.sin(el)))
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = str(OUT / f"{sku}.{name}.png"); bpy.ops.render.render(write_still=True)
    shot("A", 60, 30, max(30, S * 2.6), (0, 0, H * 0.3))
    shot("B", 22, 30, max(S * 1.9, 9), (0, 0, H * 0.48))
    shot("C", 89.9, 0, max(R * 2 * 1.9, 9), (0, 0, H))
    shot("D", 50, 215, max(S * 1.9, 9), (0, 0, H * 0.45))
    print("QA", sku, json.dumps(rec))

for g in args[2:]:
    try: one(g)
    except Exception as e:
        import traceback; traceback.print_exc(); print("QAFAIL", g, e)
