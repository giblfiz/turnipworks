"""Turn a GLB about the vertical axis so its LONG horizontal axis runs along X with the HIGH end (a chiwen's curled tail) at +X
(so the mouth end is at -X): blender --background --python tools/turn.py -- IN.glb OUT.glb
Prints where the high end was. The original stays where it was (models-unturned/)."""
import sys, math, bpy, mathutils
src, out = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
vs = [o.matrix_world @ v.co for o in obs for v in o.data.vertices]
lo = [min(v[i] for v in vs) for i in range(3)]; hi = [max(v[i] for v in vs) for i in range(3)]
dx, dy = hi[0] - lo[0], hi[1] - lo[1]      # Blender X, Y horizontal (glTF X, -Z); Z up
top = sorted(vs, key=lambda v: -v[2])[:max(20, len(vs) // 50)]
cx, cy = sum(v[0] for v in top) / len(top), sum(v[1] for v in top) / len(top); mx, my = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
if dy > dx: ang = math.radians(90) if cy > my else math.radians(-90)   # high end at +Y -> turn it to... (rotation about Z by -90 takes +Y to +X)
else: ang = 0 if cx > mx else math.radians(180)
if dy > dx: ang = -math.radians(90) if cy > my else math.radians(90)
print(f'extent X {dx:.3f} Y {dy:.3f}; high end at ({cx - mx:+.3f}, {cy - my:+.3f}) from the middle; turning {math.degrees(ang):.0f} deg about up')
R = mathutils.Matrix.Rotation(ang, 4, 'Z')
for o in obs:
    if o.parent is None: o.matrix_world = R @ o.matrix_world
bpy.context.view_layer.update()
vs = [o.matrix_world @ v.co for o in obs for v in o.data.vertices]; top = sorted(vs, key=lambda v: -v[2])[:max(20, len(vs) // 50)]
print('after: extent X %.3f Y %.3f, high end x %+.3f' % (max(v[0] for v in vs) - min(v[0] for v in vs), max(v[1] for v in vs) - min(v[1] for v in vs), sum(v[0] for v in top) / len(top) - sum((max(v[0] for v in vs), min(v[0] for v in vs))) / 2))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
