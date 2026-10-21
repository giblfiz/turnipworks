#!/usr/bin/env python3
"""Convert Gemini's uniform blue asset plates into pre-masked RGBA PNGs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--assets", type=Path, help="Only process 3D ids from assets.json")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    allowed = None
    if args.assets:
        definition = json.loads(args.assets.read_text())
        allowed = {row["id"] for row in definition["assets"] if row.get("lane") == "3d"}

    records = []
    for source in sorted(args.input_dir.glob("*.jpg")):
        if allowed is not None and source.stem not in allowed:
            continue
        target = args.output_dir / f"{source.stem}.png"
        if target.exists() and not args.overwrite:
            records.append({"id": source.stem, "status": "existing"})
            continue
        bgr = cv2.imread(str(source), cv2.IMREAD_COLOR)
        if bgr is None:
            records.append({"id": source.stem, "status": "failed", "error": "unreadable"})
            continue
        height, width = bgr.shape[:2]
        edge = max(4, min(height, width) // 64)
        border = np.concatenate((
            bgr[:edge].reshape(-1, 3), bgr[-edge:].reshape(-1, 3),
            bgr[:, :edge].reshape(-1, 3), bgr[:, -edge:].reshape(-1, 3),
        ))
        background = np.median(border, axis=0)
        if not (background[0] > background[1] * 1.25 and background[0] > background[2] * 1.5):
            records.append({
                "id": source.stem, "status": "failed",
                "error": f"border is not chroma blue: BGR={background.round().astype(int).tolist()}",
            })
            continue
        lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        bg_lab = cv2.cvtColor(background.reshape(1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)[0, 0]
        distance = np.linalg.norm(lab - bg_lab, axis=2)
        alpha = np.clip((distance - 12.0) / 24.0, 0.0, 1.0)
        alpha = (alpha * 255).astype(np.uint8)
        alpha = cv2.medianBlur(alpha, 3)
        rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = alpha
        rgba[alpha == 0, :3] = 0
        cv2.imwrite(str(target), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        records.append({
            "id": source.stem, "status": "complete",
            "background_bgr": background.round().astype(int).tolist(),
            "foreground_fraction": round(float((alpha > 127).mean()), 5),
        })
    manifest = {"requested": len(records), "complete": sum(r["status"] in {"complete", "existing"} for r in records), "failed": sum(r["status"] == "failed" for r in records), "assets": records}
    (args.output_dir / "chroma-key-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({key: manifest[key] for key in ("requested", "complete", "failed")}, indent=2))
    if manifest["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
