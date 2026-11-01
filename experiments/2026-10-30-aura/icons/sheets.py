#!/usr/bin/env python3
"""Sheets for Gemini (blind3.py's two kinds, never mixed): per set,
  match-<set>.png   our own icons R1..R4 above the ten new ones A..J at 62 and 31 px ("does each belong to the same set?")
  blind-<set>.png   the ten new ones at their real 31 px on the ring's ground, shuffled letters, no names
and the letter keys (checks/*.key.json).   browser-venv/bin/python sheets.py"""
import json, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[2]; A = REPO / 'tools/spawn-tuner/assets/ui-icons'
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
IDS = [p['id'] for p in json.loads((HERE / 'plan.json').read_text())['pictures'] if p['set'] == 'charcoal']
REFS = ['pawn.sheet', 'pawn.damage', 'pawn.cond.concentrating', 'thing.light']
C = HERE / 'checks'; C.mkdir(exist_ok=True)
for s in ('charcoal', 'parchment'):
    cw = 110; sheet = Image.new('RGB', (5 * cw + 40, 3 * 150 + 30), '#1c1f24'); d = ImageDraw.Draw(sheet)
    def cell(im, x, y, lab):
        a, b = im.resize((62, 62), Image.LANCZOS), im.resize((31, 31), Image.LANCZOS)
        sheet.paste(a, (x + 24, y + 26), a); sheet.paste(b, (x + 39, y + 98), b); d.text((x + 40, y + 2), lab, fill='#eee8da', font=F)
    for i, r in enumerate(REFS): cell(Image.open(A / s / f'{r}.webp').convert('RGBA'), 20 + i * cw, 10, f'R{i + 1}')
    L = 'ABCDEFGHIJ'
    for i, id in enumerate(IDS): cell(Image.open(A / s / f'{id}.webp').convert('RGBA'), 20 + (i % 5) * cw, 160 + (i // 5) * 150, L[i])
    sheet.save(C / f'match-{s}.png'); (C / f'match-{s}.key.json').write_text(json.dumps(dict(zip(L, IDS)), indent=1))
    order = IDS[:]; random.Random(f'aura-{s}').shuffle(order)
    sheet = Image.new('RGB', (len(order) * 79 + 12, 67 + 40), '#111316'); d = ImageDraw.Draw(sheet)
    for i, id in enumerate(order):
        x = 12 + i * 79; c = Image.new('RGBA', (67, 67), '#1c1f24'); ic = Image.open(A / s / 'sizes' / '31' / f'{id}.webp').convert('RGBA'); c.alpha_composite(ic, (18, 18))
        sheet.paste(c.convert('RGB'), (x, 8)); d.text((x + 28, 80), L[i], fill='#e8e2d4', font=F)
    sheet.save(C / f'blind-{s}.png'); (C / f'blind-{s}.key.json').write_text(json.dumps(dict(zip(L, order)), indent=1))
print('sheets in', C)
