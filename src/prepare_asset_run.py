#!/usr/bin/env python3
"""Freeze a catalog TSV as an auditable Gemini/TRELLIS production run."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--style", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    frozen = args.output / "source-manifest.tsv"
    shutil.copy2(args.manifest, frozen)
    rows = list(csv.DictReader(frozen.open(), delimiter="\t"))
    if len(rows) != 500:
        raise SystemExit(f"refusing to launch: expected 500 SKUs, found {len(rows)}")
    ids = [row["sku"] for row in rows]
    if len(ids) != len(set(ids)):
        raise SystemExit("refusing to launch: duplicate SKU ids")

    assets = []
    for row in rows:
        variants = ", ".join(
            f"{key}={row[key]}" for key in ("family", "tier", "shape") if row[key]
        ) or "base version"
        detail = (
            f"{row['desc']}. Function and context: {row['hint']}. "
            f"Primary material family: {row['mat']}. Placement: {row['place']}; "
            f"VTT footprint class: {row['fp']}; variant: {variants}. "
            "Prioritize a clean silhouette and construction that remains readable from an elevated game camera."
        )
        assets.append({
            "id": row["sku"],
            "object": row["object"],
            "source": "generate",
            "lane": row["lane"],
            "generation": row["gen"],
            "priority": row["pri"],
            "subject": row["desc"],
            "detail": detail,
        })

    (args.output / "assets.json").write_text(json.dumps({"assets": assets}, indent=2) + "\n")
    run = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sku_count": len(rows),
        "lane_counts": {
            lane: sum(row["lane"] == lane for row in rows) for lane in ("3d", "2d")
        },
        "source_manifest": str(args.manifest.resolve()),
        "source_manifest_sha256": sha256(frozen),
        "style": str(args.style.resolve()),
        "style_sha256": sha256(args.style),
        "reference": str(args.reference.resolve()),
        "reference_sha256": sha256(args.reference),
    }
    (args.output / "run.json").write_text(json.dumps(run, indent=2) + "\n")
    print(json.dumps(run, indent=2))


if __name__ == "__main__":
    main()
