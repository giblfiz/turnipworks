#!/usr/bin/env python3
"""Before/after contact sheet: one row per culture, BEFORE (left) and AFTER (right), each view.
    python3 contact.py BEFORE_DIR AFTER_DIR OUT.jpg [view]"""
import sys
from PIL import Image, ImageDraw
B, A, OUT = sys.argv[1:4]; view = sys.argv[4] if len(sys.argv) > 4 else '34'
NAMES = {'jpn': 'Japan', 'chn': 'China', 'nrs': 'Norse', 'rus': "Rus'", 'mde': 'Mamluk', 'ind': 'India', 'mes': 'Mexica'}
W, H = 800, 500; sheet = Image.new('RGB', (W * 2 + 30, (H + 30) * len(NAMES) + 40), (28, 28, 30)); d = ImageDraw.Draw(sheet)
d.text((10, 10), f'culture roofs, 2026-11-07   left: before (a7b5c59e)   right: after   view: {view}', fill=(230, 230, 230))
for i, (c, n) in enumerate(NAMES.items()):
    y = 40 + i * (H + 30); d.text((10, y), n, fill=(240, 220, 160))
    for j, src in enumerate((B, A)):
        try: im = Image.open(f'{src}/{c}-{view}.png').convert('RGB').resize((W, H))
        except FileNotFoundError: continue
        sheet.paste(im, (10 + j * (W + 10), y + 15))
sheet.save(OUT, quality=88); print(OUT)
