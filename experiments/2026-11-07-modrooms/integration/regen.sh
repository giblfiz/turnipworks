#!/usr/bin/env bash
# The modrooms lane's generated data (copied from the cyberpunk pack's regen.sh), rebuilt from its inputs (run from the repo root; after a rebase or a merge):
#   0. integration/borrow_sync.py (MX_BORROW and set:MOD from reuse-borrow.json), then src/catalog_tool.py                       (catalog/out and engine types.json from catalog/*.catalog.md)
#   1. tools/spawn-tuner/build_data.py           (library.json, rooms.json from the catalog, the manifest, the GLBs here)
#   2. tools/flats_mine.py                       (this batch's four floors -> assets/flat; build_data again to list them)
#   3. prep/flats.json, prep/jobs.json restored  (build_data writes this machine's absolute paths into them)
#   4. integration/merge_lib.py [REF]            (main's committed library + this batch: wave 1's GLBs are on no machine)
#   5. engine/tools/build_types.py, engine/tools/library_spawns.mjs, build_types.py again (types.json; what each room's rules put down)
#   experiments/2026-11-07-modrooms/integration/regen.sh [REF=main] [--no-spawns]
set -euo pipefail
REF=${1:-main}; E=experiments/2026-11-07-modrooms
[[ -d $E && -f tools/spawn-tuner/build_data.py ]] || { echo "run from the repo root"; exit 64; }
python3 $E/integration/borrow_sync.py
python3 src/catalog_tool.py > /dev/null || true
( cd tools/spawn-tuner && python3 build_data.py > /dev/null )
python3 $E/tools/flats_mine.py | tail -1
( cd tools/spawn-tuner && python3 build_data.py > /dev/null )
git checkout tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/jobs.json
python3 $E/integration/merge_lib.py "$REF"
python3 engine/tools/build_types.py
[[ ${2:-} == --no-spawns ]] || { node engine/tools/library_spawns.mjs --jobs 6 | tail -1; python3 engine/tools/build_types.py; } # (types.json reads the spawns: a building's shelves are what its rooms lay)
git checkout -q catalog/out/by-setting/tem-temple-chapel.txt 2>/dev/null || true # (that file drifts on main from another lane's catalog; not ours)
