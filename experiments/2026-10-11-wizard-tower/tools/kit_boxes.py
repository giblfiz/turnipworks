#!/usr/bin/env python3
"""Kit pieces are stretched per axis to their box; the yard and the crypt kept every box within about 1.5x of the mesh.
For every ACCEPTED mesh whose catalog role is gen `kit` (or spec fit: box / kit: wall): the box it would ship at (override,
else spec size), the per-axis stretch, and, where the anisotropy is over 1.5 ONLY because of the thin axis (depth), a
proposed box with the depth raised to mesh depth / 1.45 (the crypt's rule: niche panels 16 to 18 in, gate 9 in).
Width and height are never changed here: a piece whose width:height is itself over 1.5x off is printed as FAIL.
    python3 tools/kit_boxes.py TYPE_DIR [--write]     --write merges the proposals into TYPE_DIR/manifest_overrides.json"""
import csv, json, math, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[2]; sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
T = Path(sys.argv[1]); write = "--write" in sys.argv
if not T.exists(): T = HERE.parent / sys.argv[1]
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")): roles.update(ct.parse_catalog(p)[0])
spec = {a["id"]: a for a in json.loads((T / "assets.json").read_text())["assets"]}
of = T / "manifest_overrides.json"; over = json.loads(of.read_text()) if of.exists() else {}
over.setdefault("size", {}); over.setdefault("note", {})
for r in csv.DictReader((T / "qa" / "summary.tsv").open(), delimiter="\t"):
    s = r["sku"]; x = spec.get(s)
    if r["verdict"] != "accept" or not x: continue
    role = roles.get(x["object"]) or {}
    if not (role.get("gen") == "kit" or x.get("fit") == "box" or x.get("kit") == "wall"): continue
    m = json.loads((T / "qa" / f"{s}.json").read_text())["size_ft_at_auto_scale"]; box = list(over["size"].get(s) or x["size"])
    a, b = (0, 1) if abs(math.log(box[0] / box[1]) - math.log(m[0] / m[1])) <= abs(math.log(box[0] / box[1]) - math.log(m[1] / m[0])) else (1, 0)
    mesh = [m[a] * 12, m[b] * 12, m[2] * 12]; f = [box[i] / mesh[i] for i in range(3)]; an = max(f) / min(f)
    thin = min(range(2), key=lambda i: box[i]); wide = 1 - thin; wh = max(f[wide], f[2]) / min(f[wide], f[2])
    line = f"{s:44} mesh {[round(v) for v in mesh]} box {box} anisotropy {an:.2f}"
    if an <= 1.5: print(line, "ok"); continue
    if wh > 1.5: print(line, f"FAIL: width:height stretch {wh:.2f}x"); continue
    lo, hi = max(f[wide], f[2]) / 1.45, min(f[wide], f[2]) * 1.45          # allowed range of the thin-axis factor
    new = list(box); new[thin] = int(math.ceil(mesh[thin] * lo)) if f[thin] < lo else int(math.floor(mesh[thin] * hi))
    print(line, f"-> box {new}")
    if write and s not in over["size"]:
        over["size"][s] = new
        over["note"].setdefault(s, f"mesh gate: kit box {'x'.join(map(str, new))} (mesh {round(mesh[0])}x{round(mesh[1])}x{round(mesh[2])} at auto scale; the catalog's thin side {box[thin]} would stretch it {an:.1f}x unevenly)")
if write: of.write_text(json.dumps(over, indent=1) + "\n")
