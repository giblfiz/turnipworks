#!/usr/bin/env python3
"""Publish the accepted figures of the default set as FILES the game can pick up later without renaming:
set/published/manifest.json (one row per figure: stable id, tags, sizes, facing, files), tiers/ (the two shipping
tiers), models -> the full-size originals (a symlink to the USB disk; never committed), thumbs/ (thumbs.py fills it).
    python3 publish.py [--expected 450]      then thumbs.py and deploy_set.sh
A figure is published when its QA verdict is accept (or set/qa/overrides.json says so). Its batch number is the
publish run in which it first appeared, so the gallery can mark what is new."""
import json, os, sys, time
from pathlib import Path
HERE = Path(__file__).resolve().parent; SET = HERE / "set"; PUB = SET / "published"
expected = int(next((a.split("=")[1] for a in sys.argv if a.startswith("--expected=")), 450))
spec = {a["id"]: a for a in json.loads((SET / "assets.json").read_text())["assets"]}
over = json.loads((SET / "qa/overrides.json").read_text()) if (SET / "qa/overrides.json").exists() else {}
blind = json.loads((SET / "blind.json").read_text()) if (SET / "blind.json").exists() else {}
old = json.loads((PUB / "manifest.json").read_text()) if (PUB / "manifest.json").exists() else {"batch": 0, "figures": []}
was = {f["id"]: f for f in old["figures"]}; batch = old["batch"] + 1; now = time.strftime("%Y-%m-%dT%H:%M:%S%z"); now = now[:-2] + ":" + now[-2:]
(PUB / "tiers").mkdir(parents=True, exist_ok=True); (PUB / "thumbs").mkdir(exist_ok=True)
if not (PUB / "models").exists(): os.symlink(os.path.realpath(SET / "models"), PUB / "models")
HERO_TIER = {"hero", "large"}      # 20k / 1024 for heroes, bosses and large one-offs; 8k / 512 for hordes and townsfolk (Harry 2026-10-06)
figs, new = [], 0
for q in sorted((SET / "qa").glob("*.json")):
    if q.name == "overrides.json": continue
    r = json.loads(q.read_text()); i = r["id"]; s = spec.get(i)
    if not s or s["group"] == "body": continue
    v = over.get(i, {}).get("verdict", r["verdict"])
    if v != "accept" or "tiers" not in r or "20k1024" not in r["tiers"] or "8k512" not in r["tiers"]: continue
    for key in ("20k1024", "8k512"):
        src, dst = SET / "tiers" / f"{i}--{key}.glb", PUB / "tiers" / f"{i}--{key}.glb"
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            if dst.exists(): dst.unlink()
            try: os.link(src, dst)
            except OSError: import shutil; shutil.copy2(src, dst)
    prev = was.get(i)
    if prev and prev.get("sha1") and prev["sha1"] != r.get("sha1"): prev = None      # a new mesh under the same name: new again, and its picture's address changes
    new += prev is None
    rec = "hero" if (s["group"] in HERO_TIER or s.get("boss")) else "horde"
    t = r["tiers"]
    figs.append({"id": i, "name": s.get("name") or s["subject"], "group": s["group"], "race": s.get("race"), "gender": s.get("gender"), "cls": s.get("cls"), "family": s.get("family"),
                 "tags": s.get("tags", []), "srd": s.get("srd", []), "height_ft": s["height_ft"]["body"], "overall_ft": r.get("overall_ft"), "base_ft": s.get("base_ft", 5),
                 "facing_deg": r.get("yaw_deg", 0), "scale": r["scale"], "y0": r["y0"], "centre": r["plan"]["centre"], "native_bounds": r["native_bounds"],
                 "files": {"full": f"models/{i}.glb", "hero": f"tiers/{i}--20k1024.glb", "horde": f"tiers/{i}--8k512.glb"},
                 "tris": {"full": t["full"]["tris"], "hero": t["20k1024"]["tris"], "horde": t["8k512"]["tris"]}, "kb": {"full": t["full"]["kb"], "hero": t["20k1024"]["kb"], "horde": t["8k512"]["kb"]},
                 "recommended": rec, "sha1": r.get("sha1"), "thumb": f"thumbs/{i}.webp" if (PUB / "thumbs" / f"{i}.webp").exists() else None,
                 "batch": prev["batch"] if prev else batch, "published_at": prev["published_at"] if prev else now,
                 "qa": {"verdict": v, "unpainted_seen": (r.get("unpainted") or {}).get("seen"), "floating": r["pieces"]["floating_count"], "contacts": r["ground"]["contact_count"], "reach_ft": r["plan"]["reach_radius_ft"],
                        "feet_base_ft": round(r["plan"]["contacts_radius_ft"] * 2, 2), "notes": r.get("notes", []) + ([over[i]["note"]] if over.get(i, {}).get("note") else [])},
                 "gemini": ({"blind": blind[i].get("blind"), "class_guess": blind[i].get("class_guess"), "role_guess": blind[i].get("role_guess"), "faults": blind[i].get("faults")} if blind.get(i) else None)})
if new == 0: batch = old["batch"]
(PUB / "manifest.json").write_text(json.dumps({"updated": now, "expected_total": expected, "batch": batch, "figures": figs}, indent=1) + "\n")
from collections import Counter
print(f"published {len(figs)} of about {expected} ({new} new, batch {batch}):", dict(Counter(f["group"] for f in figs)))
