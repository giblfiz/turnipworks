#!/usr/bin/env python3
"""Which plates are still to brief: no plate yet, not in a running worker's brief (worker-logs/codex-<k>.pid alive), and
the parent plate (if any) there.   python3 tools/todo.py   -> prints the ids (space separated) on the last line"""
import json, os, re
from pathlib import Path
E = Path(__file__).resolve().parent.parent; T = json.loads((E / 'targets.json').read_text()); busy = set()
for p in (E / 'worker-logs').glob('codex-*.pid'):
    k = p.stem.split('-')[1]
    try: os.kill(int(p.read_text()), 0)
    except Exception: continue
    b = E / f'BRIEF-{k}.md'
    if b.exists(): busy |= set(re.findall(r'^### (\S+)', b.read_text(), re.M))
have = lambda i: (E / 'plates' / f'{i}.png').exists()
todo = [t['id'] for t in T if not have(t['id']) and t['id'] not in busy and (not t.get('parent') or have(t['parent']))]
print('waiting on a parent:', [t['id'] for t in T if not have(t['id']) and t['id'] not in busy and t['id'] not in todo])
print('in running briefs, not done:', sorted(i for i in busy if not have(i)))
print(' '.join(todo))
