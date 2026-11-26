#!/usr/bin/env python3
"""A Meshy mesh UNDER A SHIPPED SKU (the openmesh-01 precedent: placed things keep their sku and simply look better; `was`
files the old mesh, `rev` busts the 4-h colour-map cache). NOTHING here runs by itself: Harry decides first.

  python3 experiments/2026-11-07-meshy/integration/dropin.py build     # worktree: shipped names rebuilt from the Meshy source
  python3 experiments/2026-11-07-meshy/integration/dropin.py library   # patch data/library.json's records (idempotent; run
                                                                       # AFTER any regen/merge_lib, it is the last word)
  python3 experiments/2026-11-07-meshy/integration/dropin.py undo      # library records back to the shipped mesh

`build` copies each chosen Meshy source GLB (USB) to experiments/2026-11-07-meshy/models/<sku>.glb (owner = this batch) and runs the same
runtime prep (blender_runtime 5,000 faces / 256 px, blender_lod, lod_tex) with "takeover": true (owner = this batch),
after unlinking this worktree's links to main's files of that name (never writes through a link). DROPIN lists the choices.
(Its prep files are named *-zz-meshy-dropin* so build_data.py, which reads prep/results-*.jsonl in sorted order, lets them win.)
"""
import hashlib, json, os, shutil, subprocess, sys
from pathlib import Path

E = Path(__file__).resolve().parents[1]; W = E.parents[1]; TU = W / 'tools/spawn-tuner'
U = Path('/mnt/usb/turnip-works/lanes-2026-11-07/meshy/meshy')
DROPIN = json.loads((E / 'integration/dropin.json').read_text())   # {"<shipped sku>": "<meshy file stem on USB>", ...}
UNTIL = '2026-11-08T00:00:00-0800'


def sha8(p): return hashlib.sha1(Path(p).read_bytes()).hexdigest()[:8]


def build():
    assert W != Path('<repo>'), 'build belongs in the worktree'
    d = E / 'models'; d.mkdir(parents=True, exist_ok=True); jobs = []
    for sku, stem in DROPIN['choices'].items():
        src = d / f'{sku}.glb'; shutil.copyfile(U / f'{stem}.glb', src)
        for f in [TU / f'assets/m/{sku}.glb', TU / f'assets/m/{sku}.glb.owner', TU / f'prep/tex-src/{sku}.png', *TU.glob(f'assets/lod/*/{sku}.glb'), *TU.glob(f'assets/tex/*/{sku}.webp')]:
            if f.is_symlink(): f.unlink()
        jobs.append({'sku': sku, 'src': str(src), 'out': str(TU / f'assets/m/{sku}.glb'), 'faces': 5000, 'tex': 256, 'kitfix': False, 'force': True, 'takeover': True})
    jp = TU / 'prep/jobs-zz-meshy-dropin.json'; jp.write_text(json.dumps(jobs, indent=1))
    res = TU / 'prep/results-zz-meshy-dropin.jsonl'; res.unlink(missing_ok=True)
    for script, out in (('blender_runtime.py', res), ('blender_lod.py', TU / 'prep/lod-zz-meshy-dropin.jsonl')):
        subprocess.run(['blender', '--background', '--python', f'prep/{script}', '--', str(jp), '0', '1', str(out)], cwd=TU, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    sys.path.insert(0, str(TU / 'prep')); os.chdir(TU); from lod_tex import one
    for j in jobs: print('tex', one(TU / 'prep/tex-src' / (j['sku'] + '.png'))[0])
    for l in res.read_text().split('\n'):
        if l.strip(): print('runtime', l)


def library(undo=False):
    lp = TU / 'data/library.json'; L = json.loads(lp.read_text())
    rec_by = {json.loads(l)['sku']: json.loads(l) for l in (TU / 'prep/results-zz-meshy-dropin.jsonl').read_text().split('\n') if l.strip()} if not undo else {}
    for sku in DROPIN['choices']:
        cat = DROPIN['category'][sku]; k = next(s for s in L['objects'][cat]['skus'] if s['sku'] == sku)
        if undo:
            if k.get('src') == 'meshy-01' and k.get('was'): old = k['was'][0]; k.update(old.get('shipped', {})); k['was'] = k['was'][1:] or None; k.pop('rev', None)
            continue
        new_mesh = f"meshy-01/{sku}@{sha8(E / 'models' / f'{sku}.glb')}"
        if k.get('mesh') == new_mesh: continue
        r = rec_by[sku]
        shipped = {f: k.get(f) for f in ('src', 'mesh', 'bounds', 'faces', 'kb')}
        k['was'] = [{'mesh': k['mesh'], 'until': UNTIL, 'shipped': shipped}] + (k.get('was') or [])
        k.update(src='meshy-01', mesh=new_mesh, bounds=r['bounds'], faces=r['faces'], kb=round(r['bytes'] / 1024), rev=new_mesh.rsplit('@', 1)[1])
    lp.write_text(json.dumps(L, indent=1)); print('library.json', 'restored' if undo else 'patched', list(DROPIN['choices']))


if __name__ == '__main__':
    {'build': build, 'library': library, 'undo': lambda: library(undo=True)}[sys.argv[1]]()
