#!/bin/bash
# remerge.sh : after `git merge main` stops on conflicts in the shared files, take main's version of each and put the
# farmstead's blocks back (every step is idempotent). Run from the worktree root; then rebuild data and commit.
set -e
I=experiments/2026-10-11-types/hut/integration
F="engine/client/pack.js engine/test/browser_build.py engine/test/core.test.mjs tools/spawn-tuner/ROOMS.md tools/spawn-tuner/build_data.py tools/spawn-tuner/data/library.json tools/spawn-tuner/data/rooms.json tools/spawn-tuner/js/solver2.js tools/spawn-tuner/js/walls.js tools/spawn-tuner/prep/tex-ladder.json tools/spawn-tuner/index.html tools/spawn-tuner/js/look.js tools/spawn-tuner/js/buildings.js tools/spawn-tuner/data/orient.json tools/spawn-tuner/prep/flats-out.json catalog/fantasy-core.catalog.md catalog/expansion-trades.catalog.md docs/ASSETS_TO_BUILD.md docs/STATUS.md"
for f in $F; do if git status --short "$f" | grep -q "^UU\|^AA"; then git checkout --theirs "$f"; echo "took main's $f"; fi; done
python3 $I/apply.py; python3 $I/room_types.py; python3 $I/build_batch.py; python3 $I/engine_patch.py --from HEAD
python3 - <<'PY'
import subprocess
p='tools/spawn-tuner/ROOMS.md'; s=open(p).read()
if '## Farmstead' not in s:
    old=subprocess.run(['git','show','HEAD:'+p],capture_output=True,text=True).stdout
    i=old.index('## Farmstead'); j=old.index('## Rooms that are not rectangles'); a='## Rooms that are not rectangles'
    assert s.count(a)==1; open(p,'w').write(s.replace(a, old[i:j]+a)); print('ROOMS.md: Farmstead section put back')
p='tools/spawn-tuner/js/buildings.js'; s=open(p).read()
if '  HUT: {' not in s:
    old=subprocess.run(['git','show','HEAD:'+p],capture_output=True,text=True).stdout
    i=old.index('  // type:hut (2026-10-12): the farmhouse.'); j=old.index("  MKT: { label: 'Market & village'", i); a="  MKT: { label: 'Market & village'"
    assert s.count(a)==1; s=s.replace(a, old[i:j]+a)
    a="export const MIN_FIT = {"; s=s.replace(a, a+" 'hut-kitchen': [[3, 3]], 'hut-cottage': [[3, 3]], 'hut-byre': [[3, 4]], 'hut-barn': [[4, 4]], 'hut-granary': [[3, 3]], 'hut-dairy': [[2, 3]], 'hut-loft': [[2, 3]],",1); open(p,'w').write(s); print('buildings.js: HUT put back')
p='tools/spawn-tuner/prep/orient_ccm.py'; s=open(p).read()
if '"beehive-skep"' not in s:
    old=subprocess.run(['git','show','HEAD:'+p],capture_output=True,text=True).stdout
    i=old.index('    # farmstead (hut-01)'); j=old.index('\n', old.index('"rural-milk-churn-tall"', i))+1; a="MANUAL = {  # sku: (yaw or None, why)\n"
    open(p,'w').write(s.replace(a, a+old[i:j])); print('orient_ccm.py: manual yaws put back')
PY
echo "now: (cd tools/spawn-tuner && python3 build_data.py && python3 prep/lod_tex.py && python3 prep/flats.py && python3 build_data.py && ~/.local/share/tw-birefnet-venv/bin/python prep/orient_ccm.py hut-01), tests, git add, commit"
