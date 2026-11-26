"""Blender: the TOP of a desk mesh, sampled. For each GLB, rays straight down on an 11x11 grid over its bounds (glTF frame:
x across, z front-back with +z the front, y up) -> the first hit's height as a share of the mesh's height (None = a miss).
    blender --background --python tools/desk_tops.py -- OUT.json GLB [GLB ...]"""
import bpy, json, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import bmesh
argv = sys.argv[sys.argv.index('--') + 1:]; out, glbs = argv[0], argv[1:]; res = {}
for g in glbs:
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=g)
    bm = bmesh.new()
    for o in bpy.context.scene.objects:
        if o.type == 'MESH': m = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh(); m.transform(o.matrix_world); bm.from_mesh(m)
    bvh = BVHTree.FromBMesh(bm); vs = [v.co for v in bm.verts]
    lo = Vector([min(v[i] for v in vs) for i in range(3)]); hi = Vector([max(v[i] for v in vs) for i in range(3)])
    H = hi.z - lo.z; grid = []
    for j in range(11):            # glTF z (front +) = Blender -y
        row = []
        for i in range(11):        # glTF x = Blender x
            u, v = -0.5 + (i + 0.5) / 11, -0.5 + (j + 0.5) / 11
            x = (lo.x + hi.x) / 2 + u * (hi.x - lo.x); y = (lo.y + hi.y) / 2 - v * (hi.y - lo.y)
            hit = bvh.ray_cast(Vector((x, y, hi.z + 1)), Vector((0, 0, -1)))
            row.append(None if hit[0] is None else round((hit[0].z - lo.z) / H, 3))
        grid.append(row)
    res[g.rsplit('/', 1)[-1][:-4]] = grid
json.dump(res, open(out, 'w'), indent=1)
