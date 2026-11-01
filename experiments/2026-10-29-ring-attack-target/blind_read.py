#!/usr/bin/env python3
"""Blind 31 px reads of the new pictures through agy-run (the Gemini subscription), into the 10-15 batch's read dirs.

  python3 blind_read.py [--retry]      (run package.py first: it writes each candidate.png + prompt.txt)

Same neutral protocol as experiments/2026-10-15-ring-icons/tools/process.py: the model sees only candidate.png (the
31 px icon on 67 px of #1c1f24) and the selected-piece prompt, never the action, metaphor or a descriptive filename.
Calls are serial under /tmp/agy.lock. result.json is evidence, status needs-review; decisions go in review.json.
"""
import json, os, shutil, subprocess, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
BATCH = REPO / 'experiments/2026-10-15-ring-icons'
sys.path.insert(0, str(BATCH / 'tools'))
import process as P  # noqa: E402
AGY = '~/fauna-tools/agy-run'
retry = '--retry' in sys.argv
for pic in json.loads((HERE / 'plan-additions.json').read_text())['pictures']:
    d = P.read_directory(pic); rp = d / 'result.json'
    if rp.exists() and json.loads(rp.read_text()).get('returncode') == 0 and not retry: print('cached', pic['set'], pic['id']); continue
    with tempfile.TemporaryDirectory(prefix='blind-') as t:
        shutil.copy(d / 'candidate.png', Path(t) / 'candidate.png')
        prompt = (f"Look at the image file {t}/candidate.png (open it and view it at its supplied size). "
                  "Do NOT create, crop or write any files.\n\n" + P.blind_prompt(pic))
        out = Path(t) / 'out.txt'; result = None
        for model in ('gemini-4-argon-high', 'gemini-3.8-flash-high'):
            stamp = datetime.now(timezone.utc).isoformat()
            r = subprocess.run(['flock', '/tmp/agy.lock', AGY, '-m', model, '-C', t, '-t', '600', '-o', str(out), prompt], capture_output=True, text=True, timeout=5400)  # (the wait for the shared lock counts too)
            text = out.read_text().strip() if out.exists() else r.stdout.strip()
            result = {'timestamp': stamp, 'model': f'{model} via agy-run (subscription)', 'returncode': r.returncode if text else 1,
                      'read': text, 'error': r.stderr.strip()[-2000:], 'status': 'needs-review' if r.returncode == 0 and text else 'gate-error'}
            if result['status'] == 'needs-review': break
    P.atomic_json(rp, result); (d / 'raw.txt').write_text(result['read'] + '\n' + result['error'])
    pp = BATCH / 'provenance' / pic['set'] / f'{P.stem(pic)}.json'  # (prepare() writes the 10-15 model name; say which one read it)
    prov = json.loads(pp.read_text()); prov['blind_model'] = result['model']; P.atomic_json(pp, prov)
    print(pic['set'], pic['id'], result['status'], '\n', result['read'][:1200], '\n')
