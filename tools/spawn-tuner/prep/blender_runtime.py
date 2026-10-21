"""Runtime-tier downsample for the Spawn Tuner (Blender, one process handles a slice of prep/jobs.json).

Run: blender --background --python prep/blender_runtime.py -- jobs.json WORKER NWORKERS RESULTS.jsonl
Per job: import TRELLIS GLB -> join to one mesh -> collapse-decimate to the face target -> single colour map
(metallic/roughness/normal unlinked, constant matte non-metal: Harry 2026-09-30) -> colour map scaled to the
texture target -> origin moved to bottom-centre -> WEBP GLB. Skips jobs whose output is newer than the source.
Refuses a job that would replace ANOTHER batch's mesh (prep/owner_guard.py; the refusal is recorded as the job's error).
"""

from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import bmesh
import bpy
import mathutils

sys.path.insert(0, str(Path(__file__).resolve().parent))
import owner_guard  # noqa: E402  (one owner per shipped mesh file: a job from another batch folder is refused, 2026-10-12)

MATTE_ROUGHNESS = 0.85


def extent(vals):
    return (max(vals) - min(vals)) if vals else 0.0


def kit_fix(obj):
    """Thin 'edge' kit pieces (walls, doors, partitions): TRELLIS often lays a door flat, turns a piece sideways,
    or bakes the plate's floor in as a slab. Stand it up, face it along Z (glTF), and cut the slab off."""
    notes = []
    me = obj.data
    co = [v.co.copy() for v in me.vertices]
    ex = [extent([c[i] for c in co]) for i in range(3)]
    if ex[2] < 0.5 * min(ex[0], ex[1]):  # lying down: thinnest axis is vertical -> rotate +90 about X
        me.transform(mathutils.Matrix.Rotation(math.radians(90), 4, "X"))
        notes.append("stood up")
        co = [v.co.copy() for v in me.vertices]
        ex = [extent([c[i] for c in co]) for i in range(3)]
    if ex[0] < ex[1] * 0.8:  # broad face looks along X -> turn it to look along -Y (glTF +Z)
        me.transform(mathutils.Matrix.Rotation(math.radians(90), 4, "Z"))
        notes.append("turned 90")
        co = [v.co.copy() for v in me.vertices]
    zs = [c.z for c in co]
    z0, H = min(zs), extent(zs)
    mid = [c.y for c in co if z0 + 0.4 * H <= c.z <= z0 + 0.6 * H]
    ref = extent(mid)
    full = extent([c.y for c in co])
    cut = None
    if full > 2.0 * ref + 0.02:  # a slab or plinth much deeper than the wall itself
        for k in range(1, 30):
            lo, hi = z0 + (k - 1) * 0.01 * H, z0 + k * 0.01 * H
            sl = [c.y for c in co if lo <= c.z <= hi]
            if sl and extent(sl) < max(1.5 * ref, ref + 0.05 * full):
                cut = lo
                break
    if cut is not None and cut > z0 + 0.002 * H:
        bm = bmesh.new()
        bm.from_mesh(me)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, cut), plane_no=(0, 0, 1), clear_inner=True)
        bm.to_mesh(me)
        bm.free()
        me.update()
        notes.append(f"cut slab {round((cut - z0) / H * 100)}% of height (depth {full:.2f} -> wall {ref:.2f})")
    return notes


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
    # bake parent/node transforms into the mesh so the exported node is identity
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    before = len(obj.data.polygons)
    if before > job["faces"]:
        mod = obj.modifiers.new(name="decimate", type="DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = job["faces"] / before
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if job.get("kitfix"):
        job["fix"] = kit_fix(obj)
    faces = len(obj.data.polygons)
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        for key in ("Metallic", "Roughness", "Normal", "Emission Color", "Alpha"):
            if key in bsdf.inputs:
                for link in list(bsdf.inputs[key].links):
                    nt.links.remove(link)
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = MATTE_ROUGHNESS
        slot.material.blend_method = "OPAQUE" if hasattr(slot.material, "blend_method") else None
    for image in bpy.data.images:
        if image.size[0] and max(image.size) > job["tex"]:
            k = job["tex"] / max(image.size)
            image.scale(max(1, round(image.size[0] * k)), max(1, round(image.size[1] * k)))
    # origin to bottom-centre (Blender Z-up; glTF export turns it into Y-up)
    obj.data.update()
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]  # not bound_box: it is stale after mesh edits
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
    hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    shift = mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    obj.data.transform(mathutils.Matrix.Translation(-shift))
    obj.location = (0, 0, 0)
    out = Path(job["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_image_format="WEBP",
                              export_image_quality=80, export_apply=True, export_yup=True)
    dims = hi - lo
    # glTF axes: x = Blender x, y (up) = Blender z, z = -Blender y
    return {"sku": job["sku"], "fix": job.get("fix"), "faces_src": before, "faces": faces, "bytes": out.stat().st_size,
            "bounds": [round(dims.x, 5), round(dims.z, 5), round(dims.y, 5)]}


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1:]
    jobs = json.loads(Path(args[0]).read_text())
    worker, nworkers, results = int(args[1]), int(args[2]), Path(args[3])
    for i, job in enumerate(jobs):
        if i % nworkers != worker:
            continue
        out, src = Path(job["out"]), Path(job["src"])
        if out.exists() and out.stat().st_mtime > src.stat().st_mtime and not job.get("force"):
            continue
        t0 = time.time()
        try:
            why = owner_guard.refusal(job)
            if why:
                raise RuntimeError(why)
            rec = process(job)
            rec["secs"] = round(time.time() - t0, 1)
            owner_guard.stamp(job)
        except Exception as exc:  # keep the batch going; the failure is recorded
            rec = {"sku": job["sku"], "error": repr(exc)}
        with results.open("a") as fh:
            fh.write(json.dumps(rec) + "\n")
        print("TW_RUNTIME", json.dumps(rec), flush=True)


if __name__ == "__main__":
    main()
