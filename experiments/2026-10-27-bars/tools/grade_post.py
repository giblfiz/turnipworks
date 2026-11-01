#!/usr/bin/env python3
"""Darken the bars' post to the bars' own iron (2026-10-27). Gemini at play distance read the generated post as "a light
stone/masonry pillar" beside the dark bars of `cell-bars`. Same texture, its luminance and saturation matched to the bars'
colour map (the mean and spread of cell-bars), written back into the source GLB (the original in models-ungraded/), as
experiments/2026-10-11-types/dun/tools/grade_cut_rock.py did. Run in the browser venv (trimesh):
  python experiments/2026-10-27-bars/tools/grade_post.py [--measure]
"""
import shutil, sys, numpy as np, trimesh
from pathlib import Path
from PIL import Image
D = Path(__file__).resolve().parents[1]; T = D.parents[1] / "tools/spawn-tuner/assets/m"
def tex(sc):
    for g in sc.geometry.values():
        im = getattr(g.visual.material, 'baseColorTexture', None)
        if im is not None: return g.visual.material, im
    return None, None
def stats(im):
    a = np.asarray(im.convert("RGBA")).astype(float) / 255; m = a[..., 3] > 0.5; rgb = a[..., :3][m]
    lum = rgb @ np.array([0.299, 0.587, 0.114]); return rgb.mean(0) * 255, lum.mean(), lum.std()
_, bim = tex(trimesh.load(T / "cell-bars.glb")); bmean, blum, bstd = stats(bim)
print("cell-bars   mean", bmean.round(), "lum", round(blum, 3), "sd", round(bstd, 3))
src = D / "models-ungraded" / "cell-bars-post.glb"
if not src.exists(): src.parent.mkdir(exist_ok=True); shutil.copy2(D / "models" / "cell-bars-post.glb", src)
sc = trimesh.load(src); m, im = tex(sc); pmean, plum, pstd = stats(im)
print("post before mean", pmean.round(), "lum", round(plum, 3), "sd", round(pstd, 3))
if "--measure" in sys.argv: sys.exit(0)
a = np.asarray(im.convert("RGBA")).astype(float) / 255; rgb0 = a[..., :3]
grey = (rgb0 @ np.array([0.299, 0.587, 0.114]))[..., None]
bsat = 1.0  # keep the post's own hue at the bars' saturation: scale chroma by the bars' chroma over the post's
pc = np.abs(rgb0 - grey).mean(); bc = np.abs(np.asarray(bim.convert("RGB")).astype(float) / 255 - (np.asarray(bim.convert("RGB")).astype(float) / 255 @ np.array([0.299, 0.587, 0.114]))[..., None]).mean()
k = min(1.0, bc / max(pc, 1e-6))
lum = (grey - plum) * (bstd / max(pstd, 1e-6)) + blum  # luminance mapped onto the bars' mean and spread
rgb = np.clip(lum + k * (rgb0 - grey), 0, 1)
m.baseColorTexture = Image.fromarray((np.dstack([rgb, a[..., 3]]) * 255).round().astype("uint8")).convert(im.mode)
sc.export(D / "models" / "cell-bars-post.glb")
_, im2 = tex(trimesh.load(D / "models" / "cell-bars-post.glb")); print("post after  mean", stats(im2)[0].round(), "lum", round(stats(im2)[1], 3), "chroma k", round(k, 2))
