#!/usr/bin/env python3
"""At a stopped rebase onto a main that landed other lanes' appended blocks: resolve every conflict as a UNION (main's
side, then ours), fix build_types.py's genre tables by hand-written merge, take main's generated files and regenerate
them (types.json by build_types.py; library-spawns.json as main's rooms + ours). Then `git add` and continue.
    python3 experiments/2026-11-06-cultures-b/tools/rebase_resolve.py"""
import json, re, subprocess
from pathlib import Path
W = Path(__file__).resolve().parents[3]
run = lambda *a: subprocess.run(a, cwd=W, capture_output=True, text=True).stdout
files = run('git', 'diff', '--name-only', '--diff-filter=U').split()
GEN = {'engine/client/data/types.json', 'tools/spawn-tuner/data/types.json', 'engine/client/data/library-spawns.json'}
CONF = re.compile(r'<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', re.S)
for f in files:
    if f in GEN: continue
    t = (W / f).read_text()
    if f == 'engine/tools/build_types.py':  # both sides end the LABELS dict and define GENRE_OF / GENRES / order
        def fix(m):
            a, b = m.group(1), m.group(2)
            if 'GENRE_OF' in a:
                la = a.split('}\n')[0]; lb = b.split('}\n')[0]
                ga = re.search(r"GENRE_OF = (\{.*?\})", a).group(1); gb = re.search(r"GENRE_OF = (\{.*?\})", b).group(1)
                gen = {**eval(ga), **eval(gb)}
                gs = eval(re.search(r"GENRES = (\[.*?\])\n", a).group(1)); gs += [g for g in eval(re.search(r"GENRES = (\[.*?\])\n", b).group(1)) if g not in gs]
                return (la + '\n' + lb + '\n}\n# genre of a setting code; every code not listed is fantasy. The genres list is in menu order (fantasy first: the Build\n'
                        '# tray opens on the first genre, engine/client/surfaces/build.js). Modern: the sprawl pack; Cultures: the culture packs (2026-11-06).\n'
                        f'GENRE_OF = {gen!r}\nGENRES = {gs!r}\n')
            if a.startswith('order = '):
                oa = eval(a.split('=', 1)[1]); ob = eval(b.split('=', 1)[1]); return 'order = ' + repr(oa + [c for c in ob if c not in oa]) + '\n'
            return a + b
        t = CONF.sub(fix, t)
    else:
        t = CONF.sub(lambda m: m.group(1) + m.group(2), t)
    assert '<<<<<<<' not in t, f
    (W / f).write_text(t); run('git', 'add', f); print('union', f)
for f in GEN & set(files):
    if f.endswith('library-spawns.json'):
        main = json.loads(run('git', 'show', f':2:{f}')); ours = json.loads(run('git', 'show', f':3:{f}'))
        main['rooms'].update({k: v for k, v in ours['rooms'].items() if k not in main['rooms']}); (W / f).write_text(json.dumps(main, separators=(',', ':')) if '\n' not in run('git', 'show', f':2:{f}')[:200] else json.dumps(main, indent=1))
    else:
        (W / f).write_text(run('git', 'show', f':2:{f}'))
    run('git', 'add', f); print('generated (main + ours)', f)
print(run('python3', 'engine/tools/build_types.py'))
for f in ('engine/client/data/types.json', 'tools/spawn-tuner/data/types.json'): run('git', 'add', f)
print('left:', run('git', 'diff', '--name-only', '--diff-filter=U') or 'none')
