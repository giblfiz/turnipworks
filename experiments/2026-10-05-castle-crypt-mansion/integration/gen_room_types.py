#!/usr/bin/env python3
"""Regenerate room_types.py from the designers' rooms.json files (crypt, castle, mansion).

    python3 gen_room_types.py          # rewrites room_types.py beside this file; run again after a designer edits rooms.json

What comes from rooms.json: key, label, cells, family, floors (in order, first = default), recipes, outdoor.
What is decided here (integration): the v1 program name, the colour chip, wealth / tiers, which recipes are only
BORROWED for their slots (a `tav-` recipe on a castle or mansion room would also list the room under Tavern & inn in
the game's Build tray and let the inn's building tool pack it: taxonomy.js joins a room to a type by recipe prefix).
"""
import json, pathlib, pprint
HERE = pathlib.Path(__file__).resolve().parent
B = HERE.parent
CODE = {"crypt": "cry", "castle": "cas", "mansion": "nob"}
BORROW_PREFIX = ("tav-",)            # slots only, never the tray join
# colour chips for the tuner's palette: one hue family per type
COLORS = {
    "crypt": ["#8a8fa8", "#6f7590", "#a39a86", "#5e6b7a", "#b0a7c0", "#7f9a94", "#c9b458"],
    "castle": ["#b5533c", "#c9a227", "#7d8791", "#8c6b4f", "#c4703d", "#9a8fb5", "#55606b", "#6d7f5c", "#8f9b7a"],
    "mansion": ["#d8c27a", "#a9c4a0", "#b98b5e", "#7a5c3e", "#c59bb0", "#e2d6a8", "#8fbf8f", "#6fae5c", "#d9654f", "#7d8a99"],
}
# v2 dispatches on the room KEY (solver2.js KEY[key]); `program` is only what the classic v1 engine runs. Every new
# room uses the small generic v1 program (hunks/solver_tail.once.js); outdoor rooms use v1 'outdoors' like the yard.
# Round 2 (2026-10-05, supervisor): integration's corrections to the designers' rooms.json, castle and mansion only.
# (The crypt's two, chapel 4x7 and embalming 4x4, are for the crypt integrator: its hunk is being applied and is not regenerated here.)
CELLS = {"crypt-catacomb": [10, 3],   # crypt rework (blind reads): named a catacomb 7 times in 10 at 10x3, 3 to 5 in 10 at 6x2, 8x2, 8x3, 12x3, 13x3, 14x4
         "crypt-chapel": [4, 7],      # crypt integrator: 4x5 had no room for benches behind the bier
         "crypt-embalming": [4, 4],   # 4x3 had zero slack for the work table
         "great-hall": [10, 6],        # 8x5 held 1-2 trestles and a dais in 60% of halls: two rows + dais + hearth need 50 x 30 ft
         "gatehouse": [3, 5],          # castle integration (blind reads): 4x4 with a guard table in the side band was a guardroom; a passage 15 ft wide, gates at both ends
         "barracks": [7, 5],           # 6x4 held about 8 bunks, lockers on one wall: 12 bunks + footlockers + guard table need 35 x 25
         "mansion-hall": [5, 6],       # stair-grand is 10 x 15 ft: 5 cells of depth for the stair alone, 6 leave a landing at its foot
         "mansion-kitchen": [6, 5],    # mansion integration (blind reads): the castle kitchen's size, where its great hearth and work table fit
         "mansion-cellar": [5, 4],     # 4x3 held a cask rack and two shelves; the wine racks need wall
         "mansion-conservatory": [5, 4]}  # the centre fountain needs 17 ft across; 5x3 is 14
# recipes of the room's OWN type added so the Build tray lists it there (catalog/rooms-castle.md, added in round 2)
OWN_RECIPES = {"chapel": ["cas-castle-chapel"], "dungeon": ["cas-castle-dungeon"]}

# floors chosen at integration (first = default), by room key (crypt rework, blind reads: the bone-strewn earth is half of what
# makes an ossuary read as one; the damp blue flagstones read as "shallow water or slime" in the catacomb)
FLOORS = {"crypt-ossuary": ["floor-bone-strewn"], "crypt-catacomb": ["floor-earth-packed", "floor-bone-strewn"]}

def entry(t, i, rm, top):
    rm = {**rm, "floors": FLOORS.get(rm["key"], rm.get("floors")), "cells": CELLS.get(rm["key"], rm["cells"]), "recipes": OWN_RECIPES.get(rm["key"], []) + list(rm["recipes"])}
    recipes = [r for r in rm["recipes"] if not r.startswith(BORROW_PREFIX)]
    borrow = [r for r in rm["recipes"] if r.startswith(BORROW_PREFIX)]
    outdoor = bool(rm.get("outdoor")) and rm.get("outdoor") is not False and (rm.get("outdoor") is True or rm.get("role") == "outdoor")
    e = {"key": rm["key"], "label": rm["label"], "program": "outdoors" if outdoor else "generic",
         "family": rm.get("family") or top.get("family") or "dressed-stone", "cells": list(rm["cells"]),
         "floors": [f["id"] if isinstance(f, dict) else f for f in rm["floors"]],
         "recipes": recipes, "color": COLORS[t][i % len(COLORS[t])], "group": top.get("label") or t.capitalize()}
    if borrow: e["borrow"] = borrow
    if outdoor: e["outdoor"] = True
    # tiers: the exclusive sku tiers this room may roll (build_data's batch block), first = preferred. 'ccm' = the batch's
    # flat variants of roles the inn already had (rugs, paintings, drapes).
    e["tiers"] = [{"crypt": "crypt", "castle": "castle", "mansion": "noble"}[t], "ccm"]
    if t == "mansion" and not outdoor:
        e["wealth"] = "fine"  # the grade floor (no straw pallets); with no noble mesh of a role, a mansion room rolls the inn's fine one
    own = [r for r in recipes if r.startswith(CODE[t] + "-")]
    if not own: e["_todo"] = f"no {CODE[t]}- recipe: this room will NOT appear under its own type in the game's Build tray until one is added to catalog/rooms-{t}.md"
    return e

def main():
    out = {}
    for t in ("crypt", "castle", "mansion"):
        top = json.loads((B / t / "rooms.json").read_text())
        out[t] = [entry(t, i, rm, top) for i, rm in enumerate(top["rooms"])]
    txt = (HERE / "room_types.head.py").read_text()
    body = []
    for t, rows in out.items():
        body.append(f"# ---- {t}: {len(rows)} rooms ----\n{t.upper()}_ROOM_TYPES = [\n" + "".join("    " + pprint.pformat(r, width=100000, sort_dicts=False) + ",\n" for r in rows) + "]\n")
    (HERE / "room_types.py").write_text(txt.replace("# @@ROOM_TYPES@@\n", "\n".join(body)))
    for t, rows in out.items():
        print(t, len(rows), "rooms;", "todo:", [r["key"] for r in rows if "_todo" in r])

if __name__ == "__main__":
    main()
