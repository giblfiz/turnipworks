#!/usr/bin/env python3
"""Three rock pieces for the banks demo (the slope pilot's only rock was a grass-topped cliff chunk, which reads as a
block of turf when used small). Prompt frame copied from ../2026-10-05-yard-props (house style, chroma-blue plate).
Writes assets.json for src/plate_gate_batch.py, run through the yard-props gen.py (plates by the FREE Codex route):
    python3 rocks_spec.py && python3 ../2026-10-05-yard-props/gen.py . --workers 3
    python3 rocks_fal.py            # masked/*.png -> fal TRELLIS.2, $0.30 each -> fal/models/*.glb
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
yard = json.load(open(HERE / '../2026-10-05-yard-props/assets.json'))['assets']
base = next(a for a in yard if a['id'] == 'planter-stone')
head, tail = base['prompt'].split('create a new, distinct single asset:')[0], base['prompt'].split('\n\n', 1)[1].split('Specific design:')[0]
END = (" Solid rock all the way round: every side is painted stone, there is no cut face and no hollow. It stands on nothing: NO ground disc, NO grass patch, NO soil, NO base slab or platform under it, and its underside is flat."
       " The background is flat chroma blue, so the object itself has NO blue anywhere: the stone is a WARM grey. Show exactly this one object and nothing else, whole and well inside the frame, filling only about half the frame width, with a wide margin all round.")
def A(id, subject, design, desc, must, size):
    return {"id": id, "object": id, "group": "rocks", "source": "generate", "lane": "3d", "subject": subject, "size": size,
            "prompt": f"{head}create a new, distinct single asset: {subject}.\n\n{tail}Specific design: {design}{END}\n",
            "refs": base['refs'], "gate_refs": [], "gate": {"desc": desc, "must": must, "must_not": ["a ground disc, grass patch, soil mound or base slab under the object", "a built wall, bricks or cut masonry", "a grass-covered top"]}}
assets = [
 A("rock-boulder", "a big weathered field boulder",
   "One big, rounded, weathered natural boulder of warm-grey stone, like a glacial erratic lying in a field: about 5 ft wide x 4 ft deep x 3.5 ft tall, wider than it is tall, lumpy and asymmetric with two or three broad facets, a few chunky cracks, and soft moss-green patches of moss on its top and one shoulder.",
   "a single large rounded natural boulder of grey stone with some moss", ["one natural boulder, wider than tall", "grey stone with a little green moss"], [60.0, 48.0, 42.0]),
 A("rock-cluster", "a low cluster of three boulders",
   "A low cluster of THREE natural warm-grey boulders of different sizes fused together into one solid group, the biggest in the middle and two smaller ones leaning against it, about 8 ft wide x 5 ft deep x 3 ft tall overall, much wider than tall. Rounded, lumpy, weathered stone with a few cracks and soft moss-green moss in the joints between the boulders.",
   "a low group of a few natural grey boulders touching each other, with some moss", ["two to four natural boulders fused into one low group", "clearly wider than tall"], [96.0, 60.0, 36.0]),
 A("rock-table", "a flat-topped table rock",
   "A flat-topped natural table rock: a broad slab-like outcrop of layered warm-grey stone about 8 ft wide x 7 ft deep x 4 ft tall, with a clearly FLAT, level, bare stone top big enough for a person to stand on (the top is stone, with only a thin line of moss in one crack), and short, steep, chunky sides showing two or three horizontal layers and a few cracks. Roughly oval in plan, rounded corners.",
   "a broad natural rock with a flat level bare-stone top and short steep sides", ["a flat, level top surface of bare stone", "natural layered rock, wider than tall"], [96.0, 84.0, 48.0]),
]
(HERE / "assets.json").write_text(json.dumps({"assets": assets}, indent=1) + "\n")
print(len(assets), "assets"); print(assets[0]['prompt'][:400])
