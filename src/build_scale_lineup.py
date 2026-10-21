"""Blender-side: scale generated GLBs to their catalog nominal size and lay them out on a 5-ft grid.

Run: blender --background --python src/build_scale_lineup.py -- OUT.glb REPORT.json ID=PATH.glb [ID=PATH.glb ...]
Each mesh is scaled uniformly so its height matches the catalog's nominal height (TRELLIS output arrives
normalized). The report compares mesh proportions with the catalog box, a free QA check on generation.
"""

import json
import sys
from pathlib import Path

import bpy
import mathutils

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog_tool as ct  # noqa: E402

INCH = 0.0254
CELL = 60 * INCH


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    out, report_path, items = Path(args[0]), Path(args[1]), [a.split("=", 1) for a in args[2:]]
    roles = {}
    for path in sorted((ct.ROOT / "catalog").glob("*.catalog.md")):
        roles.update(ct.parse_catalog(path)[0])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    report, x = [], 0.0
    for oid, glb in items:
        w, d, h = roles[oid]["size"]
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=glb)
        new = [o for o in bpy.context.scene.objects if o not in before]
        meshes = [o for o in new if o.type == "MESH"]
        pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
        lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
        hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
        dims = hi - lo  # Blender: z up
        k = (h * INCH) / dims.z
        pivot = bpy.data.objects.new(f"{oid}", None)
        bpy.context.scene.collection.objects.link(pivot)
        for o in new:
            if o.parent is None:
                o.parent = pivot
        centre = (lo + hi) / 2
        pivot.scale = (k, k, k)
        width = dims.x * k
        pivot.location = (x + width / 2 - centre.x * k, -centre.y * k, -lo.z * k)
        x += width + 12 * INCH
        mesh_wh = sorted((dims.x, dims.y), reverse=True)
        cat_wh = sorted((w, d), reverse=True)
        report.append({"id": oid, "catalog_in": [w, d, h], "scale_range": roles[oid]["scale"],
                       "mesh_in_after_scaling": [round(v * k / INCH, 1) for v in (dims.x, dims.y, dims.z)],
                       "footprint_ratio_mesh_vs_catalog": round((mesh_wh[0] / dims.z) / (cat_wh[0] / h), 2)})
    # 5-ft grid under the lineup: alternating tiles, colour-only materials (export cleanly to glTF)
    cells = max(1, int(x / CELL) + 1)
    mats = []
    for i, rgb in enumerate(((0.62, 0.55, 0.45), (0.52, 0.46, 0.37))):
        m = bpy.data.materials.new(f"grid{i}")
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (*rgb, 1)
        bsdf.inputs["Roughness"].default_value = 0.9
        mats.append(m)
    for cx in range(cells):
        for cy in (-1, 0):
            bpy.ops.mesh.primitive_plane_add(size=CELL, location=(cx * CELL + CELL / 2, cy * CELL + CELL / 2, -0.002))
            bpy.context.object.data.materials.append(mats[(cx + cy) % 2])
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_image_format="WEBP",
                              export_image_quality=85, export_apply=True)
    report_path.write_text(json.dumps(report, indent=1))
    print("TW_LINEUP", json.dumps(report))


if __name__ == "__main__":
    main()
