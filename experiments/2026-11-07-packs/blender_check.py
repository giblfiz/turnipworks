# blender -b --factory-startup --python check.py -- picked.json report.json sheet_dir
import bpy, json, sys, os, math
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
picked = json.load(open(args[0])); rep = []; sheet = args[2]; os.makedirs(sheet, exist_ok=True)
scn = bpy.context.scene
for k, p in enumerate(picked):
    bpy.ops.wm.read_factory_settings(use_empty=True); scn = bpy.context.scene
    try:
        bpy.ops.import_scene.gltf(filepath=p['file'])
    except Exception as e:
        rep.append({**p, 'ok': False, 'err': str(e)}); continue
    meshes = [o for o in scn.objects if o.type == 'MESH']
    tex = 0
    for o in meshes:
        for m in o.data.materials:
            if m and m.use_nodes and any(n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > 0 for n in m.node_tree.nodes): tex += 1; break
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = [min(v[i] for v in pts) for i in range(3)]; hi = [max(v[i] for v in pts) for i in range(3)]
    dims = [hi[i] - lo[i] for i in range(3)]   # Blender: x, y (= -glTF z), z up
    biggest = max(dims); want = max(p['size_m']) if p.get('size_m') else p.get('h')
    err = abs((dims[2] if not p.get('size_m') else biggest) - want) / want * 100 if want else None
    r = {**p, 'ok': bool(meshes) and tex == len(meshes), 'meshes': len(meshes), 'textured': tex, 'dims_m': [round(d, 3) for d in dims], 'min_z': round(lo[2], 4), 'size_err_pct': round(err, 2) if err is not None else None}
    rep.append(r)
    if k % 2 == 0 or True:
        # render: camera 3/4 from the front (+glTF Z = Blender -Y), a sun, EEVEE, 384 px
        c = Vector([(lo[i] + hi[i]) / 2 for i in range(3)]); R = max(dims) * 1.6 + 0.05
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
        cam.location = c + Vector((R * 0.7, -R * 1.0, R * 0.75)); cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; scn.collection.objects.link(sun); sun.rotation_euler = (0.8, 0.2, 0.6)
        w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.53, 0.5, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
        for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH'):
            try: scn.render.engine = eng; break
            except TypeError: pass
        scn.render.resolution_x = scn.render.resolution_y = 384; scn.render.film_transparent = False
        scn.render.filepath = os.path.join(sheet, f'r{k:02d}.png'); bpy.ops.render.render(write_still=True)
json.dump(rep, open(args[1], 'w'), indent=1)
