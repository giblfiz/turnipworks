#!/usr/bin/env python3
"""room.json for the viewer: a small furnished inn room from the game's LIBRARY (read-only: tools/spawn-tuner/data/
library.json and orient.json), sized by the tuner's own rule (largest catalog dimension to the mesh's largest
dimension; wall pieces stretched to their 5 x 1 x 9 ft box), on a 5-ft grid 6 squares by 5. The near wall is left
off so the table camera sees in. Positions in feet; rot = degrees about the vertical, 0 = facing the camera (+Z).
    python3 build_room.py
"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent; T = HERE.parents[1] / "tools/spawn-tuner"
L = json.loads((T / "data/library.json").read_text())["objects"]; O = json.loads((T / "data/orient.json").read_text())
def sku(obj, name):
    o = L[obj]; s = next(k for k in o["skus"] if k["sku"] == name)
    return o, s
def prop(obj, name, x, z, rot):
    o, s = sku(obj, name)
    return {"kind": "prop", "id": name, "file": Path(s["url"]).name, "size_ft": [round(v / 12, 3) for v in (s.get("size") or o["size"])], "yaw": O.get(s["mesh"]) or 0, "x": x, "z": z, "rot": rot}
def wall(obj, name, x, z, rot):
    o, s = sku(obj, name)
    return {"kind": "wall", "id": name, "file": Path(s["url"]).name, "box_ft": [5, 1, 9], "x": x, "z": z, "rot": rot}
W, D = 6, 5
pieces = []
ws = ["wall-straight--rough-timber--s2", "wall-straight--rough-timber--s4"]
for i in range(W):   # back wall along z = 0, a doorway in the second square
    pieces.append(wall("wall-doorway", "wall-doorway--rough-timber", i * 5 + 2.5, 0, 0) if i == 1 else wall("wall-straight", ws[i % 2], i * 5 + 2.5, 0, 0))
for j in range(D):   # side walls
    pieces.append(wall("wall-straight", ws[j % 2], 0, j * 5 + 2.5, 90)); pieces.append(wall("wall-straight", ws[(j + 1) % 2], W * 5, j * 5 + 2.5, 90))
pieces += [
    prop("table-square", "table-square--common--s1", 17.5, 12.5, 0),
    prop("chair-plain", "chair-plain--common--s4", 17.5, 15.6, 180),     # at the near side of the table, facing it
    prop("chair-plain", "chair-plain--common--s5", 14.4, 12.5, 90),      # at its left side, facing it
    prop("barrel", "barrel--s2", 27.9, 11.4, 0), prop("barrel", "barrel--s5", 27.9, 13.8, 40),
    prop("crate", "crate--s3", 27.8, 8.6, 10),
    prop("bench-long", "bench-long--s5", 2.0, 15.0, 90),
    prop("candlestick-floor", "candlestick-floor--iron", 2.0, 2.2, 0),
]
floor = [Path(s["url"]).name for s in L["floor-planks-worn"]["skus"]]
room = {"cells": [W, D], "wall_h": 9, "floor": floor, "pieces": pieces,
        "lamps": [[4, 7.2, 4], [26, 7.2, 4], [15, 7.5, 21]],
        # the four figures: square centre, facing (0 = toward the camera), turned a little so each reads
        # second tries of two figures (changed prompts); the page can swap them in
        "second_try": {"fig-wolf": "fig-wolf-b", "fig-goblin": "fig-goblin-b"},
        "figures": [{"id": "fig-fighter", "x": 7.5, "z": 7.5, "rot": 10}, {"id": "fig-wizard", "x": 12.5, "z": 17.5, "rot": 20},
                    {"id": "fig-goblin", "x": 22.5, "z": 12.5, "rot": -15}, {"id": "fig-wolf", "x": 22.5, "z": 20.5, "rot": -50}]}
(HERE / "room.json").write_text(json.dumps(room, indent=1) + "\n")
print(len(pieces), "pieces;", "files:", sorted({p["file"] for p in pieces}))
