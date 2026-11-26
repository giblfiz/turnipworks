#!/usr/bin/env python3
"""The RunPod side (COPY of the cyberpunk lane's, dinos lane 2026-11-07; pod/tools renamed tw-dinos / dinos):
    python3 pod_prep.py prep [ids...]     pod/figs/{masked,gate-manifest.json}: every accepted plate with no mesh yet (or the ids)
    python3 pod_prep.py home              pod/figs/models/<id>.glb -> set/models/<id>.glb (new or changed only; set/models is on USB)
Then:  cd pod && PIPE=1024_cascade TEX=2048 tools/launch_wave.sh figs auto auto ; (poll) tools/harvest.sh figs auto auto ; tools/pod_down.sh"""
import json, shutil, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; SET = HERE / "set"; T = HERE / "pod" / "figs"
if sys.argv[1] == "prep":
    (T / "masked").mkdir(parents=True, exist_ok=True)
    gate = json.loads((SET / "gate-manifest.json").read_text())["assets"]
    spec = {a["id"]: a for a in json.loads((SET / "assets.json").read_text())["assets"]}
    ids = sys.argv[2:] or [i for i, r in gate.items() if r.get("status") == "accepted" and spec.get(i, {}).get("group") != "body" and not (SET / "models" / f"{i}.glb").exists()]
    for i in ids: shutil.copy2(SET / "masked" / f"{i}.png", T / "masked" / f"{i}.png")
    have = sorted(p.stem for p in (T / "masked").glob("*.png"))
    (T / "gate-manifest.json").write_text(json.dumps({"assets": {i: {"status": "accepted"} for i in have}}, indent=1) + "\n")
    print(len(ids), "plates for the pod:", " ".join(ids))
else:
    n = 0
    for g in sorted((T / "models").glob("*.glb")):
        d = SET / "models" / g.name
        if not d.exists() or d.stat().st_size != g.stat().st_size: shutil.copy2(g, d); n += 1
    print(n, "meshes brought home")
