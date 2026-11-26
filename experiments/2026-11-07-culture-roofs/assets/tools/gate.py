#!/usr/bin/env python3
"""The plate gate (and the mesh-render read): Gemini through agy-run (the subscription), BLIND, in an isolated folder that
holds only the pictures under random names, small on grey (what = plates: 256 px; renders: 200 px), one small group
per call. Gemini names each thing; the match against the spec's `see` line is printed side by side for the supervisor
(a TEXT read: what it names vs what it should read as), and the measured checks run here: an alpha channel with clear
corners, a single body, and for wall panels the alpha box's width:height (a parent wall must be clearly taller than
wide). Results merge into gate-<what>.json.
  python3 tools/gate.py plates|renders [id ...]          ids default: every picture not read yet"""
import json, random, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
E = Path(__file__).resolve().parent.parent
T = {t['id']: t for t in json.loads((E / 'targets.json').read_text())}
what = sys.argv[1]; SRC = {'plates': lambda i: E / 'plates' / f'{i}.png', 'renders': lambda i: E / 'renders' / f'{i}-34.png'}[what]
out_p = E / f'gate-{what}.json'; out = json.loads(out_p.read_text()) if out_p.exists() else {}
ids = sys.argv[2:] or [i for i in T if SRC(i).exists() and i not in out]
PX = 256 if what == 'plates' else 200

def measure(p):
    im = Image.open(p)
    if im.mode != 'RGBA': return {'alpha': False}
    a = im.getchannel('A'); w, h = im.size; corners = [a.getpixel(c) for c in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    bb = a.point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, w, h)
    return {'alpha': True, 'corners_clear': max(corners) < 16, 'wh': round((bb[2] - bb[0]) / max(1, bb[3] - bb[1]), 2), 'fill': round(sum(1 for v in a.getdata() if v > 24) / (w * h), 3)}

def on_grey(p, size):
    im = Image.open(p).convert('RGBA'); bb = im.getbbox() or (0, 0, *im.size); im = im.crop(bb)
    s = size * 0.86 / max(im.size); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    bg = Image.new('RGBA', (size, size), (128, 128, 132, 255)); bg.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2)); return bg.convert('RGB')

def agy(d, prompt):
    for _ in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', d, '-t', '900', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True)
        m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
        try: return json.loads(m.group(0))
        except Exception: print('  (retry)', r.stdout[-300:], r.stderr[-200:], flush=True)
    return []

PRE = 'Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.\n'
for k in range(0, len(ids), 12):
    part = ids[k:k + 12]; d = tempfile.mkdtemp(prefix=f'agy-croof-{what}-'); key = {}
    for i in part:
        n = f'{random.getrandbits(40):010x}.jpg'; key[n] = i; on_grey(SRC(i), PX).save(Path(d) / n, quality=92)
    got = agy(d, f"These {len(key)} small pictures ({', '.join(sorted(key))}) each show ONE prop or building piece from a 3D tabletop game, as seen from across the table.\n{PRE}"
              'For EACH picture: first report any visible labels or text; then say in a few plain words WHAT the object is (as a player would name it), '
              'which culture and period it looks like if any (or "none"), and any defect (cut off, two objects, floating parts, a floor or base under it, blurry). '
              'Answer with ONLY a JSON array: [{"file": "<name>", "text": "...", "object": "...", "culture": "...", "defect": "..."}, ...]')
    for g in got:
        i = key.get(g.get('file'))
        if i: out[i] = {**out.get(i, {}), 'read': {x: g.get(x) for x in ('object', 'culture', 'defect', 'text')}}
    for i in part: out.setdefault(i, {})['measure'] = measure(SRC(i)) if what == 'plates' else {}
    shutil.rmtree(d, ignore_errors=True); out_p.write_text(json.dumps(out, indent=1))
    for i in part:
        v = out[i]; m = v.get('measure', {}); r = v.get('read', {}); wall = T[i]['kind'] == 'wall'
        flag = [] if not m else (['NOALPHA'] if not m.get('alpha') else []) + ([] if m.get('corners_clear', True) else ['CORNERS']) + (['SQUAT'] if wall and m.get('wh', 0) > 0.72 else [])
        print(f"{i:34s} {' '.join(flag) or 'ok':8s} want: {T[i]['see'][:60]:60s} | got: {r.get('object', '?')} [{r.get('culture', '')}] {('DEFECT ' + r['defect']) if r.get('defect') and str(r['defect']).lower() not in ('none', 'no', '') else ''}"
              + (f" wh {m.get('wh')}" if wall else ''), flush=True)
