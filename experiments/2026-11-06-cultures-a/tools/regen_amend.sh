#!/usr/bin/env bash
# Rebuild the generated files of the commit at HEAD from its own sources and amend it (used to replay the culture
# commits onto main after a link farm missed new binaries: a library built without a batch's GLBs drops its skus).
#   experiments/2026-11-06-cultures-a/tools/regen_amend.sh jpn [chn ind]
set -euo pipefail
W=$(cd "$(dirname "$0")/../../.." && pwd); cd "$W"
python3 src/catalog_tool.py > /dev/null 2>&1 || true
(cd tools/spawn-tuner && python3 build_data.py > /dev/null)
(cd engine && node tools/library_spawns.mjs --jobs 4 | tail -1)
git checkout -- tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/jobs.json
git add catalog/out engine/client/data/types.json engine/client/data/library-spawns.json tools/spawn-tuner/data
git commit -q --amend --no-edit
git log --oneline -1
