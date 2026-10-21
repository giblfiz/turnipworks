#!/usr/bin/env python3
"""Patch a pinned TRELLIS.2 install to avoid BRIA/NVIDIA runtime paths."""

from __future__ import annotations

import argparse
import shutil
import site
from pathlib import Path


OLD_RASTER = """    # Setup differentiable rasterizer context
    ctx = dr.RasterizeCudaContext()
    # Prepare UV coordinates for rasterization (rendering in UV space)
    uvs_rast = torch.cat([out_uvs * 2 - 1, torch.zeros_like(out_uvs[:, :1]), torch.ones_like(out_uvs[:, :1])], dim=-1).unsqueeze(0)
    rast = torch.zeros((1, texture_size, texture_size, 4), device='cuda', dtype=torch.float32)

    # Rasterize in chunks to save memory
    for i in range(0, out_faces.shape[0], 100000):
        rast_chunk, _ = dr.rasterize(
            ctx, uvs_rast, out_faces[i:i+100000],
            resolution=[texture_size, texture_size],
        )
        mask_chunk = rast_chunk[..., 3:4] > 0
        rast_chunk[..., 3:4] += i # Store face ID in alpha channel
        rast = torch.where(mask_chunk, rast_chunk, rast)

    # Mask of valid pixels in texture
    mask = rast[0, ..., 3] > 0

    # Interpolate 3D positions in UV space (finding 3D coord for every texel)
    pos = dr.interpolate(out_vertices.unsqueeze(0), rast, out_faces)[0][0]
    valid_pos = pos[mask]
"""

NEW_RASTER = """    # Rasterize UV triangles without NVIDIA research-code dependencies.
    mask, valid_pos = rasterize_uv_positions(
        out_uvs, out_faces, out_vertices, texture_size
    )
"""


def installed_o_voxel() -> Path:
    candidates = [Path(root) / "o_voxel" for root in site.getsitepackages()]
    return next((path for path in candidates if path.is_dir()), None)  # type: ignore[return-value]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected one patch target in {path}, found {count}")
    path.write_text(text.replace(old, new))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trellis-root", required=True, type=Path)
    args = parser.parse_args()
    package = installed_o_voxel()
    if package is None:
        raise SystemExit("installed o_voxel package not found")
    shutil.copy2(Path(__file__).with_name("clean_uv_rasterizer.py"), package / "clean_uv_rasterizer.py")
    postprocess = package / "postprocess.py"
    # Normalize whitespace-only blank lines so the pinned block matches cleanly.
    postprocess.write_text(postprocess.read_text().replace("    \n", "\n"))
    replace_once(postprocess, "import nvdiffrast.torch as dr\n", "from .clean_uv_rasterizer import rasterize_uv_positions\n")
    replace_once(postprocess, OLD_RASTER, NEW_RASTER)

    pipeline = args.trellis_root / "trellis2/pipelines/trellis2_image_to_3d.py"
    replace_once(
        pipeline,
        "        pipeline.rembg_model = getattr(rembg, args['rembg_model']['name'])(**args['rembg_model']['args'])\n",
        "        pipeline.rembg_model = None  # Inputs are pre-masked RGBA; avoid loading a remover.\n",
    )
    print(f"patched {postprocess}")
    print(f"patched {pipeline}")


if __name__ == "__main__":
    main()
