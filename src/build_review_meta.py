#!/usr/bin/env python3
"""Filter metadata for the inn-01 review page: semantic role, themes and generation date per SKU.

Reads web/review/assets.json (the asset list), catalog/runs/inn-01/manifest.tsv (sku -> catalog object),
catalog/*.catalog.md (role headings + set: codes) and the GLB mtimes (generation time).
Writes web/review/meta.json. assets.json is left alone so build_live_review.py can keep rebuilding it.

Usage: python3 src/build_review_meta.py [--review web/review]
"""
import argparse
import csv
import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct  # noqa: E402


def clean(heading):
    """'W1. Fruit' -> 'Fruit'; 'W. Food — object level' -> 'Food'."""
    if not heading:
        return ""
    h = re.sub(r"^[A-Z]+\d*[a-z]?\.\s*", "", heading)
    return re.split(r"\s+[—-]\s+", h)[0].strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--review", type=pathlib.Path, default=ROOT / "web/review")
    ap.add_argument("--manifest", type=pathlib.Path, default=ROOT / "catalog/runs/inn-01/manifest.tsv")
    a = ap.parse_args()

    roles = {}
    for path in sorted((ROOT / "catalog").glob("*.catalog.md")):
        roles.update(ct.parse_catalog(path)[0])
    obj = {r["sku"]: r["object"] for r in csv.DictReader(a.manifest.open(), delimiter="\t")}
    assets = json.loads((a.review / "assets.json").read_text())["assets"]

    out, missing = {}, []
    for asset in assets:
        sku = asset["sku"]
        role = roles.get(obj.get(sku, sku))
        glb = a.review / "assets/models" / f"{sku}.glb"
        gen = datetime.datetime.fromtimestamp(glb.stat().st_mtime).astimezone().isoformat(timespec="minutes") \
            if glb.exists() else None
        if role is None:
            missing.append(sku)
            out[sku] = {"domain": "Uncatalogued", "role": "Uncatalogued", "themes": [], "gen": gen}
            continue
        out[sku] = {"domain": clean(role["domain"]), "role": clean(role["sub"]),
                    "themes": sorted(role["set"]), "gen": gen}
    payload = {"settings": ct.SETTINGS, "assets": out}
    (a.review / "meta.json").write_text(json.dumps(payload, indent=1) + "\n")
    print(f"meta: {len(out)} skus, {len(missing)} uncatalogued {missing[:8]}")


if __name__ == "__main__":
    main()
