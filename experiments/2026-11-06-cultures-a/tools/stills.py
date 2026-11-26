#!/usr/bin/env python3
"""Stills for Harry: one room per culture at the table camera (tools/room_shots.py pictures, composed side by side with
a caption strip; nothing drawn on the pictures).   python3 tools/stills.py OUT.png tag:caption [tag:caption ...]
tag = <code>/<shotdir>/<room>-<size>-<seed> (the -table.png beside it is used)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
E = Path(__file__).resolve().parent.parent
out, items = sys.argv[1], [a.split(':', 1) for a in sys.argv[2:]]
ims = [Image.open(E / f'{t}-table.png').convert('RGB') for t, _ in items]
h = 720; ims = [im.resize((round(im.width * h / im.height), h), Image.LANCZOS) for im in ims]
W = sum(im.width for im in ims) + 10 * (len(ims) + 1); S = Image.new('RGB', (W, h + 70), (24, 24, 28)); d = ImageDraw.Draw(S)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 26)
except Exception: font = ImageFont.load_default()
x = 10
for im, (_, cap) in zip(ims, items): S.paste(im, (x, 10)); d.text((x + 8, h + 24), cap, fill=(235, 230, 220), font=font); x += im.width + 10
S.save(out); print(out, S.size)
