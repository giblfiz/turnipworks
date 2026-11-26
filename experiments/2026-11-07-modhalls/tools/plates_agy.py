#!/usr/bin/env python3
"""Plates for the modhalls lane on the Gemini SUBSCRIPTION (agy-run's image tool), never a paid API. Codex's image quota is
gone until Nov 11 and fal is empty, so this replaces the Codex workers (../2026-11-07-modrooms/tools/write_brief.py).
    python3 tools/plates_agy.py [ID ...]      (default: every spec in assets.json without raw/<id>.png)  [--per N]
1. GENERATE: N specs per agy call (shared queue: flock /tmp/agy.lock, stdin closed), in an EMPTY isolated folder on USB
   (nothing to read but the prompt), each prompt verbatim; Gemini paints on flat chroma blue (it has no alpha).
2. MATTE: src/birefnet_matte.py (official MIT BiRefNet, local GPU) with its chroma-blue refinement -> plates/<id>.png RGBA,
   which tools/gate_plates.py then measures and reads blind.
Every call is appended to work/agy-plates.log."""
import json, shutil, subprocess, sys, time
from datetime import datetime
from pathlib import Path
B = Path(__file__).resolve().parent.parent
MAIN = Path('<repo>')
USB = Path('/mnt/usb/turnip-works/lanes-2026-11-07/modhalls')
AGY = '~/fauna-tools/agy-run'
A = {a['id']: a for a in json.loads((B / 'assets.json').read_text())['assets']}
args = sys.argv[1:]; per = 4
if '--per' in args: k = args.index('--per'); per = int(args[k + 1]); del args[k:k + 2]
ids = args or [i for i in A if not (B / 'raw' / f'{i}.jpg').exists()]
(B / 'raw').mkdir(exist_ok=True); (B / 'plates').mkdir(exist_ok=True); (B / 'work').mkdir(exist_ok=True)
SIZE = {'portrait': 'portrait (taller than wide, about 2:3)', 'landscape': 'landscape (wider than tall, about 3:2)', 'square': 'square'}
log = open(B / 'work' / 'agy-plates.log', 'a')
for n in range(0, len(ids), per):
    chunk = ids[n:n + per]; d = USB / 'agy' / f'{datetime.now():%H%M%S}-{n}'; d.mkdir(parents=True)
    shots = '\n\n'.join(f'### Image {k + 1}: save as {i}.png ({SIZE[A[i]["aspect"]]})\n{A[i]["prompt"]}' for k, i in enumerate(chunk))
    prompt = (f'Use your image generation tool to make {len(chunk)} separate images, one for each prompt below. Pass each prompt to the image tool '
              'EXACTLY as written (copy it verbatim). Do NOT write code, do NOT draw anything yourself, do NOT read or open any other file. '
              'Save each result in the current directory under the file name given in its heading, then print the saved paths. Do nothing else.\n\n' + shots)
    t0 = time.time()
    try: out = subprocess.run(['flock', '/tmp/agy.lock', AGY, '-t', '900', '-C', str(d), prompt], capture_output=True, text=True, timeout=2400, stdin=subprocess.DEVNULL).stdout
    except subprocess.TimeoutExpired: out = 'TIMEOUT'
    (B / 'work' / f'agy-{d.name}.txt').write_text(out[-4000:])
    got = []
    for i in chunk:
        f = d / f'{i}.png'
        if not f.exists():
            alt = sorted(d.glob(f'{i}*.png')) or sorted(d.glob(f'{i}*.jpg'))
            f = alt[0] if alt else f
        if f.exists():
            from PIL import Image
            Image.open(f).convert('RGB').save(B / 'raw' / f'{i}.jpg', quality=95); got.append(i)  # (birefnet_matte.py reads *.jpg)
    log.write(f'{datetime.now().isoformat()} {d.name} {len(chunk)} asked, {len(got)} saved in {time.time() - t0:.0f}s: {",".join(got)}\n'); log.flush()
    print(d.name, 'saved', got, 'missing', [i for i in chunk if i not in got], f'{time.time() - t0:.0f}s', flush=True)
# matte everything raw that has no plate yet
todo = [i for i in (args or list(A)) if (B / 'raw' / f'{i}.jpg').exists()]
if todo:
    r = subprocess.run(['python3', str(MAIN / 'src/birefnet_matte.py'), str(B / 'raw'), str(B / 'matted'), '--ids', ','.join(todo), '--overwrite'],
                       capture_output=True, text=True, cwd=str(MAIN))
    print(r.stdout[-1500:], r.stderr[-800:])
    man = json.loads((B / 'matted' / 'matte-manifest.json').read_text()) if (B / 'matted' / 'matte-manifest.json').exists() else {}
    for i in todo:
        m = (B / 'matted' / f'{i}.png')
        if m.exists(): shutil.copy2(m, B / 'plates' / f'{i}.png')
        rec = man.get(i) if isinstance(man, dict) else None
        print(i, 'matte', (rec or {}).get('verdict'), {k: (rec or {}).get(k) for k in ('fg', 'soft', 'comps', 'border', 'chroma_iou')})
