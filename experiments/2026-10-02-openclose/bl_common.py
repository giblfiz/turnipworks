"""Shared Blender helpers for the open/close pilot (runtime-tier prep copied from
tools/spawn-tuner/prep/blender_runtime.py, which is not imported so that file stays untouched)."""

from __future__ import annotations

import bpy
import mathutils

MATTE_ROUGHNESS = 0.85


def load_joined(path: str, name: str):
    """Import a GLB, join its meshes, bake transforms. Returns the single mesh object."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o.name in bpy.data.objects and o is not obj and o.type != "MESH":
            bpy.data.objects.remove(o)
    obj.name = name
    return obj


def decimate(obj, faces: int):
    before = len(obj.data.polygons)
    if before > faces:
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new(name="decimate", type="DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = faces / before
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return before, len(obj.data.polygons)


def matte(obj, tex: int):
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        for key in ("Metallic", "Roughness", "Normal", "Emission Color", "Alpha"):
            if key in bsdf.inputs:
                for link in list(bsdf.inputs[key].links):
                    nt.links.remove(link)
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = MATTE_ROUGHNESS
        for n in nt.nodes:
            if n.type == "TEX_IMAGE" and n.image and max(n.image.size) > tex:
                k = tex / max(n.image.size)
                n.image.scale(max(1, round(n.image.size[0] * k)), max(1, round(n.image.size[1] * k)))


def bounds(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
    hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


def to_bottom_centre(obj):
    lo, hi = bounds(obj)
    shift = mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    obj.data.transform(mathutils.Matrix.Translation(-shift))
    obj.location = (0, 0, 0)


def scale_mesh(obj, sx, sy, sz):
    obj.data.transform(mathutils.Matrix.Diagonal((sx, sy, sz, 1.0)))
    obj.data.update()
