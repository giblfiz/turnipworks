#!/usr/bin/env bash
# Every candidate mesh (USB meshy/*.glb and trellis/*.glb, listed in work/candidates.tsv: sku<TAB>src) through the SAME
# runtime prep the shipped meshes had: blender_runtime.py (5,000 faces, one 256-px colour map, matte, bottom-centre),
# blender_lod.py (f1500..f20000 + full) and lod_tex.py (t64..t2048). New sku names only (<subject>--mx7 / --mxt / --tr2),
# so nothing shipped is touched; outputs are real files in THIS worktree's tools/spawn-tuner/assets.
#   experiments/2026-11-07-meshy/tools/prep.sh
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../.." && pwd); TU=$W/tools/spawn-tuner
[[ $W != $TW_REPO ]] || { echo "prep belongs in the worktree"; exit 1; }
cd "$TU"; mkdir -p prep/tex-src
python3 - "$E" "$TU" <<'PY'
import json, sys
from pathlib import Path
E, TU = Path(sys.argv[1]), Path(sys.argv[2])
jobs = []
for line in (E / 'work/candidates.tsv').read_text().split('\n'):
    if not line.strip(): continue
    sku, src = line.split('\t')
    for f in [TU / f'assets/m/{sku}.glb', TU / f'assets/m/{sku}.glb.owner', TU / f'prep/tex-src/{sku}.png', *TU.glob(f'assets/lod/*/{sku}.glb'), *TU.glob(f'assets/tex/*/{sku}.webp')]:
        if f.is_symlink(): f.unlink()   # (never write through a link into main)
    jobs.append({'sku': sku, 'src': src, 'out': str(TU / f'assets/m/{sku}.glb'), 'faces': 5000, 'tex': 256, 'kitfix': False, 'force': True})
json.dump(jobs, open(TU / 'prep/jobs-meshy01.json', 'w'), indent=1); print(len(jobs), 'jobs')
PY
rm -f prep/results-meshy01.jsonl prep/lod-meshy01.jsonl
blender --background --python prep/blender_runtime.py -- prep/jobs-meshy01.json 0 1 prep/results-meshy01.jsonl > "$E/work/runtime-blender.log" 2>&1
blender --background --python prep/blender_lod.py -- prep/jobs-meshy01.json 0 1 prep/lod-meshy01.jsonl > "$E/work/lod-blender.log" 2>&1
python3 - <<'PY'
import sys, json, pathlib
sys.path.insert(0, 'prep'); from lod_tex import one
for j in json.load(open('prep/jobs-meshy01.json')):
    sku, size, out = one(pathlib.Path('prep/tex-src') / (j['sku'] + '.png')); print('tex', sku, size, out)
r = [json.loads(l) for l in open('prep/results-meshy01.jsonl')]
for x in r: print('runtime', x.get('sku'), x.get('faces_src'), '->', x.get('faces'), x.get('bytes'), x.get('error', '')[:200])
PY
mkdir -p "$E/work/prep"; mv prep/jobs-meshy01.json prep/results-meshy01.jsonl prep/lod-meshy01.jsonl "$E/work/prep/"   # candidates only: kept out of build_data.py's results glob
