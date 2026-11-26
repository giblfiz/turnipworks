#!/usr/bin/env python3
"""A FLIER THAT STANDS IN ITS FLYING POSE (Harry 2026-11-07, of the pterodactyl: "The standing [pterodactyl] needs to be
thrown away. For now let's just use the flying one as standing."; dinohuge lane).
    ~/.local/share/tw-trimesh-venv/bin/python stand_as_fly.py      (publish.py runs it last; run it again after measure_fly.py)
For each id in STAND_AS_FLY, its row in set/published/manifest.json takes the FLYING figure's mesh and frame from the
pack's own fly manifest (set/published/fly/manifest.json): files (fly/tiers, fly/models), scale, y0, centre, facing,
height, tris, kb, sha1 (so its addresses change and no browser keeps the old mesh), thumbnail, and `plate` (the flying
plate, for the figure review page). Its id, name, group, size (base_ft), tags and srd stay: saved maps still load it,
the bar still finds it. The standing mesh is no longer named anywhere (its files stay on the USB disk).
On the ground the engine puts a figure's LOWEST point on its disc (client/figures.js), so a flying pose stands on its
tucked feet and belly, wings spread. Raised, the pawn wears its fly row: the same mesh, so the swap changes nothing seen.
Idempotent: a row already standing as its flier is rewritten to the same thing."""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent; PUB = HERE / "set/published"
STAND_AS_FLY = ["foe-pterodactyl"]
man = json.loads((PUB / "manifest.json").read_text()); fly = {f["id"]: f for f in json.loads((PUB / "fly/manifest.json").read_text())["figures"]}
for row in man["figures"]:
    i = row["id"]
    if i not in STAND_AS_FLY: continue
    q = fly[i]; qa = json.loads((PUB / "fly/qa" / f"{i}.json").read_text())
    nb = row.get("native_bounds")
    try:   # the flying mesh's own bounds (the published rows carry them); trimesh is in the tw-trimesh venv
        import trimesh
        s = trimesh.load(PUB / "fly" / q["files"]["full"], force="scene"); b = s.bounds
        nb = [[round(float(v), 4) for v in b[0]], [round(float(v), 4) for v in b[1]]]
    except Exception as e:  # noqa: BLE001
        if row.get("stands_as") != "fly": raise SystemExit(f"{i}: could not read the flying mesh's bounds ({e!r}); run with the tw-trimesh venv")
    over = qa["reach_ft"] - row["base_ft"] / 2
    row.update({"height_ft": q["height_ft"], "overall_ft": q["overall_ft"], "facing_deg": q["facing_deg"], "scale": q["scale"], "y0": q["y0"], "centre": q["centre"],
                "native_bounds": nb, "files": {k: "fly/" + v for k, v in q["files"].items()}, "tris": q["tris"], "kb": q["kb"], "sha1": q["sha1"],
                "thumb": "fly/" + q["thumb"] if q.get("thumb") else None, "stands_as": "fly", "plate": i + "-fly",
                "qa": {"verdict": "accept", "unpainted_seen": None, "floating": qa.get("loose", {}).get("pieces"), "contacts": None, "reach_ft": qa["reach_ft"], "feet_base_ft": None,
                       "notes": ["stands in its FLYING pose (Harry 2026-11-07: the standing mesh was thrown away)"] + ([f"reaches {over:.1f} ft outside its square"] if over > 0.6 else []) + qa.get("notes", [])},
                "gemini": None})
    print(f"{i}: stands as its flier ({q['files']['hero']}, {q['height_ft']} ft tall, {q['span_ft']} ft span, on its {row['base_ft']}-ft base)")
(PUB / "manifest.json").write_text(json.dumps(man, indent=1) + "\n")
