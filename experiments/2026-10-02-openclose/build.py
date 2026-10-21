"""Build the open/close pilot assets (runtime tier) + the hinge sidecar.

blender --background --python build.py
Outputs (in runtime/): chest-parts.glb, chest-cut.glb, chest-swap-closed.glb, chest-swap-open.glb, door-demo.glb,
and openclose.json (the animation data). All GLBs are glTF Y-up, origin bottom-centre, front facing +Z.
Blender axes here: front = -Y, back (hinge side) = +Y, up = +Z.  glTF (x, y, z) = Blender (x, z, -y).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path("experiments/2026-10-02-openclose")
sys.path.insert(0, str(HERE))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

from bl_common import bounds, decimate, load_joined, matte, scale_mesh, to_bottom_centre  # noqa: E402

TUNER = Path("tools/spawn-tuner/assets/m")  # read only
INN01 = Path("experiments/2026-09-30-inn-01-500/models")
OUT = HERE / "runtime"
OUT.mkdir(exist_ok=True)
TEX = 512
REPORT = {}


def gl(v):
    """Blender vector -> glTF list."""
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cap_material(name, png):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False  # exported doubleSided: interior walls read from either side
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(HERE / png))
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def mat_index(obj, mat):
    for i, s in enumerate(obj.material_slots):
        if s.material == mat:
            return i
    obj.data.materials.append(mat)
    return len(obj.data.materials) - 1


def bvh_of(obj):
    # straight from mesh data: the evaluated depsgraph copy goes stale after bmesh edits in this script
    mw = obj.matrix_world
    return BVHTree.FromPolygons([mw @ v.co for v in obj.data.vertices], [tuple(p.vertices) for p in obj.data.polygons])


def planar_uv(bm, faces, uv_layer, k=3.0):
    for f in faces:
        n = f.normal
        for loop in f.loops:
            c = loop.vert.co
            if abs(n.z) > 0.7:
                loop[uv_layer].uv = (c.x * k, c.y * k)
            elif abs(n.x) > abs(n.y):
                loop[uv_layer].uv = (c.y * k, c.z * k)
            else:
                loop[uv_layer].uv = (c.x * k, c.z * k)


def cut(obj, z, keep):
    """Bisect at height z; keep 'below' or 'above'. Returns the boundary edges on the cut plane."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1),
                                 clear_outer=(keep == "below"), clear_inner=(keep == "above"), dist=1e-5)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return len([g for g in res["geom_cut"] if isinstance(g, bmesh.types.BMEdge)])


def simplify_hull(hull, min_turn_deg=12.0, min_edge_frac=0.04):
    """Drop near-collinear and very close hull points: inset_region spikes on short, almost straight edges."""
    per = sum((hull[i] - hull[i - 1]).length for i in range(len(hull)))
    changed = True
    while changed and len(hull) > 4:
        changed = False
        for i in range(len(hull)):
            a, b, c = hull[i - 1], hull[i], hull[(i + 1) % len(hull)]
            u, w = b - a, c - b
            if u.length < 1e-9 or w.length < 1e-9:
                turn = 0.0
            else:
                turn = math.degrees(u.angle(w))
            if turn < min_turn_deg or u.length < min_edge_frac * per:
                hull.pop(i)
                changed = True
                break
    return hull


