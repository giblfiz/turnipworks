"""Faces x skins ladder for the Spawn Tuner's GPU dials (Harry 2026-09-30: "dials to work on faces & skins").

Run: blender --background --python prep/blender_lod.py -- jobs.json WORKER NWORKERS RESULTS.jsonl
Per job (same source + same fixes as blender_runtime.py, so placement bounds match):
  geometry: assets/lod/f{N}/<sku>.glb  for N in FACES (descending decimation, no material: UVs only)
  colour map: the source's base-colour image saved once as PNG -> prep/tex-src/<sku>.png (lod_tex.py makes the WEBP ladder)
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import bpy
import mathutils

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_runtime import kit_fix  # noqa: E402  same stand-up / turn / slab-cut as the runtime tier

FACES = ["full", 20000, 10000, 5000, 3000, 1500]
TOOL = Path(__file__).resolve().parents[1]


def process(job):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=job["src"])
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if job.get("kitfix"):
        kit_fix(obj)
    obj.data.update()
    pts = [v.co.copy() for v in obj.data.vertices]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
    hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    obj.data.transform(mathutils.Matrix.Translation(-mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
    # the colour map, at source resolution, saved once
    src_png = TOOL / "prep/tex-src" / f"{job['sku']}.png"
    src_png.parent.mkdir(parents=True, exist_ok=True)
    img = None
    for slot in obj.material_slots:
        bsdf = next((n for n in slot.material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        link = bsdf and bsdf.inputs["Base Color"].links
        if link and link[0].from_node.type == "TEX_IMAGE":
            img = link[0].from_node.image
            break
    # ... and again when the source mesh is NEWER than the saved map: a mesh replaced under the same sku kept its old colour
    # map on its new UVs (2026-10-06, the cat tree: "camouflage")
    if img is not None and (not src_png.exists() or src_png.stat().st_mtime < Path(job["src"]).stat().st_mtime):
        img.filepath_raw = str(src_png)
        img.file_format = "PNG"
        img.save()
    # strip materials: geometry + UVs only (the tuner binds the chosen texture size itself)
    obj.data.materials.clear()
    full = len(obj.data.polygons)
    out = {"sku": job["sku"], "faces": {}, "bytes": {}, "tex_src": img.size[:] if img else None}
    for level in FACES:
        target = full if level == "full" else level
        cur = len(obj.data.polygons)
        if target < cur:
            mod = obj.modifiers.new(name="d", type="DECIMATE")
            mod.decimate_type = "COLLAPSE"
            mod.ratio = target / cur
            mod.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=mod.name)
        dst = TOOL / "assets/lod" / f"f{level}" / f"{job['sku']}.glb"
        dst.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(dst), export_format="GLB", export_materials="NONE", export_apply=True,
                                  export_yup=True, export_normals=True, export_texcoords=True)
        out["faces"][str(level)] = len(obj.data.polygons)
        out["bytes"][str(level)] = dst.stat().st_size
    return out


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1:]
    jobs = json.loads(Path(args[0]).read_text())
    worker, nworkers, results = int(args[1]), int(args[2]), Path(args[3])
    for i, job in enumerate(jobs):
        if i % nworkers != worker:
            continue
        if (TOOL / "assets/lod/f1500" / f"{job['sku']}.glb").exists() and not job.get("force"):
            continue
        t0 = time.time()
        try:
            rec = process(job)
            rec["secs"] = round(time.time() - t0, 1)
        except Exception as exc:  # keep going; record it
            rec = {"sku": job["sku"], "error": repr(exc)}
        with results.open("a") as fh:
            fh.write(json.dumps(rec) + "\n")
        print("TW_LOD", json.dumps(rec), flush=True)


if __name__ == "__main__":
    main()
