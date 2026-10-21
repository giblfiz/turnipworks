"""Render a consistent elevated three-quarter PNG preview for a GLB.

Run: blender --background --python src/render_glb_preview.py -- INPUT.glb OUTPUT.png
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
import mathutils


def main() -> None:
    source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points = [obj.matrix_world @ mathutils.Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = mathutils.Vector([min(point[i] for point in points) for i in range(3)])
    high = mathutils.Vector([max(point[i] for point in points) for i in range(3)])
    center = (low + high) / 2
    radius = max((high - low).length / 2, 0.01)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("preview-world")
    scene.world = world
    world.use_nodes = True
    background = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
    background.inputs[0].default_value = (0.16, 0.18, 0.22, 1)
    background.inputs[1].default_value = 0.8

    camera = bpy.data.objects.new("preview-camera", bpy.data.cameras.new("preview-camera"))
    scene.collection.objects.link(camera)
    scene.camera = camera
    azimuth, elevation, distance = math.radians(-35), math.radians(25), radius * 3.2
    camera.location = center + mathutils.Vector((
        distance * math.cos(elevation) * math.sin(azimuth),
        -distance * math.cos(elevation) * math.cos(azimuth),
        distance * math.sin(elevation),
    ))
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 55

    key = bpy.data.objects.new("key", bpy.data.lights.new("key", "AREA"))
    key.data.energy = 700
    key.data.shape = "DISK"
    key.data.size = radius * 2.5
    key.location = center + mathutils.Vector((-radius * 2, -radius * 2, radius * 3))
    scene.collection.objects.link(key)

    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output.resolve())
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