def cap_cut(obj, z, depth, inset, direction, rim_mat, in_mat, keep_open_cavity=False):
    """Cap the open cross-section at height z with a geometric (not topological) cap: TRELLIS shells are rarely
    clean manifolds, so the bisect boundary does not form fillable loops. Instead: 2D convex hull of the cut
    vertices -> ngon -> inset by the wall thickness (rim ring). If the mesh is already hollow (keep_open_cavity)
    the inner face is deleted, leaving a ring over the wall shell. Otherwise the inner face is pushed `depth`
    along `direction` (-1 down into a body, +1 up into a lid) to make a dark recessed interior box."""
    from mathutils.geometry import convex_hull_2d
    rim_i = mat_index(obj, rim_mat)
    in_i = mat_index(obj, in_mat)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new()
    pts = [v.co.xy.copy() for v in bm.verts if abs(v.co.z - z) < 1e-4]
    info = {"cut_verts": len(pts)}
    if len(pts) < 3:
        bm.free()
        return info
    # outline = axis-aligned rectangle of the cut: a superset of the cross-section, so the cap never leaves a gap
    # into the open shell (cost: up to a band's thickness of overhang where the wood is recessed between straps).
    # A convex hull + inset spiked on short near-collinear edges; simplify_hull is kept for non-box props.
    x0, x1 = min(p.x for p in pts), max(p.x for p in pts)
    y0, y1 = min(p.y for p in pts), max(p.y for p in pts)
    hull = [Vector((x0, y0)), Vector((x1, y0)), Vector((x1, y1)), Vector((x0, y1))]
    zz = z + direction * -1e-4  # a hair outside the cut so the cap wins the depth test over the shell edge
    verts = [bm.verts.new((p.x, p.y, zz)) for p in hull]
    face = bm.faces.new(verts)
    bm.normal_update()
    want_up = direction < 0  # body top faces up; lid underside faces down
    if (face.normal.z > 0) != want_up:
        face.normal_flip()
    face.material_index = rim_i
    ins = bmesh.ops.inset_region(bm, faces=[face], thickness=inset, depth=0.0, use_even_offset=True, use_boundary=True)
    ring = ins["faces"]
    for f in ring:
        f.material_index = rim_i
    info.update(hull_pts=len(hull), ring_faces=len(ring))
    if keep_open_cavity:
        bmesh.ops.delete(bm, geom=[face], context="FACES_ONLY")
        planar_uv(bm, ring, uv)
    else:
        ext = bmesh.ops.extrude_face_region(bm, geom=[face])
        moved = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
        floor = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMFace)]
        if face.is_valid:
            bmesh.ops.delete(bm, geom=[face], context="FACES_ONLY")
        bmesh.ops.translate(bm, verts=moved, vec=(0, 0, direction * depth))
        bm.normal_update()
        # extrusion side walls face outward from the pushed region: flip them so they face into the cavity
        side = list({f for v in moved for f in v.link_faces if f not in floor})
        bm.normal_update()
        mid = floor[0].calc_center_median()
        mid.z = z + direction * depth * 0.5
        for f in side:  # each wall must face the cavity centre
            if f.normal.dot(mid - f.calc_center_median()) < 0:
                f.normal_flip()
        for f in floor:  # body floor faces up, lid recess ceiling faces down
            if (f.normal.z > 0) != (direction < 0):
                f.normal_flip()
        for f in floor + side:
            f.material_index = in_i
        planar_uv(bm, ring + floor + side, uv)
        # TRELLIS leaves stray inner shells inside a "solid" prop: drop original faces inside the new cavity prism
        poly = [v.co.xy.copy() for v in floor[0].verts]
        z0, z1 = sorted((z, z + direction * depth))

        def inside(pt):
            sgn = 0
            for i in range(len(poly)):
                a, b = poly[i], poly[(i + 1) % len(poly)]
                c = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)
                if c != 0:
                    if sgn == 0:
                        sgn = 1 if c > 0 else -1
                    elif (c > 0) != (sgn > 0):
                        return False
            return True
        # any vertex inside the prism (not just the centroid): stray slabs that cross the new walls poke through
        junk = [f for f in bm.faces if f.material_index not in (rim_i, in_i)
                and any(z0 - 1e-4 <= co.z <= z1 + 1e-4 and inside(co.xy)
                        for co in [v.co for v in f.verts] + [f.calc_center_median()])]
        bmesh.ops.delete(bm, geom=junk, context="FACES")
        info["junk_faces_removed"] = len(junk)
        info.update(floor_faces=len(floor), wall_faces=len(side))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return info

