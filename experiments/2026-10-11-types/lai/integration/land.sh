#!/bin/bash
# land.sh : the whole landing of type-lai, run UNDER  flock /tmp/tw-main.lock  (docs/STATUS.md working rules; the
# coordinator's rule of 2026-10-12: main is not touched until everything is green).
#   1. in THIS worktree: fetch, merge origin/main (never the local main ref) into type-lai. It must merge clean: bring
#      origin/main in by hand BEFORE taking the lock (catalog lines: take main's, run tools/add_set.py; code: apply.py).
#   2. tests on the merged result HERE: a sandbox built from this worktree against the main tree's shared binaries
#      (sandbox/land), the golden test against origin/main's own tuner (sandbox/pristine), the engine's core test with the
#      sandbox's data. Any failure stops the script: main was never touched.
#   3. only then: main is fast-forwarded to type-lai, binaries copied, the library built in the main tree, the gates run
#      there, the generated data committed, both deploys, push.
# The live verification comes AFTER the lock is released.
set -euo pipefail
M=$TW_REPO; WT=$TW_REPO; D=experiments/2026-10-11-types/lai; T=$M/tools/spawn-tuner; I=$WT/$D/integration
say() { echo "=== $(date +%H:%M:%S) $*"; }
passes() { echo "$1: $2"; echo "$2" | grep -Eq "$3" || { echo "FAILED: $1 (main is untouched)"; exit 1; }; }
cd $WT
say "1. fetch; origin/main into type-lai (in this worktree)"
git fetch -q origin
[ -z "$(git status --short | grep -v '^??' | grep -v "$D/")" ] || { echo "this worktree has uncommitted changes outside $D: commit them first"; git status --short | grep -v '^??' | head; exit 1; }
git merge --no-edit origin/main || { git merge --abort; echo "origin/main does not merge clean into type-lai: merge it by hand before taking the lock"; exit 1; }
[ "$(git -C $M rev-parse main)" = "$(git rev-parse origin/main)" ] || { echo "the main tree's local main is not origin/main: another landing is half done; not landing"; exit 1; }
python3 $I/apply.py --tree tools/spawn-tuner --check | grep -v unchanged && { echo "apply.py would change the merged tree: apply and commit before landing"; exit 1; } || true
say "2. tests on the merged result, in this worktree"
git -C $M stash list > /dev/null
python3 $I/make_sandbox.py pristine --pristine > /dev/null
python3 $I/make_sandbox.py land > $I/land-sandbox.log 2>&1 || { tail -5 $I/land-sandbox.log; echo "FAILED: sandbox build (main is untouched)"; exit 1; }
S=$I/sandbox/land
python3 - <<P
import json
o='$S/data/orient.json'; x=json.load(open(o)); x.update(json.load(open('$I/keep/orient-lai.json'))); json.dump(x,open(o,'w'),indent=1)
P
passes lai "$(node tools/spawn-tuner/test/lai.test.mjs $S 2>&1 | tail -1)" " 0 failures"
# golden: no room type of ANOTHER kind may differ (a lair room this landing changes on purpose is named and allowed)
g=$(node tools/spawn-tuner/test/golden.mjs $I/sandbox/pristine $S 2>&1 | grep -i "differ" || true); echo "golden: $g"
echo "$g" | grep -q "^golden: .* differ" || { echo "FAILED: golden did not run (main is untouched)"; exit 1; }
if echo "$g" | grep "^  [a-z]" | grep -vq "^  lair-"; then echo "FAILED: golden: a room type that is not the lair's differs (main is untouched)"; exit 1; fi
for t in solver2 dun min crypt; do passes $t "$(cd $S && node test/$t.test.mjs $S 2>&1 | tail -1 | cut -c1-120)" "0 failures"; done
passes wall_items "$(cd $S && node test/wall_items.test.mjs 2>&1 | head -1)" ", 0 on the floor"
passes logcabin "$(cd $S && node test/logcabin.test.mjs 2>&1 | tail -1)" " 0 failed"
passes buildings "$(cd $S && node test/buildings.test.mjs 4 --code=LAI 2>&1 | grep 'plans keep')" "plans keep every rule \((9[0-9]|100)"
# the engine's core test reads the tuner's data through engine/tuner-data: give it the sandbox's for the run, then put the worktree's back
[ -e engine/node_modules ] || ln -s $M/engine/node_modules engine/node_modules
for f in library rooms orient; do cp tools/spawn-tuner/data/$f.json $I/keep/.wt-$f.json; cp $S/data/$f.json tools/spawn-tuner/data/$f.json; done
r=$(cd engine && node test/core.test.mjs 2>&1 | tail -1) || true
for f in library rooms orient; do cp $I/keep/.wt-$f.json tools/spawn-tuner/data/$f.json; rm $I/keep/.wt-$f.json; done
passes core "$r" "^core: ([0-9]+)/\1 passed"
say "3. green: fast-forward main, binaries, data"
cd $M
git merge --ff-only type-lai || { echo "main cannot be fast-forwarded to type-lai (dirty files in the way?): nothing landed"; exit 1; }
mkdir -p $M/$D/models $M/$D/flats/decals $T/prep/tex-src
rsync -a $WT/$D/models/ $M/$D/models/; rsync -a $WT/$D/flats/decals/ $M/$D/flats/decals/
cp $WT/$D/flats/icons/room-lair-*.png $M/engine/client/data/icons/
cp $I/sandbox/real/prep/tex-src/*.png $T/prep/tex-src/ 2>/dev/null || true
python3 - <<P
import json,os
a='$T/prep/tex-ladder.json'; b='$I/keep/tex-ladder-lai.json'
if os.path.exists(a) and os.path.exists(b): x=json.load(open(a)); x.update(json.load(open(b))); json.dump(x,open(a,'w')); print('tex-ladder keys',len(x))
a='$T/data/orient.json'; x=json.load(open(a)); n=len(x); x.update(json.load(open('$I/keep/orient-lai.json'))); json.dump(x,open(a,'w'),indent=1); print('orient keys',n,'->',len(x))
P
cd $T; python3 build_data.py > $I/land-bd1.log 2>&1; python3 prep/flats.py > $I/land-flats.log 2>&1; python3 build_data.py > $I/land-bd2.log 2>&1
grep -i "lair:\|NOT replaced" $I/land-bd2.log || true; grep "  lair-" $I/land-bd2.log | cut -c1-110
python3 prep/fire_anchors.py > $I/land-fire.log 2>&1 || { echo "fire_anchors failed"; tail -3 $I/land-fire.log; exit 1; }
python3 prep/ccm_prep.py lai-01 check
python3 prep/delivery.py > $I/land-delivery.log 2>&1 || { echo "delivery.py failed"; tail -5 $I/land-delivery.log; exit 1; }
python3 test/assets_check.py --quiet || { echo "assets_check failed"; python3 test/assets_check.py | tail -8; exit 1; }
passes "lai (main tree)" "$(node test/lai.test.mjs $T 2>&1 | tail -1)" " 0 failures"
g=$(node test/golden.mjs $I/sandbox/pristine $T 2>&1 | grep -i "differ" || true); echo "golden (main tree): $g"
if echo "$g" | grep "^  [a-z]" | grep -vq "^  lair-"; then echo "FAILED: golden on the main tree: a room type that is not the lair's differs"; exit 1; fi
say "commit the generated data"
cd $M; git add tools/spawn-tuner/data/library.json tools/spawn-tuner/data/rooms.json tools/spawn-tuner/data/orient.json tools/spawn-tuner/data/fire_anchors.json tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/flats-out.json tools/spawn-tuner/prep/jobs.json
git ls-files --error-unmatch tools/spawn-tuner/prep/tex-ladder.json > /dev/null 2>&1 && git add tools/spawn-tuner/prep/tex-ladder.json
git commit -q -m "Monster lair type: library, rooms and flats data (lai-01, lai-flats-01)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" || echo "(nothing to commit)"
say "deploy: tuner, then the game (no relay restart of its own)"
tools/spawn-tuner/deploy.sh > $I/land-deploy-tuner.log 2>&1 || { echo "tuner deploy failed"; tail -5 $I/land-deploy-tuner.log; exit 1; }
tail -6 $I/land-deploy-tuner.log | cut -c1-200
engine/deploy.sh --no-relay > $I/land-deploy-engine.log 2>&1 || { echo "engine deploy failed"; tail -5 $I/land-deploy-engine.log; exit 1; }
tail -4 $I/land-deploy-engine.log | cut -c1-200
say "push"
GH_CONFIG_DIR=$HOME/.config/gh git push origin main 2>&1 | tail -1
say "LANDED (now, outside the lock: assets_check.py --live, tool-sweep check, live room shots, the game check)"
