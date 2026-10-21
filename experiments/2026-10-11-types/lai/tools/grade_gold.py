#!/usr/bin/env python3
"""Make the hoard read as GOLD from above (2026-10-12). As meshed, the two hoard heaps' colour maps are a deep orange; from the
table camera a blind read called the great heap "a large, orange, cratered mound: a monster nest or burrow", where the
library's pale yellow coin heap reads as gold. Same texture; the lit orange and yellow pixels (the coin surface) are turned
toward yellow-gold and lifted, everything else (chest wood, iron, gems, shadow) is left alone. Originals in models-ungraded/.
Run in the browser venv (trimesh):  python tools/grade_gold.py
"""
import shutil, colorsys, numpy as np, trimesh
from pathlib import Path
from PIL import Image
D = Path(__file__).resolve().parents[1]; (D / "models-ungraded").mkdir(exist_ok=True)
for sku in ("treasure-hoard-heap", "treasure-hoard-heap--s2"):
    src = D / "models-ungraded" / f"{sku}.glb"
    if not src.exists(): shutil.copy2(D / "models" / f"{sku}.glb", src)
    sc = trimesh.load(src)
    for g in sc.geometry.values():
        m = g.visual.material; im = m.baseColorTexture
        if im is None: continue
        hsv = np.asarray(im.convert("RGB").convert("HSV")).astype(float); h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
        coin = (h > 12) & (h < 58) & (s > 0.35) & (v > 0.38)                       # the lit coin surface
        w = np.clip((v - 0.38) / 0.2, 0, 1) * coin                                 # soft edge into the shadows
        h2 = h + w * (48 - h) * 0.85; s2 = s * (1 - 0.18 * w); v2 = np.clip(v * (1 + 0.32 * w), 0, 1)
        out = np.dstack([h2 * 255 / 360, s2 * 255, v2 * 255]).round().astype("uint8")
        rgb = Image.fromarray(out, "HSV").convert("RGB")
        if im.mode == "RGBA": rgb.putalpha(im.getchannel("A"))
        before = np.asarray(im.convert("RGB")).reshape(-1, 3)[coin.reshape(-1)].mean(0).round(); after = np.asarray(rgb.convert("RGB")).reshape(-1, 3)[coin.reshape(-1)].mean(0).round()
        m.baseColorTexture = rgb.convert(im.mode)
        print(sku, f"coin surface {coin.mean() * 100:.0f}% of the map: mean", before, "->", after)
    sc.export(D / "models" / f"{sku}.glb")
