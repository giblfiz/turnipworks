"""Blender-side face × texture downsample matrix for one GLB: exports every combination and renders a thumbnail.

Run: blender --background --python src/build_downsample_matrix.py -- INPUT.glb OUT_DIR
Face stops: full, 1/4, 5k (Harry's default stop), 1/16, 1/64, 1/256 (≈ the collapse floor); textures halve
from 2048. Each combination is exported twice: "-bc" (colour map only, constant matte non-metal: the shipping
format, Harry 2026-09-30) and full PBR for comparison. Thumbnails show the colour-only look.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
import mathutils

FACE_STOPS = [("f0", 1.0), ("f1", 0.25), ("f5k", 5000), ("f2", 1 / 16), ("f3", 1 / 64), ("f4", 1 / 256)]
MATTE_ROUGHNESS = 0.85
TEXTURES = [2048, 1024, 512, 256, 128, 64]
THUMB = 320


def setup_scene():
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = THUMB
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.87, 0.83, 0.75, 1)
    bg.inputs[1].default_value = 1.0
    meshes = [o for o in scene.objects if o.type == "MESH"]
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
    hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    centre, radius = (lo + hi) / 2, (hi - lo).length / 2
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    az, el, dist = math.radians(-35), math.radians(28), radius * 3.2
    cam.location = centre + mathutils.Vector((dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az),
                                              dist * math.sin(el)))
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    return scene, meshes


def strip_orm(meshes):
    """Unlink metallic/roughness image inputs, set constant matte non-metal; return links to restore."""
    saved = []
    for obj in meshes:
        for slot in obj.material_slots:
            nt = slot.material.node_tree
            bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            for key in ("Metallic", "Roughness"):
                sock = bsdf.inputs[key]
                for link in list(sock.links):
                    saved.append((nt, link.from_socket, sock, sock.default_value))
                    nt.links.remove(link)
            bsdf.inputs["Metallic"].default_value = 0.0
            bsdf.inputs["Roughness"].default_value = MATTE_ROUGHNESS
    return saved


def restore_orm(saved):
    for nt, from_sock, to_sock, value in saved:
        to_sock.default_value = value
        nt.links.new(from_sock, to_sock)


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1:]
    src, out = Path(args[0]).resolve(), Path(args[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for step, (stop, target) in enumerate(FACE_STOPS):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(src))
        scene, meshes = setup_scene()
        before = sum(len(o.data.polygons) for o in meshes)
        ratio = target if target <= 1 else min(1.0, target / before)
        if ratio < 1:
            for obj in meshes:
                mod = obj.modifiers.new(name="decimate", type="DECIMATE")
                mod.decimate_type = "COLLAPSE"
                mod.ratio = ratio
                mod.use_collapse_triangulate = True
                bpy.context.view_layer.objects.active = obj
                bpy.ops.object.modifier_apply(modifier=mod.name)
        faces = sum(len(o.data.polygons) for o in meshes)
        for size in TEXTURES:  # descending: each halving works from the previous, full-quality result
            for image in bpy.data.images:
                if image.size[0] and max(image.size) > size:
                    k = size / max(image.size)
                    image.scale(max(1, round(image.size[0] * k)), max(1, round(image.size[1] * k)))
            name = f"{stop}-t{size}"
            glb = out / f"{name}.glb"
            bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", export_image_format="WEBP",
                                      export_image_quality=85, export_apply=True)
            saved = strip_orm(meshes)
            glb_bc = out / f"{name}-bc.glb"
            bpy.ops.export_scene.gltf(filepath=str(glb_bc), export_format="GLB", export_image_format="WEBP",
                                      export_image_quality=85, export_apply=True)
            scene.render.filepath = str(out / f"{name}.png")  # thumbnails show the shipping look: colour map only
            bpy.ops.render.render(write_still=True)
            restore_orm(saved)
            rows.append({"id": name, "stop": stop, "face_step": step, "ratio": ratio, "faces": faces,
                         "faces_source": before, "texture": size, "bytes": glb.stat().st_size,
                         "bytes_bc": glb_bc.stat().st_size})
    (out / "matrix.json").write_text(json.dumps(rows, indent=1))
    print("TW_MATRIX", len(rows), "variants")


if __name__ == "__main__":
    main()
