#!/usr/bin/env python3
"""Generate one auditable Turnip Works concept plate with Gemini."""

from __future__ import annotations

import argparse
import os
import base64
import hashlib
import json
import mimetypes
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

def image_part(path: Path) -> dict:
    return {
        "type": "image",
        "mime_type": mimetypes.guess_type(path.name)[0] or "image/png",
        "data": base64.b64encode(path.read_bytes()).decode(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt-file", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--reference", action="append", default=[], type=Path)
    parser.add_argument("--model", default="gemini-3.1-flash-image")
    parser.add_argument("--image-size", default="1K", choices=["0.5K", "1K", "2K", "4K"])
    parser.add_argument("--key-file", type=Path,
                        default=Path("/etc/turnip-works/secrets/google/gemini-api-key.txt"),
                        help="used only when GEMINI_API_KEY is not set in the environment")
    args = parser.parse_args()

    prompt = args.prompt_file.read_text().strip()
    content = [image_part(path) for path in args.reference]
    content.append({"type": "text", "text": prompt})
    started = datetime.now(timezone.utc)
    payload = {
        "model": args.model,
        "input": content,
        "store": False,
        "response_format": {
            "type": "image",
            "mime_type": "image/jpeg",
            "aspect_ratio": "1:1",
            "image_size": args.image_size,
        },
    }
    request = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": os.environ.get("GEMINI_API_KEY") or args.key_file.read_text().strip(),
            "Api-Revision": "2026-05-20",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            interaction = json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"Gemini returned HTTP {exc.code}: {detail}") from exc

    image = next(
        (
            block
            for step in interaction.get("steps", [])
            if step.get("type") == "model_output"
            for block in step.get("content", [])
            if block.get("type") == "image" and block.get("data")
        ),
        None,
    )
    if not image:
        raise RuntimeError("Gemini returned no output image")

    image_bytes = base64.b64decode(image["data"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(image_bytes)
    finished = datetime.now(timezone.utc)
    manifest = {
        "provider": "google",
        "model": args.model,
        "interaction_id": interaction.get("id"),
        "started_at": started.isoformat(),
        "finished_at": finished.isoformat(),
        "elapsed_seconds": round((finished - started).total_seconds(), 2),
        "prompt_file": str(args.prompt_file),
        "prompt_sha256": hashlib.sha256(args.prompt_file.read_bytes()).hexdigest(),
        "references": [
            {"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in args.reference
        ],
        "output": str(args.output),
        "output_bytes": len(image_bytes),
        "output_sha256": hashlib.sha256(image_bytes).hexdigest(),
        "image_size": args.image_size,
    }
    manifest_path = args.output.with_suffix(".gemini.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
