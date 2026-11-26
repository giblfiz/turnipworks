#!/usr/bin/env bash
# A culture's accepted meshes (CODE/models/*.glb named in catalog/runs/CODE-01/manifest.tsv) and its flats -> the runtime
# tier, the LOD ladder, the texture ladder and the flat pictures, in THIS worktree only (the openmesh runtime.sh, cut
# down). The worktree's assets folders are per-file links to main's (tools/link_ignored.py); this batch's names are
# unlinked first so the builds write real files here, never into main (land_binaries.sh copies them in under the lock).
# Orientation: CODE/mesh-read.json yaw (the blind four-turn read) for non-kit meshes, written to data/orient.json with
# the evidence in prep/orient-sweep-CODE-01/decisions.json.
#   experiments/2026-11-06-cultures-a/tools/runtime.sh CODE
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../.." && pwd); TU=$W/tools/spawn-tuner; C=$1
[[ $W != $TW_REPO ]] || { echo "runtime preparation belongs in the worktree"; exit 1; }
cd "$TU"; mkdir -p prep/tex-src
mapfile -t ids < <(python3 -c "import csv,sys; [print(r['sku']) for r in csv.DictReader(open('$W/catalog/runs/$C-01/manifest.tsv'), delimiter='\t')]")
echo "${#ids[@]} accepted meshes in catalog/runs/$C-01"
for s in "${ids[@]}"; do
  for f in assets/m/$s.glb assets/m/$s.glb.owner assets/lod/*/$s.glb assets/tex/*/$s.webp; do [[ -L $f ]] && rm "$f"; done
done
for f in "$E/$C"/flats/seamless/*.png "$E/$C"/flats/decals/*.jpg; do [[ -e $f ]] || continue; s=$(basename "${f%.*}"); for g in assets/flat/$s.webp assets/flat/*/$s.webp; do [[ -L $g ]] && rm "$g"; done; done
python3 build_data.py | tail -2
python3 prep/ccm_prep.py "$C-01" jobs
J=prep/jobs-${C}01.json
rm -f prep/results-${C}01.jsonl prep/lod-${C}01.jsonl
blender --background --python prep/blender_runtime.py -- "$J" 0 1 prep/results-${C}01.jsonl > "$E/$C/runtime-blender.log" 2>&1
blender --background --python prep/blender_lod.py -- "$J" 0 1 prep/lod-${C}01.jsonl > "$E/$C/lod-blender.log" 2>&1
python3 - "$J" <<'PY'
import sys, json, pathlib
sys.path.insert(0, 'prep'); from lod_tex import one
p = pathlib.Path('prep/tex-ladder.json'); info = json.loads(p.read_text()) if p.exists() else {}
for j in json.load(open(sys.argv[1])):
    sku, size, _ = one(pathlib.Path('prep/tex-src') / (j['sku'] + '.png')); info[sku] = list(size)
p.write_text(json.dumps(info))
PY
python3 "$E/tools/flats_mine.py" "$C" | tail -3
python3 build_data.py | tail -2
python3 "$E/tools/orient_apply.py" "$C"
python3 build_data.py | tail -1
python3 prep/ccm_prep.py "$C-01" check
# the worktree's delivery list must not send a browser to an old delivered copy of a name (main's deploy rebuilds it)
python3 - "$W/catalog/runs/$C-01/manifest.tsv" <<'PY'
import json, sys, csv
from pathlib import Path
ids = {r['sku'] for r in csv.DictReader(open(sys.argv[1]), delimiter='\t')}
p = Path('assets/delivery.json'); d = json.loads(p.read_text()); n = sum(1 for k in list(d.get('tokens', {})) if k in ids and d['tokens'].pop(k)); p.write_text(json.dumps(d)); print('delivery tokens dropped here:', n)
PY
