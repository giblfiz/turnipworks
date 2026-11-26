#!/usr/bin/env python3
"""Plates: Codex's built-in image tool (`codex exec`, the ChatGPT plan: no API spend) paints each figure's plate from
set/assets.json with the set's body plate attached; BiRefNet mattes it on the local GPU. NO per-plate gate here: the
gate is gate.py, batched (the shared agy lock is the bottleneck), which marks plates accepted or gives corrections.
    python3 plates.py [--ids=a,b] [--workers=4] [--redo]
A plate the gate refused is painted again with the gate's problems as corrections (set/gate.json[id].extra).
Writes WORK/<id>.tryN.{jpg,png,comp.jpg}, set/plates.json (every try), prompts/<id>.tryN.md."""
import concurrent.futures, json, os, shutil, subprocess, sys, tempfile, threading, time
from pathlib import Path
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
sys.path.insert(0, str(ROOT / 'src'))
import plate_gate_batch as pgb   # its matte (birefnet) and composite only

LOCK, GPU = threading.Lock(), threading.Lock()
STATE = SET / 'plates.json'


def load():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def codex_plate(a, attempt, extra):
    (HERE / 'prompts').mkdir(exist_ok=True); WORK.mkdir(parents=True, exist_ok=True)
    prompt = a['prompt'] + (f"\n\nCorrections from a rejected previous attempt (fix these): {extra}" if extra else '')
    (HERE / 'prompts' / f"{a['id']}.try{attempt}.md").write_text(prompt)
    out = WORK / f"{a['id']}.try{attempt}.jpg"
    wd = tempfile.mkdtemp(prefix=f"cp-{a['id']}-")
    full = ("Use your built-in image generation tool. The attached image is the body reference described below.\n\n" + prompt +
            "\n\nSave the resulting image (any size is fine) into the current directory as plate.png and print its path and pixel size.")
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write']
    for ref in a.get('refs', []): cmd += ['-i', str(ref)]
    cmd += ['-']
    r = None
    for k in range(2):
        r = subprocess.run(cmd, input=full, capture_output=True, text=True, timeout=1500)
        with open(WORK / f"{a['id']}.codex.log", 'a') as f: f.write(r.stdout[-3000:] + r.stderr[-2000:])
        got = next((os.path.join(wd, n) for n in ('plate.png', 'plate.jpg', 'plate.webp') if os.path.exists(os.path.join(wd, n))), None)
        if not got:
            pics = sorted(Path(wd).glob('*.png')) + sorted(Path(wd).glob('*.jpg'))
            got = str(pics[0]) if pics else None
        if got:
            Image.open(got).convert('RGB').save(out, quality=94); shutil.rmtree(wd, ignore_errors=True); return out
    raise RuntimeError('codex image failed: ' + ((r.stderr or r.stdout)[-300:] if r else ''))


def gates():
    return json.loads((SET / 'gate.json').read_text()) if (SET / 'gate.json').exists() else {}


def run(a, st):
    aid = a['id']; rec = st.setdefault(aid, {'id': aid, 'tries': []})
    attempt = len(rec['tries']) + 1
    g = gates().get(aid, {})
    plate = codex_plate(a, attempt, g.get('extra', '') if g.get('status') == 'refused' else '')
    rgba = WORK / f'{aid}.try{attempt}.png'
    with GPU: m = pgb.birefnet(plate, rgba)
    comp = pgb.composite(rgba, WORK / f'{aid}.try{attempt}.comp.jpg')
    with LOCK:
        rec['tries'].append({'try': attempt, 'plate': str(plate), 'rgba': str(rgba), 'comp': str(comp), 'matte': m, 'at': time.strftime('%H:%M:%S')})
        rec['status'] = 'painted'
        STATE.write_text(json.dumps(st, indent=1) + '\n')
    print(aid, 'try', attempt, 'painted; matte', m.get('verdict'), m.get('comps'), flush=True)


if __name__ == '__main__':
    arg = lambda k, d=None: next((x.split('=', 1)[1] for x in sys.argv if x.startswith(k + '=')), d)
    ids = arg('--ids'); ids = ids.split(',') if ids else None
    A = [a for a in json.loads((SET / 'assets.json').read_text())['assets'] if ids is None or a['id'] in ids]
    st = load()
    G = gates()   # gate.py's verdicts (its own file: the two never write the same one)
    todo = [a for a in A if '--redo' in sys.argv or a['id'] not in st or (G.get(a['id'], {}).get('status') == 'refused' and G[a['id']].get('judged') == len(st[a['id']]['tries']))]
    print(len(todo), 'plates to paint', flush=True)
    with concurrent.futures.ThreadPoolExecutor(int(arg('--workers', 4))) as pool:
        futs = {pool.submit(run, a, st): a['id'] for a in todo}
        for f in concurrent.futures.as_completed(futs):
            try: f.result()
            except Exception as e: print(futs[f], 'ERROR', repr(e)[:300], flush=True)
