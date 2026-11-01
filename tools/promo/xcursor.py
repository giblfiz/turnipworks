#!/usr/bin/env python3
"""The desktop's own pointer images for the footage (tools/promo, 2026-10-22). Headless Chromium draws no mouse pointer,
so the shots draw one where the mouse is: the game's own cursor images where the game sets one (data/cursors/*.png, read
from the CSS), else the system theme's (Adwaita) arrow / hand / grab, read from its Xcursor files into PNGs here.

  python3 tools/promo/xcursor.py OUTDIR     -> OUTDIR/{default,pointer,grab,grabbing,text,crosshair,move}.png + cursors.json (hotspots)
"""
import json, os, struct, sys

THEME = '/usr/share/icons/Adwaita/cursors'
NAMES = {'default': 'left_ptr', 'pointer': 'hand2', 'grab': 'openhand', 'grabbing': 'closedhand', 'text': 'xterm', 'crosshair': 'crosshair', 'move': 'fleur'}

def read(path, want=32):
    b = open(path, 'rb').read()
    assert b[:4] == b'Xcur', path
    _, hsize, _, ntoc = struct.unpack('<4sIII', b[:16])
    imgs = []
    for k in range(ntoc):
        typ, sub, pos = struct.unpack('<III', b[16 + 12 * k: 28 + 12 * k])
        if typ != 0xfffd0002: continue
        _, _, _, _, w, h, xh, yh, _ = struct.unpack('<IIIIIIIII', b[pos:pos + 36])
        imgs.append((abs(sub - want), w, h, xh, yh, b[pos + 36: pos + 36 + 4 * w * h]))
    imgs.sort(key=lambda t: t[0]); _, w, h, xh, yh, px = imgs[0]
    from PIL import Image
    im = Image.frombytes('RGBA', (w, h), px, 'raw', 'BGRA')  # premultiplied ARGB, little-endian
    return im, (xh, yh)

def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True); hot = {}
    for css, x in NAMES.items():
        p = os.path.join(THEME, x)
        if not os.path.exists(p): continue
        im, h = read(os.path.realpath(p)); im.save(os.path.join(out, f'{css}.png')); hot[css] = {'w': im.width, 'h': im.height, 'x': h[0], 'y': h[1]}
    json.dump(hot, open(os.path.join(out, 'cursors.json'), 'w'), indent=1); print(hot)

if __name__ == '__main__': main()
