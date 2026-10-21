#!/usr/bin/env bash
# The real-mesh data pass for run cult-01, from tools/spawn-tuner of the tree it is run in (worktree or main):
# runtime GLBs -> build_data -> ladder -> ladder textures -> flats -> build_data. Heavy steps go through the shared limiter.
set -u
T=$(cd "$(dirname "$0")/../../../../tools/spawn-tuner" && pwd); cd "$T"; SLOT=${TW_SLOT:-/tmp/scratch/tw-slot}
python3 build_data.py > /dev/null && python3 prep/ccm_prep.py cult-01 jobs
$SLOT blender --background --python prep/blender_runtime.py -- prep/jobs-cult01.json 0 1 prep/results-cult01.jsonl > prep/runtime-cult01-0.log 2>&1
python3 build_data.py > /dev/null
$SLOT blender --background --python prep/blender_lod.py -- prep/jobs-cult01.json 0 1 prep/lod-cult01.jsonl > prep/lod-cult01-0.log 2>&1
$SLOT python3 prep/lod_tex.py > prep/lodtex-cult01.log 2>&1
$SLOT python3 prep/flats.py > prep/flats-cult01.log 2>&1
python3 build_data.py | tail -12
python3 prep/ccm_prep.py cult-01 check
echo PREP-DONE
