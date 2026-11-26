"""Mesh QA, step 1 of 3 (Blender): measurements + four render tiles per GLB. Generalised from the yard's qa_mesh.py.
    blender --background --python tools/qa_mesh.py -- TYPE_DIR [--out QADIR] [--models DIR] [--assets FILE] [--redo] [sku ...]
Defaults: models TYPE_DIR/models/*.glb, sizes and flags from TYPE_DIR/assets.json, output TYPE_DIR/qa/.
Skips a sku whose qa/<sku>.json already carries the same GLB sha1 (unless --redo). Use tools/qa.sh to run all three steps.

The mesh is scaled so its largest dimension equals the catalog's largest (the tuner's 'auto' size rule), stood on a
warm grey floor with a 5-ft grid and a 5 ft 9 in grey figure beside it.
Tiles: A = TABLE DISTANCE (60 deg above, about 30 ft of floor across), B = close and low (for a wall panel: the broad
face straight on), C = straight down, D = close, high three-quarter from the other side.

Measurements -> QADIR/<sku>.json:
  bounds, size at the auto scale, proportions vs catalog (prop_factor_footprint / prop_factor_height: how many times off),
  loose parts and FLOATING parts (a part over 1% of the vertices whose lowest point is above a quarter of the height),
  footprint span by height band (a base slab shows as a bottom band spanning the whole footprint under a much narrower
  band above it), underside (how much of the footprint the lowest 3% touches; whether the mesh's middle is over it),
  and for a KIT WALL PANEL (see is_wall): width:height, depth:height, and the orthographic front silhouette:
  how much of the panel is filled, the largest clear opening (share of width and height, whether it reaches the floor).
"""
import bpy, bmesh, sys, json, math, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
def opt(name, default=None):
    if name in argv:
        i = argv.index(name); v = argv[i + 1]; del argv[i:i + 2]; return v
    return default
OUT, MODELS, ASSETS = opt("--out"), opt("--models"), opt("--assets")
REDO = "--redo" in argv
if REDO: argv.remove("--redo")
TYPE = Path(argv[0]).resolve()
OUT = Path(OUT) if OUT else TYPE / "qa"; OUT.mkdir(parents=True, exist_ok=True)
MODELS = Path(MODELS) if MODELS else TYPE / "models"
ASSETS = Path(ASSETS) if ASSETS else TYPE / "assets.json"
SPEC = {a["id"]: a for a in json.loads(ASSETS.read_text())["assets"]} if ASSETS.exists() else {}
WANT = argv[1:]
def spec_of(sku):
    return SPEC.get(sku) or SPEC.get(sku.replace("--chunky", "")) or {}

def is_wall(sku, spec):
    """A kit wall panel: said so in the spec ("kit": "wall"), or panel-sized in the catalog (about 5 ft wide, at least
    8 ft tall, at most 2 ft deep): wall-straight / wall-window / wall-doorway / wall-crypt-niches, and also a barred
    cell door or a stained-glass window panel. Battlements and stairs are props."""
    if spec.get("kit") == "wall": return True
    if spec.get("kit") or not spec.get("size"): return bool(not spec.get("size") and sku.startswith(("wall-straight", "wall-window", "wall-doorway")))
    w, d, h = spec["size"]
    return 54 <= max(w, d) <= 66 and h >= 96 and min(w, d) <= 24 and sku.startswith(("wall-", "window-", "door-", "ossuary-wall", "tomb-door-sealed"))

def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m

