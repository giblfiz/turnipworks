"""List (or drop) the loose parts of a GLB: blender --background --python tools/parts.py -- IN.glb [OUT.glb DROP_INDEX,...]
Prints each part's face count, bounding box (fractions of the whole) and flatness, biggest first."""
import sys, bpy, bmesh
a = sys.argv[sys.argv.index('--') + 1:]; src = a[0]; out = a[1] if len(a) > 1 else None; drop = {int(x) for x in a[2].split(',')} if len(a) > 2 else set()
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
ob = next(o for o in bpy.context.scene.objects if o.type == 'MESH'); me = ob.data
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
seen, parts = set(), []
for f in bm.faces:
    if f.index in seen: continue
    stack, comp = [f], []
    seen.add(f.index)
    while stack:
        g = stack.pop(); comp.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen: seen.add(h.index); stack.append(h)
    parts.append(comp)
co = [v.co for v in bm.verts]; lo = [min(c[i] for c in co) for i in range(3)]; hi = [max(c[i] for c in co) for i in range(3)]
parts.sort(key=len, reverse=True)
for k, comp in enumerate(parts[:12]):
    vs = {v for f in comp for v in f.verts}; plo = [min(v.co[i] for v in vs) for i in range(3)]; phi = [max(v.co[i] for v in vs) for i in range(3)]
    print(k, len(comp), 'box', [round((plo[i] - lo[i]) / max(1e-6, hi[i] - lo[i]), 2) for i in range(3)], [round((phi[i] - lo[i]) / max(1e-6, hi[i] - lo[i]), 2) for i in range(3)])
print('parts', len(parts), 'faces', len(bm.faces))
if out:
    kill = [f for k in drop for f in parts[k]]
    bmesh.ops.delete(bm, geom=kill, context='FACES'); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS'); bm.to_mesh(me); me.update()
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB'); print('wrote', out, 'dropped', sorted(drop))
