"""Culture roofs (2026-11-07, lane culture-roofs; experiments/2026-11-07-culture-roofs, PLAN.md): the roof ORNAMENT meshes.
build_data.py imports this module: add_culture_roofs() reads catalog/runs/croof-01/manifest.tsv (written by the lane's
assets/tools/manifest.py) and puts each accepted mesh (binaries: experiments/2026-11-07-culture-roofs/assets/models/<source>.glb)
into the sku table. A sku name that already exists is never replaced; with no manifest nothing is added.
  - roof-ridge--kawara / --tongwa / --glazed: new skus of the EXISTING kit role roof-ridge, named like its --lead / --thatch
    (shape = the roof style, tier '' as theirs): the roof builder picks the ridge by style.
  - roof-onigawara (jpn), roof-chiwen (chn), roof-cupola-onion (rus), roof-dome and roof-malqaf (mde), roof-shikhara (ind): new
    kit roles carrying their culture's exclusive tier, so no room program rolls them; the roof builder places them by rule
    (engine/client/roofs.js). The catalog lines are in catalog/objects-culture-roofs.catalog.md."""
from pathlib import Path

E = "experiments/2026-11-07-culture-roofs/assets"
SRC = "croof-01"


def add_culture_roofs(skus, root, load_manifest):
    man = Path(root) / f"catalog/runs/{SRC}/manifest.tsv"
    if not man.exists():
        return
    skipped = []
    for row in load_manifest(man):
        glb = Path(root) / E / "models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            skipped.append(row["sku"])
            continue
        row = dict(row)
        skus[row["sku"]] = {**row, "src": SRC, "glb": glb, "piece": "", "hung": False,
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if skipped:
        print(f"culture roofs: {len(skipped)} sku names already in the library, NOT replaced: {', '.join(skipped[:8])}")
