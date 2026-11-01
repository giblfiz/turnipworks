#!/usr/bin/env python3
"""Measure, judge and tier the eye tyrant's mesh by the default set's own QA (../2026-10-06-figures/set_qa.py `one`:
the same thresholds, the same two shipping tiers by src/optimize_glb_blender.py), pointed at THIS folder laid out like
the set (assets.json, masked/, models/, qa/, tiers/). A facing other than the mesh's +Z goes in ./yaw.json ({id: deg}).
    ~/.local/share/tw-trimesh-venv/bin/python qa.py [path/to/mesh.glb]   (default models/foe-eye-tyrant.glb)"""
import json, shutil, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; FIG = HERE.parent / "2026-10-06-figures"; sys.path.insert(0, str(FIG)); ID = "foe-eye-tyrant"
import measure, set_qa
if (HERE / "yaw.json").exists(): measure.YAW = json.loads((HERE / "yaw.json").read_text())
set_qa.SET = HERE
for d in ("qa", "tiers", "models", "published/thumbs"): (HERE / d).mkdir(parents=True, exist_ok=True)
src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "models" / f"{ID}.glb"
glb = HERE / "models" / f"{ID}.glb"
if src.resolve() != glb.resolve(): shutil.copy2(src, glb)
print(set_qa.one((ID, glb, True)))
r = json.loads((HERE / "qa" / f"{ID}.json").read_text())
print(json.dumps({k: r.get(k) for k in ("verdict", "fail", "notes", "overall_ft", "scale", "y0", "yaw_deg", "tiers")}, indent=1))
print("plan", json.dumps(r.get("plan")), "\nground", json.dumps(r.get("ground")), "\npieces", json.dumps({k: v for k, v in r["pieces"].items() if k != "floating"}))
