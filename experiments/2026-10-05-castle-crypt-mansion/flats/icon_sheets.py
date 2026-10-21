#!/usr/bin/env python3
"""Check sheets for the icons -> raw/checks/: icons-reference.png (existing room icons of the set, from
engine/client/data/icons) and <name>-view.png for each icons/room-*.png (large + at 56 px, on the tray's dark
and on a light ground)."""
import glob, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); SET = os.path.join(HERE, '..', '..', '..', 'engine', 'client', 'data', 'icons'); OUT = os.path.join(HERE, 'raw', 'checks')
BG = [(42, 44, 50), (226, 222, 212)]
ref = ['room-common', 'room-kitchen', 'room-storeroom', 'room-cellar', 'room-guest', 'room-desk', 'room-stable', 'room-yard', 'type-CRY', 'type-DUN', 'type-TEM', 'type-CAS']
s = Image.new('RGB', (6 * 280, 2 * 280), BG[0])
for i, n in enumerate(ref):
    im = Image.open(os.path.join(SET, n + '.png')).convert('RGBA').resize((256, 256), Image.LANCZOS); s.paste(im, (i % 6 * 280 + 12, i // 6 * 280 + 12), im)
s.save(os.path.join(OUT, 'icons-reference.png'))
for f in sorted(glob.glob(os.path.join(HERE, 'icons', 'room-*.png'))):
    im = Image.open(f).convert('RGBA'); s = Image.new('RGB', (2 * 420, 300))
    for k, bg in enumerate(BG):
        s.paste(Image.new('RGB', (420, 300), bg), (k * 420, 0)); big = im.resize((256, 256), Image.LANCZOS); sm = im.resize((56, 56), Image.LANCZOS)
        s.paste(big, (k * 420 + 20, 22), big); s.paste(sm, (k * 420 + 320, 122), sm)
    s.save(os.path.join(OUT, os.path.basename(f)[:-4] + '-view.png'))
