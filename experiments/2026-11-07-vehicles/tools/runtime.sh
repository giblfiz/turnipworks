#!/usr/bin/env bash
# Accepted meshes of this batch (models/*.glb, listed in catalog/runs/$RUN/manifest.tsv; RUN=vehicles-03 or moddesk-03) -> the runtime tier, the LOD ladder
# and the texture ladder, in THIS worktree only (openmesh's runtime.sh, cut down). The worktree's tuner assets are per-file
# links to main's (integration/link_main_binaries.py); this batch's names are NEW names, and any link of one is removed
# first, so the builds write real files here and never into main (Fauna's landing copies them in).
#   RUN=vehicles-03 experiments/2026-11-07-vehicles/tools/runtime.sh [sku ...]      (default: every manifest row)
set -euo pipefail
RUN=${RUN:-vehicles-03}; J=${RUN//-/}
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../.." && pwd); TU=$W/tools/spawn-tuner
[[ $W != $TW_REPO ]] || { echo "runtime preparation belongs in the worktree"; exit 1; }
cd "$TU"; mkdir -p prep/tex-src
if [[ $# -gt 0 ]]; then ids=("$@"); else mapfile -t ids < <(awk -F'\t' 'NR>1{print $1}' "$W/catalog/runs/$RUN/manifest.tsv"); fi
echo "${#ids[@]} skus"
for s in "${ids[@]}"; do
  for f in assets/m/$s.glb assets/m/$s.glb.owner assets/lod/*/$s.glb assets/tex/*/$s.webp prep/tex-src/$s.png; do [[ -L $f ]] && rm "$f"; done
done
python3 build_data.py | tail -2
printf '%s\n' "${ids[@]}" > "$E/work/runtime-ids.txt"
python3 - "$E" "$J" <<'PY'
import json, sys
from pathlib import Path
E = Path(sys.argv[1]); want = set(Path(E / 'work/runtime-ids.txt').read_text().split())
jobs = [{**j, 'force': True} for j in json.load(open('prep/jobs.json')) if j['sku'] in want]
missing = want - {j['sku'] for j in jobs}
assert not missing, sorted(missing)
json.dump(jobs, open(f'prep/jobs-{sys.argv[2]}.json', 'w'), indent=1); print(len(jobs), f'jobs -> prep/jobs-{sys.argv[2]}.json')
PY
rm -f prep/results-$J.jsonl prep/lod-$J.jsonl
blender --background --python prep/blender_runtime.py -- prep/jobs-$J.json 0 1 prep/results-$J.jsonl > "$E/work/runtime-blender.log" 2>&1
blender --background --python prep/blender_lod.py -- prep/jobs-$J.json 0 1 prep/lod-$J.jsonl > "$E/work/lod-blender.log" 2>&1
python3 - "$J" <<'PY'
import sys, json, pathlib
J = sys.argv[1]; sys.path.insert(0, 'prep'); from lod_tex import one
for j in json.load(open(f'prep/jobs-{J}.json')):
    sku, size, _ = one(pathlib.Path('prep/tex-src') / (j['sku'] + '.png')); print('tex', sku, size)
PY
python3 build_data.py | tail -2
python3 - "$J" <<'PY'
import json, sys
r = [json.loads(l) for l in open(f'prep/results-{sys.argv[1]}.jsonl')]
bad = [x for x in r if 'bounds' not in x]
print(len(r), 'runtime results;', len(bad), 'without bounds', [(x.get('sku'), x.get('error', '')[:200]) for x in bad])
PY
