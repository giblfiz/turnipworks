#!/usr/bin/env python3
"""Flats DERIVED from our own accepted plates, with no image model (the Codex image allowance ran out on 2026-10-11 and
the rule is not to switch model). Provenance: each output is a recolouring of one of our own house-style plates.
  decal-scorch--d1       from experiments/2026-10-01-floors2/inputs/decal-dirt-patch--s1.jpg: the patch's brushwork kept (smoothed),
                         its colour replaced by soot (near-black in the middle, grey ash toward the rim), cut to a
                         ragged rayed burst on the plates' chroma blue for prep/flats.py to key
  giant-web-floor--d1    our own decal-cobweb plate (experiments/2026-09-30-inn-01-500/inputs/decal-cobweb.jpg), unchanged: the
                         same painted web, registered under a FLOOR role so it can be laid flat and large (a wall-hung
                         role may not lie on the floor: test/wall_items.test.mjs)
    python3 tools/derive_flats.py
"""
import pathlib, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = pathlib.Path(__file__).resolve().parents[1]; MAIN = pathlib.Path("<repo>")
out = HERE / "flats/decals"; out.mkdir(parents=True, exist_ok=True)
for i, src in enumerate(("s1",), 1):  # (s2 and s3 carry footprints and pebbles: they read as mud with tracks and as rubble)
    im = Image.open(MAIN / f"experiments/2026-10-01-floors2/inputs/decal-dirt-patch--{src}.jpg").convert("RGB")
    a = np.asarray(im).astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = (b > r + 35) & (b > g + 15)                       # the plate background (prep/flats.py key_blue)
    lab, _ = ndimage.label(blue); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge)); obj = ~bg
    lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255.0
    lo, hi = np.percentile(lum[obj], [5, 95]); t = np.clip((lum - lo) / max(1e-3, hi - lo), 0, 1)   # the patch's own light and dark,
    # (not smoothed: a blind read took the smoothed patch for a pit or a pool; with its brushwork it read as scorched earth and ash)
    dist = ndimage.distance_transform_edt(obj); rim = np.clip(dist / (0.22 * max(1.0, dist.max())), 0, 1)  # 0 at the rim, 1 inside
    v = (0.05 + 0.20 * t) * (0.55 + 0.45 * (1 - rim)) + 0.10 * (1 - rim)                              # soot: dark inside, ash-grey rim
    soot = np.stack([v * 255 * 1.04, v * 255 * 0.98, v * 255 * 0.92], -1)
    # a ragged burst, not the patch's own outline (two of the three patches fill their plate): an oval with a noisy, rayed edge;
    # everything outside it is painted the plate's chroma blue, which prep/flats.py keys out and feathers
    h, w = obj.shape; yy, xx = np.mgrid[0:h, 0:w]; rng = np.random.default_rng(1000 + i)
    noise = ndimage.gaussian_filter(rng.normal(0, 1, (h, w)), min(h, w) / 22); noise /= np.abs(noise).max() + 1e-6
    ang = np.arctan2(yy - h / 2, xx - w / 2); rays = 0.10 * np.sin(ang * (7 + 2 * i) + rng.uniform(0, 6.28)) + 0.06 * np.sin(ang * (13 + i) + rng.uniform(0, 6.28))
    ell = np.sqrt(((xx - w / 2) / (w * 0.44)) ** 2 + ((yy - h / 2) / (h * 0.44)) ** 2) + 0.28 * noise + rays
    burst = (ell < 0.86) & obj; rim = np.clip((0.86 - ell) / 0.5, 0, 1)
    v = (0.045 + 0.16 * t) * (0.5 + 0.5 * rim) + 0.13 * (1 - rim)
    soot = np.stack([v * 255 * 1.04, v * 255 * 0.98, v * 255 * 0.92], -1)
    blue_bg = np.zeros_like(a); blue_bg[..., 0] = 24; blue_bg[..., 1] = 64; blue_bg[..., 2] = 236
    res = np.where(burst[..., None], soot, blue_bg); obj = burst
    Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(out / f"decal-scorch--d{i}.jpg", quality=95)
    print(f"decal-scorch--d{i}.jpg  from decal-dirt-patch--{src}  {im.size}  patch {obj.mean() * 100:.0f}% of the plate")
shutil.copyfile(MAIN / "experiments/2026-09-30-inn-01-500/inputs/decal-cobweb.jpg", out / "giant-web-floor--d1.jpg"); print("giant-web-floor--d1.jpg  = decal-cobweb.jpg")
