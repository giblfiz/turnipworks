"""The build_data.py side of the wizard's tower integration (2026-10-11). Pasted by apply.py (hunks/hunks.py).
Same shape as experiments/2026-10-05-castle-crypt-mansion/integration/room_types.py; edit HERE, then apply.py again
(and keep tools/spawn-tuner/build_data.py's applied lines the same, or apply.py inserts the block a second time)."""
G = "Wizard's tower"
T = ['wizard', 'noble', 'ccm']  # exclusive sku tiers these rooms may roll: their own first; the mansion's bookcases, mirrors and pedestals; the batch flats
FL_STONE = ['floor-flagstone-square', 'floor-checker-stone', 'floor-flagstone-large', 'floor-tile-hex']
FL_WOOD = ['floor-planks-dark', 'floor-planks-worn', 'floor-planks-stained', 'floor-flagstone-square']
def R(key, label, cells, floors, recipes, color, family='tower-stone', **kw):
    return {'key': key, 'label': label, 'program': 'generic', 'family': family, 'cells': cells, 'floors': floors, 'recipes': recipes, 'color': color, 'group': G, 'tiers': T, **kw}
WIZARD_ROOM_TYPES = [
    R('wiz-lab', 'Alchemy laboratory', [5, 4], ['floor-flagstone-square', 'floor-tile-hex', 'floor-flagstone-large', 'floor-checker-stone'], ['arc-tower-laboratory'], '#7fae6a'),
    R('wiz-study', 'Library & study', [4, 4], FL_WOOD, ['arc-tower-study'], '#9a7bb8'),
    R('wiz-summoning', 'Summoning chamber', [4, 4], ['floor-flagstone-large', 'floor-flagstone-square', 'floor-checker-stone'], ['arc-tower-summoning'], '#b0483f'),
    R('wiz-observatory', 'Observatory', [4, 4], ['floor-planks-dark', 'floor-flagstone-square', 'floor-checker-stone', 'floor-planks-worn'], ['arc-tower-observatory'], '#c9a84a'),
    R('wiz-scrying', 'Scrying room', [3, 3], ['floor-checker-stone', 'floor-tile-encaustic', 'floor-flagstone-square', 'floor-planks-dark'], ['arc-tower-scrying'], '#8fb0b8'),
    R('wiz-store', 'Potion store', [3, 3], ['floor-flagstone-square', 'floor-flagstone-large', 'floor-planks-worn'], ['arc-tower-store'], '#6d8a55'),
    R('wiz-apothecary', 'Apothecary shop', [4, 3], ['floor-planks-worn', 'floor-planks-stained', 'floor-tile-hex', 'floor-flagstone-square'], ['arc-tower-apothecary'], '#c98a4a', family='half-timber'),
    R('wiz-bedchamber', "Wizard's bedchamber", [4, 4], FL_WOOD, ['arc-tower-bedchamber'], '#7a5ca8'),
    R('wiz-menagerie', "Familiars' menagerie", [4, 4], ['floor-flagstone-rushes', 'floor-planks-rushes', 'floor-flagstone-square', 'floor-planks-worn'], ['arc-tower-menagerie'], '#a8a05c'),
    R('wiz-stair', 'Tower stair', [3, 3], FL_STONE, ['arc-tower-stair'], '#8a8fa0'),
    R('wiz-workshop', "Enchanter's workshop", [5, 4], ['floor-checker-stone', 'floor-flagstone-square', 'floor-tile-encaustic', 'floor-flagstone-large'], ['arc-tower-workshop'], '#b06fb0'),
]

BATCH_BLOCK = """\
    # wizard's tower (RunPod + the free image route, 2026-10-11): one run folder (wizard-01) and its flats. The rules that keep
    # every older room as it was (test/golden.mjs): a sku name that exists is never replaced; a new sku gets the EXCLUSIVE tier
    # `wizard` when its role + family already had a mesh OR when its role is named by a recipe of any older room type (so
    # no inn, crypt, castle or mansion room starts rolling an alembic). Everything else (new roles, the tower-stone wall
    # family) is open to all. Exclusive tiers are rolled only by room types that list them in `tiers`.
    WIZ = ROOT / "experiments/2026-10-11-wizard-tower"
    WIZ_FAMILIES = {"tower-stone", "half-timber"}
    wiz_had = {(r["object"], r["family"]) for r in skus.values()}
    wiz_rooms = {rt["key"] for rt in ROOM_TYPES if rt.get("group") == "Wizard's tower"}
    wiz_elsewhere = {oid for rt in ROOM_TYPES if rt["key"] not in wiz_rooms for rid in rt["recipes"] + rt.get("borrow", []) for ids in recipes[rid]["slots"].values() for oid in ids}
    for path in sorted((WIZ / "flats/decals").glob("*.jpg")):
        obj, _, var = path.stem.partition("--")
        skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "wizard" if (obj, "") in wiz_had or obj in wiz_elsewhere else "",
                           "shape": var, "src": "wizard-flats-01", "plate": path, "piece": ""}
    wiz_skipped = []
    wiz_manifest = ROOT / "catalog/runs/wizard-01/manifest.tsv"
    for row in (load_manifest(wiz_manifest) if wiz_manifest.exists() else []):
        glb = WIZ / "wizard/models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            wiz_skipped.append(row["sku"]); continue
        row = dict(row)
        if row["family"] and row["family"] not in WIZ_FAMILIES:  # (make_manifest.py reads the first `--` part of a kit sku as its wall family: wrong for door-tower--leaf)
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p); row["family"] = ""
        piece = "leaf" if row["shape"] == "leaf" else ""
        if not piece and row["place"] != "kit" and ((row["object"], row["family"]) in wiz_had or row["object"] in wiz_elsewhere or row["tier"] == "wizard"):
            row["tier"] = "wizard"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "wizard-01", "glb": glb, "piece": piece, "hung": "hung" in flags, "fit": "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if wiz_skipped:
        print(f"wizard: {len(wiz_skipped)} sku names already in the library, NOT replaced: {', '.join(wiz_skipped[:8])}")
"""
EXCLUSIVE_OLD = '    EXCLUSIVE = {"crypt", "castle", "noble", "storey", "ccm"}  # sku tiers'
EXCLUSIVE_NEW = '    EXCLUSIVE = {"crypt", "castle", "noble", "storey", "ccm", "wizard"}  # sku tiers'
