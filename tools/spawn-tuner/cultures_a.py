"""Culture packs A: Japan, China, India (2026-11-06, lane cultures-a; experiments/2026-11-06-cultures-a).

build_data.py imports this module: CULTURE_ROOM_TYPES are appended to its ROOM_TYPES, add_cultures_a() puts each
culture's accepted meshes (catalog/runs/<code>-01/manifest.tsv, binaries in experiments/2026-11-06-cultures-a/<code>/models)
and its flats (<code>/flats/seamless/*.png opaque floors, <code>/flats/decals/*.jpg keyed decals) into the sku table, and
CULTURE_TIERS joins EXCLUSIVE. The rules are the other batches': a sku name that already exists is never replaced; every
mesh but the wall kit (wall pieces and door leaves) carries its culture's exclusive tier, so no older room
rolls one, and a culture's sacred pieces never appear outside its own rooms. The room programs are in js/solver2.js (the
`ca:` skeleton and the `jpn:` / `chn:` / `ind:` blocks), the walls, doors and roles in js/walls.js (the same markers)."""
from pathlib import Path

_E = Path(__file__).resolve().parents[2] / "experiments/2026-11-06-cultures-a"
_G = {"jpn": "Japan", "chn": "China", "ind": "India"}
# the room types, by culture (first floor = the default; tiers: the culture's exclusive sku tier). The tuner groups its
# palette by `group`; the Build tray finds a room's type by its first recipe's prefix (jpn-room-... -> JPN).
_RT = {
    "jpn": [
        {"key": "jpn-house", "label": "Tatami room", "program": "generic", "family": "jpn-shoji", "cells": [4, 4], "floors": ["floor-tatami", "floor-jpn-cedar"],
         "recipes": ["jpn-room-house"], "color": "#c9b77a"},
        {"key": "jpn-teahouse", "label": "Tea house", "program": "generic", "family": "jpn-shoji", "cells": [3, 3], "floors": ["floor-tatami"],
         "recipes": ["jpn-room-teahouse"], "color": "#8f9a5c"},
        {"key": "jpn-dojo", "label": "Dojo", "program": "generic", "family": "jpn-shoji", "cells": [6, 5], "floors": ["floor-jpn-cedar", "floor-planks-worn"],
         "recipes": ["jpn-room-dojo"], "color": "#b98d55"},
        {"key": "jpn-shrine", "label": "Shrine hall", "program": "generic", "family": "jpn-shrine", "cells": [5, 4], "floors": ["floor-jpn-cedar", "floor-planks-worn"],
         "recipes": ["jpn-room-shrine"], "color": "#d0563c"},
        {"key": "jpn-shrine-court", "label": "Shrine approach", "program": "outdoors", "family": "jpn-shrine", "cells": [6, 6], "floors": ["floor-gravel", "floor-jpn-moss"],
         "recipes": ["jpn-room-shrine-court"], "color": "#a8a49a", "outdoor": True},
        {"key": "jpn-shop", "label": "Sake merchant's shop", "program": "generic", "family": "jpn-shoji", "cells": [4, 4], "floors": ["floor-earth-packed", "floor-jpn-cedar"],
         "recipes": ["jpn-room-shop"], "color": "#8a6a48"},
        {"key": "jpn-garden", "label": "Tea garden", "program": "outdoors", "family": "jpn-shoji", "cells": [6, 6], "floors": ["floor-jpn-moss", "floor-grass-worn"],
         "recipes": ["jpn-room-garden"], "color": "#6f8f4a", "outdoor": True},
    ],
    "chn": [
        {"key": "chn-hall", "label": "Courtyard-house hall", "program": "generic", "family": "chn-brick", "cells": [5, 4], "floors": ["floor-chn-brick", "floor-flagstone-square"],
         "recipes": ["chn-room-hall"], "color": "#8e3b2f"},
        {"key": "chn-teahouse", "label": "Tea house", "program": "generic", "family": "chn-brick", "cells": [5, 5], "floors": ["floor-chn-brick", "floor-planks-worn"],
         "recipes": ["chn-room-teahouse"], "color": "#7a8a4e"},
        {"key": "chn-study", "label": "Scholar's study", "program": "generic", "family": "chn-brick", "cells": [4, 3], "floors": ["floor-chn-brick", "floor-planks-dark"],
         "recipes": ["chn-room-study"], "color": "#5b6b7a"},
        {"key": "chn-temple", "label": "Temple hall", "program": "generic", "family": "chn-temple", "cells": [6, 5], "floors": ["floor-chn-brick"],
         "recipes": ["chn-room-temple"], "color": "#c8902e"},
        {"key": "chn-market", "label": "Market street", "program": "outdoors", "family": "chn-brick", "cells": [7, 4], "floors": ["floor-chn-paving", "floor-earth-packed"],
         "recipes": ["chn-room-market"], "color": "#a07a4c", "outdoor": True},
        {"key": "chn-courtyard", "label": "Courtyard", "program": "outdoors", "family": "chn-brick", "cells": [6, 6], "floors": ["floor-chn-paving", "floor-chn-brick"],
         "recipes": ["chn-room-courtyard"], "color": "#8a8f84", "outdoor": True},
    ],
    "ind": [
        {"key": "ind-haveli", "label": "Haveli courtyard", "program": "outdoors", "family": "ind-lime", "cells": [5, 5], "floors": ["floor-ind-lime", "floor-ind-sandstone"],
         "recipes": ["ind-room-haveli"], "color": "#e0b04a", "outdoor": True},
        {"key": "ind-durbar", "label": "Palace hall (durbar)", "program": "generic", "family": "ind-sandstone", "cells": [6, 5], "floors": ["floor-ind-sandstone", "floor-ind-lime"],
         "recipes": ["ind-room-durbar"], "color": "#b5452e"},
        {"key": "ind-mandapa", "label": "Shiva temple hall", "program": "generic", "family": "ind-temple", "cells": [6, 5], "floors": ["floor-ind-temple"],
         "recipes": ["ind-room-mandapa"], "color": "#d79a3a"},
        {"key": "ind-bazaar", "label": "Bazaar shop", "program": "generic", "family": "ind-lime", "cells": [4, 4], "floors": ["floor-ind-lime", "floor-earth-packed"],
         "recipes": ["ind-room-bazaar"], "color": "#c96f2e"},
        {"key": "ind-stepwell", "label": "Stepwell", "program": "outdoors", "family": "ind-sandstone", "cells": [7, 7], "floors": ["floor-ind-temple", "floor-ind-sandstone"],
         "recipes": ["ind-room-stepwell"], "color": "#9a7a4a", "outdoor": True},
        {"key": "ind-kitchen", "label": "Household kitchen", "program": "generic", "family": "ind-lime", "cells": [4, 3], "floors": ["floor-earth-packed", "floor-ind-lime"],
         "recipes": ["ind-room-kitchen"], "color": "#a8642e"},
    ],
}
for _c, _rows in _RT.items():
    for _r in _rows:
        _r.setdefault("group", _G[_c]); _r.setdefault("tiers", [_c])

