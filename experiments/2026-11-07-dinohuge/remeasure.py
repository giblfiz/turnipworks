#!/usr/bin/env python3
"""RE-MEASURE AND RE-PUBLISH figures of the default set whose STATED SIZE changed (not their mesh), with the set's own
tools: set_qa.py's judging (measure.py: scale, y0, plan, reach, notes) and publish.py's rows. dinohuge lane 2026-11-07:
the tyrannosaur and triceratops resized large -> huge (set_more.py RESIZED -> set/assets.json).
    ~/.local/share/tw-trimesh-venv/bin/python remeasure.py --ids=foe-tyrannosaur,foe-triceratops
Both tools are run UNCHANGED in a scratch mirror of the set (never in the main checkout, never on the USB originals):
  - set_qa.one() for each id, with --redo; its two side effects are kept out of the real set: the tier re-cut (Blender)
    is stubbed to report the tiers already made (the mesh did not change, so its tiers did not), and the thumbnail it
    deletes for a "new mesh" is a placeholder in the mirror. -> set/qa/<id>.json in the worktree.
  - publish.py over the mirror (placeholder tiers and thumbnails, so it links and copies nothing) -> its manifest; only
    the named ids may change (checked; refused otherwise) -> set/published/manifest.json in the worktree.
Reads the meshes from the set's models/ (the USB disk, read-only) and the plates from the main checkout's set/masked."""
import json, os, shutil, subprocess, sys, tempfile, types
from pathlib import Path
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[1]; FIG = REPO / 'experiments/2026-10-06-figures'
MAIN = Path('experiments/2026-10-06-figures')
IDS = next(a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--ids='))
M = Path(tempfile.mkdtemp(prefix='remeasure-')); S = M / 'set'
for p in FIG.glob('*.py'): shutil.copy2(p, M)
for p in FIG.glob('*.json'): shutil.copy2(p, M)
S.mkdir(); (S / 'published').mkdir()
for n in ('assets.json', 'retries.json', 'blind.json'): shutil.copy2(FIG / 'set' / n, S / n)
shutil.copytree(FIG / 'set/qa', S / 'qa'); shutil.copy2(FIG / 'set/published/manifest.json', S / 'published/manifest.json')
os.symlink(MAIN / 'set/masked', S / 'masked'); os.symlink(os.path.realpath(MAIN / 'set/models'), S / 'models')
os.symlink(os.path.realpath(MAIN / 'set/models'), S / 'published/models')
# placeholders: publish.py only asks whether a tier / thumbnail exists and how old it is
old = json.loads((S / 'published/manifest.json').read_text())
(S / 'tiers').mkdir(); (S / 'published/tiers').mkdir(); (S / 'published/thumbs').mkdir()
for f in old['figures']:
    for t in ('20k1024', '8k512'): (S / 'tiers' / f"{f['id']}--{t}.glb").touch()
    if f.get('thumb'): (S / 'published' / f['thumb']).touch()
for f in old['figures']:
    for t in ('20k1024', '8k512'): (S / 'published/tiers' / f"{f['id']}--{t}.glb").touch()   # newer than set/tiers: no relink

# ---- 1. set_qa.one, unchanged, tiers stubbed
sys.path.insert(0, str(M)); os.chdir(M)
src = (M / 'set_qa.py').read_text(); qa = types.ModuleType('set_qa'); qa.__file__ = str(M / 'set_qa.py')
exec(compile(src[:src.index('if __name__ == "__main__":')], qa.__file__, 'exec'), qa.__dict__)
a0 = {f['id']: f for f in old['figures']}
was = {i: json.loads((S / 'qa' / f'{i}.json').read_text()) for i in IDS}
class Stub:
    def __init__(self, pid): self.pid = pid
    def run(self, cmd, **kw):
        out = Path(cmd[cmd.index('--') + 2]); key = out.stem.split('--')[1]; out.touch()
        return types.SimpleNamespace(stdout=f"TW_OPTIMIZE={json.dumps({'faces_after': was[self.pid]['tiers'][key]['tris']})}\n", returncode=0)
for i in IDS:
    qa.subprocess = Stub(i)
    pid, v = qa.one((i, S / 'models' / f'{i}.glb', True))
    r = json.loads((S / 'qa' / f'{i}.json').read_text()); r['tiers'] = was[i]['tiers']; r['qa_seconds'] = was[i].get('qa_seconds', r['qa_seconds'])
    (S / 'qa' / f'{i}.json').write_text(json.dumps(r, indent=1) + '\n')
    print(pid, v, '| scale', was[i]['scale'], '->', r['scale'], '| y0', was[i]['y0'], '->', r['y0'], '| notes', r['notes'])
    assert v == was[i]['verdict'] and r['sha1'] == was[i]['sha1'], 'verdict or mesh changed'
    if a0[i].get('thumb'): (S / 'published' / a0[i]['thumb']).touch()   # set_qa deleted it as stale: the mesh did not change, so it is not

# ---- 2. publish.py, unchanged
r = subprocess.run([sys.executable, str(M / 'publish.py'), f"--expected={old['expected_total']}"], cwd=M, capture_output=True, text=True)
print(r.stdout.strip(), r.stderr.strip()[-500:])
new = json.loads((S / 'published/manifest.json').read_text())
a, b = {f['id']: f for f in old['figures']}, {f['id']: f for f in new['figures']}
changed = sorted(i for i in set(a) | set(b) if a.get(i) != b.get(i))
print('rows changed:', changed)
assert set(changed) <= set(IDS) and new['batch'] == old['batch'], 'publish.py would change other rows: refused'
for i in IDS:
    print(i, {k: (a[i].get(k), b[i].get(k)) for k in b[i] if a[i].get(k) != b[i].get(k)})
for i in IDS: shutil.copy2(S / 'qa' / f'{i}.json', FIG / 'set/qa' / f'{i}.json')
# publish.py stamps `updated` with now; keep the old stamp's form, the rows are what changed
(FIG / 'set/published/manifest.json').write_text(json.dumps(new, indent=1) + '\n')
shutil.rmtree(M)
print('wrote set/qa/{%s}.json and set/published/manifest.json' % ','.join(IDS))