def cap_score(obj, zc, depth, direction, in_mat):
    """Ray audit of a cap. inside: rays from the cavity centre outward must hit the added interior first (else old
    TRELLIS inner shell shows through). outside: rays from outside must never hit the added interior first (else
    the dark box pokes out through a recessed wall)."""
    bvh = bvh_of(obj)
    mi = [p.material_index for p in obj.data.polygons]
    in_i = [i for i, m in enumerate(obj.data.materials) if m == in_mat][0]
    lo, hi = bounds(obj)
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    zs = [zc + direction * depth * f for f in (0.15, 0.4, 0.65, 0.85)]
    good = tot = 0
    for z in zs:
        for k in range(8):
            a = k * math.pi / 4
            hit = bvh.ray_cast(Vector((cx, cy, z)), Vector((math.cos(a), math.sin(a), 0)))
            tot += 1
            good += bool(hit[0]) and mi[hit[2]] == in_i
    bad = n = 0
    zlo, zhi = (lo.z, zc) if direction < 0 else (zc, hi.z)
    for f in (0.1, 0.3, 0.5, 0.7, 0.9):
        z = zlo + (zhi - zlo) * f
        for g in (0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9):
            x = lo.x + (hi.x - lo.x) * g
            y = lo.y + (hi.y - lo.y) * g
            for org, d in (((x, lo.y - 2, z), (0, 1, 0)), ((x, hi.y + 2, z), (0, -1, 0)),
                           ((lo.x - 2, y, z), (1, 0, 0)), ((hi.x + 2, y, z), (-1, 0, 0))):
                hit = bvh.ray_cast(Vector(org), Vector(d))
                n += 1
                bad += bool(hit[0]) and mi[hit[2]] == in_i
    return {"inside_hits_interior": f"{good}/{tot}", "outside_sees_interior": f"{bad}/{n}", "_good": good / tot, "_bad": bad}


def cap_search(obj, zc, depth, direction, rim, dark, width, fracs=(0.075, 0.1, 0.12, 0.14, 0.16, 0.18)):
    base = obj.data.copy()
    trials = []
    for f in fracs:
        obj.data = base.copy()
        info = cap_cut(obj, zc, depth, f * width, direction, rim, dark)
        s = cap_score(obj, zc, depth, direction, dark)
        trials.append((f, s))
        if s["_bad"] == 0 and s["_good"] >= 0.95:
            break
    ok = [tr for tr in trials if tr[1]["_bad"] == 0]
    f, s = max(ok, key=lambda tr: (tr[1]["_good"], -tr[0])) if ok else min(trials, key=lambda tr: tr[1]["_bad"])
    if f != trials[-1][0]:
        obj.data = base.copy()
        info = cap_cut(obj, zc, depth, f * width, direction, rim, dark)
    info.update(inset_frac=f, audit={k: v for k, v in s.items() if not k.startswith("_")},
                trials=[[tf, ts["inside_hits_interior"], ts["outside_sees_interior"]] for tf, ts in trials])
    return info


def ray_h(obj, origin, direction):
    bvh = bvh_of(obj)
    hit = bvh.ray_cast(Vector(origin), Vector(direction))
    return hit[0]


def ray_down(obj, x, y):
    bvh = bvh_of(obj)
    hit = bvh.ray_cast(Vector((x, y, 50)), Vector((0, 0, -1)))
    return round(hit[0].z, 4) if hit[0] else None


def band(obj, z0, z1):
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices if z0 <= (obj.matrix_world @ v.co).z <= z1]
    lo = Vector([min(v[i] for v in vs) for i in range(3)])
    hi = Vector([max(v[i] for v in vs) for i in range(3)])
    return lo, hi


def hinge_rig(name, body_objs, moving, pivot, axis_gl, open_deg, extra=None):
    """Parent `moving` under an empty at `pivot` (mesh data re-expressed relative to it), export GLB."""
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for b in body_objs:
        b.parent = root
    hinge = bpy.data.objects.new(f"{moving.name}_hinge", None)
    bpy.context.scene.collection.objects.link(hinge)
    hinge.parent = root
    hinge.location = pivot
    moving.data.transform(Matrix.Translation(-pivot))
    moving.location = (0, 0, 0)
    moving.parent = hinge
    path = OUT / f"{name}.glb"
    export(path)
    rec = {
        "glb": f"runtime/{name}.glb",
        "mode": "hinge",
        "parts": {"static": [b.name for b in body_objs], "moving": moving.name, "pivotNode": hinge.name},
        "pivot": gl(pivot),
        "axis": axis_gl,
        "openAngle": open_deg,
        "duration": 0.9,
        "ease": "inOutCubic",
        "openEase": "outBack",
    }
    if extra:
        rec.update(extra)
    return rec


def export(path):
    for o in bpy.data.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_image_format="WEBP",
                              export_image_quality=80, export_apply=True, export_yup=True)


def faces(*objs):
    return sum(len(o.data.polygons) for o in objs)


