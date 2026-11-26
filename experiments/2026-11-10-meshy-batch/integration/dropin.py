#!/usr/bin/env python3
"""Meshy Smart Topology meshes UNDER SHIPPED SKUS, batch 2 (2026-11-10; the 2026-11-07 dropin.py pattern, itself the openmesh-01
precedent): placed things keep their sku and simply look better; `was` files the old mesh, `rev` busts the 4-h colour-map cache.

  python3 experiments/2026-11-10-meshy-batch/integration/dropin.py build     # WORKTREE only: shipped names rebuilt from the Meshy source
  python3 experiments/2026-11-10-meshy-batch/integration/dropin.py library   # patch data/library.json (idempotent; the last word after any regen)
  python3 experiments/2026-11-10-meshy-batch/integration/dropin.py undo      # library records back to the shipped mesh

dropin.json "choices" = {"<shipped sku>": "<Meshy file stem on the USB>"}; "category" = {"<sku>": "<library object id>"}.
`build` copies each chosen Meshy source GLB to experiments/2026-11-10-meshy-batch/models/<sku>.glb and runs the shipped runtime
prep (blender_runtime 5,000 faces / 256 px, blender_lod, lod_tex) with "takeover": true, after unlinking this worktree's links to
main's files of that name (never writes through a link). Prep files are named *-zz-meshy-batch* so build_data.py, which reads
prep/results-*.jsonl in sorted order, lets them win (after the 11/07 *-zz-meshy-dropin* files).
"""
import hashlib, json, os, shutil, subprocess, sys
from pathlib import Path

E = Path(__file__).resolve().parents[1]; W = E.parents[1]; TU = W / 'tools/spawn-tuner'
U = Path('/mnt/usb/turnip-works/lanes-2026-11-10/meshy-batch/meshy')
DROPIN = json.loads((E / 'integration/dropin.json').read_text())
SRC = 'meshy-02'; TAG = 'zz-meshy-batch'; UNTIL = '2026-11-11T00:00:00-0800'


def glb_extent(p):
    import struct
    b = Path(p).read_bytes(); n = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20 + n]); lo = [1e9] * 3; hi = [-1e9] * 3
    for m in j['meshes']:
        for pr in m['primitives']:
            a = j['accessors'][pr['attributes']['POSITION']]
            for i in range(3): lo[i] = min(lo[i], a['min'][i]); hi[i] = max(hi[i], a['max'][i])
    return [round(h - l, 5) for l, h in zip(lo, hi)]


def sha8(p): return hashlib.sha1(Path(p).read_bytes()).hexdigest()[:8]


def build(only=None):
    assert W != Path('<repo>'), 'build belongs in the worktree'
    d = E / 'models'; d.mkdir(parents=True, exist_ok=True); jobs = []
    for sku, stem in DROPIN['choices'].items():
        if only and sku not in only: continue
        src = d / f'{sku}.glb'; shutil.copyfile(U / f'{stem}.glb', src)
        for f in [TU / f'assets/m/{sku}.glb', TU / f'assets/m/{sku}.glb.owner', TU / f'prep/tex-src/{sku}.png', *TU.glob(f'assets/lod/*/{sku}.glb'), *TU.glob(f'assets/tex/*/{sku}.webp')]:
            if f.is_symlink(): f.unlink()
        jobs.append({'sku': sku, 'src': str(src), 'out': str(TU / f'assets/m/{sku}.glb'), 'faces': 5000, 'tex': 256, 'kitfix': False, 'force': True, 'takeover': True})
    jp = TU / f'prep/jobs-{TAG}.json'
    old = [j for j in (json.loads(jp.read_text()) if jp.exists() and only else []) if j['sku'] not in {x['sku'] for x in jobs}]
    jp.write_text(json.dumps(jobs, indent=1))
    res = TU / f'prep/results-{TAG}.jsonl'; lod = TU / f'prep/lod-{TAG}.jsonl'
    keep_r = [l for l in (res.read_text().split('\n') if res.exists() and only else []) if l.strip() and json.loads(l)['sku'] not in {x['sku'] for x in jobs}]
    keep_l = [l for l in (lod.read_text().split('\n') if lod.exists() and only else []) if l.strip() and json.loads(l).get('sku') not in {x['sku'] for x in jobs}]
    res.unlink(missing_ok=True); lod.unlink(missing_ok=True)
    for script, out in (('blender_runtime.py', res), ('blender_lod.py', lod)):
        subprocess.run(['blender', '--background', '--python', f'prep/{script}', '--', str(jp), '0', '1', str(out)], cwd=TU, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    sys.path.insert(0, str(TU / 'prep')); os.chdir(TU); from lod_tex import one
    for j in jobs: print('tex', one(TU / 'prep/tex-src' / (j['sku'] + '.png'))[0])
    if old:  # an incremental build keeps the earlier skus' prep records
        jp.write_text(json.dumps(old + jobs, indent=1))
        res.write_text('\n'.join(keep_r + [l for l in res.read_text().split('\n') if l.strip()]) + '\n')
        lod.write_text('\n'.join(keep_l + [l for l in lod.read_text().split('\n') if l.strip()]) + '\n')
    for l in res.read_text().split('\n'):
        if l.strip(): print('runtime', l[:300])


def library(undo=False, only=None):
    lp = TU / 'data/library.json'; L = json.loads(lp.read_text())
    rec_by = {json.loads(l)['sku']: json.loads(l) for l in (TU / f'prep/results-{TAG}.jsonl').read_text().split('\n') if l.strip()} if not undo else {}
    for sku in DROPIN['choices']:
        if only and sku not in only: continue
        cat = DROPIN['category'][sku]; k = next(s for s in L['objects'][cat]['skus'] if s['sku'] == sku)
        if undo:
            if k.get('src') == SRC and k.get('was'): old = k['was'][0]; k.update(old.get('shipped', {})); k['was'] = k['was'][1:] or None; k.pop('rev', None)
            if k.get('was') is None: k.pop('was', None)
            continue
        new_mesh = f"{SRC}/{sku}@{sha8(E / 'models' / f'{sku}.glb')}"
        if k.get('mesh') == new_mesh: continue
        r = rec_by[sku]
        got = glb_extent(TU / f'assets/m/{sku}.glb')  # the drawn mesh is the truth: prep's record can keep a vertex decimation dropped
        if max(abs(g - b) / max(b, 1e-6) for g, b in zip(got, r['bounds'])) > 0.02:
            print(f'  {sku}: prep bounds {r["bounds"]} -> drawn {got}'); r = {**r, 'bounds': got}
        shipped = {f: k.get(f) for f in ('src', 'mesh', 'bounds', 'faces', 'kb')}
        k['was'] = [{'mesh': k['mesh'], 'until': UNTIL, 'shipped': shipped}] + (k.get('was') or [])
        k.update(src=SRC, mesh=new_mesh, bounds=r['bounds'], faces=r['faces'], kb=round(r['bytes'] / 1024), rev=new_mesh.rsplit('@', 1)[1])
    lp.write_text(json.dumps(L, indent=1)); print('library.json', 'restored' if undo else 'patched', only or list(DROPIN['choices']))


if __name__ == '__main__':
    a = sys.argv[1:]; only = a[1:] or None
    {'build': lambda: build(only), 'library': lambda: library(only=only), 'undo': lambda: library(undo=True, only=only)}[a[0]]()