def front_silhouette(ob, lo, hi, ext, broad):
    """Rays through the panel along its thin axis on a grid over the broad face. -> filled share, openings."""
    me = ob.data; me.calc_loop_triangles()
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], [tuple(t.vertices) for t in me.loop_triangles])
    thin = 1 - broad
    NX, NZ = 80, 144
    grid = [[False] * NX for _ in range(NZ)]            # True = solid
    d = Vector((0, 0, 0)); d[thin] = 1
    for iz in range(NZ):
        for ix in range(NX):
            o = Vector((0, 0, 0)); o[broad] = lo[broad] + (ix + .5) / NX * ext[broad]; o[2] = lo.z + (iz + .5) / NZ * ext.z; o[thin] = lo[thin] - 1
            grid[iz][ix] = bvh.ray_cast(o, d)[0] is not None
    filled = sum(map(sum, grid)) / (NX * NZ)
    # exterior = clear cells reachable from the top and the two side edges (NOT the bottom: a doorway opens to the floor)
    ext_ = [[False] * NX for _ in range(NZ)]
    stack = [(NZ - 1, x) for x in range(NX)] + [(z, 0) for z in range(NZ)] + [(z, NX - 1) for z in range(NZ)]
    # a doorway is not exterior: stop the side flood from running along the floor by sealing the bottom 2 rows for it
    while stack:
        z, x = stack.pop()
        if not (0 <= z < NZ and 0 <= x < NX) or ext_[z][x] or grid[z][x]: continue
        if z < 2 and 2 < x < NX - 3: continue
        ext_[z][x] = True; stack += [(z + 1, x), (z - 1, x), (z, x + 1), (z, x - 1)]
    seen = [[False] * NX for _ in range(NZ)]; comps = []
    for z0 in range(NZ):
        for x0 in range(NX):
            if grid[z0][x0] or ext_[z0][x0] or seen[z0][x0]: continue
            st, n, x1, x2, z1, z2 = [(z0, x0)], 0, x0, x0, z0, z0
            seen[z0][x0] = True
            while st:
                z, x = st.pop(); n += 1; x1, x2, z1, z2 = min(x1, x), max(x2, x), min(z1, z), max(z2, z)
                for zz, xx in ((z + 1, x), (z - 1, x), (z, x + 1), (z, x - 1)):
                    if 0 <= zz < NZ and 0 <= xx < NX and not grid[zz][xx] and not ext_[zz][xx] and not seen[zz][xx]:
                        seen[zz][xx] = True; st.append((zz, xx))
            comps.append({"area_share": round(n / (NX * NZ), 4), "width_share": round((x2 - x1 + 1) / NX, 2), "height_share": round((z2 - z1 + 1) / NZ, 2),
                          "reaches_floor": z1 <= 2, "bottom_at": round(z1 / NZ, 2), "top_at": round((z2 + 1) / NZ, 2), "centre_x": round((x1 + x2 + 1) / 2 / NX, 2)})
    comps.sort(key=lambda c: -c["area_share"])
    rows = ["".join("#" if grid[z][x] else ("." if ext_[z][x] else "o") for x in range(0, NX, 2)) for z in range(NZ - 1, -1, -6)]
    return {"filled_share": round(filled, 3), "openings_share": round(sum(c["area_share"] for c in comps), 4),
            "largest_opening": comps[0] if comps else None, "openings_over_half_pct": sum(1 for c in comps if c["area_share"] >= 0.005), "ascii": rows}

