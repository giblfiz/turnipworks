"""Culture packs B (2026-11-06; experiments/2026-11-06-cultures-b): Norse steading (NRS), Middle East / Mamluk (MDE),
medieval Rus' (RUS), Mexica (MES). build_data.py imports this file: its room types join ROOM_TYPES, add_cultures_b()
reads each pack's run manifest (catalog/runs/cultb-<code>-01/manifest.tsv) and every mesh is tier <code> (EXCLUSIVE),
so no older room rolls any of them. A pack whose manifest is absent adds nothing, so packs land one at a time.
Rules in words: tools/spawn-tuner/ROOMS.md -> Culture packs; programs: js/solver2.js block cb:solver2 (the culture-room
skeleton) and one data block per pack."""
import csv
import pathlib

E = "experiments/2026-11-06-cultures-b"
TIERS = {"nrs", "mde", "rus", "mes"}

EARTH = ["floor-earth-straw", "floor-earth-packed", "floor-planks-rushes", "floor-earth-bare"]
PLANK = ["floor-boards-rough", "floor-planks-worn", "floor-planks-dark"]
YARD = ["floor-earth-packed", "floor-grass-worn", "floor-earth-bare", "floor-gravel"]
STONE_ME = ["floor-flagstone-large", "floor-flagstone-square", "floor-marble-cabochon", "floor-tile-hex"]
COURT_ME = ["floor-flagstone-large", "floor-setts-courtyard", "floor-flagstone-square", "floor-cobble"]
MEX = ["floor-flagstone-large", "floor-earth-packed", "floor-flagstone-irregular"]


def _rt(code, group, key, label, cells, family, floors, color, **kw):
    return {"key": key, "label": label, "program": "outdoors" if kw.get("outdoor") else "generic", "family": family, "cells": cells, "floors": floors,
            "recipes": [key], "color": color, "group": group, "tiers": kw.pop("tiers", [code]), **kw}


