"""Weld-before-decimate trial. Builds ladder rungs 10000/5000/3000/1500 several ways for the sample props.
Run: blender --background --python weld_build.py -- /var/tmp/tw-delivery/weld/jobs.json /var/tmp/tw-delivery/weld [only-variants,comma]
Out: OUT/glb/<variant>/f<rung>/<sku>.glb , OUT/build.jsonl
Variants (all share today's import/join/apply/kit_fix/recentre, and today's descending chain full>20000>10000>5000>3000>1500):
  A    today's pipeline unchanged (also exports ffull = the reference for the pictures)
  B5/B4/B3  bmesh remove_doubles at 1e-5 / 1e-4 / 1e-3 of the largest dimension, then decimate
  P1/P01    B4 + vertex group on UV-seam (and open-edge) vertices, invert_vertex_group=True, factor 1 / 0.1
  Q1        B4 + same group, not inverted, factor 1 (to find out which direction protects)
  Cs/Ca     B4's geometry at each rung, custom normals dropped: all smooth / sharp edges above 40 degrees
"""
import json, math, sys, time
from pathlib import Path
import bpy, bmesh, mathutils
sys.path.insert(0, 'tools/spawn-tuner/prep')
from blender_runtime import kit_fix  # read-only import of the shipped fix

CHAIN = [20000, 10000, 5000, 3000, 1500]; EXPORT = {10000, 5000, 3000, 1500}
args = sys.argv[sys.argv.index('--') + 1:]
JOBS = json.loads(Path(args[0]).read_text()); OUT = Path(args[1])
ONLY = set(args[2].split(',')) if len(args) > 2 else None
VARIANTS = dict(A={}, B5=dict(weld=1e-5), B4=dict(weld=1e-4, normals=['Cs', 'Ca']), B3=dict(weld=1e-3),
                P1=dict(weld=1e-4, vg=(True, 1.0)), P01=dict(weld=1e-4, vg=(True, 0.1)), Q1=dict(weld=1e-4, vg=(False, 1.0)))

def export(v, level, sku):
    dst = OUT / 'glb' / v / f'f{level}' / f'{sku}.glb'; dst.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(dst), export_format='GLB', export_materials='NONE', export_apply=True, export_yup=True, export_normals=True, export_texcoords=True)
    return dst.stat().st_size

def weld(me, dist):
    bm = bmesh.new(); bm.from_mesh(me); n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    n1 = len(bm.verts); bm.to_mesh(me); bm.free(); me.update(); return n0, n1

def seam_verts(me):
    """Vertices on an edge that is open, non-manifold, or whose two faces disagree on the UV at either end (a UV seam)."""
    bm = bmesh.new(); bm.from_mesh(me); uv = bm.loops.layers.uv.active; s = set(); nseam = nopen = 0
    for e in bm.edges:
        ls = e.link_loops
        if len(ls) != 2: s.update(v.index for v in e.verts); nopen += 1; continue
        l1, l2 = ls; a1 = l1[uv].uv; b1 = l1.link_loop_next[uv].uv
        if l2.vert == l1.vert: a2 = l2[uv].uv; b2 = l2.link_loop_next[uv].uv
        else: a2 = l2.link_loop_next[uv].uv; b2 = l2[uv].uv
        if (a1 - a2).length > 1e-6 or (b1 - b2).length > 1e-6: s.update(v.index for v in e.verts); nseam += 1
    ne, nv = len(bm.edges), len(bm.verts); bm.free(); return s, dict(edges=ne, verts=nv, seam_edges=nseam, open_edges=nopen, seam_verts=len(s))

def export_normals(obj, mode, v, level, sku):
    keep = obj.data; tmp = keep.copy(); obj.data = tmp
    for name in ('custom_normal', 'sharp_edge', 'sharp_face'):
        if name in tmp.attributes: tmp.attributes.remove(tmp.attributes[name])
    tmp.shade_smooth()
    if mode == 'Ca': tmp.set_sharp_from_angle(angle=math.radians(40))
    tmp.update(); b = export(v, level, sku); obj.data = keep; bpy.data.meshes.remove(tmp); return b

def process(job):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=job['src'])
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    notes = kit_fix(obj) if job.get('kitfix') else []
    obj.data.update()
    pts = [v.co.copy() for v in obj.data.vertices]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    obj.data.transform(mathutils.Matrix.Translation(-mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
    obj.data.materials.clear()
    maxdim = max(hi[i] - lo[i] for i in range(3))
    base = obj.data.copy(); base.use_fake_user = True
    rec = dict(sku=job['sku'], kit=notes, maxdim=maxdim, nmesh=len(meshes), src_faces=len(base.polygons), src_verts=len(base.vertices),
               src_custom_normals='custom_normal' in base.attributes, src_sharp_edge='sharp_edge' in base.attributes, v={})
    for v, cfg in VARIANTS.items():
        if ONLY and v not in ONLY: continue
        obj.data = base.copy(); r = dict(faces={}, bytes={}); t0 = time.time()
        for g in list(obj.vertex_groups): obj.vertex_groups.remove(g)
        if 'weld' in cfg:
            r['weld'] = weld(obj.data, cfg['weld'] * maxdim); r['faces_after_weld'] = len(obj.data.polygons)
        if 'vg' in cfg or v == 'B4':
            s, r['seams'] = seam_verts(obj.data)
            if 'vg' in cfg: obj.vertex_groups.new(name='seam').add(list(s), 1.0, 'REPLACE')
        r['t_prep'] = round(time.time() - t0, 2); t0 = time.time()
        if v == 'A': export(v, 'full', job['sku'])
        for level in CHAIN:
            cur = len(obj.data.polygons)
            if level < cur:
                mod = obj.modifiers.new(name='d', type='DECIMATE'); mod.decimate_type = 'COLLAPSE'; mod.ratio = level / cur; mod.use_collapse_triangulate = True
                if 'vg' in cfg: mod.vertex_group = 'seam'; mod.invert_vertex_group = cfg['vg'][0]; mod.vertex_group_factor = cfg['vg'][1]
                bpy.ops.object.modifier_apply(modifier=mod.name)
            if level in EXPORT:
                r['bytes'][level] = export(v, level, job['sku']); r['faces'][level] = len(obj.data.polygons)
                for nv in cfg.get('normals', []): export_normals(obj, nv, nv, level, job['sku'])
        r['t_chain'] = round(time.time() - t0, 2); r['custom_normals_end'] = 'custom_normal' in obj.data.attributes
        if 'vg' in cfg or v == 'B4': r['seams_end'] = seam_verts(obj.data)[1]
        old = obj.data; obj.data = base; bpy.data.meshes.remove(old)
        rec['v'][v] = r
    return rec

t00 = time.time()
with (OUT / 'build.jsonl').open('a') as fh:
    for job in JOBS:
        t0 = time.time()
        try: rec = process(job); rec['secs'] = round(time.time() - t0, 1)
        except Exception as exc:
            import traceback; traceback.print_exc(); rec = dict(sku=job['sku'], error=repr(exc))
        fh.write(json.dumps(rec) + '\n'); fh.flush(); print('TW_WELD', json.dumps(rec)[:300], flush=True)
print('TW_WELD_DONE', round(time.time() - t00, 1))
