#!/usr/bin/env bash
# Run only after source + reviewed orientation have been committed:
# flock /tmp/tw-main.lock experiments/2026-10-13-factions/integration/land.sh 1
# Stage=preflight stops before main moves. Stages 2/3 permit NO golden changes.
set -euo pipefail
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  cat <<'HELP'
Usage: flock /tmp/tw-main.lock integration/land.sh STEP
STEP is 1,2,3. STAGE=preflight runs gates only. Requires clean tracked state, accepted manifest, reviewed orientation, replacement cutoff, and reviewed Step1 golden differences. No writes with --help.
HELP
  exit 0
fi
STEP=${1:?step 1, 2 or 3 required}; [[ $STEP =~ ^[123]$ ]] || exit 2
W=$(git rev-parse --show-toplevel)
M=$TW_REPO
E=experiments/2026-10-13-factions
I=$W/$E/integration
T=$W/tools/spawn-tuner
LIMIT=/tmp/scratch/tw-slot
export GH_CONFIG_DIR=$HOME/.config/gh
[[ $W != "$M" ]] || { echo 'Refusing preflight in main'; exit 1; }
[[ -z $(git status --porcelain --untracked-files=no) ]] || { echo 'Commit own tracked changes before landing'; exit 1; }
[[ -z $(git -C "$M" status --porcelain --untracked-files=no) ]] || { echo 'Main has tracked edits; leave them untouched'; exit 1; }
SOURCE=$(git rev-parse HEAD)
git fetch origin
[[ $(git -C "$M" rev-parse main) == $(git rev-parse origin/main) ]] || { echo 'Main is not fetched origin/main'; exit 1; }
BASE=$(git rev-parse origin/main)
STAMP=$(date +%Y%m%d-%H%M%S)
LOG=$I/landing-$STAMP-step$STEP
mkdir -p "$LOG"
BASELINE=$LOG/pristine
mkdir -p "$BASELINE"
git archive "$BASE" tools/spawn-tuner | tar -x -C "$BASELINE"
BRANCH=codex-c-land-$STEP-$STAMP
git switch -c "$BRANCH" origin/main
git merge --no-edit "$SOURCE"
python3 "$I/sandbox.py" --main "$M" --target "$W"
# Step1 must be independently landable; never ship a partial Step2 wave accidentally.
python3 - "$STEP" <<'PY'
import csv,json,sys,pathlib
p=pathlib.Path('catalog/runs/factions-01/manifest.tsv')
rows=list(csv.DictReader(p.open(),delimiter='\t'))
if sys.argv[1]=='1':
    assert len(rows)==5 and all(r['group']=='step1' for r in rows), 'Step1 manifest must contain exactly the five accepted Step1 meshes'
