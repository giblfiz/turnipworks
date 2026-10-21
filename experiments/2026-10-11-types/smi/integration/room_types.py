"""The build_data.py side of the Smithy & workshop integration (2026-10-11). apply_smi.py pastes these into
tools/spawn-tuner/build_data.py; edit HERE and run apply_smi.py again (the room-type block is replaced whole)."""
G = "Smithy & workshop"
T = ["smi"]
STONE_FLOORS = ["floor-flagstone-irregular", "floor-earth-packed", "floor-flagstone-large", "floor-cobble", "floor-brick-herringbone"]
SMI_ROOM_TYPES = [
    {"key": "smi-forge", "label": "Blacksmith's forge", "program": "generic", "family": "fieldstone", "cells": [5, 4], "floors": STONE_FLOORS,
     "recipes": ["smi-room-forge", "smi-forge-room", "smi-working-forge"], "color": "#d0703a", "group": G, "tiers": T},
    {"key": "smi-armoury", "label": "Armourer & weaponsmith", "program": "generic", "family": "fieldstone", "cells": [5, 4],
     "floors": ["floor-flagstone-large", "floor-flagstone-irregular", "floor-flagstone-square", "floor-boards-rough", "floor-earth-packed"],
     "recipes": ["smi-room-armoury", "smi-armorer-workshop"], "color": "#9aa7b5", "group": G, "tiers": T},
    {"key": "smi-carpenter", "label": "Carpenter's woodshop", "program": "generic", "family": "rough-timber", "cells": [5, 4],
     "floors": ["floor-boards-rough", "floor-planks-worn", "floor-earth-packed", "floor-planks-dark"],
     "recipes": ["smi-room-carpenter", "smi-carpenter-shop"], "color": "#d9bd72", "group": G, "tiers": T},
    {"key": "smi-potter", "label": "Potter's workshop", "program": "generic", "family": "fieldstone", "cells": [5, 4],
     "floors": ["floor-terracotta", "floor-brick-herringbone", "floor-earth-packed", "floor-flagstone-irregular", "floor-boards-rough"],
     "recipes": ["smi-room-potter"], "color": "#c9824f", "group": G, "tiers": T},
    {"key": "smi-shopfront", "label": "Smith's shop front", "program": "generic", "family": "half-timber", "cells": [4, 4],
     "floors": ["floor-planks-worn", "floor-planks-dark", "floor-flagstone-irregular", "floor-boards-rough", "floor-planks-stained"],
     "recipes": ["smi-room-shopfront", "smi-shopfront"], "color": "#b98a4a", "group": G, "tiers": ["smi", "mkt"]},
    {"key": "smi-stock", "label": "Stock store", "program": "generic", "family": "rough-timber", "cells": [4, 3],
     "floors": ["floor-earth-packed", "floor-boards-rough", "floor-flagstone-irregular", "floor-flagstone-large"],
     "recipes": ["smi-room-stock"], "color": "#8c7355", "group": G, "tiers": T},
    {"key": "smi-yard", "label": "Smith's yard", "program": "outdoors", "family": "fieldstone", "cells": [6, 5],
     "floors": ["floor-earth-packed", "floor-cobble", "floor-gravel", "floor-earth-bare", "floor-setts-courtyard", "floor-grass-worn"],
     "recipes": ["smi-room-yard", "smi-farrier-bay"], "color": "#a08a5c", "group": G, "outdoor": True, "tiers": T},
    {"key": "smi-quarters", "label": "Smith's quarters", "program": "generic", "family": "half-timber", "cells": [4, 3],
     "floors": ["floor-planks-worn", "floor-planks-stained", "floor-planks-dark", "floor-boards-rough"],
     "recipes": ["smi-room-quarters"], "borrow": ["tav-guest-room", "tav-guest-room-full"], "color": "#b9a0c0", "group": G, "tiers": T},
    {"key": "smi-passage", "label": "Workshop passage & stair", "program": "generic", "family": "half-timber", "cells": [2, 6],
     "floors": ["floor-boards-rough", "floor-planks-worn", "floor-flagstone-irregular", "floor-planks-dark"],
     "recipes": ["smi-room-passage"], "borrow": ["tav-hallway"], "color": "#a89a7c", "group": G, "tiers": T},
]

# pasted before "    # a remeshed piece set supersedes ..." (inside main(); `skus`, `load_manifest`, ROOT are in scope)
BATCH_BLOCK = '''\
    # smithy & workshop (RunPod, 2026-10-11): experiments/2026-10-11-types/smi, one manifest. THE WORKSHOP SKELETON is in
    # js/solver2.js (SMI_CRAFTS): a craft is a line of data naming its heat source, workstation, tool wall, raw stock and
    # finished goods. The shop front is a TRADE of the market's shop skeleton (tier `smi` on its five roles: solver2.js
    # mktRegisterTrade). Every mesh of the batch is tier `smi`; a sku name that already exists is never replaced.
    SMI = ROOT / "experiments/2026-10-11-types/smi"
    smi_manifest = ROOT / "catalog/runs/smi-01/manifest.tsv"
    if smi_manifest.exists():
        smi_skipped = []
        for row in load_manifest(smi_manifest):
            glb = SMI / "models" / f"{row['source']}.glb"
            if not glb.exists():
                continue
            if row["sku"] in skus:
                smi_skipped.append(row["sku"])
                continue
            row = dict(row)
            if not row["tier"]:  # every mesh of the batch is tier `smi` (as the market's are `mkt`): a NEW role is as exclusive as a new sku of an old one,
                row["tier"] = "smi"  # so a mine or a castle that lists `anvil` or `coal-bin` in a recipe keeps rolling exactly what it had
            flags = set(filter(None, (row.get("flags") or "").split(",")))
            skus[row["sku"]] = {**row, "src": "smi-01", "glb": glb, "piece": "", "hung": "hung" in flags,
                                **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
        if smi_skipped:
            print(f"smithy: {len(smi_skipped)} sku names already in the library, NOT replaced: {', '.join(smi_skipped[:8])}")
'''
EXCLUSIVE_OLD = '    for obj in objects.values():\n        tiers = {s["tier"] for s in obj["skus"]}\n'
EXCLUSIVE_ADD = '    EXCLUSIVE |= {"smi"}  # smithy & workshop (2026-10-11): every mesh of the batch; the shop front is the trade `smi` of the shop skeleton\n'
