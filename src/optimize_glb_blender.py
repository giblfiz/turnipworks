"""Blender-side GLB optimizer. Invoke through build_optimization_ladder.py."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--faces", type=int)
    parser.add_argument("--texture-size", type=int, required=True)
    return parser.parse_args(args)


def main() -> None:
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    before_faces = sum(len(obj.data.polygons) for obj in meshes)
    if args.faces and before_faces > args.faces:
        ratio = args.faces / before_faces
        for obj in meshes:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            modifier = obj.modifiers.new(name="TW local decimation", type="DECIMATE")
            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(False)

    resized = []
    for image in bpy.data.images:
        old_size = tuple(image.size)
        if max(old_size) > args.texture_size:
            scale = args.texture_size / max(old_size)
            width = max(1, round(old_size[0] * scale))
            height = max(1, round(old_size[1] * scale))
            image.scale(width, height)
        resized.append({"name": image.name, "from": old_size, "to": tuple(image.size)})

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(args.output.resolve()),
        export_format="GLB",
        export_image_format="WEBP",
        export_image_quality=85,
        export_apply=True,
    )
    after_faces = sum(len(obj.data.polygons) for obj in meshes)
    print("TW_OPTIMIZE=" + json.dumps({
        "input": str(args.input),
        "output": str(args.output),
        "faces_before": before_faces,
        "faces_after": after_faces,
        "textures": resized,
        "bytes": args.output.stat().st_size,
    }))


if __name__ == "__main__":
    main()
