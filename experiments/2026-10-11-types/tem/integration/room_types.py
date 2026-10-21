"""The build_data.py side of the temple & chapel type (apply.py pastes these in). Keys beyond the inn's: group, tiers, and
`flavors`: the flavors this room dresses in, in order of preference (js/solver2.js temFlavor)."""
GOOD, EVIL = ['sun', 'moon', 'nature', 'sword-shield'], ['devils', 'spiders', 'skulls', 'dragons', 'tentacles']
PALE = ['floor-checker-stone', 'floor-flagstone-square', 'floor-marble-cabochon', 'floor-tile-encaustic']
def rt(key, label, cells, recipes, color, floors=PALE, family='temple-stone', tiers=('temple', 'ccm'), flavors=GOOD):
    return {'key': key, 'label': label, 'program': 'generic', 'family': family, 'cells': cells, 'floors': floors, 'recipes': recipes, 'color': color, 'group': 'Temple', 'tiers': list(tiers), 'flavors': flavors}
TEMPLE_ROOM_TYPES = [
    rt('temple-nave', 'Temple nave', [5, 8], ['tem-nave'], '#d8cfa4'),
    rt('cathedral', 'Cathedral', [8, 14], ['tem-nave'], '#e3d9a8', floors=['floor-marble-cabochon', 'floor-checker-stone', 'floor-flagstone-square', 'floor-tile-encaustic']),
    rt('cathedral-dark', 'Dark cathedral', [8, 14], ['tem-nave'], '#6f5a6e', floors=['floor-flagstone-damp', 'floor-tomb-slabs', 'floor-checker-stone', 'floor-flagstone-large'], family='crypt-stone', tiers=('crypt', 'ccm'), flavors=EVIL),
    rt('temple-shrine', 'Shrine', [3, 4], ['tem-shrine'], '#cfc08a'),
    rt('temple-vestry', 'Vestry', [3, 3], ['tem-vestry-room'], '#c4b79a', floors=['floor-flagstone-square', 'floor-checker-stone', 'floor-tile-encaustic']),
    rt('temple-cloister', 'Cloister walk', [8, 3], ['tem-cloister-walk'], '#b9c2a0', floors=['floor-flagstone-square', 'floor-flagstone-large', 'floor-checker-stone']),
    rt('temple-scriptorium', 'Scriptorium', [5, 5], ['tem-scriptorium-room'], '#c9b98c', floors=['floor-flagstone-square', 'floor-tile-encaustic', 'floor-checker-stone']),
    rt('temple-infirmary', 'Infirmary', [7, 5], ['tem-infirmary-ward'], '#cdd3c4', floors=['floor-flagstone-square', 'floor-checker-stone', 'floor-tile-encaustic']),
    rt('temple-cell', "Priest's cell", [2, 3], ['tem-priest-cell'], '#b7ad98', floors=['floor-flagstone-square', 'floor-flagstone-large']),
    rt('temple-belltower', 'Bell tower base', [3, 3], ['tem-bell-tower'], '#bfb18f', floors=['floor-flagstone-square', 'floor-flagstone-large']),
]
BATCH_BLOCK = '''\
    # >>> tem:data.batch
    # temple & chapel (2026-10-11): one run folder (experiments/2026-10-11-types/tem/batch, manifest catalog/runs/tem-01) and
    # one flats folder. Same rules as the castle / crypt / mansion block: a sku name that exists is never replaced; a new
    # mesh under a role + family the library already had (the marble altar) gets the exclusive tier `temple`.
    TEM = ROOT / "experiments/2026-10-11-types/tem"
    tem_had = {(r["object"], r["family"]) for r in skus.values()}
    for path in sorted((TEM / "flats/decals").glob("*.jpg")):
        obj, _, var = path.stem.partition("--")  # flavor-banner--sun: the flavor is the shape
        if path.stem not in skus:
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var, "src": "tem-flats-01", "plate": path, "piece": ""}
    tem_manifest = ROOT / "catalog/runs/tem-01/manifest.tsv"
    for row in (load_manifest(tem_manifest) if tem_manifest.exists() else []):
        glb = TEM / "batch/models" / f"{row['source']}.glb"
        if not glb.exists() or row["sku"] in skus:
            continue
        row = dict(row)
        if row["family"] and row["family"] != "temple-stone":
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
            row["family"] = ""
        if (row["object"], row["family"]) in tem_had or row["object"] in ("rite-alms-box",):  # (the alms box is in a recipe the castle chapel reads: the golden test)
            row["tier"] = "temple"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "tem-01", "glb": glb, "piece": "", "hung": "hung" in flags, "fit": "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    # <<< tem:data.batch
'''
