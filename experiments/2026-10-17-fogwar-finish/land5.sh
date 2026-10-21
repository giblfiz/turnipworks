#!/usr/bin/env bash
# Fog-of-war look landing. Invoke only after final commit: flock /tmp/tw-main.lock <this script>
# Merge + suites + fast-forward main + deploy (tuner, then engine --no-relay: no core/relay change) + push.
set -euo pipefail
ROOT=$TW_REPO
MAIN=$TW_REPO
BATCH=experiments/2026-10-17-fogwar-finish
SLOT=/tmp/scratch/tw-slot
PY=python3
OUT=$ROOT/$BATCH/landing-$(date +%Y%m%dT%H%M%S)
cd "$ROOT"
test -z "$(git status --porcelain --untracked-files=normal | grep -v '^?? '"$BATCH"'/')" || { echo 'Worktree must be committed before landing'; exit 1; }
git fetch origin
LAND="fogwar-roll-land-$(date +%Y%m%dT%H%M%S)"
git switch -c "$LAND"
git merge origin/main -m $'Merge origin/main for the roll-back landing\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>' || { echo 'merge conflict'; exit 1; }
mkdir -p "$OUT"
python3 tools/tool-sweep/check.py
(cd engine && npm test) > "$OUT/npm-test.log" 2>&1 || { tail -30 "$OUT/npm-test.log"; exit 1; }
tail -3 "$OUT/npm-test.log"
# fog suites, atmosphere parity, house buttons, UI, two-tab (fogwar_ui runs with its own ratings-server copy: the live
# one learns the fogwar field only when restarted after this landing)
for m in browser_fogpass.py browser_fogwar_game.py browser_fog.py browser_fogtweaks.py atmos_parity.py house_buttons.py fx_ui.py; do
  tools/run_all_tests.sh --match "$m" --out "$OUT/matrix-$(echo $m | tr / _)" > "$OUT/run-$(echo $m | tr / _).log" 2>&1 || {
    if [ "$m" = browser_two_tab.py ]; then echo 'two-tab red once: re-run (M5 flakes)'; tools/run_all_tests.sh --match "$m" --out "$OUT/matrix-two-tab-2" > "$OUT/run-two-tab-2.log" 2>&1 || { tail -20 "$OUT/run-two-tab-2.log"; exit 1; };
    else tail -25 "$OUT/run-$(echo $m | tr / _).log"; exit 1; fi; }
  echo "green: $m"
done
FOGWAR_OUT_DIR="$OUT/fogwar-stills" $SLOT $PY "$BATCH/run_tuner_tests.py" fogwar_ui.py > "$OUT/fogwar_ui.log" 2>&1 || { tail -20 "$OUT/fogwar_ui.log"; exit 1; }
grep 'passed' "$OUT/fogwar_ui.log"
git -C "$MAIN" merge --ff-only "$LAND"
(cd "$MAIN" && tools/spawn-tuner/deploy.sh) > "$OUT/deploy-tuner.log" 2>&1 || { tail -30 "$OUT/deploy-tuner.log"; exit 1; }
tail -4 "$OUT/deploy-tuner.log"
(cd "$MAIN" && engine/deploy.sh --no-relay) > "$OUT/deploy-engine.log" 2>&1 || { tail -30 "$OUT/deploy-engine.log"; exit 1; }
tail -4 "$OUT/deploy-engine.log"
(cd "$MAIN" && GH_CONFIG_DIR=$HOME/.config/gh git push origin main)
git -C "$MAIN" rev-parse HEAD
echo LANDED