def prep(path, name, faces_target):
    o = load_joined(str(path), name)
    src = len(o.data.polygons)
    return o, src


# ---------------------------------------------------------------- 1. separate parts (generated body + lid)
def front_is_plus_y(obj):
    """Lock plate / hasp side: the centre column protrudes further than the sides at mid height."""
    lo, hi = bounds(obj)
    d = hi - lo
    mid = [v.co.y for v in obj.data.vertices if abs(v.co.x - (lo.x + hi.x) / 2) < 0.08 * d.x and lo.z + 0.15 * d.z < v.co.z < lo.z + 0.7 * d.z]
    side = [v.co.y for v in obj.data.vertices if abs(v.co.x - (lo.x + hi.x) / 2) > 0.3 * d.x and lo.z + 0.15 * d.z < v.co.z < lo.z + 0.7 * d.z]
    plus = max(mid) - max(side)
    minus = min(side) - min(mid)
    return plus > minus, round(plus, 4), round(minus, 4)


def build_multi(name, title, body_path, lid_path, sku_note):
    """Approach 1-multi: raw multi-view body + lid. Decimate, orient (front = -Y), place the lid on the rim, hinge.
    No trims, caps or patches."""
    reset()
    body, src_b = prep(body_path, "body", 6000)
    lid, src_l = prep(lid_path, "lid", 4000)
    db = decimate(body, 6200)
    dl = decimate(lid, 4000)
    notes = {}
    for o in (body, lid):
        flip, plus, minus = front_is_plus_y(o)
        notes[o.name + "_front_protrusion_+y/-y"] = [plus, minus]
        if flip:
            o.data.transform(Matrix.Rotation(math.pi, 4, "Z"))
            notes[o.name + "_turned_180"] = True
    to_bottom_centre(body)
    lo, hi = bounds(body)
    H = hi.z - lo.z
    vs = [v.co for v in body.data.vertices]
    rims = [max(v.z for v in vs if v.y < lo.y + 0.12 * (hi.y - lo.y) and abs(v.x) < 0.35 * (hi.x - lo.x)),
            max(v.z for v in vs if v.y > hi.y - 0.12 * (hi.y - lo.y) and abs(v.x) < 0.35 * (hi.x - lo.x))]
    zf = min(rims)
    blo, bhi = band(body, zf - 0.04 * H, zf)
    llo, lhi = bounds(lid)
    LH = lhi.z - llo.z
    skirt = [v.co for v in lid.data.vertices if llo.z + 0.12 * LH <= v.co.z <= llo.z + 0.3 * LH]
    slo = Vector([min(v[i] for v in skirt) for i in range(3)])
    shi = Vector([max(v[i] for v in skirt) for i in range(3)])
    rim_z = min(v.co.z for v in lid.data.vertices if abs(v.co.x) > 0.3 * (lhi.x - llo.x))
    sx = (bhi.x - blo.x) / (shi.x - slo.x)
    sy = (bhi.y - blo.y) / (shi.y - slo.y)
    sz = 0.8 * sx
    lid.data.transform(Matrix.Translation(Vector((-(slo.x + shi.x) / 2, -(slo.y + shi.y) / 2, -rim_z))))
    scale_mesh(lid, sx, sy, sz)
    lid.data.transform(Matrix.Translation(Vector(((blo.x + bhi.x) / 2, (blo.y + bhi.y) / 2, zf))))
    lb = bvh_of(lid)
    above = [v.co for v in body.data.vertices if v.co.z > zf + 1e-3]
    out = 0
    for c in above:
        loc, nrm, idx, dist = lb.find_nearest(c)
        if loc is not None and (c - loc).dot(nrm) > 1e-3:
            out += 1
    for o in (body, lid):
        matte(o, TEX)
        for s in o.material_slots:
            s.material.use_backface_culling = False  # hollow shells: inner faces must render (flag, not geometry)
    pivot = Vector((0, bhi.y, zf))
    REPORT[name] = {"src_faces": [src_b, src_l], "faces": faces(body, lid), "rim_frac": round(zf / H, 3),
                    "body_depth_over_width": round((hi.y - lo.y) / (hi.x - lo.x), 3),
                    "body_verts_above_lid_line_outside_lid": f"{out}/{len(above)}",
                    "lid_scale": [round(sx, 3), round(sy, 3), round(sz, 3)], "decimate": [db, dl], **notes}
    return hinge_rig(name, [body], lid, pivot, [1, 0, 0], -105,
                     {"title": title, "sku": "chest-ironbound", "size_in": [36, 20, 22], "variantOf": "chest-parts",
                      "geometryOps": ["decimate", "orient", "lid placement transform"], "source": sku_note})


