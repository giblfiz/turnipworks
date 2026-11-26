#!/usr/bin/env python3
"""Contact sheet of everything this worker made, for Harry: roofing plates (2 x 2 tiled), section previews, gable pictures,
ornament plates and (when they exist) mesh renders. -> /mnt/usb/turnip-works/lanes-2026-11-07/culture-roofs/assets/contact-sheet.jpg
    python3 tools/contact.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
E = Path(__file__).resolve().parent.parent; OUT = Path('/mnt/usb/turnip-works/lanes-2026-11-07/culture-roofs/assets/contact-sheet.jpg')
C = 220; F = ImageFont.load_default(14) if hasattr(ImageFont, 'load_default') else None
rows = []
def tile2(p):
    im = Image.open(p).convert('RGB').resize((C // 2, C // 2)); o = Image.new('RGB', (C, C))
    for i in (0, 1):
        for j in (0, 1): o.paste(im, (i * C // 2, j * C // 2))
    return o
def fit(p, bg=(128, 128, 132)):
    im = Image.open(p).convert('RGBA'); im.thumbnail((C, C)); o = Image.new('RGB', (C, C), bg); o.paste(im, ((C - im.width) // 2, (C - im.height) // 2), im); return o
rows.append(('roofing plates (2x2)', [(p.stem.replace('roofing-', ''), tile2(p)) for p in sorted((E / 'seamless').glob('*.png'))]))
rows.append(('sections (3x3, 35 deg)', [(p.stem.replace('section-', ''), fit(p)) for p in sorted((E / 'previews').glob('section-*.png'))]))
rows.append(('gable walls', [(p.stem.replace('gable-wall--', ''), fit(p)) for p in sorted((E / 'gables').glob('gable-wall--*.webp')) if '.normal' not in p.name]))
rows.append(('ornament plates', [(p.stem.replace('roof-', ''), fit(p)) for p in sorted((E / 'plates').glob('roof-*.png'))]))
if (E / 'renders').exists(): rows.append(('meshes', [(p.stem.replace('roof-', '').replace('-34', ''), fit(p)) for p in sorted((E / 'renders').glob('*-34.png'))]))
n = max(len(r[1]) for r in rows); W = 160 + n * (C + 8); H = len(rows) * (C + 30) + 10
sheet = Image.new('RGB', (W, H), (40, 42, 46)); d = ImageDraw.Draw(sheet)
for k, (title, cells) in enumerate(rows):
    y = 10 + k * (C + 30); d.text((8, y + C // 2), title, fill=(230, 230, 230), font=F)
    for i, (lab, im) in enumerate(cells):
        x = 160 + i * (C + 8); sheet.paste(im, (x, y)); d.text((x, y + C + 4), lab, fill=(230, 230, 230), font=F)
sheet.save(OUT, quality=88); print(OUT, sheet.size)
