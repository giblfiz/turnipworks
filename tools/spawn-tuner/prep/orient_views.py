"""Four-view orientation renders for the front sweep (inn-02, 2026-10-02).

Run: blender --background --python prep/orient_views.py -- LIST.txt OUTDIR
LIST.txt has one GLB path per line, optionally followed by a yaw in degrees (three.js sense) to apply first, which
re-renders a mesh as the tuner will show it after an orient.json correction (the verification pass). For each GLB, writes OUTDIR/<stem>__{A,B,C,D}.png:
  A = camera on glTF +Z looking back at the object (sees its +Z face), B = on +X, C = on -Z, D = on -X,
all at the same 18 deg elevation, so the four tiles go once round the object. Workbench + texture colour:
fast, and enough to read a front. The labels are letters on purpose: the vision prompt never names an axis.
glTF -> Blender: +X -> +X, +Y(up) -> +Z, +Z -> -Y.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
import mathutils

VIEWS = {"A": (0.0, -1.0), "B": (1.0, 0.0), "C": (0.0, 1.0), "D": (-1.0, 0.0)}  # Blender XY direction to the camera
ELEV = math.radians(18)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.display.shading.show_shadows = False
    sc.display.shading.show_cavity = True
    sc.render.resolution_x = sc.render.resolution_y = 320
    sc.render.image_settings.file_format = "PNG"
    sc.render.film_transparent = False
    world = bpy.data.worlds.new("w")
    sc.world = world
    world.color = (0.55, 0.6, 0.66)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.lens = 50
    # a floor disc so "lying on its side" reads against a ground
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1.0, fill_type="NGON")
    floor = bpy.context.active_object
    floor.name = "floor"
    mat = bpy.data.materials.new("floor")
    mat.diffuse_color = (0.32, 0.3, 0.27, 1)
    floor.data.materials.append(mat)
    return sc, cam, floor


def main():
    lst, out = sys.argv[sys.argv.index("--") + 1:]
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    sc, cam, floor = setup()
    for line in Path(lst).read_text().splitlines():
        if not line.strip():
            continue
        parts = line.split()
        src, yaw = Path(parts[0]), (float(parts[1]) if len(parts) > 1 else 0.0)
        if all((out / f"{src.stem}__{k}.png").exists() for k in VIEWS):
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(src))
        new = [o for o in bpy.data.objects if o not in before]
        if yaw:  # glTF +Y-up yaw == Blender +Z rotation (the axis swap is a proper rotation)
            for o in new:
                if o.parent is None:
                    o.matrix_world = mathutils.Matrix.Rotation(math.radians(yaw), 4, "Z") @ o.matrix_world
            bpy.context.view_layer.update()
        meshes = [o for o in new if o.type == "MESH"]
        pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
        lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
        hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
        ctr = (lo + hi) / 2
        rad = max((hi - lo).length / 2, 0.01)
        floor.location = (ctr.x, ctr.y, lo.z - 0.002 * rad)
        floor.scale = (rad * 1.6,) * 3
        dist = rad / math.tan(cam.data.angle / 2) * 1.08
        for k, (dx, dy) in VIEWS.items():
            cam.location = ctr + mathutils.Vector((dx * dist * math.cos(ELEV), dy * dist * math.cos(ELEV), dist * math.sin(ELEV)))
            cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = str(out / f"{src.stem}__{k}.png")
            bpy.ops.render.render(write_still=True)
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
        for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures):
            for blk in list(coll):
                if blk.users == 0:
                    coll.remove(blk)
        print("ORIENT_VIEWS", src.stem, flush=True)


main()
