#!/usr/bin/env python3
"""Gemini's two reads of a set of pictures of the 24 targets (plates, or mesh renders), each through agy-run (the
subscription) in an isolated folder that holds only the images, "Do NOT create, crop or write any files":
  state  BLIND: random names, each picture small on grey (160 px: the size a thing is at table distance), OPEN or SHUT?
  match  each picture beside its partner's render: the same design? which state is each?
  python3 tools/gate.py plates|renders [id ...]   -> gate-<what>.json (merged into what is there)
A picture passes when the blind read gives the wanted state and the match read says same design and the new one is
in the wanted state."""
import json, random, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
E = Path(__file__).resolve().parent.parent
T = {t['id']: t for t in json.loads((E / 'targets.json').read_text())}
what = sys.argv[1]; ids = sys.argv[2:] or list(T)
SRC = {'plates': lambda i: E / 'plates' / f'{i}.png', 'renders': lambda i: E / 'mesh-qa' / f'{i}-34.png'}[what]
ids = [i for i in ids if SRC(i).exists()]
out_p = E / f'gate-{what}.json'; out = json.loads(out_p.read_text()) if out_p.exists() else {}

def on_grey(p, size):
    im = Image.open(p).convert('RGBA'); bb = im.getbbox() or (0, 0, *im.size); im = im.crop(bb)
    s = size * 0.86 / max(im.size); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    bg = Image.new('RGBA', (size, size), (128, 128, 132, 255)); bg.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2)); return bg.convert('RGB')

def agy(d, prompt):
    for attempt in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', d, '-t', '900', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True)  # (no timeout here: the wait for the shared lock can be long; agy-run -t bounds the call)
        m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
        try: return json.loads(m.group(0))
        except Exception: print('  (retry)', r.stdout[-300:], r.stderr[-200:], flush=True)
    return []

PRE = "Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.\n"
# ---- blind state ---- (SKIP_STATE=1: keep the blind reads already in the file)
import os
key = {}; d = tempfile.mkdtemp(prefix='agy-openmesh-state-')
for i in ids:
    n = f'{random.getrandbits(40):010x}.jpg'; key[n] = i; on_grey(SRC(i), 160).save(Path(d) / n, quality=92)
names = sorted(key) if not os.environ.get('SKIP_STATE') else []
for k in range(0, len(names), 24):
    part = names[k:k + 24]; dd = tempfile.mkdtemp(prefix='agy-openmesh-s-')
    for n in part: shutil.copy(Path(d) / n, dd)
    got = agy(dd, f"These {len(part)} small pictures ({', '.join(part)}) each show one prop from a 3D tabletop game (furniture, a container, a door in its frame, a wall section with a window, a floor hatch, a cage), small, as seen from across the table.\n{PRE}"
              "For EACH picture: first say in a few words what you see (and any visible labels or text), then decide whether it is OPEN or SHUT (a door/gate/hatch/grate swung or lifted open, a lid raised, cupboard doors open, shutters or casements open, an empty see-through window opening: OPEN; otherwise SHUT). If unsure, still pick the likelier one with low confidence.\n"
              'Answer with ONLY a JSON array: [{"file": "<name>", "see": "...", "state": "OPEN" or "SHUT", "confidence": <0-100>}, ...]')
    for g in got:
        i = key.get(g.get('file'))
        if i: out.setdefault(i, {})['blind'] = {'see': g.get('see'), 'state': str(g.get('state')).upper(), 'conf': g.get('confidence'), 'ok': str(g.get('state')).upper() == T[i]['want'].upper()}
    shutil.rmtree(dd, ignore_errors=True)
shutil.rmtree(d, ignore_errors=True)
out_p.write_text(json.dumps(out, indent=1))
# ---- match ----
for k in range(0, len(ids), 25):
    part = ids[k:k + 25]; dd = tempfile.mkdtemp(prefix="agy-openmesh-m-"); names = {}
    for j, i in enumerate(part):
        a = on_grey(E / 'refs' / f"{T[i]['partner']}-34.png", 384); b = on_grey(SRC(i), 384)
        im = Image.new('RGB', (776, 384), (255, 255, 255)); im.paste(a, (0, 0)); im.paste(b, (392, 0)); n = f'pair-{j + 1}.jpg'; im.save(Path(dd) / n, quality=92); names[n] = i
    got = agy(dd, f"Each of these {len(part)} pictures ({', '.join(names)}) shows two props from a 3D game side by side: LEFT is an existing prop, RIGHT is a new model meant to be the very same prop in its other state (opened, or shut).\n{PRE}"
              "For EACH picture: first report any visible labels or text; then say whether RIGHT is plainly the SAME design as LEFT (same kind of object, same materials and colours, same ornament, similar proportions; only open/shut may differ): SAME or DIFFERENT, and what differs besides the state; then whether RIGHT faces the SAME way as LEFT (its front, the side with its door, lid opening, lock, face or window, toward the same side of the picture) or not; then the state of LEFT and of RIGHT, each OPEN or SHUT.\n"
              'Answer with ONLY a JSON array: [{"file": "<name>", "same": "SAME" or "DIFFERENT", "differs": "...", "facing": "SAME" or "TURNED", "left": "OPEN" or "SHUT", "right": "OPEN" or "SHUT"}, ...]')
    for g in got:
        i = names.get(g.get('file'))
        if i: out.setdefault(i, {})['match'] = {**{x: g.get(x) for x in ('same', 'differs', 'facing', 'left', 'right')}, 'ok': str(g.get('same')).upper() == 'SAME' and str(g.get('right')).upper() == T[i]['want'].upper()}
    shutil.rmtree(dd, ignore_errors=True)
    out_p.write_text(json.dumps(out, indent=1))
for i in ids:
    v = out.get(i, {}); v['pass'] = bool(v.get('blind', {}).get('ok') and v.get('match', {}).get('ok'))
out_p.write_text(json.dumps(out, indent=1))
for i in ids:
    v = out[i]; print(f"{'PASS' if v['pass'] else 'FAIL'} {i}: blind {v.get('blind', {}).get('state')} ({v.get('blind', {}).get('see')}); match {v.get('match', {}).get('same')} right {v.get('match', {}).get('right')} ({(v.get('match', {}).get('differs') or '')[:90]})")
