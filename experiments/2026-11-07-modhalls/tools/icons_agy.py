#!/usr/bin/env python3
"""The four corridors' Build-tray icons (room-mod-*-hallway / -corridor), in the house icon style: the modrooms lane's ICON
frame and CITY tail (../2026-11-07-modrooms/flats/gen.py), its anchor (experiments/2026-10-03-build-icons/raw/type-TAV.png),
on the free Gemini route (agy-run's image tool), ONE call for all four, in an empty folder holding only the anchor.
Then the house post-processing (../2026-11-07-modrooms/flats/post.py: chroma-green key, de-spill, trim, 8% pad, 128 px
RGBA) into icons/, and copies to engine/client/data/icons/ of the tree given (default: this worktree) and to USB.
    python3 tools/icons_agy.py [--dest /path/to/repo] [--only name,name]"""
import importlib.util, os, shutil, subprocess, sys, time
from datetime import datetime
from pathlib import Path
B = Path(__file__).resolve().parent.parent; MAIN = Path('<repo>')
GEN = B.parent / '2026-11-07-modrooms' / 'flats' / 'gen.py'
USB = Path('/mnt/usb/turnip-works/lanes-2026-11-07/modhalls/icons')
args = sys.argv[1:]
dest = Path(args[args.index('--dest') + 1]) if '--dest' in args else B.parents[1]
only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
src = GEN.read_text()
ICON = src[src.index('ICON = """') + 10: src.index('"""', src.index('ICON = """') + 10)]
CITY = [l for l in src.splitlines() if l.startswith('CITY = ')][0].split(' = ', 1)[1].strip().strip("'")
ANCHOR = MAIN / 'experiments/2026-10-03-build-icons/raw/type-TAV.png'
SUBJ = {
  'room-mod-apartment-hallway': 'an apartment-building hallway as a small vignette: a short stretch of corridor with a patterned carpet runner down the middle, two numberless wooden apartment doors facing each other, a warm wall sconce and a small red fire extinguisher on the wall',
  'room-mod-office-corridor': 'an office corridor as a small vignette: a short stretch of corridor with grey carpet tiles, a water cooler and a potted plant against one wall, a cork notice board with pinned papers on the other, a plain office door',
  'room-mod-hotel-corridor': 'a hotel corridor as a small vignette: a short stretch of corridor with a rich burgundy patterned carpet, two numberless hotel room doors, a room-service cart with a white tablecloth and a silver cloche outside one of them, a warm wall sconce',
  'room-mod-service-corridor': 'a back-of-house service corridor as a small vignette: a short stretch of bare concrete corridor with thick pipes running along one wall, a grey breaker panel, a yellow mop bucket on wheels and a plain steel door',
}
todo = [k for k in SUBJ if not only or k in only]
d = USB.parent / 'agy' / f'icons-{datetime.now():%H%M%S}'; d.mkdir(parents=True)
shutil.copy(ANCHOR, d / 'anchor.png')
shots = '\n\n'.join(f'### {k}\n' + ICON.format(subject=SUBJ[k] + CITY, name=k).replace('The attached image', 'The image anchor.png in this folder') for k in todo)
prompt = (f'Make {len(todo)} separate images with your image generation tool, one per section below, each from its prompt exactly as '
          'written, each with anchor.png (in this folder) passed to the image tool as the style reference. Do NOT write code, do NOT draw '
          'anything yourself, do NOT open any file but anchor.png. Save each under the file name its section gives, then print the paths.\n\n' + shots)
t0 = time.time()
out = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '1200', '-C', str(d), prompt], capture_output=True, text=True, timeout=3000, stdin=subprocess.DEVNULL).stdout
(B / 'work' / f'agy-{d.name}.txt').write_text(out[-4000:])
got = [k for k in todo if (d / f'{k}.png').exists()]
print(f'{len(got)}/{len(todo)} icons in {time.time() - t0:.0f}s', 'QUOTA' if 'RESOURCE_EXHAUSTED' in out or 'exhausted' in out else '')
if not got: sys.exit(2)
# the house post-processing, run on our raws (post.py reads HERE/raw and writes HERE/icons: point it at this lane's folder)
fl = B / 'flats'; (fl / 'raw').mkdir(parents=True, exist_ok=True); (fl / 'icons').mkdir(exist_ok=True); (fl / 'magenta-icons.json').write_text('[]')
for k in got: shutil.copy(d / f'{k}.png', fl / 'raw' / f'{k}.png')
post = (GEN.parent / 'post.py').read_text().replace("HERE = os.path.dirname(os.path.abspath(__file__))", f"HERE = {str(fl)!r}")
(fl / 'post_icons.py').write_text(post)
print(subprocess.run([sys.executable, str(fl / 'post_icons.py'), ','.join(got)], capture_output=True, text=True).stdout)
USB.mkdir(parents=True, exist_ok=True)
for k in got:
    f = fl / 'icons' / f'{k}.png'
    shutil.copy(f, USB / f.name); shutil.copy(fl / 'raw' / f'{k}.png', USB / f'{k}.raw.png')
    t = dest / 'engine/client/data/icons' / f.name
    if t.is_symlink(): t.unlink()
    shutil.copy(f, t); print('->', t)
