#!/usr/bin/env python3
"""Cool the cut-rock wall kit (2026-10-12). As meshed, the four panels' colour maps average (63,54,37) to (83,69,32): an
ochre brown that reads as timber under the tuner's warm light; the brief was dark grey-brown rock with cool quiet
surfaces. Same texture, colour pulled 60% toward grey and a little darker, written back into the source GLB (originals in
models-ungraded/). Run in the browser venv (trimesh):  python tools/grade_cut_rock.py
"""
import shutil, numpy as np, trimesh
from pathlib import Path
from PIL import Image
D = Path(__file__).resolve().parents[1]
for sku in ("wall-straight--cut-rock", "wall-straight--cut-rock--s2", "wall-straight--cut-rock--s3", "wall-doorway--cut-rock"):
    src = D / "models-ungraded" / f"{sku}.glb"
    if not src.exists(): shutil.copy2(D / "models" / f"{sku}.glb", src)
    sc = trimesh.load(src); n = 0
    for g in sc.geometry.values():
        m = g.visual.material; im = m.baseColorTexture
        if im is None: continue
        a = np.asarray(im.convert("RGBA")).astype(float) / 255; rgb0 = a[..., :3]; before = rgb0.mean((0, 1)) * 255
        grey = (rgb0 @ np.array([0.299, 0.587, 0.114]))[..., None]
        rgb = np.clip((grey + 0.4 * (rgb0 - grey)) * 0.92, 0, 1); rgb[..., 2] = np.clip(rgb[..., 2] * 1.06, 0, 1)  # desaturated, a little darker, a touch toward blue-grey
        out = np.dstack([rgb, a[..., 3]]); m.baseColorTexture = Image.fromarray((out * 255).round().astype("uint8")).convert(im.mode); n += 1
        print(sku, "mean", before.round(), "->", (rgb.mean((0, 1)) * 255).round())
    sc.export(D / "models" / f"{sku}.glb")