def build_parts_raw():
    """Approach 1, raw (Harry 2026-10-02: generated surfaces beat procedural patches). Raw generated body and lid;
    only decimation, a placement transform for the lid, and the hinge rig. No trim was needed: the body's walls rise
    toward the back (a wedge), so the lid sits at the front-rim height and the higher back walls tuck inside the
    solid lid when closed."""
    reset()
    body, src_b = prep(HERE / "models/chest-ib--body.glb", "body", 6000)
    lid, src_l = prep(HERE / "models/chest-ib--lid.glb", "lid", 4000)
    db = decimate(body, 6200)
    dl = decimate(lid, 4000)
    to_bottom_centre(body)
    lo, hi = bounds(body)
    H = hi.z - lo.z
    zf = max(v.co.z for v in body.data.vertices if v.co.y < lo.y + 0.15 * (hi.y - lo.y)
             and abs(v.co.x) < 0.3 * (hi.x - lo.x))  # front rim height
    blo, bhi = band(body, zf - 0.04 * H, zf)
    # without a trim, the wedge's back walls poke out through the closed lid (measured 406/674 verts outside it),
    # so a clean planar trim at the front-rim height is needed. No cap: the wall tops stay as generated, and the
    # body material is made double-sided (a flag, not geometry) so the open wall section is not see-through.
    trimmed = cut(body, zf, "below") > 0
    for s in body.material_slots:
        s.material.use_backface_culling = False
    llo, lhi = bounds(lid)
    LH = lhi.z - llo.z
    skirt = [v.co for v in lid.data.vertices if llo.z + 0.12 * LH <= v.co.z <= llo.z + 0.3 * LH]
    slo = Vector([min(v[i] for v in skirt) for i in range(3)])
    shi = Vector([max(v[i] for v in skirt) for i in range(3)])
    rim_z = min(v.co.z for v in lid.data.vertices if abs(v.co.x) > 0.3 * (lhi.x - llo.x))
    sx = (bhi.x - blo.x) / (shi.x - slo.x)
    sy = (bhi.y - blo.y) / (shi.y - slo.y)
    sz = 0.8 * sx
    lid.data.transform(Matrix.Translation(Vector((-(slo.x + shi.x) / 2, -(slo.y + shi.y) / 2, -rim_z))))
    scale_mesh(lid, sx, sy, sz)
    lid.data.transform(Matrix.Translation(Vector(((blo.x + bhi.x) / 2, (blo.y + bhi.y) / 2, zf))))
    # audit: body vertices above the lid line must stay inside the closed lid (else the wedge walls poke out)
    lb = bvh_of(lid)
    above = [v.co for v in body.data.vertices if v.co.z > zf + 1e-3]
    out = 0
    for c in above:
        loc, nrm, idx, dist = lb.find_nearest(c)
        if loc is not None and (c - loc).dot(nrm) > 1e-3:
            out += 1
    for o in (body, lid):
        matte(o, TEX)
    pivot = Vector((0, bhi.y, zf))
    REPORT["parts_raw"] = {"src_faces": [src_b, src_l], "faces": faces(body, lid), "lid_line_frac": round(zf / H, 3),
                           "back_wall_above_lid_line_frac": round((H - zf) / H, 3),
                           "body_verts_above_lid_line_outside_lid": f"{out}/{len(above)}",
                           "lid_scale": [round(sx, 3), round(sy, 3), round(sz, 3)], "decimate": [db, dl]}
    return hinge_rig("chest-parts-raw", [body], lid, pivot, [1, 0, 0], -105,
                     {"title": "Separate parts (raw)", "sku": "chest-ironbound", "size_in": [36, 20, 22], "lead": True,
                      "variantOf": "chest-parts", "geometryOps": ["decimate", "planar trim (body, front-rim height)", "lid placement transform"],
                      "trimmed": trimmed})


