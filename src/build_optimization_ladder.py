#!/usr/bin/env python3
"""Build and record the Turnip Works local GLB optimization ladder."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


PRESETS = [
    {"id": "texture-1024", "label": "Texture 1024", "faces": None, "texture_size": 1024},
    {"id": "texture-512", "label": "Texture 512", "faces": None, "texture_size": 512},
    {"id": "texture-256", "label": "Texture 256", "faces": None, "texture_size": 256},
    {"id": "balanced", "label": "Balanced", "faces": 24000, "texture_size": 1024},
    {"id": "lean", "label": "Lean", "faces": 12000, "texture_size": 512},
    {"id": "tiny", "label": "Tiny", "faces": 6000, "texture_size": 512},
    {"id": "absurd", "label": "Absurd", "faces": 3000, "texture_size": 256},
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("experiment", type=Path)
    parser.add_argument("--blender", default="blender")
    parser.add_argument("--preset", choices=[preset["id"] for preset in PRESETS])
    args = parser.parse_args()
    root = args.experiment.resolve()
    script = Path(__file__).with_name("optimize_glb_blender.py").resolve()
    output_root = root / "optimized"
    rows = []

    for source in sorted((root / "models").glob("*.glb")):
        for preset in [row for row in PRESETS if not args.preset or row["id"] == args.preset]:
            output = output_root / preset["id"] / source.name
            command = [
                args.blender, "--background", "--python", str(script), "--",
                str(source), str(output), "--texture-size", str(preset["texture_size"]),
            ]
            if preset["faces"]:
                command += ["--faces", str(preset["faces"])]
            completed = subprocess.run(command, check=True, text=True, capture_output=True)
            marker = next(line for line in completed.stdout.splitlines() if line.startswith("TW_OPTIMIZE="))
            result = json.loads(marker.removeprefix("TW_OPTIMIZE="))
            rows.append({
                "asset": source.stem,
                "preset": preset["id"],
                "label": preset["label"],
                "target_faces": preset["faces"],
                "texture_size": preset["texture_size"],
                "faces": result["faces_after"],
                "bytes": output.stat().st_size,
                "sha256": sha256(output),
                "path": str(output.relative_to(root)),
            })
            print(f"{source.stem:5} {preset['id']:12} {result['faces_after']:6} faces {output.stat().st_size:9} bytes")

    manifest_path = output_root / "manifest.json"
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"variants": []}
    replaced = {(row["asset"], row["preset"]) for row in rows}
    variants = [row for row in previous["variants"] if (row["asset"], row["preset"]) not in replaced] + rows
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "method": "Blender 4.3 collapse decimation + WebP resize/export quality 85",
        "presets": PRESETS,
        "variants": sorted(variants, key=lambda row: (row["asset"], row["preset"])),
    }
    (output_root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
