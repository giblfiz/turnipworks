#!/usr/bin/env python3
"""manifest_overrides.json for dun-01: kit boxes for door leaves (tools/kit_boxes.py rule: thin axis within 1.45x of the mesh),
own sizes for props whose mesh proportions are more than 1.35x off their spec box (the mesh's own box at the QA auto scale,
rounded to the inch: nothing is stretched), plain walls left at the catalog's 60x12x108. Re-run after every QA.
    python3 own_sizes.py"""
import csv, json, subprocess, sys
from pathlib import Path
T = Path(__file__).resolve().parent
of = T / "manifest_overrides.json"; of.write_text(json.dumps({"size": {}, "note": {}}) + "\n")
subprocess.run([sys.executable, str(T / "tools/kit_boxes.py"), str(T), "--write"], check=True, capture_output=True)
over = json.loads(of.read_text())
for k in [k for k in over["size"] if k.startswith("wall-")]:          # plain walls keep the kit's 12 in: corners and doorways assume it
    over["size"].pop(k); over["note"].pop(k, None)
spec = {a["id"]: a for a in json.loads((T / "assets.json").read_text())["assets"]}
for r in csv.DictReader((T / "qa/summary.tsv").open(), delimiter="\t"):
    s = r["sku"]
    if r["verdict"] != "accept" or s in over["size"] or s.startswith("wall-"): continue
    m = [v * 12 for v in json.loads((T / "qa" / f"{s}.json").read_text())["size_ft_at_auto_scale"]]; b = spec[s]["size"]
    f = [b[i] / m[i] for i in range(3)]
    if max(f) / min(f) > 1.35:
        over["size"][s] = [round(v) for v in m]
        over["note"][s] = f"mesh gate: ships at its own box {'x'.join(str(round(v)) for v in m)} (the design said {'x'.join(f'{v:g}' for v in b)}; the mesh came out {max(f)/min(f):.1f}x off those proportions and is not stretched)"
of.write_text(json.dumps(over, indent=1) + "\n")
print(len(over["size"]), "own sizes:", over["size"])