def build_parts():
    reset()
    rim = cap_material("rim_wood", "tex-rim.png")
    body, src_b = prep(HERE / "models/chest-ib--body.glb", "body", 6000)
    lid, src_l = prep(HERE / "models/chest-ib--lid.glb", "lid", 4000)
    db = decimate(body, 6200)
    dl = decimate(lid, 4000)
    to_bottom_centre(body)
    lo, hi = bounds(body)
    H = hi.z - lo.z
    # the generated body's side walls rise toward the back (wedge; front rim at ~75% height): level it at the
    # front-rim height so the lid can sit flat
    front_top = max(v.co.z for v in body.data.vertices if v.co.y < lo.y + 0.15 * (hi.y - lo.y)
                    and abs(v.co.x) < 0.3 * (hi.x - lo.x))
    zc = front_top - 0.01 * H
    n_cut = cut(body, zc, "below")
    blo, bhi = band(body, zc - 0.04 * H, zc)
    zt = zc - 0.03 * H  # just below the rim
    cy = (blo.y + bhi.y) / 2
    inner = {"+x": ray_h(body, (0, cy, zt), (1, 0, 0)), "-x": ray_h(body, (0, cy, zt), (-1, 0, 0)),
             "+y": ray_h(body, (0, cy, zt), (0, 1, 0)), "-y": ray_h(body, (0, cy, zt), (0, -1, 0))}
    thick = [bhi.x - inner["+x"].x, inner["-x"].x - blo.x, bhi.y - inner["+y"].y, inner["-y"].y - blo.y]
    wall_t = max(0.02, sorted(thick)[1])  # second smallest: robust to one band / lock plate
    cap = cap_cut(body, zc, 0, wall_t, -1, rim, rim, keep_open_cavity=True)
    cap["wall_thickness_xxyy"] = [round(x, 4) for x in thick]
    cap_l = None
    floor_hit = ray_down(body, 0, (blo.y + bhi.y) / 2)
    # lid: footprint from its skirt (skip the hanging hasp), scale x/y onto the body rim, squash a little
    llo, lhi = bounds(lid)
    LH = lhi.z - llo.z
    skirt = [v.co for v in lid.data.vertices if llo.z + 0.12 * LH <= v.co.z <= llo.z + 0.3 * LH]
    slo = Vector([min(v[i] for v in skirt) for i in range(3)])
    shi = Vector([max(v[i] for v in skirt) for i in range(3)])
    rim_z = min(v.co.z for v in lid.data.vertices if abs(v.co.x) > 0.3 * (lhi.x - llo.x))  # rim bottom at the ends
    sx = (bhi.x - blo.x) / (shi.x - slo.x)
    sy = (bhi.y - blo.y) / (shi.y - slo.y)
    sz = 0.8 * sx
    lid.data.transform(Matrix.Translation(Vector((-(slo.x + shi.x) / 2, -(slo.y + shi.y) / 2, -rim_z))))
    scale_mesh(lid, sx, sy, sz)
    lid.data.transform(Matrix.Translation(Vector(((blo.x + bhi.x) / 2, (blo.y + bhi.y) / 2, zc))))
    # TRELLIS closed the lid with a flat grey underside: trim 4% above its rim (drops the hanging hasp) and give
    # it the same rim ring + dark recess as the cut approach. Then drop the lid by the trim so it still sits on zc.
    l_lo, l_hi = bounds(lid)
    trim = zc + 0.04 * (l_hi.z - zc)
    cut(lid, trim, "above")
    lid.data.transform(Matrix.Translation(Vector((0, 0, zc - trim))))
    dark = cap_material("interior_dark", "tex-interior.png")
    cap_l = cap_search(lid, zc, 0.4 * (l_hi.z - trim), +1, rim, dark, bhi.x - blo.x)
    for o in (body, lid):
        matte(o, TEX)
    pivot = Vector((0, bhi.y, zc))  # back-top edge of the body
    REPORT["parts"] = {"src_faces": [src_b, src_l], "faces": faces(body, lid), "body_cut_frac": round(zc / H, 3),
                       "cut_edges": n_cut, "cap": cap, "cap_lid": cap_l, "cavity_floor_hit_z_over_rim": round(floor_hit / zc, 3) if floor_hit else None,
                       "lid_scale": [round(sx, 3), round(sy, 3), round(sz, 3)], "decimate": [db, dl]}
    return hinge_rig("chest-parts", [body], lid, pivot, [1, 0, 0], -105,
                     {"title": "Separate parts", "sku": "chest-ironbound", "size_in": [36, 20, 22]})


