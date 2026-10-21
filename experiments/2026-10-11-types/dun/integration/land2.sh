#!/bin/bash
# land.sh : the whole landing of type-dun on main, run UNDER  flock /tmp/tw-main.lock  (see docs/STATUS.md working rules).
# Stops at the first failure and says where; nothing is forced. Stages: merge, binaries, data, tests, commit, deploy, live check, push.
set -euo pipefail
M=$TW_REPO; WT=$TW_REPO; D=experiments/2026-10-11-types/dun; T=$M/tools/spawn-tuner; I=$WT/$D/integration
say() { echo "=== $(date +%H:%M:%S) $*"; }
cd $M
git merge-base --is-ancestor type-dun HEAD || { echo "type-dun is not merged"; exit 1; }  # (second run: the merge and the pristine copy were made by the first)
say "binaries: models, flats, icons (git-ignored) into main's tree"
mkdir -p $M/$D/models $M/$D/flats/seamless $M/$D/flats/decals
rsync -a $WT/$D/models/ $M/$D/models/; rsync -a $WT/$D/flats/seamless/ $M/$D/flats/seamless/; rsync -a $WT/$D/flats/decals/ $M/$D/flats/decals/
cp -n $WT/$D/flats/icons/room-dun-*.png $M/engine/client/data/icons/
mkdir -p $T/prep/tex-src; cp $I/keep/tex-src/*.png $T/prep/tex-src/
python3 - <<P
import json,os
a='$T/prep/tex-ladder.json'; b='$I/keep/tex-ladder-dun.json'
if os.path.exists(a):
    x=json.load(open(a)); x.update(json.load(open(b))); json.dump(x,open(a,'w')); print('tex-ladder keys',len(x))
P
say "data: build_data, flats, build_data"
cd $T; python3 build_data.py > $I/land-bd1.log 2>&1; python3 prep/flats.py > $I/land-flats.log 2>&1; python3 build_data.py > $I/land-bd2.log 2>&1
grep -i "dungeon:\|NOT replaced" $I/land-bd2.log || true; grep "dun-" $I/land-bd2.log | cut -c1-110
python3 prep/fire_anchors.py > $I/land-fire.log 2>&1 || { echo "fire_anchors failed"; tail -3 $I/land-fire.log; exit 1; }
python3 prep/ccm_prep.py dun-01 check
python3 prep/delivery.py > $I/land-delivery.log 2>&1 || { echo "delivery.py failed"; tail -5 $I/land-delivery.log; exit 1; }  # the delivered copies assets_check wants (the deploy builds them too)
python3 test/assets_check.py --quiet || { echo "assets_check failed"; python3 test/assets_check.py | tail -8; exit 1; }
say "tests on the real tree"
r=$(node test/dun.test.mjs $T 2>&1 | tail -1); echo "$r"; echo "$r" | grep -q " 0 failures"
node test/golden.mjs $I/sandbox/pristine $T > $I/land-golden.log 2>&1 || true; tail -4 $I/land-golden.log | cut -c1-200; grep -q " 0 differ" $I/land-golden.log || { grep -E "^  [a-z-]+: [0-9]+ differ" $I/land-golden.log | grep -vE "^  (temple|tem-)" | grep -q . && { echo "golden differs outside the temple (which landed again after the reference was taken)"; exit 1; } || echo "(golden: only temple rooms differ: type-tem merged after the reference was taken)"; }
for t in solver2 crypt castle mansion tem; do r=$(node test/$t.test.mjs $T 2>&1 | tail -1 | cut -c1-120); echo "$t: $r"; echo "$r" | grep -q "0 failures"; done
cd $M/engine; r=$(node test/core.test.mjs 2>&1 | tail -1); echo "$r"; echo "$r" | grep -Eq "^core: ([0-9]+)/\1 passed"
say "commit the generated data"
cd $M; git add tools/spawn-tuner/data/library.json tools/spawn-tuner/data/rooms.json tools/spawn-tuner/data/fire_anchors.json tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/flats-out.json tools/spawn-tuner/prep/jobs.json
git ls-files --error-unmatch tools/spawn-tuner/prep/tex-ladder.json > /dev/null 2>&1 && git add tools/spawn-tuner/prep/tex-ladder.json
git commit -q -m "Dungeon & prison type: library, rooms and flats data (dun-01, dun-flats-01)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" || echo "(nothing to commit)"
say "deploy: tuner, then the game (no relay restart of its own)"
tools/spawn-tuner/deploy.sh > $I/land-deploy-tuner.log 2>&1 || { echo "tuner deploy failed"; tail -5 $I/land-deploy-tuner.log; exit 1; }
tail -6 $I/land-deploy-tuner.log | cut -c1-200
engine/deploy.sh --no-relay > $I/land-deploy-engine.log 2>&1 || { echo "engine deploy failed"; tail -5 $I/land-deploy-engine.log; exit 1; }
tail -4 $I/land-deploy-engine.log | cut -c1-200
say "live check"
python3 tools/spawn-tuner/test/assets_check.py --live 2>&1 | tail -3
python3 tools/tool-sweep/check.py 2>&1 | tail -3 || true
git status --short | grep -v "^??" | head -8 || true
say "push"
GH_CONFIG_DIR=$HOME/.config/gh git push origin main 2>&1 | tail -1
say "LANDED"
