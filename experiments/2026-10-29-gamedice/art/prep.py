#!/usr/bin/env python3
"""The generated face symbols (art/out/*.png, Codex image_gen) -> the die-face decals the game loads
(tools/spawn-tuner/assets/dice/<id>.png): cropped to the symbol's own extent, centred on a square with a 6% margin, 256 px,
alpha kept. Processing only: no pixel is drawn here."""
import sys, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', '..', '..', 'tools', 'spawn-tuner', 'assets', 'dice')
os.makedirs(OUT, exist_ok=True)
for name in sys.argv[1:] or sorted(f[:-4] for f in os.listdir(os.path.join(HERE, 'out')) if f.endswith('.png')):
    im = Image.open(os.path.join(HERE, 'out', name + '.png')).convert('RGBA')
    a = im.split()[3].point(lambda v: 255 if v > 24 else 0); box = a.getbbox(); im = im.crop(box)
    s = int(max(im.size) / 0.88); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2), im)
    sq.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name, box, os.path.getsize(os.path.join(OUT, name + '.png')), 'bytes')