# ---------------------------------------------------------------- 2. cut and cap (existing inn-01 chest)
CUT_FRAC = 0.60  # lid line: middle of the horizontal iron band (ortho renders, shots/closed-front.png)


def build_cut():
    reset()
    rim = cap_material("rim_wood", "tex-rim.png")
    dark = cap_material("interior_dark", "tex-interior.png")
    body, src = prep(INN01 / "chest-ironbound.glb", "body", 6000)
    to_bottom_centre(body)
    lo, hi = bounds(body)
    H = hi.z - lo.z
    zc = CUT_FRAC * H
    # duplicate for the lid
    d0 = decimate(body, 9300)  # decimate once, before the cut: collapsing after it would lift verts off the plane
    lid = body.copy()
    lid.data = body.data.copy()
    lid.name = "lid"
    bpy.context.scene.collection.objects.link(lid)
    cut(body, zc, "below")
    cut(lid, zc, "above")
    blo, bhi = band(body, zc - 0.03 * H, zc)
    # inset from the convex hull: the smallest that hides TRELLIS's grey inner shell without poking out (ray audit)
    cb = cap_search(body, zc, 0.78 * zc, -1, rim, dark, bhi.x - blo.x)
    cl = cap_search(lid, zc, 0.45 * (hi.z - zc), +1, rim, dark, bhi.x - blo.x)
    hit = ray_down(body, 0, (blo.y + bhi.y) / 2)
    db, dl = d0, None
    for o in (body, lid):
        matte(o, TEX)
    pivot = Vector((0, bhi.y, zc))
    REPORT["cut"] = {"src_faces": src, "faces": faces(body, lid), "cut_frac": CUT_FRAC, "cap_body": cb, "cap_lid": cl,
                     "interior_floor_hit_frac_of_rim": round(hit / zc, 3) if hit else None, "decimate": [db, dl]}
    return hinge_rig("chest-cut", [body], lid, pivot, [1, 0, 0], -105,
                     {"title": "Cut and cap", "sku": "chest-ironbound", "size_in": [36, 20, 22]})


# ---------------------------------------------------------------- 3. two-state swap
def build_swap():
    recs = {}
    fps = {}
    for state in ("closed", "open"):
        reset()
        o, src = prep(HERE / f"models/chest-ib--{state}.glb", f"chest_{state}", 8000)
        to_bottom_centre(o)
        lo, hi = bounds(o)
        flo, fhi = band(o, lo.z, lo.z + 0.25 * (hi.z - lo.z))  # body footprint (the open lid stands above it)
        fps[state] = (flo, fhi, lo, hi)
        if state == "open":
            c = fps["closed"]
            k = (c[1].x - c[0].x) / (fhi.x - flo.x)
            o.data.transform(Matrix.Translation(Vector((-(flo.x + fhi.x) / 2, -(flo.y + fhi.y) / 2, 0))))
            scale_mesh(o, k, k, k)
            o.data.transform(Matrix.Translation(Vector(((c[0].x + c[1].x) / 2, (c[0].y + c[1].y) / 2, 0))))
            nlo, nhi = band(o, 0, 0.25 * (hi.z - lo.z) * k)
            REPORT.setdefault("swap", {})["footprint_closed_xy"] = [round(c[1].x - c[0].x, 3), round(c[1].y - c[0].y, 3)]
            REPORT["swap"]["footprint_open_xy_after"] = [round(nhi.x - nlo.x, 3), round(nhi.y - nlo.y, 3)]
            REPORT["swap"]["open_scale"] = round(k, 3)
        d = decimate(o, 8000)
        matte(o, TEX)
        export(OUT / f"chest-swap-{state}.glb")
        REPORT.setdefault("swap", {})[f"{state}_faces"] = [src, d[1]]
        recs[state] = f"runtime/chest-swap-{state}.glb"
    return {"title": "Two-state swap", "mode": "swap", "sku": "chest-ironbound", "size_in": [36, 20, 22],
            "states": recs, "duration": 0.35, "pop": 0.08, "ease": "inOutCubic"}


