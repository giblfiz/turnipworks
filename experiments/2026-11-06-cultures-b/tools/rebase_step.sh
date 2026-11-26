#!/usr/bin/env bash
# One stopped rebase step: union-resolve, rebuild the generated data for THIS commit's tree, stage, continue.
set -euo pipefail
W=$(cd "$(dirname "$0")/../../.." && pwd); cd "$W"
python3 experiments/2026-11-06-cultures-b/tools/rebase_resolve.py | tail -2
python3 engine/tools/build_types.py > /dev/null
(cd tools/spawn-tuner && python3 build_data.py | tail -1)
git checkout -q tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/jobs.json 2>/dev/null || true
git add engine/tools/build_types.py engine/client/data/types.json tools/spawn-tuner/data
GIT_EDITOR=true git rebase --continue 2>&1 | tail -2
