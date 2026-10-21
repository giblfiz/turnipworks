#!/usr/bin/env bash
# Gates only. Run in prepared temporary branch in Task C worktree, under landing lock.
# BASELINE is an immutable tuner tree built from fetched origin/main. Step 1 can
# permit exactly the named corbel-room recipe differences; steps 2 and 3 permit none.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  echo "usage: $0 BASELINE_TUNER [reviewed-recipe-json]"
  echo "Mutates generated data in this worktree; runs preflight gates, never main/deploy."
  exit 0
fi
BASELINE=${1:?baseline tuner tree required}
[[ -d $BASELINE && -f $BASELINE/data/library.json ]] || { echo "Baseline tuner directory absent/incomplete: $BASELINE" >&2; exit 64; }
REVIEWED=${2:-}
GOLDEN_ARGS=()
if [[ -n $REVIEWED ]]; then [[ -f $REVIEWED ]] || exit 64; GOLDEN_ARGS=("--accept-recipes=$REVIEWED"); fi
cd "$ROOT"
[[ $(pwd) != $TW_REPO ]] || { echo 'Run preflight in Task C worktree, never main'; exit 1; }
python3 tools/tool-sweep/sku_guard.py
cd tools/spawn-tuner
python3 build_data.py
python3 prep/flats.py
python3 build_data.py
python3 test/assets_check.py --quiet
LIMIT=/tmp/scratch/tw-slot
"$LIMIT" node test/golden.mjs "$BASELINE" "$PWD" "${GOLDEN_ARGS[@]}"
"$LIMIT" node test/tem.test.mjs "$PWD"
"$LIMIT" node test/cult.test.mjs "$PWD"
cd "$ROOT/engine"
"$LIMIT" npm test