def one(glb):
    sku = Path(glb).stem
    sha = hashlib.sha1(Path(glb).read_bytes()).hexdigest()
    old = OUT / f"{sku}.json"
    if old.exists() and not REDO:
        try:
            if json.loads(old.read_text()).get("glb_sha1") == sha and (OUT / f"{sku}.D.png").exists():
                print("QASKIP", sku); return
        except Exception: pass
    spec = spec_of(sku)
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
    w, d, h = spec.get("size") or [36, 36, 36]
    cat = sorted([w, d], reverse=True) + [h]
    msh = sorted([ext.x, ext.y], reverse=True) + [ext.z]
    k = max(w, d, h) / 12 / max(ext)                      # feet per mesh unit ('auto' size rule)
    # ---- loose parts
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
    # ---- FLOATING pieces. TRELLIS meshes are hundreds of unwelded shells that touch, so edge connectivity says nothing
    # (the yard's picnic table has 12 'parts' and is sound). Instead: points (vertices + face centres) into a voxel grid
    # 1/72 of the largest dimension, voxels joined to neighbours up to two cells away; any group not joined to the
    # largest one is a detached piece. Detached and off the floor = floating.
    cell = max(ext) / 72
    pts = co + [f.center for f in me.polygons]
    vox = {}
    for c in pts:
        key = (int((c.x - lo.x) / cell), int((c.y - lo.y) / cell), int((c.z - lo.z) / cell)); vox[key] = vox.get(key, 0) + 1
    N26 = [(i, j, l) for i in (-2, -1, 0, 1, 2) for j in (-2, -1, 0, 1, 2) for l in (-2, -1, 0, 1, 2) if (i, j, l) != (0, 0, 0)]
    seenv, groups = set(), []
    for key in vox:
        if key in seenv: continue
        st, n, zmin = [key], 0, 10 ** 9; seenv.add(key)
        while st:
            u = st.pop(); n += vox[u]; zmin = min(zmin, u[2])
            for i, j, l in N26:
                q = (u[0] + i, u[1] + j, u[2] + l)
                if q in vox and q not in seenv: seenv.add(q); st.append(q)
        groups.append((n, zmin))
    groups.sort(reverse=True)
    det = [(n / len(pts), zmin * cell / ext.z) for n, zmin in groups[1:] if n / len(pts) >= 0.004]
    floating = [g for g in det if g[1] > 0.05]
    on_floor = [g for g in det if g[1] <= 0.05]
    # ---- cross-section spans (fraction of the full footprint in x and y) in height bands
    def band(a, b):
        pts = [c for c in co if lo.z + a * ext.z <= c.z <= lo.z + b * ext.z]
        if len(pts) < 3: return None
        return [round((max(p.x for p in pts) - min(p.x for p in pts)) / ext.x, 2), round((max(p.y for p in pts) - min(p.y for p in pts)) / ext.y, 2), len(pts)]
    bands = {f"{int(a*100)}-{int(b*100)}%": band(a, b) for a, b in [(0, .03), (.03, .08), (.08, .2), (.2, .5), (.5, .8), (.8, 1)]}
    b0, b1 = bands["0-3%"], bands["8-20%"]
    slab = bool(b0 and b1 and b0[0] > 0.9 and b0[1] > 0.9 and b0[0] * b0[1] > 2.2 * b1[0] * b1[1])
    # ---- underside: what the lowest 3% of the height touches, and whether the mesh's middle stands over it
    low = [c for c in co if c.z <= lo.z + 0.03 * ext.z]
    cx = sum(c.x for c in co) / len(co); cy = sum(c.y for c in co) / len(co)
    lx0, lx1 = min(c.x for c in low), max(c.x for c in low); ly0, ly1 = min(c.y for c in low), max(c.y for c in low)
    mx, my = 0.1 * ext.x, 0.1 * ext.y
    under = {"contact_span_xy": [round((lx1 - lx0) / ext.x, 2), round((ly1 - ly0) / ext.y, 2)],
             "bottom_3pct_vertex_share": round(len(low) / len(co), 3),
             "middle_over_contact": bool(lx0 - mx <= cx <= lx1 + mx and ly0 - my <= cy <= ly1 + my)}
    under["flat_underside"] = bool(under["middle_over_contact"] and min(under["contact_span_xy"]) >= 0.35)
    f_foot = (msh[1] / msh[0]) / (cat[1] / cat[0]); f_h = (msh[2] / msh[0]) / (cat[2] / cat[0])
    rec = {"sku": sku, "glb_sha1": sha, "faces": len(me.polygons), "rule_set": "wall" if is_wall(sku, spec) else "prop",
           "bounds_units": [round(ext.x, 3), round(ext.z, 3), round(ext.y, 3)],
           "size_ft_at_auto_scale": [round(ext.x * k, 2), round(ext.y * k, 2), round(ext.z * k, 2)],
           "catalog_in": [w, d, h], "catalog_known": bool(spec.get("size")),
           "ratio_mesh_long:short:height": [round(v / msh[0], 2) for v in msh], "ratio_catalog": [round(v / cat[0], 2) for v in cat],
           "prop_factor_footprint": round(max(f_foot, 1 / f_foot), 2), "prop_factor_height": round(max(f_h, 1 / f_h), 2),
           "height_error": round((ext.z * k * 12) / h - 1, 2),
           "loose_shells": len(parts), "loose_shells_over_1pct": len(big),
           "detached_pieces": len(det), "floating_pieces": len(floating), "floating_share": round(sum(g[0] for g in floating), 3),
           "floating_lowest_at": [round(g[1], 2) for g in floating][:6],
           "separate_pieces_on_floor": len(on_floor), "separate_on_floor_share": round(sum(g[0] for g in on_floor), 3),
           "bands_span_xy": bands, "base_slab_suspect": slab, "underside": under}
    if rec["rule_set"] == "wall":
        broad = 0 if ext.x >= ext.y else 1
        W, D, H = ext[broad], ext[1 - broad], ext.z
        cw, cd = max(w, d), min(w, d)
        lowd = [c[1 - broad] for c in co if c.z <= lo.z + 0.05 * H]; midd = [c[1 - broad] for c in co if lo.z + 0.3 * H <= c.z <= lo.z + 0.7 * H]
        rec["wall"] = {"width:height": round(W / H, 3), "catalog_width:height": round(cw / h, 3), "depth:height": round(D / H, 3), "catalog_depth:height": round(cd / h, 3),
                       "foot_depth_vs_mid": round((max(lowd) - min(lowd)) / max(1e-9, max(midd) - min(midd)), 2) if lowd and midd else None,
                       **front_silhouette(ob, lo, hi, ext, broad)}
    (OUT / f"{sku}.json").write_text(json.dumps(rec, indent=1))
    # ---- scene: feet, object on the floor at the origin
    ob.scale = (k, k, k); bpy.ops.object.transform_apply(scale=True)
    ob.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, -lo.z * k); bpy.ops.object.transform_apply(location=True)
    S = max(ext) * k; H = ext.z * k; R = max(ext.x, ext.y) * k / 2
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0)); g = bpy.context.object; g.data.materials.append(mat("floor", (0.36, 0.33, 0.30)))
    line = mat("line", (0.24, 0.22, 0.20))
    for i in range(-12, 13):
        for horiz in (0, 1):
            bpy.ops.mesh.primitive_plane_add(size=1, location=((0, i * 5 + 2.5, 0.01) if horiz else (i * 5 + 2.5, 0, 0.01)))
            p = bpy.context.object; p.scale = (120, 0.06, 1) if horiz else (0.06, 120, 1); p.data.materials.append(line)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.75, depth=5.75, location=(R + 2.5, -R * 0.3, 2.875)); bpy.context.object.data.materials.append(mat("fig", (0.62, 0.62, 0.66)))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(R + 2.5, -R * 0.3, 5.75 + 0.3)); bpy.context.object.data.materials.append(bpy.data.materials["fig"])
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.render.resolution_x = sc.render.resolution_y = 640; sc.render.film_transparent = False
    try: sc.view_settings.view_transform = "Standard"
    except Exception: pass
    world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.66, 0.72, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
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
    if rec["rule_set"] == "wall":                         # the broad face straight on (camera on the thin axis)
        shot("B", 4, 0 if ext.x >= ext.y else 90, max(S * 1.5, 9), (0, 0, H * 0.5))
    else:
        shot("B", 22, 30, max(S * 1.9, 9), (0, 0, H * 0.48))
    shot("C", 89.9, 0, max(R * 2 * 1.9, 9), (0, 0, H))
    shot("D", 50, 215, max(S * 1.9, 9), (0, 0, H * 0.45))
    print("QA", sku, json.dumps({k_: v for k_, v in rec.items() if k_ not in ("bands_span_xy", "wall")}))

glbs = sorted(MODELS.glob("*.glb"))
if WANT: glbs = [g for g in glbs if g.stem in WANT]
for g in glbs:
    try: one(g)
    except Exception as e:
        import traceback; traceback.print_exc(); print("QAFAIL", g, e)
