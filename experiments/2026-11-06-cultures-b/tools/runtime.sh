#!/usr/bin/env bash
# One pack's accepted meshes -> the runtime tier, the LOD ladder and the texture ladder, in THIS worktree only (the
# openmesh runtime.sh, per pack). Its sku names are NEW, so nothing of main's is touched: the worktree's assets/m, lod,
# tex hold links to main's files (tools/setup_links.py) and these builds write real files beside them; land_binaries.py
# copies them into main.        tools/runtime.sh nrs
set -euo pipefail
code=$1
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../.." && pwd); TU=$W/tools/spawn-tuner
[[ $W != $TW_REPO ]] || { echo "runtime preparation belongs in the worktree"; exit 1; }
python3 "$E/tools/manifest.py" "$code"
cd "$TU"; mkdir -p prep/tex-src
python3 build_data.py | tail -2
python3 - "$code" <<'PY'
import json, sys
code = sys.argv[1]; lib = json.load(open('data/library.json'))['objects']
mine = {s['sku'] for o in lib.values() for s in o['skus'] if s.get('src') == f'cultb-{code}-01' and s['kind'] == 'mesh'}
jobs = [{**j, 'force': True} for j in json.load(open('prep/jobs.json')) if j['sku'] in mine]
json.dump(jobs, open(f'prep/jobs-cultb-{code}.json', 'w'), indent=1); print(len(jobs), f'jobs -> prep/jobs-cultb-{code}.json')
PY
rm -f prep/results-cultb-$code.jsonl prep/lod-cultb-$code.jsonl
for w in 0 1; do blender --background --python prep/blender_runtime.py -- prep/jobs-cultb-$code.json $w 2 prep/results-cultb-$code.jsonl > "$E/worker-logs/runtime-$code-$w.log" 2>&1 & done; wait
for w in 0 1; do blender --background --python prep/blender_lod.py -- prep/jobs-cultb-$code.json $w 2 prep/lod-cultb-$code.jsonl > "$E/worker-logs/lod-$code-$w.log" 2>&1 & done; wait
python3 - "$code" <<'PY'
import sys, json, pathlib
sys.path.insert(0, 'prep'); from lod_tex import one
for j in json.load(open(f'prep/jobs-cultb-{sys.argv[1]}.json')):
    sku, size, _ = one(pathlib.Path('prep/tex-src') / (j['sku'] + '.png'))
print('textures done')
PY
python3 build_data.py | tail -2
python3 - "$code" <<'PY'
import json, sys
r = [json.loads(l) for l in open(f'prep/results-cultb-{sys.argv[1]}.jsonl')]
bad = [x for x in r if 'bounds' not in x]
print(len(r), 'runtime results;', len(bad), 'without bounds', [(x.get('sku'), x.get('error', '')[:200]) for x in bad])
PY
