#!/usr/bin/env python3
"""Plate -> Meshy feeder for the 2026-11-10 batch (run under tools/with_meshy_key.sh).
  feed.py once      clean every new plate (pad to a 10% margin, faint alpha < 40 -> 0) into plates-ready/, submit each ready
                    plate not yet submitted as Smart Topology t2.5 10k (remesh + texture in ONE task), then poll/download.
  feed.py loop      the same every 60 s until all workers are done and no task is open.
Budget guard: never submits when the balance would fall below START - CAP (credits); START is recorded on first run."""
import json, subprocess, sys, time
from pathlib import Path
from PIL import Image
import numpy as np
E = Path(__file__).resolve().parents[1]; T = E / 'tools'
sys.path.insert(0, str(T)); import meshy_i2m as M  # noqa: E402
CAP = 750          # $15 at $0.02 a credit (Pro)
BUD = E / 'work/budget.json'


def clean(src, dst):
    im = Image.open(src).convert('RGBA'); a = np.array(im); al = a[..., 3]
    al[al < 40] = 0; a[..., 3] = al
    ys, xs = np.nonzero(al)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape[:2]; S = int(max(w, h) * 1.2)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(Image.fromarray(a), ((S - w) // 2, (S - h) // 2))
    out.save(dst)


def once():
    R = E / 'plates-ready'; R.mkdir(exist_ok=True)
    bal = M.call('GET', '/openapi/v1/balance')['balance']
    b = json.loads(BUD.read_text()) if BUD.exists() else {'start': bal}; BUD.write_text(json.dumps(b))
    tasks = M.load()
    for p in sorted((E / 'plates').glob('*.png')):
        r = R / p.name
        if not r.exists() or r.stat().st_mtime < p.stat().st_mtime:
            if time.time() - p.stat().st_mtime < 20: continue   # still being written
            clean(p, r); print('clean', p.name)
        name = p.stem; tag = f'{name}--t25'
        if tag in tasks and tasks[tag].get('status') not in ('FAILED', 'CANCELED'): continue
        if bal - 15 < b['start'] - CAP: print('BUDGET CAP: not submitting', name); continue
        M.submit(r, name, 't25'); tasks = M.load(); bal -= 15
    M.poll()
    return tasks


def workers_running():
    for pid in (E / 'work/logs').glob('codex-*.pid'):
        if subprocess.run(['kill', '-0', pid.read_text().strip()], capture_output=True).returncode == 0: return True
    return False


if __name__ == '__main__':
    if sys.argv[1:] == ['once']: once()
    elif sys.argv[1:] == ['loop']:
        while True:
            try: once()
            except (Exception, SystemExit) as e: print('feed pass failed (retry in 60 s):', repr(e)[:300], flush=True)
            t = M.load()
            open_ = [k for k, v in t.items() if not v.get('downloaded') and v.get('status') not in ('FAILED', 'CANCELED')]
            if not workers_running() and not open_: print('ALL DONE'); break
            time.sleep(60)
