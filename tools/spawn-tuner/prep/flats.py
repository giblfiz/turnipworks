"""Flat (2D) assets for the Spawn Tuner: chroma-key the blue plate background, crop to the object, save WEBP.

Run from tools/spawn-tuner:  python3 prep/flats.py   (reads prep/flats.json written by build_data.py)
Writes assets/flat/<sku>.webp and prep/flats-out.json ({sku: {w, h}} aspect info for the planes).
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

TOOL = Path(__file__).resolve().parents[1]
MAX = 512


def key_blue(im, enclosed=False):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = (b > r + 35) & (b > g + 15)  # house plates use a chroma-blue background
    # only blue connected to the image border is background (bluish-grey stone inside the object stays)
    lab, _ = ndimage.label(blue)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    if not enclosed: blue = np.isin(lab, list(edge))  # (enclosed=True: line work, the wizard's ritual circle: blue between the lines is background too)
    alpha = np.where(blue, 0, 255).astype(np.uint8)
    rgba = np.dstack([a.astype(np.uint8), alpha])
    return Image.fromarray(rgba), ~blue


def soften_decal(rgba, mask, feather=0.1, blob=False):
    """Scatter decals: remove chroma-blue spill on the edge band (no purple fringe once alpha-blended) and fade alpha to 0
    toward the image border, so painting that ran off the plate doesn't end in a straight cut."""
    a = np.asarray(rgba).astype(float)
    h, w = mask.shape
    dist = ndimage.distance_transform_edt(mask)  # px from background, inside the object
    band = (dist > 0) & (dist < 6)
    rgb = a[..., :3]
    lim = (rgb[..., 0] + rgb[..., 1]) / 2
    rgb[..., 2] = np.where(band, np.minimum(rgb[..., 2], lim), rgb[..., 2])
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]) / (feather * min(h, w))
    ramp = np.clip(edge, 0, 1) * np.clip(dist / 6, 0, 1)
    if blob:  # mud patches fill their plate: give them an irregular, noise-wobbled oval falloff instead of a square
        rng = np.random.default_rng(abs(hash(a.tobytes()[:64])) % 2**32)
        noise = ndimage.gaussian_filter(rng.normal(0, 1, (h, w)), min(h, w) / 14)
        noise /= np.abs(noise).max() + 1e-6
        ell = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2 + 0.35 * noise
        ramp = ramp * np.clip((1 - ell) / 0.45, 0, 1)
    a[..., 3] = a[..., 3] * ramp
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main():
    out, info = TOOL / "assets/flat", {}
    out.mkdir(parents=True, exist_ok=True)
    for job in json.loads((TOOL / "prep/flats.json").read_text()):
        im = Image.open(job["plate"])
        if job.get("opaque"):  # seamless floor swatches: no keying, no crop
            im.convert("RGB").resize((MAX, MAX), Image.LANCZOS).save(out / f"{job['sku']}.webp", "WEBP", quality=85)
            info[job["sku"]] = {"w": MAX, "h": MAX, "keyed": 0.0}
            continue
        medallion = job["sku"].startswith(("decal-ritual-circle", "decal-star-floor"))  # wizard's tower: they fill the plate, edge to edge
        if job.get("native_alpha"):
            rgba = im.convert("RGBA")
            mask = np.asarray(rgba)[..., 3] > 0
            if not mask.any():
                raise ValueError(f"Empty alpha: {job['sku']}")
        else:
            rgba, mask = key_blue(im, enclosed=job["sku"].startswith("decal-ritual-circle"))
        if job["sku"].startswith(("rug-hay-scatter", "decal-")):  # floor scatter decals are drawn soft-blended
            rgba = soften_decal(rgba, mask, blob=job["sku"].startswith("decal-dirt"), **({"feather": 0.001} if medallion else {}))
        ys, xs = np.nonzero(mask)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        crop = rgba.crop(box)
        if job["sku"].startswith("floor-tile"):
            crop = crop.convert("RGB")  # floor tiles are laid opaque, edge to edge
        crop.thumbnail((MAX, MAX))
        crop.save(out / f"{job['sku']}.webp", "WEBP", quality=82)
        info[job["sku"]] = {"w": crop.width, "h": crop.height, "keyed": round(float(1 - mask.mean()), 3)}
        print(job["sku"], info[job["sku"]])
    (TOOL / "prep/flats-out.json").write_text(json.dumps(info, indent=1))


if __name__ == "__main__":
    main()