# ---------------------------------------------------------------- 4. door demo (existing runtime assets, no generation)
def build_door():
    reset()
    frame, _ = prep(TUNER / "wall-doorway--dressed-stone.glb", "frame", 99999)
    leaf, _ = prep(TUNER / "door-plank--leaf.glb", "leaf", 99999)
    to_bottom_centre(frame)
    to_bottom_centre(leaf)
    lo, hi = bounds(frame)
    H = hi.z - lo.z
    # opening: raycast through the wall along Y at mid height; the longest run of misses is the doorway
    ylo0, yhi0 = band(frame, 0.25 * H, 0.5 * H)
    xs = [lo.x + (hi.x - lo.x) * i / 400 for i in range(401)]
    miss = [ray_h(frame, (x, ylo0.y - 1, 0.35 * H), (0, 1, 0)) is None for x in xs]
    best, run = (0, 0, 0), None
    for i, m in enumerate(miss + [False]):
        if m and run is None:
            run = i
        if not m and run is not None:
            if i - run > best[0]:
                best = (i - run, run, i - 1)
            run = None
    x0, x1 = xs[best[1]], xs[best[2]]
    g = x1 - x0
    cx = (x0 + x1) / 2
    top = 0.0
    for i in range(400):
        zz = 0.35 * H + (H - 0.35 * H) * i / 400
        if ray_h(frame, (cx, ylo0.y - 1, zz), (0, 1, 0)) is not None:
            top = zz
            break
    ylo, yhi = band(frame, 0.25 * H, 0.5 * H)
    wall_mid_y = (ylo.y + yhi.y) / 2
    llo, lhi = bounds(leaf)
    sx = (g * 0.98) / (lhi.x - llo.x)
    sz = (top * 0.99) / (lhi.z - llo.z)
    scale_mesh(leaf, sx, sx, sz)
    llo, lhi = bounds(leaf)
    leaf.data.transform(Matrix.Translation(Vector((x0 + 0.01 * g - llo.x, wall_mid_y - (llo.y + lhi.y) / 2, 0))))
    llo, lhi = bounds(leaf)
    pivot = Vector((llo.x, (llo.y + lhi.y) / 2, 0))
    REPORT["door"] = {"opening_w_frac": round(g / (hi.x - lo.x), 3), "opening_h_frac": round(top / H, 3),
                      "leaf_scale_xz": [round(sx, 3), round(sz, 3)], "faces": faces(frame, leaf)}
    return hinge_rig("door-demo", [frame], leaf, pivot, [0, 1, 0], -95,
                     {"title": "Door (existing leaf + doorway)", "sku": "wall-doorway--dressed-stone + door-plank--leaf",
                      "size_in": [60, 12, 108], "fit": "height"})


def main():
    data = {"version": 1, "units": "glb-local (runtime tier, width ~1); size_in is the catalog size the tuner scales to",
            "convention": "glTF Y-up, front +Z, pivot in GLB root space; openAngle in degrees about axis (right-hand rule)",
            "assets": {}}
    data["assets"]["chest-parts-raw"] = build_parts_raw()
    data["assets"]["chest-multi-trellis"] = build_multi(
        "chest-multi-trellis", "1-multi: trellis", HERE / "mv/models/trellis-body.glb", HERE / "mv/models/trellis-lid.glb",
        "fal-ai/trellis/multi from Gemini view sets (mv/views)")
    # chest-multi-hunyuan removed 2026-10-21: Hunyuan3D's licence bars distributing its output in the EU, UK and South Korea (docs/LICENSING_AUDIT.md).
    data["assets"]["chest-parts"] = build_parts()
    data["assets"]["chest-parts"].update(title="Separate parts (patched)", variantOf="chest-parts",
                                         geometryOps=["decimate", "planar trim", "rim ring", "lid recess cap"])
    data["assets"]["chest-cut"] = build_cut()
    data["assets"]["chest-swap"] = build_swap()
    data["assets"]["door-demo"] = build_door()
    (OUT / "openclose.json").write_text(json.dumps(data, indent=1) + "\n")
    (HERE / "build-report.json").write_text(json.dumps(REPORT, indent=1) + "\n")
    print("BUILD_REPORT", json.dumps(REPORT))


if __name__ == "__main__":
    main()
