#!/usr/bin/env python3
"""Small, auditable fal TRELLIS.2 batch runner for Turnip Works experiments."""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import hashlib
import json
import mimetypes
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENDPOINT = "https://queue.fal.run/fal-ai/trellis-2"
PRICE_USD = {"512": 0.25, "1024": 0.30, "1536": 0.35}


def request_json(url: str, key: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=body)
    req.add_header("Authorization", f"Key {key}")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"fal returned HTTP {exc.code}: {detail}") from exc


def image_data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def run_asset(name: str, image: Path, out_dir: Path, key: str, settings: dict) -> dict:
    started = datetime.now(timezone.utc)
    submitted = request_json(ENDPOINT, key, {"image_url": image_data_uri(image), **settings})
    request_id = submitted["request_id"]
    status_url = submitted.get("status_url", f"{ENDPOINT}/requests/{request_id}/status")
    response_url = submitted.get("response_url", f"{ENDPOINT}/requests/{request_id}")

    while True:
        status = request_json(status_url, key)
        state = status.get("status")
        print(f"{name}: {state}", flush=True)
        if state == "COMPLETED":
            break
        if state in {"FAILED", "CANCELLED"}:
            raise RuntimeError(f"{name}: {state}: {json.dumps(status)}")
        time.sleep(3)

    result = request_json(response_url, key)
    model_url = result["model_glb"]["url"]
    model_path = out_dir / "models" / f"{name}.glb"
    for attempt in range(4):  # fal's CDN occasionally 500s on a finished asset; the result is still there
        try:
            with urllib.request.urlopen(model_url, timeout=300) as response:
                model_path.write_bytes(response.read())
            break
        except urllib.error.URLError:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))

    finished = datetime.now(timezone.utc)
    manifest = {
        "asset": name,
        "provider": "fal.ai",
        "model": "fal-ai/trellis-2",
        "request_id": request_id,
        "started_at": started.isoformat(),
        "finished_at": finished.isoformat(),
        "elapsed_seconds": round((finished - started).total_seconds(), 2),
        "input": str(image.relative_to(out_dir)),
        "input_sha256": hashlib.sha256(image.read_bytes()).hexdigest(),
        "output": str(model_path.relative_to(out_dir)),
        "output_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "output_bytes": model_path.stat().st_size,
        "settings": settings,
        "estimated_cost_usd": PRICE_USD[settings["resolution"]],
    }
    (out_dir / "manifests" / f"{name}.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("experiment", type=Path)
    parser.add_argument("--key-file", type=Path, default=Path("~/.config/fauna/secrets/fal-api-key.txt"))
    parser.add_argument("--resolution", choices=["512", "1024", "1536"], default="1024")
    parser.add_argument("--decimation-target", type=int, default=50000)
    parser.add_argument("--texture-size", choices=["1024", "2048", "4096"], default="2048")
    args = parser.parse_args()
    root = args.experiment.resolve()
    for folder in (root / "models", root / "manifests"):
        folder.mkdir(parents=True, exist_ok=True)
    inputs = sorted(
        path
        for path in (root / "inputs").iterdir()
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    if not inputs:
        parser.error(f"no supported image inputs in {root / 'inputs'}")
    key = args.key_file.read_text().strip()
    settings = {
        "resolution": args.resolution,
        "decimation_target": args.decimation_target,
        "texture_size": args.texture_size,
        "remesh": True,
    }
    # Resume: assets with a manifest are done. One failure must not sink the batch.
    todo = [p for p in inputs if not (root / "manifests" / f"{p.stem}.json").exists()]
    failed = []

    def guarded(p):
        try:
            return run_asset(p.stem, p, root, key, settings)
        except Exception as exc:  # noqa: BLE001 — record and continue
            failed.append({"asset": p.stem, "error": str(exc)[:300]})
            print(f"{p.stem}: FAILED {exc}", flush=True)
            return None

    if todo:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(todo))) as pool:
            list(pool.map(guarded, todo))
    results = [json.loads(m.read_text()) for m in sorted((root / "manifests").glob("*.json"))]
    batch = {
        "experiment": root.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": sorted(results, key=lambda row: row["asset"]),
        "estimated_total_cost_usd": sum(row["estimated_cost_usd"] or 0 for row in results),
        "failed": failed,
    }
    (root / "manifest.json").write_text(json.dumps(batch, indent=2) + "\n")
    print(json.dumps(batch, indent=2))


if __name__ == "__main__":
    main()
