#!/usr/bin/env python3
"""The eye tyrant's plate spec, made by the default set's own spec code (../2026-10-06-figures/set_spec.py + set_more.py,
where its line lives) without rewriting the set's files: runs set_spec.py up to its write step, takes the one asset,
points its paths at the main checkout (the plate binaries live there), and writes ./assets.json. With --into-set it
also adds (or replaces) the same record in ../2026-10-06-figures/set/assets.json, so the set's QA and publish see it.
    python3 spec.py [--into-set]"""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; FIG = HERE.parent / "2026-10-06-figures"; ID = "foe-eye-tyrant"
MAIN = "experiments/2026-10-06-figures"
src = (FIG / "set_spec.py").read_text(); src = src[:src.index('(HERE / "set").mkdir')]
ns = {"__file__": str(FIG / "set_spec.py"), "__name__": "set_spec"}; exec(compile(src, str(FIG / "set_spec.py"), "exec"), ns)
a = next(x for x in ns["F"] if x["id"] == ID)
a["prio"] = a.pop("prio_set", None) or 5.6
a = json.loads(json.dumps(a).replace(str(FIG), MAIN))
(HERE / "assets.json").write_text(json.dumps({"assets": [a]}, indent=1) + "\n")
print("wrote assets.json:", a["id"], a["group"], a["height_ft"], "base", a["base_ft"], "refs", a["refs"])
if "--into-set" in sys.argv:
    p = FIG / "set/assets.json"; d = json.loads(p.read_text()); d["assets"] = [x for x in d["assets"] if x["id"] != ID] + [a]
    p.write_text(json.dumps(d, indent=1) + "\n"); print("set/assets.json:", len(d["assets"]), "assets")
