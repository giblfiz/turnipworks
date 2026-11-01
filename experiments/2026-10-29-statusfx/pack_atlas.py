#!/usr/bin/env python3
"""Pack the generated status pictures (art/, Codex image_gen) into what the game loads. Packaging only: crop to the
picture's own alpha, centre, resize, lay out; the drain ring's white-on-black becomes alpha. Nothing is painted here.
  python3 pack_atlas.py [OUT_DIR]   (default: the main checkout's engine/client/data/icons/status, git-ignored)
"""
import json, math, sys, hashlib
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
ART = HERE / 'art'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('engine/client/data/icons/status')
OUT.mkdir(parents=True, exist_ok=True)
SPRITES = ['charmed', 'stunned', 'frightened-ghost', 'frightened-bang', 'blinded-eye', 'blinded-cloud', 'grappled', 'restrained',
           'poisoned-skull', 'poisoned-bubbles', 'paralyzed', 'zzz', 'exhaust-skull']
CELL, PAD, GRID = 256, 10, 4
def trim(im, thr=24):
    a = im.getchannel('A').point(lambda v: 255 if v > thr else 0)
    return im.crop(a.getbbox())
atlas = Image.new('RGBA', (CELL * GRID, CELL * GRID), (0, 0, 0, 0)); cells = {}
for i, k in enumerate(SPRITES):
    im = trim(Image.open(ART / f'orb-{k}.png').convert('RGBA'))
    s = (CELL - 2 * PAD) / max(im.size); im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
    cx, cy = (i % GRID) * CELL, (i // GRID) * CELL
    atlas.alpha_composite(im, (cx + (CELL - im.size[0]) // 2, cy + (CELL - im.size[1]) // 2))
    W = CELL * GRID  # uv: x right, y UP (three.js flipY)
    cells[k] = [cx / W, 1 - (cy + CELL) / W, CELL / W, CELL / W]
atlas.save(OUT / 'sprites.png', optimize=True)
# decals: runes (as made) | drain (white on black -> alpha), 512 each, side by side
D = 512; dec = Image.new('RGBA', (2 * D, D), (0, 0, 0, 0))
runes = Image.open(ART / 'base-runes.png').convert('RGBA').resize((D, D), Image.LANCZOS)
dec.alpha_composite(runes, (0, 0))
g = Image.open(ART / 'base-drain.png').convert('L').resize((D, D), Image.LANCZOS)
g = g.point(lambda v: 0 if v < 24 else min(255, int((v - 24) * 255 / 200)))
drain = Image.merge('RGBA', (Image.new('L', (D, D), 255),) * 3 + (g,))
dec.alpha_composite(drain, (D, 0))
dec.save(OUT / 'decals.png', optimize=True)
# the drain ring's gaps: alpha round the ring at its middle radius; angle clockwise from 12 o'clock as the shader measures it
px = g.load(); prof = []
rs = [D * f for f in (0.36, 0.40, 0.44)]
for d in range(360):
    a = math.radians(d); s = 0
    for r in rs: s += px[int(D / 2 + r * math.sin(a)), int(D / 2 - r * math.cos(a))]
    prof.append(s)
# the six lowest points, at least 30 degrees apart
order = sorted(range(360), key=lambda d: prof[d]); gaps = []
for d in order:
    if all(min(abs(d - x), 360 - abs(d - x)) >= 30 for x in gaps): gaps.append(d)
    if len(gaps) == 6: break
off = math.degrees(math.atan2(sum(math.sin(math.radians(6 * x)) for x in gaps), sum(math.cos(math.radians(6 * x)) for x in gaps))) / 6
# plate: trimmed, 128 px high
plate = trim(Image.open(ART / 'plate-label.png').convert('RGBA'))
plate = plate.resize((round(plate.size[0] * 128 / plate.size[1]), 128), Image.LANCZOS); plate.save(OUT / 'plate.png', optimize=True)
meta = {'sprites': {'file': 'sprites.png', 'cells': cells}, 'decals': {'file': 'decals.png', 'runes': [0, 0, 0.5, 1], 'drain': [0.5, 0, 0.5, 1], 'drainGapDeg': round(off % 60, 2), 'gaps': sorted(gaps)},
        'plate': {'file': 'plate.png', 'w': plate.size[0], 'h': plate.size[1], 'cap': 0.16},
        'sha256': {f: hashlib.sha256((OUT / f).read_bytes()).hexdigest()[:16] for f in ('sprites.png', 'decals.png', 'plate.png')}}
(OUT / 'status.json').write_text(json.dumps(meta, indent=1))
print(json.dumps({k: meta[k] for k in ('decals', 'plate', 'sha256')}, indent=1))
