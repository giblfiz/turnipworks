"""Geometric front probes for the orientation sweep: measurements that confirm or contradict a vision read.

Run: blender --background --python prep/orient_probe.py -- LIST.txt OUT.jsonl
For each GLB (one path per line) writes {sku, side: {"+X","-X","+Z","-Z"} -> {flat, top}} in glTF axes:
  flat = share of vertices within 2% of the bounding box on that side (a wall plate or cabinet back is a plane there),
  top  = highest point (fraction of height) among vertices in the outer 20% slab on that side (a headboard or chair
         back is the tall end).
"""

import json
import sys
from pathlib import Path

import bpy


def main():
    lst, out = sys.argv[sys.argv.index("--") + 1:]
    with open(out, "w") as fh:
        for line in Path(lst).read_text().splitlines():
            if not line.strip():
                continue
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=line.strip())
            pts = []
            for o in bpy.context.scene.objects:
                if o.type == "MESH":
                    m = o.matrix_world
                    pts += [(v.x, v.z, -v.y) for v in (m @ vv.co for vv in o.data.vertices)]  # Blender -> glTF axes
            if not pts:
                continue
            lo = [min(p[i] for p in pts) for i in range(3)]
            hi = [max(p[i] for p in pts) for i in range(3)]
            ext = [max(hi[i] - lo[i], 1e-6) for i in range(3)]
            res = {}
            for name, ax, sgn in (("+X", 0, 1), ("-X", 0, -1), ("+Z", 2, 1), ("-Z", 2, -1)):
                edge = hi[ax] if sgn > 0 else lo[ax]
                dist = [abs(p[ax] - edge) / ext[ax] for p in pts]
                flat = sum(1 for d in dist if d < 0.02) / len(pts)
                slab = [p[1] for p, d in zip(pts, dist) if d < 0.2]
                top = (max(slab) - lo[1]) / ext[1] if slab else 0
                res[name] = {"flat": round(flat, 3), "top": round(top, 3)}
            fh.write(json.dumps({"sku": Path(line.strip()).stem, "side": res}) + "\n")
            fh.flush()


main()
