#!/usr/bin/env bash
# The vehicles batch's generated data, rebuilt from its inputs (run from the repo root; after a rebase or a merge):
#   1. src/catalog_tool.py                       (catalog/out: simple-list, by-setting; engine/client/data/types.json roles)
#   2. tools/spawn-tuner/build_data.py           (library.json, rooms.json from the catalog, the manifests, the GLBs here)
#   3. prep/flats.json, prep/jobs.json restored  (build_data writes this machine's absolute paths into them)
#   3b. tools/orient_set.py                     (data/orient.json entries of this batch's meshes, from the blind four-turn reads)
#   4. integration/merge_lib.py [REF]            (REF's committed library + this batch's objects; REF's rooms + the Vehicles
#                                                 slot of the nine rooms in build_data.VEH_ROOMS: whatever another lane did to
#                                                 those rooms is kept)
#   5. engine/tools/build_types.py, engine/tools/library_spawns.mjs (types.json; what each room's rules put down)
#   experiments/2026-11-07-vehicles/integration/regen.sh [REF=main] [--no-spawns]
set -euo pipefail
REF=${1:-main}; E=experiments/2026-11-07-vehicles
[[ -d $E && -f tools/spawn-tuner/build_data.py ]] || { echo "run from the repo root"; exit 64; }
python3 src/catalog_tool.py > /dev/null 2>&1 || true   # (its exit code reports catalog warnings that predate this batch: firepit-stone-round)
( cd tools/spawn-tuner && python3 build_data.py > /dev/null )
git checkout tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/jobs.json
python3 $E/tools/orient_set.py > /dev/null   # data/orient.json: this batch's meshes' facing (qa-extra/orient-read.json)
python3 $E/integration/merge_lib.py "$REF"
python3 engine/tools/build_types.py
[[ ${2:-} == --no-spawns ]] || node engine/tools/library_spawns.mjs --jobs 6 | tail -1
