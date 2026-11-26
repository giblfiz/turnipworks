#!/usr/bin/env python3
"""masked/*.png -> masked/ again at 640 px on the long side (RGBA, optimised). The 2026-11-06 pod's link ran at ~50 kB/s,
so the 2 MB plates took a minute each to upload; TRELLIS.2 (pipeline 512) resizes its input to 518 px anyway.
The full plates stay in plates/.   python3 tools/shrink.py [PX]"""
import sys
from pathlib import Path
from PIL import Image
E = Path(__file__).resolve().parent.parent; px = int(sys.argv[1]) if len(sys.argv) > 1 else 640; tot = 0
for p in sorted((E / 'masked').glob('*.png')):
    im = Image.open(p).convert('RGBA'); bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb:  # crop to the object with a 6% margin, so the pixels go to it
        m = int(0.06 * max(bb[2] - bb[0], bb[3] - bb[1])); bb = (max(0, bb[0] - m), max(0, bb[1] - m), min(im.width, bb[2] + m), min(im.height, bb[3] + m)); im = im.crop(bb)
    s = px / max(im.size)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(p, optimize=True); tot += p.stat().st_size
print(f'{len(list((E / "masked").glob("*.png")))} plates, {tot / 1e6:.1f} MB')
