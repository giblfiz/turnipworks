#!/usr/bin/env python3
"""Contact sheet for Harry: each accepted mesh's table-distance render (qa/<id>.A.png) beside its plate, labelled.
    python3 tools/contact_sheet.py OUT.jpg ID [ID ...]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
B = Path(__file__).resolve().parent.parent; out, ids = sys.argv[1], sys.argv[2:]
C = 340; cols = 4; rows = (len(ids) + cols - 1) // cols
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
S = Image.new('RGB', (cols * 2 * C, rows * (C + 34)), (236, 234, 228)); d = ImageDraw.Draw(S)
def fit(p):
    im = Image.open(p).convert('RGBA'); im = im.crop(im.getbbox() or (0, 0, *im.size)); im.thumbnail((C - 20, C - 20))
    bg = Image.new('RGBA', (C, C), (200, 200, 204, 255)); bg.alpha_composite(im, ((C - im.width) // 2, (C - im.height) // 2)); return bg.convert('RGB')
for k, i in enumerate(ids):
    x, y = (k % cols) * 2 * C, (k // cols) * (C + 34)
    S.paste(fit(B / 'plates' / f'{i}.png'), (x, y + 34)); S.paste(fit(B / 'qa' / f'{i}.A.png'), (x + C, y + 34))
    d.text((x + 8, y + 6), f'{i}   (plate | mesh)', fill=(30, 30, 30), font=f)
S.save(out, quality=90); print(out, S.size)
