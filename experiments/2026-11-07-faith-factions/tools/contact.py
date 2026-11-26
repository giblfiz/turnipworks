#!/usr/bin/env python3
"""A labelled contact sheet for Harry: tools/contact.py OUT.jpg TITLE COLS PATH [PATH ...] (each tile captioned with its
file stem; transparent pictures on warm grey)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
out, title, cols, paths = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3]), [Path(p) for p in sys.argv[4:]]
T, CAP, PAD = 340, 34, 10
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15); big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 24)
except Exception: font = big = ImageFont.load_default()
rows = (len(paths) + cols - 1) // cols
S = Image.new('RGB', (cols * (T + PAD) + PAD, 50 + rows * (T + CAP + PAD) + PAD), (236, 232, 224)); d = ImageDraw.Draw(S); d.text((PAD, 12), title, fill=(40, 40, 40), font=big)
for k, p in enumerate(paths):
    im = Image.open(p).convert('RGBA'); im.thumbnail((T, T)); bg = Image.new('RGBA', (T, T), (128, 128, 132, 255)); bg.alpha_composite(im, ((T - im.width) // 2, (T - im.height) // 2))
    x, y = PAD + (k % cols) * (T + PAD), 50 + (k // cols) * (T + CAP + PAD); S.paste(bg.convert('RGB'), (x, y)); d.text((x + 2, y + T + 6), p.stem[:44], fill=(30, 30, 30), font=font)
out.parent.mkdir(parents=True, exist_ok=True); S.save(out, quality=88); print(out, S.size)
