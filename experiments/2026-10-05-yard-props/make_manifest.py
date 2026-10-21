#!/usr/bin/env python3
"""catalog/runs/outdoors-02/manifest.tsv: the yard props that passed the plate gate AND the mesh gate (accepted.json),
one row per shipped sku. `source` = the file stem in models/ (three test trees were made twice, with a plain and a
chunky-canopy prompt; both passed, so the chunky one ships as --s and the plain one as --s2). `size` = this mesh's own
size where it differs from the catalog line (two tree sizes under one catalog object, the low hedge).
    python3 make_manifest.py
"""
import csv, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")): roles.update(ct.parse_catalog(p)[0])
spec = {a["id"]: a for a in json.loads((HERE / "assets.json").read_text())["assets"]}
accepted = json.loads((HERE / "accepted.json").read_text())   # {source id: note}
RENAME = {"woodpile--long": ("woodpile-long", "woodpile-long")}
for t in ("tree-deciduous--s", "tree-fruit--s", "tree-birch--s"):
    RENAME[t + "--chunky"] = (t, t.split("--")[0]); RENAME[t] = (t + "2", t.split("--")[0])
# Sizes the meshes ship at (measured on the meshes, qa/<id>.json). Props are sized largest-dimension to largest-dimension, and
# these storybook trees came out about as wide as they are tall, so a tree's number here is its LARGEST dimension in feet
# (canopy or height, whichever is bigger) and its footprint follows from the mesh. Kit pieces are stretched per axis to
# their box, so a box far from the mesh's own proportions distorts it: these boxes stay within about 1.5x of the mesh.
TREE_MAX_FT = {"tree-deciduous--s--chunky": 11, "tree-deciduous--s": 11, "tree-deciduous--l": 20, "tree-fruit--s--chunky": 9, "tree-fruit--s": 9,
               "tree-fruit--l": 13, "tree-birch--s--chunky": 17, "tree-birch--s": 17, "tree-birch--l": 22, "tree-oak-great": 26}
KIT_BOX = {"fence-post-rail": (60, 7, 40), "fence-post-corner": (9, 9, 46), "gate-fence": (48, 5, 40), "fence-picket": (60, 4, 38), "fence-wattle": (60, 5, 36),
           "wall-drystone": (60, 18, 33), "wall-drystone-pier": (24, 24, 40), "wall-drystone-gate": (60, 20, 39),
           "hedge-straight--low": (60, 22, 38), "hedge-end-block": (28, 28, 42), "hedge-gap-arch": (60, 26, 68), "hedge-corner": (60, 60, 38)}
def own_size(src, a):
    if src in KIT_BOX: return list(KIT_BOX[src])
    if src in TREE_MAX_FT:
        x, y, z = json.loads((HERE / "qa" / f"{src}.json").read_text())["size_ft_at_auto_scale"]; k = TREE_MAX_FT[src] / max(x, y, z)
        return [round(max(x, y) * k * 12), round(max(x, y) * k * 12), round(z * k * 12)]  # (square footprint: a tree may be turned any way)
    return list(a["size"])
rows = []
for src in sorted(accepted):
    a = spec[src]; sku, obj = RENAME.get(src, (src, a["object"])); role = roles[obj]
    sz = own_size(src, a); size = "" if [float(v) for v in sz] == [float(v) for v in role["size"]] else "x".join(f"{v:g}" for v in sz)
    rows.append({"sku": sku, "object": obj, "group": a["group"], "lane": "3d", "gen": role["gen"], "family": "", "tier": "", "shape": sku.partition("--")[2],
                 "place": role["place"], "fp": role["fp"], "mat": role["mat"], "pri": role["pri"], "desc": role["desc"], "hint": role["hint"],
                 "open_of": role.get("open_of") or "", "mount": "" if role.get("mount") is None else f"{role['mount']:g}", "flags": "", "note": accepted[src],
                 "size": size, "source": src})
out = ROOT / "catalog/runs/outdoors-02/manifest.tsv"; out.parent.mkdir(parents=True, exist_ok=True)
with out.open("w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0]), delimiter="\t", lineterminator="\n"); w.writeheader(); w.writerows(rows)
print(len(rows), "rows ->", out)
