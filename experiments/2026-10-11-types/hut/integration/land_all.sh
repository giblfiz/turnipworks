#!/bin/bash
# land_all.sh : run as   flock /tmp/tw-main.lock experiments/2026-10-11-types/hut/integration/land_all.sh
# Phase A (worktree): bring type-hut up to main as it is NOW (nobody else lands while the lock is held), blocks put back.
# Phase B (main): integration/land.sh (merge, binaries, data, tests, commit, deploy, push).
set -euo pipefail
WT=$TW_REPO; I=$WT/experiments/2026-10-11-types/hut/integration
cd $WT
echo "=== $(date +%H:%M:%S) phase A: type-hut up to main"
git checkout tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/jobs.json reviews/latest.json 2>/dev/null || true
if ! git merge-base --is-ancestor main HEAD; then
  git merge main -m "Merge main into type-hut (landing)" > $I/land-a-merge.log 2>&1 || {
    $I/remerge.sh > $I/land-a-remerge.log 2>&1
    python3 $I/orient_merge.py > /dev/null
    node -e "await import('$WT/tools/spawn-tuner/js/solver2.js'); await import('$WT/tools/spawn-tuner/js/walls.js'); await import('$WT/engine/client/pack.js')" --input-type=module
    git add -A catalog engine/client/pack.js engine/test/browser_build.py engine/test/core.test.mjs experiments/2026-10-11-types/hut tools/spawn-tuner/ROOMS.md tools/spawn-tuner/build_data.py tools/spawn-tuner/data tools/spawn-tuner/index.html tools/spawn-tuner/js tools/spawn-tuner/prep/tex-ladder.json tools/spawn-tuner/prep/flats-out.json tools/spawn-tuner/prep/orient_ccm.py tools/spawn-tuner/buildings tools/spawn-tuner/test docs 2>/dev/null
    if git status --short | grep -q "^UU\|^AA\|^DU\|^UD"; then echo "UNRESOLVED after remerge:"; git status --short | grep "^UU\|^AA\|^DU\|^UD"; exit 1; fi
    git commit -q -m "Merge main into type-hut (landing); farmstead blocks put back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>"
  }
fi
git status --short | grep -v "^??" | head -5 || true
git log --oneline -1 | cut -c1-90
exec $I/land.sh
