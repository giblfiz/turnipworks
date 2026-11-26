#!/usr/bin/env python3
"""Blind read of the four corridor icons beside the existing Modern room icons (family resemblance), ONE agy call: random
file names, an empty folder, each icon flattened on mid-grey at 256 px, no room names anywhere. Gemini says per image what
room it shows and how sure, and whether it matches the family (rendering, palette, camera, detail, scale) or stands out.
    python3 tools/icons_read.py [ICON_DIR]        -> /mnt/usb/turnip-works/lanes-2026-11-07/modhalls/icons/read.json"""
import json, random, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
D = Path(sys.argv[1] if len(sys.argv) > 1 else 'engine/client/data/icons')
NEW = ['room-mod-apartment-hallway', 'room-mod-office-corridor', 'room-mod-hotel-corridor', 'room-mod-service-corridor']
OLD = ['room-mod-apartment', 'room-mod-office', 'room-mod-bar', 'room-mod-bathroom', 'room-mod-kitchen', 'room-mod-penthouse', 'room-mod-store', 'room-mod-fire-escape']
d = Path(tempfile.mkdtemp(prefix='agy-mh-icons-')); names = {}
for k in random.sample(NEW + OLD, len(NEW + OLD)):
    n = f'{random.getrandbits(32):08x}.png'; names[n] = k
    im = Image.open(D / f'{k}.png').convert('RGBA').resize((256, 256), Image.LANCZOS); bg = Image.new('RGBA', im.size, (128, 128, 128, 255)); bg.alpha_composite(im); bg.convert('RGB').save(d / n)
P = ("Do NOT create, crop or write any files. Do not run commands or open any other files; only look at the {n} images {files} in this folder. "
     "They are meant to be ONE family of small app icons for a tabletop game's building tool, each showing a kind of room. For EACH image: first list any "
     "text you can read; then say what room or place it shows (a few words) and how sure you are (0-100); then whether it MATCHES the family (same "
     "rendering, palette, camera angle, level of detail and scale as most of the others) or STANDS OUT, and if it stands out, how. "
     'Answer ONLY with a JSON array: [{{"file": "<name>", "text": [], "shows": "...", "confidence": 0, "family": "matches|stands out", "how": "..."}}, ...]')
got = None
for _ in range(2):
    r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '900', '-C', str(d), P.format(n=len(names), files=', '.join(sorted(names)))], capture_output=True, text=True, timeout=7200, stdin=subprocess.DEVNULL)
    m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
    try: got = json.loads(m.group(0)); break
    except Exception: print('(retry)', r.stdout[-300:], flush=True)
shutil.rmtree(d, ignore_errors=True)
res = {names.get(g.get('file'), g.get('file')): g for g in got or []}
out = Path('/mnt/usb/turnip-works/lanes-2026-11-07/modhalls/icons'); out.mkdir(parents=True, exist_ok=True); (out / 'read.json').write_text(json.dumps(res, indent=1))
for k in NEW + OLD:
    v = res.get(k, {}); print(f"{'NEW' if k in NEW else 'old'} {k:30s} {v.get('shows')} ({v.get('confidence')}) | {v.get('family')} {v.get('how') or ''} | text {v.get('text')}")
