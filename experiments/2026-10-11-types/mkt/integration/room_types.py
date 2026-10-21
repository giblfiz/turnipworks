"""The build_data.py side of the Market & village integration (2026-10-11). apply_mkt.py pastes these into
tools/spawn-tuner/build_data.py; edit HERE and run apply_mkt.py again (the room-type block is replaced whole)."""
G = "Market & village"
TRADE_TIERS = ["mkt-general", "mkt-bakery", "mkt-apoth", "mkt-tailor", "mkt-curio"]
ALL = ["mkt"] + TRADE_TIERS  # rooms that show every trade's stock (the square, the street, the back room)
SHOP_FLOORS = ["floor-planks-worn", "floor-planks-stained", "floor-boards-rough", "floor-flagstone-irregular", "floor-planks-dark"]
def shop(key, label, tier, recipes, color, floors=None, cells=(4, 4)):
    return {"key": key, "label": label, "program": "generic", "family": "half-timber", "cells": list(cells), "floors": floors or SHOP_FLOORS,
            "recipes": recipes, "color": color, "group": G, "tiers": [tier, "mkt"]}
MKT_ROOM_TYPES = [
    {"key": "mkt-square", "label": "Market square", "program": "outdoors", "family": "half-timber", "cells": [8, 7],
     "floors": ["floor-cobble", "floor-setts-courtyard", "floor-cobble-mossy", "floor-earth-packed", "floor-gravel", "floor-grass-worn"],
     "recipes": ["mkt-market-square", "mkt-square", "mkt-produce-stalls"], "color": "#c98f4e", "group": G, "outdoor": True, "tiers": ALL},
    {"key": "mkt-street", "label": "Town street", "program": "outdoors", "family": "half-timber", "cells": [10, 3],
     "floors": ["floor-cobble", "floor-setts-courtyard", "floor-earth-packed", "floor-cobble-mossy", "floor-gravel"],
     "recipes": ["mkt-street", "mkt-town-street"], "color": "#9aa0a6", "group": G, "outdoor": True, "tiers": ALL},
    shop("mkt-general", "General store", "mkt-general", ["mkt-shop-general", "mkt-general-store"], "#b98a4a"),
    shop("mkt-bakery", "Bakery", "mkt-bakery", ["mkt-shop-bakery", "mkt-bakery"], "#e0b56a",
         floors=["floor-brick-herringbone", "floor-terracotta", "floor-flagstone-irregular", "floor-planks-worn", "floor-tile-kitchen-small"]),
    shop("mkt-apothecary", "Apothecary", "mkt-apoth", ["mkt-shop-apothecary", "mkt-apothecary-shop", "mkt-apothecary"], "#7fae7a",
         floors=["floor-tile-hex", "floor-planks-dark", "floor-planks-stained", "floor-checker-stone", "floor-flagstone-square"]),
    shop("mkt-tailor", "Tailor & draper", "mkt-tailor", ["mkt-shop-tailor", "mkt-tailor", "mkt-tailor-shop"], "#b0527a",
         floors=["floor-planks-stained", "floor-planks-polished", "floor-planks-worn", "floor-planks-dark"]),
    shop("mkt-curio", "Magic & curio shop", "mkt-curio", ["mkt-shop-curio", "mkt-magic-shop", "mkt-pawn-curio"], "#8a63b5",
         floors=["floor-planks-dark", "floor-checker-stone", "floor-planks-stained", "floor-tile-encaustic"]),
    {"key": "mkt-backroom", "label": "Shop back room", "program": "generic", "family": "half-timber", "cells": [4, 3],
     "floors": ["floor-boards-rough", "floor-planks-worn", "floor-flagstone-irregular", "floor-earth-packed"],
     "recipes": ["mkt-shop-backroom"], "borrow": ["tav-storeroom"], "color": "#8c7355", "group": G, "tiers": ALL},
    {"key": "mkt-passage", "label": "Shop passage & stair", "program": "generic", "family": "half-timber", "cells": [2, 7],
     "floors": ["floor-planks-worn", "floor-boards-rough", "floor-planks-stained", "floor-flagstone-irregular"],
     "recipes": ["mkt-shop-passage"], "borrow": ["tav-hallway"], "color": "#a89a7c", "group": G, "tiers": ["mkt"]},
    {"key": "mkt-watch", "label": "Watch post", "program": "generic", "family": "fieldstone", "cells": [4, 4],
     "floors": ["floor-flagstone-large", "floor-flagstone-irregular", "floor-boards-rough", "floor-planks-worn"],
     "recipes": ["mkt-watch-house", "mkt-watch-post"], "borrow": ["dun-guard-room"], "color": "#6f7f8f", "group": G, "tiers": ["mkt"]},
    {"key": "mkt-house", "label": "Town house: living room", "program": "generic", "family": "half-timber", "cells": [4, 4],
     "floors": ["floor-planks-worn", "floor-planks-stained", "floor-planks-rushes", "floor-flagstone-irregular"],
     "recipes": ["mkt-town-house"], "borrow": ["hut-cottage", "hut-kitchen-lived-in"], "color": "#c7a36b", "group": G, "tiers": ["mkt"]},
    {"key": "mkt-bedroom", "label": "Town house: bedroom", "program": "generic", "family": "half-timber", "cells": [4, 3],
     "floors": ["floor-planks-stained", "floor-planks-worn", "floor-planks-dark"],
     "recipes": ["mkt-town-bedroom"], "borrow": ["tav-guest-room", "tav-guest-room-full"], "color": "#b9a0c0", "group": G, "tiers": ["mkt"]},
]

