#!/usr/bin/env python3
"""Tool cursors (Harry 2026-10-04: "the mouse pointer itself" must change, in the painted icon style if it reads).
Each cursor is a crisp crosshair whose centre is the hotspot (6, 6) (the drawing tip / the drop point), with the tool's
PAINTED glyph beside it (from the same Codex image route as the menu icons: data/icons/cursor-<name>.png): a house with a
pencil to draw a building, a carpenter's square to draw a room, a crate to place a thing. If a painted glyph is missing,
a clean bold glyph is drawn instead. Writes engine/client/data/cursors/<name>.png (32 px) and <name>@2x.png (64 px).
    python3 engine/tools/make_cursors.py"""
import os
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'client', 'data', 'cursors'); ICONS = os.path.join(HERE, '..', 'client', 'data', 'icons')
INK, EDGE, ACC = (255, 255, 255, 255), (20, 20, 22, 255), (224, 176, 74, 255)
HOT = 6

def crosshair(size):
    k = size / 32; im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    P = lambda *v: [x * k for x in v]
    for a, b in [((HOT, 0.5), (HOT, 3.8)), ((HOT, 8.2), (HOT, 11.5)), ((0.5, HOT), (3.8, HOT)), ((8.2, HOT), (11.5, HOT))]:
        d.line(P(*a, *b), fill=EDGE, width=max(1, round(4.2 * k))); d.line(P(*a, *b), fill=INK, width=max(1, round(1.8 * k)))
    d.ellipse(P(HOT - 1.6, HOT - 1.6, HOT + 1.6, HOT + 1.6), fill=ACC, outline=EDGE, width=max(1, round(1.0 * k)))
    return im

def painted(name, size):
    f = os.path.join(ICONS, f'cursor-{name}.png')
    if not os.path.exists(f): return None
    g = Image.open(f).convert('RGBA'); box = int(size * 22 / 32)
    g = g.resize((box, box), Image.LANCZOS)
    # a soft dark halo so the painted glyph reads on any floor
    a = g.split()[3].filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(size / 64))
    halo = Image.new('RGBA', g.size, (10, 10, 12, 0)); halo.putalpha(a.point(lambda v: min(150, v)))
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0)); o = size - box
    out.alpha_composite(halo, (o, o)); out.alpha_composite(g, (o, o))
    return out

def plain(name, size):  # fallback: the clean bold glyphs
    k = size / 32; im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im); P = lambda *v: [x * k for x in v]; w = max(1, round(1.4 * k))
    if name == 'build': d.polygon(P(14, 20, 22.5, 12.5, 31, 20), fill=ACC, outline=EDGE, width=w); d.rectangle(P(16, 20, 29, 30), fill=ACC, outline=EDGE, width=w)
    elif name == 'room': d.rectangle(P(14, 14, 30, 30), outline=EDGE, width=max(2, round(3 * k))); d.rectangle(P(14, 14, 30, 30), outline=ACC, width=w)
    else: d.polygon(P(22, 13, 30, 17.5, 30, 26.5, 22, 31, 14, 26.5, 14, 17.5), fill=ACC, outline=EDGE, width=w)
    return im

os.makedirs(OUT, exist_ok=True)
for name in ['build', 'room', 'place']:
    for size, suffix in [(32, ''), (64, '@2x')]:
        im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        im.alpha_composite(painted(name, size) or plain(name, size)); im.alpha_composite(crosshair(size))
        im.save(os.path.join(OUT, f'{name}{suffix}.png'))
    print(name, 'painted' if os.path.exists(os.path.join(ICONS, f'cursor-{name}.png')) else 'plain')
