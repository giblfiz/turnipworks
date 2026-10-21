#!/usr/bin/env bash
# Accepted source meshes -> runtime tiers + all size/texture ladders. Main binaries remain read-only references.
set -euo pipefail
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  cat <<'HELP'
Usage: runtime.sh [--help|--dry-run|--only SKU]
Prepare accepted faction meshes in Task C only: runtime/LOD/textures then measured orientation. Needs integration/orientation.json. No deployment.
HELP
  exit 0
fi
W=$(git rev-parse --show-toplevel)
[[ $W != $TW_REPO ]] || { echo 'Runtime preparation belongs in Task C'; exit 1; }
I=$W/experiments/2026-10-13-factions/integration
LIMIT=/tmp/scratch/tw-slot
if [[ ${1:-} == --dry-run ]]; then
  printf 'Worktree: %s\nSource: catalog/runs/factions-01/manifest.tsv\nModels: experiments/2026-10-13-factions/models\nOrientation: %s/orientation.json\nSequence: sandbox, build, runtime meshes, LODs, textures, flats, build, measured orientation, check\n' "$W" "$I"
  exit 0
fi
ONLY=""
if [[ ${1:-} == --only ]]; then ONLY=${2:?SKU required}; fi
python3 "$I/sandbox.py"
cd "$W/tools/spawn-tuner"
python3 build_data.py
python3 prep/ccm_prep.py factions-01 jobs
JOBS=prep/jobs-factions01.json
if [[ -n $ONLY ]]; then
  python3 - "$ONLY" <<'PYONLY'
import json,sys
jobs=[j for j in json.load(open('prep/jobs-factions01.json')) if j['sku']==sys.argv[1]]
assert len(jobs)==1, 'Expected one accepted repair SKU'
json.dump(jobs,open('prep/jobs-factions01-repair.json','w'))
PYONLY
  JOBS=prep/jobs-factions01-repair.json
fi
"$LIMIT" blender --background --python prep/blender_runtime.py -- "$JOBS" 0 1 prep/results-factions01.jsonl
"$LIMIT" blender --background --python prep/blender_lod.py -- "$JOBS" 0 1 prep/lod-factions01.jsonl
"$LIMIT" python3 - "$JOBS" <<'PY'
import sys,json,pathlib
sys.path.insert(0,'prep');from lod_tex import one
p=pathlib.Path('prep/tex-ladder.json'); info=json.loads(p.read_text()) if p.exists() else {}
for j in json.load(open(sys.argv[1])):
    png=pathlib.Path('prep/tex-src')/(j['sku']+'.png')
    sku,size,_=one(png);info[sku]=list(size)
p.write_text(json.dumps(info))
PY
if [[ -z $ONLY ]]; then python3 prep/flats.py; fi
python3 build_data.py
# A measured orientation file keyed by SKU is required; zero is a reviewed decision, never an implicit guess.
python3 - "$I/orientation.json" <<'PY'
import sys,json,pathlib,hashlib
p=pathlib.Path(sys.argv[1]);orientations=json.loads(p.read_text())
lib=json.load(open('data/library.json'));orient=json.load(open('data/orient.json'));decisions={}
jobs={j['sku']:j for j in json.load(open('prep/jobs-factions01.json'))}
for obj in lib['objects'].values():
    for s in obj['skus']:
        if s['src']!='factions-01':continue
        v=orientations[s['sku']];yaw=v['yaw'];assert v.get('evidence'),'Orientation needs evidence'
        digest=hashlib.sha256(pathlib.Path(jobs[s['sku']]['src']).read_bytes()).hexdigest()
        assert v.get('sourceSha256')==digest, f"Stale orientation evidence: {s['sku']}"
        orient[s['mesh']]=yaw;decisions[s['mesh']]=dict(yaw=yaw,evidence=v['evidence'],sourceSha256=digest)
pathlib.Path('data/orient.json').write_text(json.dumps(orient,indent=1))
d=pathlib.Path('prep/orient-sweep-factions-01');d.mkdir(exist_ok=True);(d/'decisions.json').write_text(json.dumps(decisions,indent=1))
PY
python3 prep/ccm_prep.py factions-01 check
