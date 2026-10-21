"""Compose orient_views.py tiles into contact sheets: one row per object, tiles A-D, a big row number.

Run: python3 prep/orient_sheets.py VIEWDIR SHEETDIR PER_SHEET sku1 sku2 ...
Writes SHEETDIR/sheet-NNN.png and SHEETDIR/sheet-NNN.json (row number -> sku). The sheet never shows a sku name:
the vision model describes blind, and the comparison against the expected object happens afterwards.
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

T, PAD, LW = 320, 6, 70


def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",):
        try:
            return ImageFont.truetype(p, sz)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    vd, sd, per = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
    skus = sys.argv[4:]
    sd.mkdir(parents=True, exist_ok=True)
    big, small = font(44), font(26)
    for n in range(0, len(skus), per):
        chunk = skus[n:n + per]
        W = LW + 4 * (T + PAD)
        H = len(chunk) * (T + PAD)
        im = Image.new("RGB", (W, H), (25, 25, 28))
        dr = ImageDraw.Draw(im)
        for r, sku in enumerate(chunk):
            y = r * (T + PAD)
            dr.text((12, y + T // 2 - 26), str(r + 1), fill=(255, 220, 90), font=big)
            for c, k in enumerate("ABCD"):
                x = LW + c * (T + PAD)
                im.paste(Image.open(vd / f"{sku}__{k}.png").convert("RGB"), (x, y))
                dr.rectangle([x + 4, y + 4, x + 40, y + 38], fill=(0, 0, 0))
                dr.text((x + 11, y + 6), k, fill=(255, 255, 255), font=small)
        idx = n // per
        im.save(sd / f"sheet-{idx:03d}.png")
        (sd / f"sheet-{idx:03d}.json").write_text(json.dumps({str(i + 1): s for i, s in enumerate(chunk)}))


main()