N, M, R, X = "Norse steading", "Middle East (Mamluk)", "Medieval Rus'", "Mexica (Aztec)"
ROOM_TYPES = {
    "nrs": [
        _rt("nrs", N, "nrs-longhouse", "Longhouse", [8, 4], "norse-stave", EARTH, "#8a6a48"),
        _rt("nrs", N, "nrs-meadhall", "Mead hall (high seat)", [10, 5], "norse-stave", EARTH, "#a0603a"),
        _rt("nrs", N, "nrs-smithy", "Norse smithy", [4, 4], "norse-stave", ["floor-earth-packed", "floor-earth-bare", "floor-flagstone-irregular"], "#6f5f55", tiers=["nrs", "smi"]),  # (smi: the smithy's anvil, coal and tool board)
        _rt("nrs", N, "nrs-boathouse", "Boathouse (naust)", [8, 4], "norse-stave", ["floor-earth-packed", "floor-gravel", "floor-earth-bare"], "#6d7f86"),
        _rt("nrs", N, "nrs-weaving", "Weaving hut", [3, 3], "norse-stave", EARTH, "#b0835c"),
        _rt("nrs", N, "nrs-yard", "Steading yard (runestone)", [7, 6], "norse-stave", YARD, "#7f9455", outdoor=True),
    ],
    "mde": [
        _rt("mde", M, "mde-courtyard", "Caravanserai courtyard", [8, 8], "mde-plaster", COURT_ME, "#c9a66b", outdoor=True),
        _rt("mde", M, "mde-souk", "Souk shop", [3, 3], "mde-plaster", ["floor-flagstone-large", "floor-terracotta", "floor-flagstone-irregular"], "#c46a3a", tiers=["mde", "mkt"]),
        _rt("mde", M, "mde-hammam", "Hammam (bathhouse)", [5, 5], "mde-plaster", ["floor-marble-cabochon", "floor-flagstone-large", "floor-tile-hex"], "#9fc2c0"),
        _rt("mde", M, "mde-audience", "Reception hall (qa'a)", [7, 5], "mde-plaster", STONE_ME, "#b7894f"),
        _rt("mde", M, "mde-coffee", "Coffee house", [5, 4], "mde-plaster", ["floor-flagstone-large", "floor-terracotta", "floor-tile-hex"], "#8c5a3c"),
        _rt("mde", M, "mde-garden", "Courtyard garden", [6, 6], "mde-plaster", ["floor-setts-courtyard", "floor-flagstone-large", "floor-grass-worn"], "#7fa060", outdoor=True),
    ],
    "rus": [
        _rt("rus", R, "rus-izba", "Izba (log house)", [4, 4], "rus-log", PLANK, "#a4783f"),
        _rt("rus", R, "rus-terem", "Terem hall", [6, 4], "rus-log", ["floor-planks-polished", "floor-planks-worn", "floor-planks-dark"], "#a9473c"),
        _rt("rus", R, "rus-banya", "Banya (bathhouse)", [3, 3], "rus-log", ["floor-boards-rough", "floor-planks-worn"], "#8aa0a6"),
        _rt("rus", R, "rus-church", "Wooden church", [5, 6], "rus-log", ["floor-planks-worn", "floor-planks-dark", "floor-boards-rough"], "#d2a640"),
        _rt("rus", R, "rus-market", "Market row stall", [3, 3], "rus-log", PLANK, "#8b6a3d", tiers=["rus", "mkt"]),
        _rt("rus", R, "rus-yard", "Stockade yard", [7, 6], "rus-log", ["floor-earth-packed", "floor-earth-bare", "floor-grass-worn"], "#7c8b5a", outdoor=True),
    ],
    "mes": [
        _rt("mes", X, "mes-shrine", "Temple summit shrine", [4, 4], "mes-stucco", ["floor-flagstone-large", "floor-flagstone-square"], "#c8423a"),
        _rt("mes", X, "mes-ballcourt", "Ballcourt", [16, 6], "mes-stucco", ["floor-ind-lime"], "#d1b07a", outdoor=True),  # (2026-11-07: 80 x 30 ft for the I plan: five bench sections a side (the ring in the middle one), a 50 x 15 ft alley between end zones the plot's full width; the whole court lime-plastered)
        _rt("mes", X, "mes-house", "Noble's house", [6, 4], "mes-stucco", MEX, "#c98a4a"),
        _rt("mes", X, "mes-market", "Market plaza", [8, 7], "mes-stucco", ["floor-earth-packed", "floor-flagstone-large", "floor-earth-bare"], "#c9a052", outdoor=True),
        _rt("mes", X, "mes-chinampa", "Chinampa garden", [7, 6], "mes-stucco", ["floor-water-flooded"], "#4f8f6a", outdoor=True),
        _rt("mes", X, "mes-scribe", "Scribe's room", [4, 3], "mes-stucco", MEX, "#3f8f8f"),
    ],
}


def room_types(root):
    """The room types of every pack whose manifest has landed (catalog/runs/cultb-<code>-01/manifest.tsv)."""
    return [rt for code, rts in ROOM_TYPES.items() if (root / f"catalog/runs/cultb-{code}-01/manifest.tsv").exists() for rt in rts]


def add_cultures_b(skus, root):
    """Each pack's accepted meshes (the manifest's rows) into the library's sku table; a sku name that exists is never replaced."""
    for code in ROOM_TYPES:
        man = root / f"catalog/runs/cultb-{code}-01/manifest.tsv"
        if not man.exists():
            continue
        with open(man, newline="") as fh:
            rows = list(csv.DictReader(fh, delimiter="\t"))
        for row in rows:
            glb = root / E / "models" / f"{row['source']}.glb"
            if not glb.exists() or row["sku"] in skus:
                continue
            row = dict(row, tier=row.get("tier") or code)
            flags = set(filter(None, (row.get("flags") or "").split(",")))
            skus[row["sku"]] = {**row, "src": f"cultb-{code}-01", "glb": glb, "piece": row.get("piece", ""), "hung": "hung" in flags,
                                **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    # flat decals (chroma-blue plates, prep/flats.py keys them), each its pack's tier: the ballcourt's painted centre line
    # (2026-11-07, lane culture-roofs; experiments/2026-11-07-culture-roofs/such/flats, tools/gen.py)
    for path in sorted((root / FLATS).glob("decal-*.jpg")):
        code = next((c for c in ROOM_TYPES if path.stem.startswith(f"decal-{c}-")), None)
        if code and path.stem not in skus:
            skus[path.stem] = {"sku": path.stem, "object": path.stem, "lane": "2d", "family": "", "tier": code, "shape": "v1", "src": f"cultb-{code}-flats-01", "plate": path, "piece": ""}


FLATS = "experiments/2026-11-07-culture-roofs/such/flats"
