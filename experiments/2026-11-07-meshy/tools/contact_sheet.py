#!/usr/bin/env python3
"""Contact sheets from the in-game stills: per subject (rows: alone close, alone back, in its room close, the room at
table distance; columns: current in game / TRELLIS regenerated / Meshy 7.1 / Meshy Smart Topology, the plate at the left)
and one overview (every subject's alone-close row).
  python3 contact_sheet.py RENDERS PLATES OUTDIR
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

R, P, O = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]); O.mkdir(parents=True, exist_ok=True)
SUBJ = ['store-shelving', 'server-rack', 'drinks-cooler', 'pallet-racking', 'fence-chain-link', 'antenna-mast']
VERS = [('cur', 'current in game'), ('tr2', 'default regenerated (TRELLIS)'), ('mx7', 'Meshy 7.1, 20k'), ('mxt', 'Meshy Smart Topology, 10k')]
VIEWS = [('alone-close', 'alone, close'), ('alone-back', 'alone, other side'), ('room-close', 'in its room, close'), ('room-table', 'its room, table distance')]
W, H = 560, 360
try:
    F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
except Exception:
    F = f = ImageFont.load_default()


def cell(p):
    im = Image.open(p).convert('RGB'); im = im.crop((40, 50, im.width - 60, im.height - 50)); im.thumbnail((W, H))
    c = Image.new('RGB', (W, H), (40, 40, 44)); c.paste(im, ((W - im.width) // 2, (H - im.height) // 2)); return c


def plate(s, h):
    im = Image.open(P / f'{s}.png').convert('RGBA'); bg = Image.new('RGBA', im.size, (235, 235, 235, 255)); bg.alpha_composite(im)
    im = bg.convert('RGB'); im.thumbnail((300, h)); c = Image.new('RGB', (320, h), (235, 235, 235)); c.paste(im, (10, (h - im.height) // 2)); return c


for s in SUBJ:
    sheet = Image.new('RGB', (320 + 4 * W, 50 + len(VIEWS) * (H + 30)), (25, 25, 28)); d = ImageDraw.Draw(sheet)
    d.text((10, 12), s, font=F, fill='white')
    for j, (v, lab) in enumerate(VERS): d.text((330 + j * W, 12), lab, font=F, fill='white')
    sheet.paste(plate(s, H), (0, 50)); d.text((10, 50 + H + 4), 'the plate both pipelines got', font=f, fill='white')
    for i, (view, vlab) in enumerate(VIEWS):
        y = 50 + i * (H + 30)
        for j, (v, _) in enumerate(VERS): sheet.paste(cell(R / f'{s}--{v}--{view}.png'), (320 + j * W, y))
        d.text((330, y + H + 4), vlab, font=f, fill=(200, 200, 200))
    sheet.save(O / f'{s}.jpg', quality=86)

ov = Image.new('RGB', (320 + 4 * W, 50 + len(SUBJ) * (H + 10)), (25, 25, 28)); d = ImageDraw.Draw(ov)
for j, (v, lab) in enumerate(VERS): d.text((330 + j * W, 12), lab, font=F, fill='white')
for i, s in enumerate(SUBJ):
    y = 50 + i * (H + 10); ov.paste(plate(s, H), (0, y)); d.text((10, y + 4), s, font=f, fill=(20, 20, 20))
    for j, (v, _) in enumerate(VERS): ov.paste(cell(R / f'{s}--{v}--alone-close.png'), (320 + j * W, y))
ov.save(O / 'overview.jpg', quality=86)
print('sheets in', O)
