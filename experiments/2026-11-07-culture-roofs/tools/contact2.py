#!/usr/bin/env python3
"""Before/after contact sheet with several views side by side: one row per culture; for each view, BEFORE then AFTER.
    python3 contact2.py BEFORE_DIR AFTER_DIR OUT.jpg [views, default 34,low] [after-label]"""
import sys
from PIL import Image, ImageDraw, ImageFont
B, A, OUT = sys.argv[1:4]
views = (sys.argv[4] if len(sys.argv) > 4 else '34,low').split(',')
alab = sys.argv[5] if len(sys.argv) > 5 else 'after'
NAMES = {'jpn': 'Japan', 'chn': 'China', 'nrs': 'Norse', 'rus': "Rus'", 'mde': 'Mamluk Cairo', 'ind': 'India (Rajput)', 'mes': 'Mexica'}
W, H, G, TOP, LAB = 640, 400, 8, 56, 26
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18); big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except OSError: font = big = ImageFont.load_default()
cols = [(v, side) for v in views for side in ('before', alab)]
sheet = Image.new('RGB', (G + len(cols) * (W + G), TOP + len(NAMES) * (H + LAB + G)), (28, 28, 30)); d = ImageDraw.Draw(sheet)
d.text((G, 8), 'Turnip Works culture roofs, 2026-11-07: same buildings and cameras, no UI', fill=(235, 235, 235), font=big)
for j, (v, side) in enumerate(cols):
    d.text((G + j * (W + G), 34), f'{side} · view {v}', fill=(200, 200, 200), font=font)
for i, (c, n) in enumerate(NAMES.items()):
    y = TOP + i * (H + LAB + G); d.text((G, y + 2), n, fill=(240, 220, 160), font=big)
    for j, (v, side) in enumerate(cols):
        src = B if side == 'before' else A
        try: im = Image.open(f'{src}/{c}-{v}.png').convert('RGB').resize((W, H), Image.LANCZOS)
        except FileNotFoundError: continue
        sheet.paste(im, (G + j * (W + G), y + LAB))
sheet.save(OUT, quality=86); print(OUT, sheet.size)
