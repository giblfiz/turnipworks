#!/usr/bin/env python3
"""Run resumable, concurrent Gemini concept-image batches for Turnip Works."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_STYLE = Path(__file__).resolve().parent.parent / "style" / "heroic-handpainted.object.md"


def run_one(root: Path, asset: dict, references: list[Path], retries: int, style: str) -> dict:
    prompt_dir = root / "prompts"
    input_dir = root / "inputs"
    prompt_dir.mkdir(parents=True, exist_ok=True)
    input_dir.mkdir(parents=True, exist_ok=True)
    prompt_path = prompt_dir / f"{asset['id']}.md"
    output_path = input_dir / f"{asset['id']}.jpg"
    if output_path.exists() and output_path.with_suffix(".gemini.json").exists():
        return {"id": asset["id"], "status": "existing"}
    prompt_path.write_text(style.format(subject=asset["subject"], detail=asset["detail"]))
    command = [
        sys.executable,
        str(Path(__file__).with_name("gemini_image.py")),
        "--prompt-file", str(prompt_path),
        "--output", str(output_path),
    ]
    for reference in references:
        command += ["--reference", str(reference)]
    for attempt in range(retries + 1):
        completed = subprocess.run(command, text=True, capture_output=True)
        if completed.returncode == 0:
            print(f"{asset['id']}: completed", flush=True)
            return {"id": asset["id"], "status": "completed"}
        if attempt == retries:
            print(f"{asset['id']}: failed: {completed.stderr[-500:]}", flush=True)
            return {"id": asset["id"], "status": "failed", "error": completed.stderr[-2000:]}
        delay = 5 * (3 ** attempt)
        print(f"{asset['id']}: retrying in {delay}s", flush=True)
        time.sleep(delay)
    raise AssertionError("unreachable")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("experiment", type=Path)
    parser.add_argument("--reference", action="append", required=True, type=Path)
    parser.add_argument("--assets-file", type=Path,
                        help="Asset definition JSON (default: <experiment>/assets.json)")
    parser.add_argument("--lane", choices=("2d", "3d"),
                        help="Generate only assets assigned to this lane")
    parser.add_argument("--manifest-name", default="image-batch-manifest.json")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--style-file", type=Path, default=DEFAULT_STYLE,
                        help="prompt template with {subject} and {detail}")
    args = parser.parse_args()
    root = args.experiment.resolve()
    style = args.style_file.read_text()
    assets_file = args.assets_file or (root / "assets.json")
    definition = json.loads(assets_file.read_text())
    assets = [
        asset for asset in definition["assets"]
        if asset.get("source") == "generate"
        and (args.lane is None or asset.get("lane") == args.lane)
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(lambda asset: run_one(root, asset, args.reference, args.retries, style), assets))
    summary = {
        "experiment": root.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "requested": len(assets),
        "completed": sum(row["status"] in {"completed", "existing"} for row in results),
        "failed": sum(row["status"] == "failed" for row in results),
        "results": results,
    }
    temporary = root / f"{args.manifest_name}.tmp"
    temporary.write_text(json.dumps(summary, indent=2) + "\n")
    temporary.replace(root / args.manifest_name)
    print(json.dumps({key: summary[key] for key in ("requested", "completed", "failed")}, indent=2))
    if summary["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
