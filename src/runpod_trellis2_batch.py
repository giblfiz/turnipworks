#!/usr/bin/env python3
"""Run a reusable TRELLIS.2 image-to-GLB batch on a GPU worker.

This script is intentionally provider-neutral: copy it and the input images to a
Runpod (or any CUDA host) with the official TRELLIS.2 checkout, then run it from
that checkout so one model load can serve a whole asset batch.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from pathlib import Path

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import o_voxel
import torch
from PIL import Image
from trellis2.pipelines import Trellis2ImageTo3DPipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="*", type=Path)
    parser.add_argument("--input-list", type=Path,
                        help="Newline-delimited input paths, useful for durable worker shards")
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument(
        "--manifest-name",
        default="manifest.json",
        help="Manifest filename inside output-dir (set a unique name for concurrent workers)",
    )
    parser.add_argument("--pipeline-type", default="512", choices=("512", "1024", "1024_cascade", "1536_cascade"))
    parser.add_argument("--faces", type=int, default=50_000)
    parser.add_argument("--texture-size", type=int, default=1024)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--model", default="microsoft/TRELLIS.2-4B")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--wait-pids", default="",
                        help="Comma-separated PIDs to wait for after loading weights on CPU and before moving to the GPU "
                             "(overlap a slow model load with a previous wave that still holds the GPU)")
    parser.add_argument("--resident", action="store_true", help="Keep all pipeline models on GPU (for large-VRAM workers)")
    parser.add_argument(
        "--image-encoder",
        help="Override the DINO image encoder repo (useful while an identical gated checkpoint awaits approval)",
    )
    args = parser.parse_args()
    if args.input_list:
        args.inputs.extend(
            Path(line.strip()) for line in args.input_list.read_text().splitlines() if line.strip()
        )
    if not args.inputs:
        parser.error("provide input paths or --input-list")
    return args


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.image_encoder:
        from trellis2.modules import image_feature_extractor

        original_init = image_feature_extractor.DinoV3FeatureExtractor.__init__

        def init_with_override(self, model_name: str, image_size: int = 512) -> None:
            original_init(self, model_name=args.image_encoder, image_size=image_size)
            # Transformers 5.x nests the encoder layers one level deeper than
            # the interface TRELLIS.2 currently calls.
            if not hasattr(self.model, "layer") and hasattr(self.model, "model"):
                self.model.layer = self.model.model.layer

        image_feature_extractor.DinoV3FeatureExtractor.__init__ = init_with_override
    started = time.monotonic()
    pipeline = Trellis2ImageTo3DPipeline.from_pretrained(args.model)
    if args.resident:
        pipeline.low_vram = False
    for pid in filter(None, args.wait_pids.split(",")):
        while os.path.exists(f"/proc/{pid}"):
            time.sleep(5)
    pipeline.cuda()
    print(json.dumps({"event": "model_loaded", "seconds": round(time.monotonic() - started, 2)}), flush=True)

    records = []

    def write_manifest() -> None:
        manifest = {
            "model": args.model,
            "image_encoder": args.image_encoder,
            "pipeline_type": args.pipeline_type,
            "faces": args.faces,
            "texture_size": args.texture_size,
            "resident": args.resident,
            "assets": records,
            "total_seconds": round(time.monotonic() - started, 2),
        }
        (args.output_dir / args.manifest_name).write_text(json.dumps(manifest, indent=2) + "\n")

    for index, input_path in enumerate(args.inputs):
        asset_seed = args.seed + int.from_bytes(
            hashlib.sha256(input_path.stem.encode()).digest()[:4], "big"
        ) % 1_000_000_000
        output_path = args.output_dir / f"{input_path.stem}.glb"
        if output_path.exists() and not args.overwrite:
            record = {
                "input": str(input_path),
                "output": str(output_path),
                "seconds": 0,
                "bytes": output_path.stat().st_size,
                "seed": asset_seed,
                "status": "reused",
            }
            records.append(record)
            print(json.dumps({"event": "asset_reused", **record}), flush=True)
            write_manifest()
            continue
        item_started = time.monotonic()
        try:
            image = Image.open(input_path)
            mesh = pipeline.run(
                image,
                seed=asset_seed,
                pipeline_type=args.pipeline_type,
            )[0]
            mesh.simplify(16_777_216)
            resolution = 512 if args.pipeline_type == "512" else 1024
            glb = o_voxel.postprocess.to_glb(
                vertices=mesh.vertices,
                faces=mesh.faces,
                attr_volume=mesh.attrs,
                coords=mesh.coords,
                attr_layout=pipeline.pbr_attr_layout,
                grid_size=resolution,
                aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
                decimation_target=args.faces,
                texture_size=args.texture_size,
                remesh=True,
                remesh_band=1,
                remesh_project=0,
                use_tqdm=True,
            )
            glb.export(output_path, extension_webp=True)
            record = {
                "input": str(input_path),
                "output": str(output_path),
                "seconds": round(time.monotonic() - item_started, 2),
                "bytes": output_path.stat().st_size,
                "seed": asset_seed,
                "status": "complete",
            }
        except Exception as error:
            record = {
                "input": str(input_path),
                "output": str(output_path),
                "seconds": round(time.monotonic() - item_started, 2),
                "seed": asset_seed,
                "status": "failed",
                "error": f"{type(error).__name__}: {error}",
            }
        finally:
            torch.cuda.empty_cache()
        records.append(record)
        print(json.dumps({"event": f"asset_{record['status']}", **record}), flush=True)
        write_manifest()

    write_manifest()
    print(json.dumps({"event": "batch_complete", "assets": records, "total_seconds": round(time.monotonic() - started, 2)}), flush=True)


if __name__ == "__main__":
    main()
