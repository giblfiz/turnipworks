#!/bin/bash
# land.sh : the landing of type-hut on main, run as  flock /tmp/tw-main.lock integration/land.sh  (docs/STATUS.md working rules).
# Stops at the first failure and says where; nothing is forced. Stages: pristine copy, merge, binaries, data, tests, commit, deploy, push.
# The live checks (assets_check --live, live shots, the game) are run AFTER the lock is released: integration/after_land.sh
set -euo pipefail
M=$TW_REPO; WT=$TW_REPO; D=experiments/2026-10-11-types/hut; T=$M/tools/spawn-tuner; I=$WT/$D/integration; P=$I/sandbox/pristine
say() { echo "=== $(date +%H:%M:%S) $*"; }
cd $M
if ! git merge-base --is-ancestor type-hut HEAD; then
  say "pristine copy of main's tuner (the golden reference), then the merge"
  # (the reference is main REBUILT from what is on its disk: another batch's models may be there ahead of its committed library.json, and that drift is not ours)
  (cd $T && python3 build_data.py > $I/land-bd0.log 2>&1)
  rm -rf $P; mkdir -p $P; cp -r $T/js $T/data $P/; mkdir -p $P/test; cp $T/test/*.mjs $P/test/
  git checkout tools/spawn-tuner/data/library.json tools/spawn-tuner/data/rooms.json tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/jobs.json 2>/dev/null || true
  git merge --no-ff type-hut -m "Merge branch 'type-hut': the Farmstead type (sixteen rooms, the wattle-daub family, hut-01)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" > $I/land-merge.log 2>&1 || { echo "MERGE CONFLICT: main moved. git merge --abort here, merge main into type-hut in the worktree (integration/remerge.sh), then run again"; git merge --abort; exit 1; }
fi
say "binaries: models, the furrow ground, icons (git-ignored) into main's tree"
mkdir -p $M/$D/models $M/$D/flats/seamless
rsync -a $WT/$D/models/ $M/$D/models/; rsync -a $WT/$D/flats/seamless/ $M/$D/flats/seamless/
cp $WT/$D/flats/icons/room-hut-*.png $M/engine/client/data/icons/
say "data: build_data, flats, build_data, the front decisions, delivery"
cd $T; python3 build_data.py > $I/land-bd1.log 2>&1; python3 prep/flats.py > $I/land-flats.log 2>&1; python3 build_data.py > $I/land-bd2.log 2>&1
grep -i "farmstead:\|NOT replaced" $I/land-bd2.log || true; grep "  hut-" $I/land-bd2.log | cut -c1-100
python3 prep/lod_tex.py > $I/land-lodtex.log 2>&1
python3 $I/orient_merge.py $T
python3 prep/ccm_prep.py hut-01 check
python3 prep/delivery.py > $I/land-delivery.log 2>&1 || { echo "delivery.py failed"; tail -5 $I/land-delivery.log; exit 1; }
python3 test/assets_check.py --quiet || { echo "assets_check failed"; python3 test/assets_check.py | tail -8; exit 1; }
say "tests on the real tree"
r=$(node test/hut.test.mjs $T 2>&1 | tail -1); echo "$r"; echo "$r" | grep -q " 0 failures"
node test/golden.mjs $P $T > $I/land-golden.log 2>&1 || true; tail -1 $I/land-golden.log | cut -c1-200; grep -q " 0 differ" $I/land-golden.log || { echo "GOLDEN DIFFERS: not deploying"; exit 1; }
r=$(node test/solver2.test.mjs $T 2>&1 | tail -1 | cut -c1-120); echo "solver2: $r"; echo "$r" | grep -q "0 failures"   # (the other types' suites are covered by the golden test: their rooms are unchanged scene for scene)
r=$(node test/buildings.test.mjs 20 --code=HUT 2>&1 | grep "plans keep"); echo "$r"; echo "$r" | grep -q "100.0%"
cd $M/engine; r=$(node test/core.test.mjs 2>&1 | tail -1); echo "$r"; echo "$r" | grep -Eq "^core: ([0-9]+)/\1 passed"
say "docs and the generated data: commit"
cd $M; python3 $I/docs_patch.py
python3 src/catalog_tool.py > $I/land-catalog.log 2>&1 || true
git add docs/STATUS.md docs/ASSETS_TO_BUILD.md catalog/out tools/spawn-tuner/data/library.json tools/spawn-tuner/data/rooms.json tools/spawn-tuner/data/orient.json tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/flats-out.json tools/spawn-tuner/prep/jobs.json tools/spawn-tuner/prep/tex-ladder.json
git commit -q -m "Farmstead type: library, rooms and flats data (hut-01, hut-flats-01); STATUS, ASSETS_TO_BUILD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" || echo "(nothing to commit)"
say "deploy: tuner, then the game (no relay restart of its own)"
tools/spawn-tuner/deploy.sh > $I/land-deploy-tuner.log 2>&1 || { echo "tuner deploy failed"; tail -5 $I/land-deploy-tuner.log; exit 1; }
tail -3 $I/land-deploy-tuner.log | cut -c1-200
engine/deploy.sh --no-relay > $I/land-deploy-engine.log 2>&1 || { echo "engine deploy failed"; tail -5 $I/land-deploy-engine.log; exit 1; }
tail -3 $I/land-deploy-engine.log | cut -c1-200
git status --short | grep -v "^??" | head -8 || true
say "push"
GH_CONFIG_DIR=$HOME/.config/gh git push origin main 2>&1 | tail -1
say "LANDED (now, outside the lock: integration/after_land.sh)"
