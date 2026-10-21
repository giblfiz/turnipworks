#!/usr/bin/env bash
# Land the market type on main, under the shared lock:   flock /tmp/tw-main.lock tools/land.sh [--no-deploy]
# merge -> binaries and icons across -> catalog -> build_data / flats / build_data -> ladder list -> fire anchors ->
# gate, type test, golden (against main as it stood), core test -> commit the generated data -> deploy both -> checks.
# Stops at the first failure with the main tree as far as it got (a merge is committed only after the tests pass).
set -euo pipefail
WT=$TW_REPO; MAIN=$TW_REPO; MKT=experiments/2026-10-11-types/mkt; T=tools/spawn-tuner
exec > >(tee -a $WT/$MKT/land.log) 2>&1; echo "=== $(date -Is) land"
cd $MAIN
test -z "$(git log --oneline type-mkt..main | head -1)" || { echo "main has moved: run tools/merge_main.sh in the worktree first"; exit 3; }
python3 $WT/$MKT/integration/make_sandbox_mkt.py pristine --pristine | tail -1     # the golden reference: main as it stands
# (an earlier attempt copied this folder across: its tracked files would be "untracked files in the way" of the merge)
for f in $(git ls-tree -r --name-only type-mkt -- $MKT catalog/runs/mkt-01); do if [[ -f $f ]] && ! git ls-files --error-unmatch "$f" >/dev/null 2>&1; then rm -f "$f"; fi; done
git merge --no-commit --no-ff type-mkt
MERGING=1; trap 'if [[ ${MERGING:-0} == 1 ]]; then echo "FAILED mid-merge: putting main back"; git merge --abort 2>/dev/null || git reset --merge; git checkout -- tools/spawn-tuner/data tools/spawn-tuner/prep catalog 2>/dev/null; git status --short | grep -v "^??" | head -5; fi' ERR
rsync -a --ignore-existing $WT/$MKT/ $MAIN/$MKT/ --exclude integration/sandbox --exclude work --exclude 'shots-*'
cp $WT/$MKT/icons/room-mkt-*.png engine/client/data/icons/
python3 src/catalog_tool.py | grep -E "WARN|ERROR" | head -5 || true
python3 $T/build_data.py | grep -E "market:|mkt-|NOT LISTED|objects " | cut -c1-200
(cd $T && python3 prep/flats.py | tail -1); python3 $T/build_data.py | grep -E "NOT LISTED|objects " | cut -c1-200
rsync -a --ignore-existing $WT/$T/prep/tex-src/ $T/prep/tex-src/   # the ladder's colour maps were made in the worktree (git-ignored)
(cd $T && python3 prep/lod_tex.py | tail -1)
(cd $T && python3 prep/fire_anchors.py | tail -2); git diff --stat $T/data/fire_anchors.json | tail -1
python3 $T/prep/delivery.py | tail -2   # the delivered copies (deploy.sh runs it too; the gate below wants them listed)
python3 $T/test/assets_check.py | tail -2
node $T/test/mkt.test.mjs $T | tail -1
node $T/test/golden.mjs $WT/$MKT/integration/sandbox/pristine $T | tail -1 | tee /tmp/scratch/mkt-golden.txt; grep -q " 0 differ" /tmp/scratch/mkt-golden.txt
node engine/test/core.test.mjs | tail -2
git add -A catalog $T/data $T/prep/flats.json $T/prep/flats-out.json $T/prep/jobs.json $T/prep/tex-ladder.json engine/client/data/types.json 2>/dev/null || true
git commit -q -m "Merge branch 'type-mkt': Market & village (twelve rooms, the shop skeleton, 61 meshes); the library and rooms.json with mkt-01

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>"
MERGING=0; git log --oneline | head -1
[[ ${1:-} == --no-deploy ]] && { echo "merged, not deployed"; exit 0; }
lane-post "Turnip Works: Market & village type merged to main; deploying tuner + game client from the main tree now (tw-relay restarts once)" --model claude-opus-5-5 >/dev/null 2>&1 || true
$T/deploy.sh 2>&1 | tail -12 | cut -c1-220
engine/deploy.sh --no-relay 2>&1 | tail -8 | cut -c1-220
python3 $T/test/assets_check.py --live | tail -2
python3 tools/tool-sweep/check.py | tail -3 | cut -c1-300
echo "=== $(date -Is) landed"
