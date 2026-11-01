#!/usr/bin/env python3
"""Publish the eye tyrant into the default set's manifest by the set's own publish code (../2026-10-06-figures/publish.py,
run on THIS folder's qa/, tiers/, assets.json and blind.json), then merge its one record into
../2026-10-06-figures/set/published/manifest.json (the tracked list build_figures.py reads), the other 518 untouched.
    python3 publish_one.py            (again after thumbs: the record then names its picture)"""
import json, os, time
from pathlib import Path
HERE = Path(__file__).resolve().parent; FIG = HERE.parent / "2026-10-06-figures"; ID = "foe-eye-tyrant"
SETMAN = FIG / "set/published/manifest.json"
src = (FIG / "publish.py").read_text()
src = src.replace('HERE = Path(__file__).resolve().parent; SET = HERE / "set"; PUB = SET / "published"', f'HERE = Path({str(HERE)!r}); SET = HERE; PUB = SET / "published"')
src = src.replace('old = json.loads((PUB / "manifest.json").read_text()) if (PUB / "manifest.json").exists() else {"batch": 0, "figures": []}', f'old = json.loads(Path({str(SETMAN)!r}).read_text())')
src = src.replace('if not (PUB / "models").exists(): os.symlink(os.path.realpath(SET / "models"), PUB / "models")', 'pass')
src = src.replace('(PUB / "manifest.json").write_text(', 'OUT = (')
ns = {"__name__": "publish_one"}; exec(compile(src, str(FIG / "publish.py"), "exec"), ns)
rec = next(f for f in ns["figs"] if f["id"] == ID)
rec["gemini"] = None   # the blind read (./blind.json) names it by the publisher's word; the asset's metadata must not carry it
m = json.loads(SETMAN.read_text()); m["figures"] = [f for f in m["figures"] if f["id"] != ID] + [rec]
m["figures"] = sorted(m["figures"], key=lambda f: f["id"] + ".json")   # the order publish.py keeps: its qa files by name
m["updated"] = ns["now"]; m["batch"] = max(m["batch"], rec["batch"]); m["expected_total"] = max(m.get("expected_total") or 0, len(m["figures"]))
SETMAN.write_text(json.dumps(m, indent=1) + "\n")
print(f"set manifest: {len(m['figures'])} figures, batch {m['batch']}; {ID}: thumb={rec['thumb']} gemini={'yes' if rec['gemini'] else 'no'} h={rec['height_ft']} oh={rec['overall_ft']} base={rec['base_ft']}")
