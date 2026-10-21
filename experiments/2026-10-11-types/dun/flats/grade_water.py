#!/usr/bin/env python3
"""Colour grade of the water flats (2026-10-12): from the table camera the flooded floor (hue 105, value 0.22) read as a
mossy floor and the sewer's water (hue 55) as a dirt path. Same paintings, hue moved to water: the flooded floor to a
teal blue (hue 196) and lifted; the sewer's water band (only pixels that were olive) to a murky green-teal (hue 158).
Originals are kept in ungraded/. Idempotent: always grades from ungraded/.
"""
import numpy as np, shutil
from pathlib import Path
from PIL import Image
import matplotlib.colors as mc
H = Path(__file__).resolve().parent; (H / "ungraded").mkdir(exist_ok=True)
def grade(rel, hue, sat, gain, gamma, mask=None, q=None):
    src = H / "ungraded" / Path(rel).name
    if not src.exists(): shutil.copy2(H / rel, src)
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(float) / 255; hsv = mc.rgb_to_hsv(rgb)
    m = np.ones(hsv.shape[:2], bool) if mask is None else mask(hsv)
    out = hsv.copy(); out[..., 0] = np.where(m, hue / 360, hsv[..., 0]); out[..., 1] = np.where(m, np.clip(hsv[..., 1] * sat[0] + sat[1], 0, 1), hsv[..., 1])
    out[..., 2] = np.where(m, np.clip((hsv[..., 2] ** gamma) * gain, 0, 1), hsv[..., 2])
    im = Image.fromarray((mc.hsv_to_rgb(out) * 255).round().astype("uint8")); im.save(H / rel, **({"quality": q} if q else {}))
    print(rel, "mean before", (rgb.mean((0, 1)) * 255).round(), "after", np.asarray(im).mean((0, 1)).round(), "graded px", round(float(m.mean()), 2))
for f in ("seamless/floor-water-flooded.png", "seamless/floor-water-flooded--v2.png"): grade(f, 196, (0.9, 0.22), 1.75, 0.8)
grade("decals/sewer-channel-strip--s1.jpg", 158, (0.8, 0.12), 1.35, 0.9, mask=lambda h: (h[..., 0] > 46 / 360) & (h[..., 0] < 75 / 360) & (h[..., 1] > 0.3), q=92)
