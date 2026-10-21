#!/usr/bin/env bash
# Land the smithy type:   flock /tmp/tw-main.lock tools/land.sh [--no-deploy]
# The rule of 2026-10-12: MAIN IS NOT TOUCHED UNTIL EVERYTHING IS GREEN. The merged result is built and tested on this
# branch in this worktree (origin/main merged in; the library built by the sandbox builder against the main tree's
# git-ignored binaries); only then main is fast-forwarded to it, deployed and pushed. A failure leaves main as it was.
# The only things written outside the worktree before that are git-IGNORED binaries (this batch's models, plates, colour
# maps, icons, runtime files: new names only).
set -euo pipefail
WT=$TW_REPO; MAIN=$TW_REPO; SMI=experiments/2026-10-11-types/smi; T=tools/spawn-tuner
SLOT=/tmp/scratch/tw-slot
mkdir -p /tmp/scratch; exec > >(tee -a $WT/$SMI/land.log) 2>&1; echo "=== $(date -Is) land"
cd $WT
git fetch -q origin
if [[ -f /tmp/scratch/smi-green && "$(cat /tmp/scratch/smi-green)" == "$(git rev-parse HEAD) $(git rev-parse origin/main)" && -z "$(git status --short | grep -v '^??')" ]]; then echo "already GREEN on $(git rev-parse --short HEAD) against this origin/main: straight to the fast-forward"; else
$SMI/tools/merge_main.sh | tail -3
[[ -n ${REHEARSE:-} ]] || test "$(git -C $MAIN rev-parse main)" == "$(git rev-parse origin/main)" || { echo "local main is not origin/main (a landing is unpushed or in flight): not landing"; exit 3; }
git merge-base --is-ancestor origin/main HEAD || { echo "origin/main is not in this branch"; exit 3; }
# 1. this batch's git-ignored binaries to the main tree (ignored files: git does not see them)
rsync -a --ignore-existing --include '*/' --include '*.glb' --include '*.png' --include '*.jpg' --exclude '*' --exclude 'integration/sandbox' --exclude work --exclude 'shots-*' $WT/$SMI/ $MAIN/$SMI/ 2>/dev/null || true
if [[ ! -L $T/prep/tex-src ]]; then rsync -a --ignore-existing $T/prep/tex-src/ $MAIN/$T/prep/tex-src/; rm -rf $T/prep/tex-src; ln -s $MAIN/$T/prep/tex-src $T/prep/tex-src; fi
cp $SMI/icons/room-smi-*.png $MAIN/engine/client/data/icons/
cp -rsn $MAIN/engine/client/data/. engine/client/data/ 2>/dev/null || true   # (icons, roof pieces ...: git-ignored, so this worktree sees the main tree's through links; tracked files are left alone)
# 2. the merged library, built from this branch's code against the main tree's binaries; the golden reference is main as it stands
python3 src/catalog_tool.py | grep -E "WARN smi|ERROR.*smi" | head -5 || true
python3 $SMI/integration/make_sandbox_smi.py pristine --pristine | tail -1
python3 $SMI/integration/make_sandbox_smi.py real --real | grep -E "sandbox|smi-|collision|REFUS|NOT LISTED" | cut -c1-160
S=$SMI/integration/sandbox/real
cp $S/data/library.json $S/data/rooms.json $T/data/
(cd $T && python3 prep/lod_tex.py | tail -1)
(cd $T && python3 prep/fire_anchors.py | tail -2); git diff --stat $T/data/fire_anchors.json | tail -1
python3 $T/prep/delivery.py | tail -2
python3 $T/test/assets_check.py | tail -2
# 3. the suites, on this tree
node $T/test/smi.test.mjs $T | tail -1 | tee /tmp/scratch/smi-test.txt; grep -q ", 0 failures" /tmp/scratch/smi-test.txt
node $T/test/golden.mjs $WT/$SMI/integration/sandbox/pristine $T | tail -1 | tee /tmp/scratch/smi-golden.txt; grep -q " 0 differ" /tmp/scratch/smi-golden.txt
node $T/test/mkt.test.mjs $T | tail -1 | tee /tmp/scratch/smi-mkt.txt; grep -q ", 0 failures" /tmp/scratch/smi-mkt.txt
(cd $T; for t in solver solver2 yard repeat zones stable stacks focal wall_items; do echo "$t: $(node test/$t.test.mjs $WT/$T 2>&1 | tail -1 | cut -c1-120)"; done; echo "fuzz: $(node test/v2_fuzz.mjs 2>&1 | tail -1 | cut -c1-120)") | tee /tmp/scratch/smi-suites.txt
! grep -E "[1-9][0-9]* (failures|failed)|[1-9][0-9]* on the floor" /tmp/scratch/smi-suites.txt
node engine/test/core.test.mjs | tail -2 | tee /tmp/scratch/smi-core.txt; ! grep -qiE "[1-9][0-9]* fail" /tmp/scratch/smi-core.txt
node engine/test/buildings.test.mjs 2 --code=SMI | grep -E "FAIL|buildings," | tee /tmp/scratch/smi-bld.txt; ! grep -q FAIL /tmp/scratch/smi-bld.txt
python3 engine/tools/build_types.py | tail -1
python3 tools/tool-sweep/check.py | tail -2 | cut -c1-300 || true
# 4. commit the generated data on the branch
git add -A catalog $T/data/library.json $T/data/rooms.json $T/data/fire_anchors.json $T/data/orient.json $T/prep/tex-ladder.json engine/client/data/types.json $SMI
git commit -q -m "Smithy & workshop: the library and rooms.json with smi-01 (25 meshes), fire anchors, ladder list, types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" || echo "(generated data unchanged)"
echo "GREEN on $(git rev-parse --short HEAD)"; echo "$(git rev-parse HEAD) $(git rev-parse origin/main)" > /tmp/scratch/smi-green
fi
[[ ${1:-} == --no-ff ]] && { echo "tested, main not touched"; exit 0; }
# 5. main: fast-forward only. Generated files someone's build left modified in the main tree are put back first (they are in this commit, rebuilt)
cd $MAIN
test "$(git rev-parse main)" == "$(git -C $WT rev-parse origin/main)" || { echo "main moved while testing: not landing"; exit 3; }
for f in $(git diff --name-only main type-smi -- | sort > /tmp/scratch/smi-changed.txt; git diff --name-only | sort | comm -12 - /tmp/scratch/smi-changed.txt); do
  case $f in $T/prep/jobs.json|$T/prep/flats.json|$T/prep/flats-out.json|$T/prep/tex-ladder.json|engine/client/data/types.json|$T/data/*.json|catalog/out/*) git checkout -- "$f"; echo "main: generated file put back before the fast-forward: $f";;
    *) echo "main has an uncommitted change in $f that this landing also changes: not landing"; exit 3;; esac; done
git merge --ff-only type-smi | tail -1
[[ ${1:-} == --no-deploy ]] && { echo "merged, not deployed"; exit 0; }
lane-post "Turnip Works: Smithy & workshop type fast-forwarded onto main (tested on its branch); deploying tuner + game client now (tw-relay restarts once)" --model claude-opus-5-5 >/dev/null 2>&1 || true
$T/deploy.sh 2>&1 | tail -12 | cut -c1-220
engine/deploy.sh --no-relay 2>&1 | tail -8 | cut -c1-220
python3 $T/test/assets_check.py --live | tail -2
python3 tools/tool-sweep/check.py | tail -3 | cut -c1-300
GH_CONFIG_DIR=$HOME/.config/gh git push -q origin main && echo "pushed $(git rev-parse --short main)"
echo "=== $(date -Is) landed"
