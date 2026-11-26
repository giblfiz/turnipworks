#!/usr/bin/env python3
"""Contact sheets for Harry: every figure of the pack, its gallery thumbnail (or a game crop) with its name under it,
grouped runners / modern / robots. Writes to the lane's USB folder.
    python3 contact.py [thumbs|lean|table]      (default thumbs: set/published/thumbs; lean/table: shots/<id>-<mode>.png)"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent; USB = Path('/mnt/usb/turnip-works/lanes-2026-11-07/cyberpunk-pawns')
mode = sys.argv[1] if len(sys.argv) > 1 else 'thumbs'
man = json.loads((HERE / 'set/published/manifest.json').read_text())['figures']
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17); big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except Exception: font = big = ImageFont.load_default()
S, COLS, LBL = 300, 8, 44
for grp, title in (('runner', 'Runners'), ('modern', 'Modern NPCs'), ('robot', 'Robots')):
    F = sorted([f for f in man if f['group'] == grp], key=lambda f: (f.get('cls') or '', f.get('race') or '', f['id']))
    if not F: continue
    rows = (len(F) + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS * S, 60 + rows * (S + LBL)), (30, 28, 26)); d = ImageDraw.Draw(sheet)
    d.text((16, 14), f'Turnip Works, cyberpunk pack: {title} ({len(F)}), {mode}', fill=(240, 232, 210), font=big)
    for k, f in enumerate(F):
        p = HERE / 'set/published' / f['thumb'] if mode == 'thumbs' and f.get('thumb') else HERE / 'shots' / f"{f['id']}-{mode}.png"
        x, y = (k % COLS) * S, 60 + (k // COLS) * (S + LBL)
        if p.exists():
            im = Image.open(p).convert('RGB'); im.thumbnail((S - 8, S - 8)); sheet.paste(im, (x + (S - im.width) // 2, y + (S - im.height) // 2))
        d.text((x + 8, y + S + 4), f['name'][:30], fill=(240, 232, 210), font=font)
        d.text((x + 8, y + S + 23), f"{f['height_ft']} ft · base {f['base_ft']} ft", fill=(170, 160, 140), font=font)
    out = USB / f'contact-{grp}-{mode}.jpg'; sheet.save(out, quality=88); print(out)
