#!/bin/bash
# chain-min.sh [from-step] : in sandbox/real (make_sandbox.py real --real), everything between "meshes accepted, manifest
# written" and "room shots": runtime GLBs (written through the assets symlink into the main tree's shared assets folder:
# new files only), bounds into the library, the faces x skins ladder, flats, the library again, the front-sweep views and
# sheets. Heavy steps go through the shared limiter. Modelled on the dungeon batch's chain-dun.sh.
SLOT=/tmp/scratch/tw-slot
H=$(dirname "$(realpath "$0")"); cd "$H/sandbox/real" || exit 1
set -x
python3 build_data.py > prep/chain-bd0.log 2>&1 || exit 1
python3 prep/ccm_prep.py min-01 jobs
$SLOT bash -c 'for w in 0 1 2; do blender --background --python prep/blender_runtime.py -- prep/jobs-min01.json $w 3 prep/results-min01.jsonl > prep/runtime-min01-$w.log 2>&1 & done; wait'
python3 build_data.py > prep/chain-bd1.log 2>&1
python3 prep/ccm_prep.py min-01 jobs
$SLOT bash -c 'for w in 0 1 2; do blender --background --python prep/blender_lod.py -- prep/jobs-min01.json $w 3 prep/lod-min01.jsonl > prep/lod-min01-$w.log 2>&1 & done; wait'
python3 prep/lod_tex.py > prep/chain-lodtex.log 2>&1
python3 prep/flats.py > prep/chain-flats.log 2>&1
python3 build_data.py > prep/chain-bd2.log 2>&1
python3 prep/ccm_prep.py min-01 list
$SLOT blender --background --python prep/orient_views.py -- prep/orient-sweep-min-01/list.txt prep/orient-sweep-min-01/views > prep/orient-sweep-min-01/views.log 2>&1
python3 prep/orient_sheets.py prep/orient-sweep-min-01/views prep/orient-sweep-min-01/sheets 4 $(python3 prep/ccm_prep.py min-01 skus) > prep/chain-sheets.log 2>&1
echo done > prep/chain-min.done