r=pathlib.Path('experiments/2026-10-13-factions/integration/replacements.json')
d=json.loads(r.read_text())
assert all(x.get('until') for x in d.values()), 'Set replacement until to the planned first-live timestamp before committing and landing'
PY
rebuild() {
  local tree=$1
  (cd "$tree/tools/spawn-tuner"; python3 build_data.py; python3 prep/flats.py; python3 build_data.py)
  (cd "$tree"; python3 engine/tools/build_types.py)
}
rebuild "$W" > "$LOG/build.log" 2>&1
# Build delivery in the isolated tree too; tests then see exactly what will ship.
"$LIMIT" python3 "$T/prep/delivery.py" > "$LOG/delivery.log" 2>&1
python3 "$T/prep/ccm_prep.py" factions-01 check
python3 "$T/test/assets_check.py" --quiet
python3 tools/tool-sweep/sku_guard.py
ALLOW=''
RECIPE_ARGS=()
if [[ $STEP == 1 ]]; then
  ALLOW=$(python3 - <<'PY'
import json
x=json.load(open('experiments/2026-10-13-factions/integration/golden-step1.json'))
assert x['observedDiffsReviewed'], 'Run golden --print, review precise differing types, then mark observedDiffsReviewed before landing'
print(','.join(x['allowTypes']))
PY
)
RECIPE_ARGS=("--accept-recipes=$I/golden-scenes-step1.json")
fi
"$LIMIT" node "$T/test/golden.mjs" "$BASELINE/tools/spawn-tuner" "$T" "${RECIPE_ARGS[@]}" > "$LOG/golden.log" 2>&1
"$LIMIT" node "$T/test/tem.test.mjs" "$T" > "$LOG/tem.log" 2>&1
"$LIMIT" node "$T/test/cult.test.mjs" "$T" > "$LOG/cult.log" 2>&1
"$LIMIT" node "$T/test/factions.test.mjs" "$T" > "$LOG/factions.log" 2>&1
(cd engine; "$LIMIT" node test/faction-defaults.test.mjs; "$LIMIT" node test/factions.test.mjs; "$LIMIT" npm test) > "$LOG/engine.log" 2>&1
# Fixed generated-file allowlist: never add the rest of the worktree's edits.
DATA=(tools/spawn-tuner/data/library.json tools/spawn-tuner/data/rooms.json tools/spawn-tuner/data/factions.json tools/spawn-tuner/data/orient.json tools/spawn-tuner/data/types.json tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/flats-out.json tools/spawn-tuner/prep/jobs.json tools/spawn-tuner/prep/tex-ladder.json engine/client/data/types.json)
commit_data() {
  local tree=$1
  for file in "${DATA[@]}"; do [[ ! -f $tree/$file ]] || git -C "$tree" add -- "$file"; done
  if ! git -C "$tree" diff --cached --quiet; then
    git -C "$tree" commit -m "Faction batch step $STEP: rebuild accepted asset data" -m 'Co-Authored-By: Codex <noreply@openai.com>'
  fi
}
commit_data "$W"
echo "PREFLIGHT GREEN: $BRANCH; evidence $LOG"
[[ ${STAGE:-land} != preflight ]] || exit 0
# Nothing in main has changed yet. Re-check it immediately before the sole fast-forward.
[[ $(git -C "$M" rev-parse HEAD) == "$BASE" && -z $(git -C "$M" status --porcelain --untracked-files=no) ]]
git -C "$M" merge --ff-only "$BRANCH"
# Copy only accepted batch sources and new runtime files, never erase older assets.
python3 - "$W" "$M" "$STEP" <<'PY'
import csv,json,pathlib,shutil,sys
w,m=map(pathlib.Path,sys.argv[1:3]);step=sys.argv[3];t=pathlib.Path('tools/spawn-tuner')
lib=json.load(open(w/t/'data/library.json'))
batch=pathlib.Path('experiments/2026-10-13-factions')
for row in csv.DictReader(open(w/'catalog/runs/factions-01/manifest.tsv'),delimiter='\t'):
    stem=row.get('source') or row['sku']
    for rel in [batch/'models'/f'{stem}.glb', batch/'inputs'/f'{stem}.png']:
        (m/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(w/rel,m/rel)
    for folder in ['models-ungraded','models-graded']:
        original=batch/folder/f'{stem}.glb'
        if (w/original).exists():
            (m/original).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(w/original,m/original)
    if row['sku']=='flavor-corbel--spiders-fct':
        icon=batch/'icons/spiders.png';(m/icon).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(w/icon,m/icon)
flat_manifest=w/batch/'integration/accepted-flats.json'
for row in json.loads(flat_manifest.read_text()) if flat_manifest.exists() else []:
    rel=batch/row['path'];(m/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(w/rel,m/rel)
for obj in lib['objects'].values():
    for s in obj['skus']:
        if s['src'] not in ['factions-01','factions-flats-01']:continue
        rels=[t/s['url']]
        if s['kind']=='mesh':
            rels += [q.relative_to(w) for sub,ext in [('assets/lod','glb'),('assets/tex','webp')] for q in (w/t/sub).glob(f"*/{s['sku']}.{ext}")]
            rels += [t/'prep/tex-src'/f"{s['sku']}.png", t/'assets/m'/f"{s['sku']}.glb.owner"]
        for rel in rels:
            (m/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(w/rel,m/rel)
if step=='3':
    for f in (w/batch/'icons').glob('*.png'):
        dest=m/batch/'icons'/f.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
for f in (w/t/'assets/emblems').glob('*.webp') if step=='3' and (w/t/'assets/emblems').exists() else []:
    dest=m/t/'assets/emblems'/f.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
PY
rebuild "$M" > "$LOG/main-build.log" 2>&1
commit_data "$M"
(cd "$M"; "$LIMIT" python3 tools/spawn-tuner/prep/delivery.py) > "$LOG/main-delivery.log" 2>&1
(cd "$M"; python3 tools/spawn-tuner/test/assets_check.py --quiet; tools/spawn-tuner/deploy.sh) > "$LOG/tuner-deploy.log" 2>&1
(cd "$M"; engine/deploy.sh --no-relay) > "$LOG/client-deploy.log" 2>&1
commit_data "$M"
git -C "$M" push origin main
printf 'LANDED step %s; release lock, then run integration/verify_live.sh and live room captures. Logs: %s\n' "$STEP" "$LOG"
