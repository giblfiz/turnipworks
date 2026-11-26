"""A 3 x 3 patch of one roof section (its `near` mesh, units = feet), tilted to a 35-degree slope rising away from the camera, lit by
a low sun, seen from a table-like three-quarter camera: does it tile, does the relief read?
    blender --background --python tools/section_preview.py -- IN.glb OUT.png"""
import math, sys
import bpy, mathutils
src, out = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
for o in [o for o in sc.objects if o.type == 'MESH' and o.name.startswith('far')]: bpy.data.objects.remove(o)
near = next(o for o in sc.objects if o.type == 'MESH')
root = bpy.data.objects.new('root', None); sc.collection.objects.link(root)
# glTF import: X along the eave, glTF +Z (up the slope) -> Blender -Y, glTF +Y (the relief) -> Blender +Z
for i in range(3):
    for j in range(3):
        o = near if (i, j) == (0, 0) else near.copy()
        if o is not near: sc.collection.objects.link(o)
        o.parent = root; o.location = mathutils.Vector((i * 5.0, -j * 5.0, 0))
root.rotation_euler = (math.radians(-35), 0, 0)   # up-slope (-Y) rises
try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError: sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 900, 700
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.55, 0.6, 0.66, 1); bg.inputs[1].default_value = 0.8
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(55), 0, math.radians(-35)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 40
ctr = mathutils.Vector((7.5, -6.1, 4.3))
cam.location = ctr + mathutils.Vector((5, 17, 15)); cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = out; bpy.ops.render.render(write_still=True)