CODES = [c for c in ("jpn", "chn", "ind") if c in _RT]
CULTURE_ROOM_TYPES = [r for c in CODES for r in _RT[c]]
CULTURE_TIERS = set(CODES)
KIT_ROLES = {"wall-straight", "wall-doorway", "wall-window-small", "door-plank", "door-panelled"}  # (untiered: look.js picks them by wall family or by door leaf shape. Corner posts and pillars ARE tiered: a room that places a post-timber as a prop must not roll a vermilion one; look.js corners ignore tiers)


def add_cultures_a(skus, root, load_manifest):
    skipped = []
    for code in CODES:
        folder = _E / code
        for path in sorted((folder / "flats/seamless").glob("*.png")):
            if path.stem not in skus:
                obj, _, var = path.stem.partition("--")
                skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var or "v1", "src": f"{code}-flats-01", "plate": path, "piece": "", "opaque": True}
        for path in sorted((folder / "flats/decals").glob("*.jpg")):
            if path.stem not in skus:
                obj, _, var = path.stem.partition("--")
                skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": code, "shape": var, "src": f"{code}-flats-01", "plate": path, "piece": ""}
        manifest = root / f"catalog/runs/{code}-01/manifest.tsv"
        for row in (load_manifest(manifest) if manifest.exists() else []):
            glb = folder / "models" / f"{row['source']}.glb"
            if not glb.exists():
                continue
            if row["sku"] in skus:
                skipped.append(row["sku"])
                continue
            row = dict(row)
            if row["sku"].endswith("-leaf"):  # a door leaf is a shape of its door role, never a wall family (look.js: e.doorLeaf)
                row["shape"], row["family"] = row["sku"].split("--")[-1], ""
            if row["object"] not in KIT_ROLES:
                row["tier"] = row["tier"] or code
            flags = set(filter(None, (row.get("flags") or "").split(",")))
            piece = "leaf" if row["shape"] == "leaf" or row["shape"].endswith("-leaf") else ""
            skus[row["sku"]] = {**row, "src": f"{code}-01", "glb": glb, "piece": piece, "hung": "hung" in flags,
                                **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if skipped:
        print(f"cultures-a: {len(skipped)} sku names already in the library, NOT replaced: {', '.join(skipped[:8])}")
