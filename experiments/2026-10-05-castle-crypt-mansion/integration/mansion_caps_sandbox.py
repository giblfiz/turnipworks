# Sandbox-only helper (mansion fork): apply manifest_overrides.mansion.json (sizes) and the proposed `tier: fine` entries to
# sandbox/mansion's FAKE manifest and fake bounds, then rebuild that sandbox's data.   python3 mansion_caps_sandbox.py
import csv, json, pathlib, subprocess, sys
I = pathlib.Path('experiments/2026-10-05-castle-crypt-mansion/integration'); SB = I / 'sandbox/mansion'
ov = json.loads((I / 'manifest_overrides.mansion.json').read_text())['size']
FINE = ['urn-decorative--porcelain', 'urn-decorative--floor-vase', 'pedestal-display--marble', 'candelabra-standing--s1', 'candelabra-standing--s2']
m = SB / 'fake/runs/mansion-01/manifest.tsv'; rows = list(csv.DictReader(m.open(), delimiter='\t')); cols = list(rows[0].keys())
for r in rows:
    if r['sku'] in ov: r['size'] = 'x'.join(f'{v:g}' for v in ov[r['sku']])
    if r['sku'] in FINE: r['tier'] = 'fine'
with m.open('w', newline='') as fh: w = csv.DictWriter(fh, fieldnames=cols, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
res = SB / 'prep/results-fake.jsonl'; out = []
for line in res.read_text().splitlines():
    r = json.loads(line)
    if r['sku'] in ov: w_, d_, h_ = ov[r['sku']]; mx = max(ov[r['sku']]); r['bounds'] = [round(w_ / mx, 4), round(h_ / mx, 4), round(d_ / mx, 4)]
    out.append(json.dumps(r))
res.write_text('\n'.join(out) + '\n')
r = subprocess.run([sys.executable, str(SB / 'build_data.py')], capture_output=True, text=True); print('build_data exit', r.returncode, (r.stdout + r.stderr).splitlines()[0][:160])
lib = json.loads((SB / 'data/library.json').read_text())['objects']
for i in ['fireplace-marble', 'bookcase-ladder', 'urn-decorative', 'pedestal-display', 'candelabra-standing']: print(i, lib[i].get('only'), [(s['sku'], s['tier'], s.get('size')) for s in lib[i]['skus']])
