#!/usr/bin/env bash
# Accepted openmesh meshes (models/*.glb) -> the runtime tier, the LOD ladder and the texture ladder, in THIS worktree
# only (the faction-pillars runtime.sh, cut down). The worktree's assets/m, assets/lod/* and assets/tex/* are folders of
# per-file links to main's; this batch's names are unlinked first so the builds write real files here, never into
# main (land.sh copies them in under the lock). Replacing another batch's mesh is the point for 13 of the names
# (targets.json `replaces`): their jobs carry "takeover" (prep/owner_guard.py).
#   experiments/2026-10-30-openmesh/tools/runtime.sh
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../.." && pwd); TU=$W/tools/spawn-tuner
[[ $W != $TW_REPO ]] || { echo "runtime preparation belongs in the openmesh worktree"; exit 1; }
cd "$TU"; mkdir -p prep/tex-src
mapfile -t ids < <(cd "$E/models" && ls *.glb | sed 's/\.glb$//')
echo "${#ids[@]} accepted meshes"
for s in "${ids[@]}"; do
  for f in assets/m/$s.glb assets/m/$s.glb.owner assets/lod/*/$s.glb assets/tex/*/$s.webp; do [[ -L $f ]] && rm "$f"; done
done
python3 build_data.py | tail -3
python3 - "$E" <<'PY'
import json, sys
from pathlib import Path
E = Path(sys.argv[1]); T = {t['id']: t for t in json.loads((E / 'targets.json').read_text())}
have = {p.stem for p in (E / 'models').glob('*.glb')}
jobs = [{**j, 'force': True, **({'takeover': True} if T[j['sku']].get('replaces') else {})} for j in json.load(open('prep/jobs.json')) if j['sku'] in have and j['sku'] in T]
assert {j['sku'] for j in jobs} == have, sorted(have - {j['sku'] for j in jobs})
json.dump(jobs, open('prep/jobs-openmesh01.json', 'w'), indent=1); print(len(jobs), 'jobs -> prep/jobs-openmesh01.json')
PY
rm -f prep/results-openmesh01.jsonl prep/lod-openmesh01.jsonl
blender --background --python prep/blender_runtime.py -- prep/jobs-openmesh01.json 0 1 prep/results-openmesh01.jsonl > "$E/runtime-blender.log" 2>&1
blender --background --python prep/blender_lod.py -- prep/jobs-openmesh01.json 0 1 prep/lod-openmesh01.jsonl > "$E/lod-blender.log" 2>&1
# the hatch twins' tile height (tools/sink.py: their shaft hangs under the tile)
"$E/tools/sink.py" prep/results-openmesh01.jsonl $(cd "$E/models" && ls floor-trapdoor-open--*.glb oubliette-hatch-open.glb 2>/dev/null | sed 's/\.glb$//') 2>/dev/null
python3 - <<'PY'
import sys, json, pathlib
sys.path.insert(0, 'prep'); from lod_tex import one
for j in json.load(open('prep/jobs-openmesh01.json')):
    sku, size, _ = one(pathlib.Path('prep/tex-src') / (j['sku'] + '.png')); print('tex', sku, size)
PY
python3 build_data.py | tail -2
python3 - <<'PY'
import json
r = [json.loads(l) for l in open('prep/results-openmesh01.jsonl')]
bad = [x for x in r if 'bounds' not in x]
print(len(r), 'runtime results;', len(bad), 'without bounds', [(x.get('sku'), x.get('error', '')[:200]) for x in bad])
PY
# the worktree's delivery list must not send a browser to the OLD delivered copy of a replaced mesh (main's deploy
# rebuilds delivery.json for real: prep/delivery.py)
python3 - "$E" <<'PY'
import json, sys
from pathlib import Path
E = Path(sys.argv[1]); ids = {p.stem for p in (E / 'models').glob('*.glb')}
p = Path('assets/delivery.json'); d = json.loads(p.read_text()); n = sum(1 for k in list(d['tokens']) if k in ids and d['tokens'].pop(k)); p.write_text(json.dumps(d)); print('delivery tokens dropped here:', n)
PY
