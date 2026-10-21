"""Texture ladder for the GPU dials: prep/tex-src/<sku>.png -> assets/tex/t{N}/<sku>.webp for N in SIZES.
Sources are TRELLIS's 1024 px colour maps; 2048 is an upscale (real GPU memory, no extra detail)."""
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

TOOL = Path(__file__).resolve().parents[1]
SIZES = [64, 128, 256, 512, 1024, 2048]


def one(png):
    im = Image.open(png).convert("RGB")
    out = {}
    for n in SIZES:
        dst = TOOL / "assets/tex" / f"t{n}" / f"{png.stem}.webp"
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.resize((n, n), Image.LANCZOS).save(dst, "WEBP", quality=82, method=4)
        out[n] = dst.stat().st_size
    return png.stem, im.size, out


if __name__ == "__main__":
    pngs = sorted((TOOL / "prep/tex-src").glob("*.png"))
    with ProcessPoolExecutor(6) as ex:
        res = list(ex.map(one, pngs))
    tot = {n: sum(r[2][n] for r in res) for n in SIZES}
    print(len(res), "textures; MB per size:", {n: round(v / 1e6, 1) for n, v in tot.items()})
    (TOOL / "prep/tex-ladder.json").write_text(json.dumps({r[0]: list(r[1]) for r in res}))
