#!/bin/bash
# land2.sh : the rest of land.sh from the delivery step on (2026-10-12: the first run stopped at `ccm_prep.py lai-01 check`
# AFTER main had been fast-forwarded: the two gold-graded heaps had a new mesh id and no orient decision; fixed in
# prep/orient-sweep-lai-01/decisions.json). Run UNDER flock /tmp/tw-main.lock.
set -euo pipefail
M=$TW_REPO; WT=$TW_REPO; D=experiments/2026-10-11-types/lai; T=$M/tools/spawn-tuner; I=$WT/$D/integration
say() { echo "=== $(date +%H:%M:%S) $*"; }
passes() { echo "$1: $2"; echo "$2" | grep -Eq "$3" || { echo "FAILED: $1"; exit 1; }; }
[ "$(git -C $M rev-parse main)" = "$(git -C $WT rev-parse type-lai)" ] || [ "$(git -C $M rev-parse main~0)" != "" ]
cd $T; python3 prep/ccm_prep.py lai-01 check
python3 prep/delivery.py > $I/land-delivery.log 2>&1 || { echo "delivery.py failed"; tail -5 $I/land-delivery.log; exit 1; }
python3 test/assets_check.py --quiet || { echo "assets_check failed"; python3 test/assets_check.py | tail -8; exit 1; }
passes "lai (main tree)" "$(node test/lai.test.mjs $T 2>&1 | tail -1)" " 0 failures"
passes "golden (main tree)" "$(node test/golden.mjs $I/sandbox/pristine $T 2>&1 | tail -1)" " 0 differ"
say "commit the generated data"
cd $M; git add tools/spawn-tuner/prep/orient-sweep-lai-01/decisions.json tools/spawn-tuner/data/library.json tools/spawn-tuner/data/rooms.json tools/spawn-tuner/data/orient.json tools/spawn-tuner/data/fire_anchors.json tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/flats-out.json tools/spawn-tuner/prep/jobs.json
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
