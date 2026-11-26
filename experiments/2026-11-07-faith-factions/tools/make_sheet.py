#!/usr/bin/env python3
"""A four-turn sheet of one mesh for a blind read (mesh_read.py's sheet, with no labels: tools/render_views.py renders
fth/mesh-qa/<id>-y{0,90,180,270}.png first).   python3 tools/make_sheet.py OUTDIR ID [ID ...] -> OUTDIR/sheet--<id>.png"""
import subprocess, sys
from pathlib import Path
from PIL import Image
E = Path(__file__).resolve().parent.parent; B = E / 'fth'; out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
for i in sys.argv[2:]:
    if not (B / 'mesh-qa' / f'{i}-y270.png').exists():
        subprocess.run(['blender', '--background', '--python', str(E / 'tools/render_views.py'), '--', str(B / 'models' / f'{i}.glb'), str(B / 'mesh-qa' / i)], capture_output=True, timeout=600)
    S = Image.new('RGB', (630, 630), (255, 255, 255))
    for k, y in enumerate((0, 90, 180, 270)):
        im = Image.open(B / 'mesh-qa' / f'{i}-y{y}.png').convert('RGBA'); im = im.crop(im.getbbox() or (0, 0, *im.size)); s = 270 / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS); bg = Image.new('RGBA', (300, 300), (150, 150, 155, 255)); bg.alpha_composite(im, ((300 - im.width) // 2, (300 - im.height) // 2))
        S.paste(bg.convert('RGB'), (10 + (k % 2) * 310, 10 + (k // 2) * 310))
    S.save(out / f'sheet--{i}.png'); print(out / f'sheet--{i}.png')
