#!/usr/bin/env python3
"""Build the progressively populated inn-01 review data and hard-link its assets."""

from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path


def link(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if source.stat().st_ino == target.stat().st_ino:
            return
        target.unlink()
    os.link(source, target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--run-name", default="inn-01", help="ratings key prefix the review page uses")
    args = parser.parse_args()

    rows = list(csv.DictReader(args.manifest.open(), delimiter="\t"))
    by_sku = {row["sku"]: row for row in rows}
    complete = []
    for model in sorted((args.run / "models").glob("*.glb")):
        row = by_sku.get(model.stem)
        plate = args.run / "inputs" / f"{model.stem}.jpg"
        if row is None or not plate.exists():
            continue
        link(model, args.output / "assets" / "models" / model.name)
        link(plate, args.output / "assets" / "plates" / plate.name)
        complete.append({
            "sku": model.stem,
            "name": row["desc"],
            "priority": row["pri"],
            "material": row["mat"],
            "placement": row["place"],
            "rooms": row.get("rooms", ""),
            **({"group": row["group"]} if row.get("group") else {}),
            "hint": row["hint"],
            "bytes": model.stat().st_size,
        })

    data = {
        "run": args.run_name,
        "complete": len(complete),
        "expectedMeshes": sum(row["lane"] == "3d" for row in rows),
        "flatAssets": sum(row["lane"] == "2d" for row in rows),
        "assets": complete,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "assets.json").write_text(json.dumps(data, indent=2) + "\n")
    print(f"review: {len(complete)}/{data['expectedMeshes']} meshes")


if __name__ == "__main__":
    main()
