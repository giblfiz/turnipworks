#!/usr/bin/env bash
# The accepted ornament meshes -> the runtime tier, the LOD ladder and the texture ladder, in THIS worktree only (cultures-b
# tools/runtime.sh, for src croof-01). Their sku names are NEW, so nothing of main's is touched (the worktree's assets/m, lod, tex
# hold links to main's files; these builds write real files beside them).        tools/runtime.sh
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../../.." && pwd); TU=$W/tools/spawn-tuner
[[ $W != $TW_REPO ]] || { echo "runtime preparation belongs in the worktree"; exit 1; }
python3 "$E/tools/manifest.py"
cd "$TU"; mkdir -p prep/tex-src "$E/worker-logs"
python3 build_data.py | tail -3
python3 - <<'PY'
import json, os
lib = json.load(open('data/library.json'))['objects']
mine = {s['sku'] for o in lib.values() for s in o['skus'] if s.get('src') == 'croof-01' and s['kind'] == 'mesh'}
for d in ('assets/m',) + tuple(f'assets/lod/{f}' for f in os.listdir('assets/lod')) + tuple(f'assets/tex/{t}' for t in os.listdir('assets/tex')):
    for s in mine:
        for ext in ('glb', 'webp'):
            p = f'{d}/{s}.{ext}'
            if os.path.islink(p): raise SystemExit(f'REFUSING: {p} is a link into main')
jobs = [{**j, 'force': True} for j in json.load(open('prep/jobs.json')) if j['sku'] in mine]
json.dump(jobs, open('prep/jobs-croof.json', 'w'), indent=1); print(len(jobs), 'jobs -> prep/jobs-croof.json', sorted(mine))
PY
rm -f prep/results-croof.jsonl prep/lod-croof.jsonl
for w in 0 1; do blender --background --python prep/blender_runtime.py -- prep/jobs-croof.json $w 2 prep/results-croof.jsonl > "$E/worker-logs/runtime-$w.log" 2>&1 & done; wait
for w in 0 1; do blender --background --python prep/blender_lod.py -- prep/jobs-croof.json $w 2 prep/lod-croof.jsonl > "$E/worker-logs/lod-$w.log" 2>&1 & done; wait
python3 - <<'PY'
import sys, json, pathlib
sys.path.insert(0, 'prep'); from lod_tex import one
for j in json.load(open('prep/jobs-croof.json')):
    one(pathlib.Path('prep/tex-src') / (j['sku'] + '.png'))
print('textures done')
PY
python3 build_data.py | tail -3
python3 - <<'PY'
import json
r = [json.loads(l) for l in open('prep/results-croof.jsonl')]
bad = [x for x in r if 'bounds' not in x]
print(len(r), 'runtime results;', len(bad), 'without bounds', [(x.get('sku'), x.get('error', '')[:200]) for x in bad])
PY
