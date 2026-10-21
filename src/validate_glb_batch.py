#!/usr/bin/env python3
"""Import every GLB with Blender and report mesh/texture statistics.

Run with: blender --background --python src/validate_glb_batch.py -- MODELS_DIR REPORT_JSON
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy


def main() -> None:
    separator = sys.argv.index("--")
    models_dir = Path(sys.argv[separator + 1])
    report_path = Path(sys.argv[separator + 2])
    assets = []

    for path in sorted(models_dir.glob("*.glb")):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        try:
            bpy.ops.import_scene.gltf(filepath=str(path))
            mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
            triangles = 0
            for obj in mesh_objects:
                obj.data.calc_loop_triangles()
                triangles += len(obj.data.loop_triangles)
            assets.append(
                {
                    "file": path.name,
                    "bytes": path.stat().st_size,
                    "mesh_objects": len(mesh_objects),
                    "triangles": triangles,
                    "materials": len(bpy.data.materials),
                    "images": len(bpy.data.images),
                    "status": "valid",
                }
            )
        except Exception as error:
            assets.append({"file": path.name, "status": "invalid", "error": f"{type(error).__name__}: {error}"})

    valid = sum(asset["status"] == "valid" for asset in assets)
    report = {
        "files": len(assets),
        "valid": valid,
        "invalid": len(assets) - valid,
        "assets": assets,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ("files", "valid", "invalid")}))
    if valid != len(assets) or not assets:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