# pasted before "    # a remeshed piece set supersedes ..." (inside main(); `skus`, `load_manifest`, ROOT are in scope)
BATCH_BLOCK = '''\
    # market & village (RunPod, 2026-10-11): experiments/2026-10-11-types/mkt, one manifest. THE SHOP SKELETON: a trade
    # (general store, bakery, apothecary, tailor, curio) is a sku TIER on the shop roles (counter-shop,
    # shop-shelf-stocked, craft-display-table-goods, shop-floor-stock, shop-sign), written in the manifest's `tier`
    # column (mkt-general ...). A room type lists its trade's tier first in `tiers`, so one shop program lays every shop.
    # Every other mesh of the batch gets tier `mkt` (every older room keeps rolling exactly what it had: another type
    # opts in by listing `mkt` in its room types' `tiers`); a sku name that already exists is never replaced.
    MKT = ROOT / "experiments/2026-10-11-types/mkt"
    mkt_manifest = ROOT / "catalog/runs/mkt-01/manifest.tsv"
    MKT_FAMILIES = {"half-timber", "fieldstone", "rough-timber", "dressed-stone"}
    MKT_TIERS = {"mkt", "mkt-general", "mkt-bakery", "mkt-apoth", "mkt-tailor", "mkt-curio"}
    if mkt_manifest.exists():
        mkt_skipped = []
        for row in load_manifest(mkt_manifest):
            glb = MKT / "models" / f"{row['source']}.glb"
            if not glb.exists():
                continue
            if row["sku"] in skus:
                mkt_skipped.append(row["sku"])
                continue
            row = dict(row)
            if row["family"] and row["family"] not in MKT_FAMILIES:  # make_manifest.py reads a kit sku's first `--` part as its wall family (cell-holding-wood--gate)
                row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
                row["family"] = ""
            if not row["tier"] and row["place"] != "kit":  # every mesh that is not a trade's is tier `mkt`: a NEW role is as exclusive as a new sku of an old one
                row["tier"] = "mkt"                         # (an untiered scales-balance or spice sack changed the wizard's apothecary: test/golden.mjs). Wall and lockup kit pieces stay open
            flags = set(filter(None, (row.get("flags") or "").split(",")))
            skus[row["sku"]] = {**row, "src": "mkt-01", "glb": glb, "piece": "", "hung": "hung" in flags,
                                **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
        if mkt_skipped:
            print(f"market: {len(mkt_skipped)} sku names already in the library, NOT replaced: {', '.join(mkt_skipped[:8])}")
'''
# inserted before the loop that reads EXCLUSIVE (anchored on that loop, not on the EXCLUSIVE line: every type edits that line)
EXCLUSIVE_ANCHOR = '    for obj in objects.values():\n        tiers = {s["tier"] for s in obj["skus"]}\n'
EXCLUSIVE_ADD = '    EXCLUSIVE |= {"mkt", "mkt-general", "mkt-bakery", "mkt-apoth", "mkt-tailor", "mkt-curio"}  # market & village: `mkt` and one tier per trade (the shop skeleton)\n'
