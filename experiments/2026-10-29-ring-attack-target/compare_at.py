#!/usr/bin/env python3
"""Attack / Target: the landed pictures (round 2, text prompt only) against round 3's (the same prompt plus three of
our own icons as style references). One Gemini call per set: which of each pair belongs to the set."""
import subprocess, sys, tempfile, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[1]; A = REPO / 'tools/spawn-tuner/assets/ui-icons'
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
s = sys.argv[1]
refs = [Image.open(A / s / f'{r}.webp').convert('RGBA') for r in ('pawn.sheet', 'pawn.damage', 'pawn.give', 'thing.lock')]
new = [Image.open(A / s / 'pawn.attack.webp'), Image.open(HERE / f'sources/{s}--pawn.attack.r3.png'), Image.open(A / s / 'pawn.target.webp'), Image.open(HERE / f'sources/{s}--pawn.target.r3.png')]
cw = 110; sheet = Image.new('RGB', (4 * cw + 40, 2 * 150 + 30), '#1c1f24'); d = ImageDraw.Draw(sheet)
def cell(im, x, y, lab):
    im = im.convert('RGBA'); a, b = im.resize((62, 62), Image.LANCZOS), im.resize((31, 31), Image.LANCZOS)
    sheet.paste(a, (x + 24, y + 26), a); sheet.paste(b, (x + 39, y + 98), b); d.text((x + 40, y + 2), lab, fill='#eee8da', font=F)
for i, im in enumerate(refs): cell(im, 20 + i * cw, 10, f'R{i + 1}')
for i, im in enumerate(new): cell(im, 20 + i * cw, 160, 'ABCD'[i])
name = f'compare-at-{s}'; t = Path(tempfile.mkdtemp()); sheet.save(t / 'sheet.png'); sheet.save(HERE / 'checks' / f'{name}.png')
prompt = (f"Look at the image file {t}/sheet.png. Do NOT create, crop or write any files.\n\nRound painted UI icons for the ring menu of a fantasy 3D "
          "tabletop game, each at 62 px and 31 px. First read every label (R1-R4 top row, A-D bottom row) and name what each icon depicts. R1-R4 "
          "are existing members of ONE painted set. A and B are two versions of the same new button (Attack); C and D are two versions of another "
          "(Target: mark a pawn as the one being aimed at). For each pair, which version belongs better to the R1-R4 set, as if by the same artist "
          "(ground, rim, disc size, brushwork, palette, lighting), and which reads better at 31 px? Answer per pair with the winner and the reason; "
          "say if both fit. End with two lines exactly: `ATTACK: A|B` and `TARGET: C|D`.")
r = subprocess.run(['flock', '/tmp/agy.lock', 'timeout', '1500', str(HERE / 'agy-run-bounded'), '-m', 'gemini-4-argon-high', '-C', str(t), '-t', '600', '-o', str(t / 'out.txt'), prompt], capture_output=True, text=True, stdin=subprocess.DEVNULL)
out = (t / 'out.txt').read_text() if (t / 'out.txt').exists() else r.stdout
(HERE / 'checks' / f'{name}.txt').write_text(prompt + '\n\n=====\n' + out); shutil.rmtree(t, ignore_errors=True); print(out)
