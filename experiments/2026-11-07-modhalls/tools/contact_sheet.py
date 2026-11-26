#!/usr/bin/env python3
"""A contact sheet for Harry: the game's stills (engine/test/browser_modhalls.py --stills) and the accepted plates, labelled.
    python3 tools/contact_sheet.py STILLS_DIR OUT.jpg"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
B = Path(__file__).resolve().parent.parent; S = Path(sys.argv[1]); out = sys.argv[2]
tiles = [(p.stem, Image.open(p).convert('RGB')) for p in sorted(S.glob('*.png'))]
plates = [(p.stem, Image.open(p).convert('RGBA')) for p in sorted((B / 'masked').glob('*.png'))]
W, TW, TH, PW = 1800, 600, 386, 225
rows = (len(tiles) + 2) // 3; prow = (len(plates) + 7) // 8
sheet = Image.new('RGB', (W, rows * (TH + 28) + prow * (PW + 28) + 20), (236, 232, 222)); d = ImageDraw.Draw(sheet)
for i, (n, im) in enumerate(tiles):
    im.thumbnail((TW - 10, TH - 10)); x, y = (i % 3) * TW + 5, (i // 3) * (TH + 28) + 5; sheet.paste(im, (x, y)); d.text((x, y + TH - 4), n, fill=(30, 30, 30))
y0 = rows * (TH + 28) + 10
for i, (n, im) in enumerate(plates):
    bg = Image.new('RGBA', im.size, (200, 200, 200, 255)); bg.alpha_composite(im); bg = bg.convert('RGB'); bg.thumbnail((PW - 10, PW - 10))
    x, y = (i % 8) * PW + 5, y0 + (i // 8) * (PW + 28); sheet.paste(bg, (x, y)); d.text((x, y + PW - 6), n, fill=(30, 30, 30))
sheet.save(out, quality=88); print(out, sheet.size)
