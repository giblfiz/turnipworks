#!/usr/bin/env python3
"""Reconstruct an interrupted TRELLIS batch manifest from JSONL worker logs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("logs", nargs="+", type=Path)
    parser.add_argument("--models-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--expected-count", type=int, default=64)
    parser.add_argument(
        "--allow-extra-models",
        action="store_true",
        help="Validate logged outputs inside a larger combined model directory",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    records: dict[str, dict] = {}
    duplicates: list[str] = []

    for log_path in args.logs:
        for line_number, line in enumerate(log_path.read_text(errors="replace").splitlines(), 1):
            if not line.startswith("{"):
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("event") not in {"asset_complete", "asset_reused"}:
                continue
            name = Path(event["output"]).name
            if name in records:
                duplicates.append(name)
            event.pop("event", None)
            event["input"] = Path(event["input"]).name
            event["output"] = name
            event["worker_log"] = log_path.name
            event["worker_log_line"] = line_number
            records[name] = event

    files = {path.name: path for path in args.models_dir.glob("*.glb")}
    extra_files = sorted(files.keys() - records.keys())
    missing_records = [] if args.allow_extra_models else extra_files
    missing_files = sorted(records.keys() - files.keys())
    size_mismatches = []
    for name in files.keys() & records.keys():
        actual = files[name].stat().st_size
        if actual != records[name]["bytes"]:
            size_mismatches.append({"output": name, "logged": records[name]["bytes"], "actual": actual})

    manifest = {
        "model": "microsoft/TRELLIS.2-4B",
        "image_encoder": "camenduru/dinov3-vitl16-pretrain-lvd1689m",
        "image_encoder_sha256": "dcb2e45127cccbf1601e5f42fef165eea275c8e5213197e8dcf3f48822718179",
        "pipeline_type": "512",
        "faces_target": 50_000,
        "texture_size": 1024,
        "assets": [records[name] for name in sorted(records)],
        "validation": {
            "glb_files": len(files),
            "complete_records": len(records),
            "duplicate_complete_records": sorted(set(duplicates)),
            "missing_records": missing_records,
            "extra_files": extra_files,
            "missing_files": missing_files,
            "size_mismatches": size_mismatches,
        },
    }
    args.output.write_text(json.dumps(manifest, indent=2) + "\n")

    valid = (
        len(records) == args.expected_count
        and (args.allow_extra_models or len(files) == args.expected_count)
        and not missing_records
        and not missing_files
        and not size_mismatches
    )
    print(json.dumps(manifest["validation"], indent=2))
    if not valid:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
