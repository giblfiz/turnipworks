#!/usr/bin/env python3
"""Merge the farm's front decisions (keep/orient-hut01.json: from prep/orient-sweep-hut-01/decisions.json plus the two manual
quarter turns) into a tuner tree's data/orient.json, in prep/orient_ccm.py's own format. (orient_ccm.py itself cannot be
re-run for hut-01 without its sheets, and it stops on the three skus that were withdrawn after the sweep.)
    python3 orient_merge.py [tuner dir]"""
import json, pathlib, sys
HERE = pathlib.Path(__file__).resolve().parent
T = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parents[3] / "tools/spawn-tuner"
p = T / "data/orient.json"; o = {k: v for k, v in json.loads(p.read_text()).items() if not k.startswith("hut-01/")}
o.update(json.loads((HERE / "keep/orient-hut01.json").read_text()))
p.write_text(json.dumps(dict(sorted(o.items())), indent=1) + "\n"); print("orient.json:", sum(k.startswith("hut-01/") for k in o), "farm entries")
