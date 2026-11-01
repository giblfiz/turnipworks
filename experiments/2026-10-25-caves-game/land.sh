#!/usr/bin/env bash
# Land the caves branch on main, under the lock:   flock /tmp/tw-main.lock experiments/2026-10-25-caves-game/land.sh BRANCH
# ff-only merge; the tuner's generated data rebuilt in main and checked to be unchanged (the cave's rooms.json entry,
# its floor's library.json, flats.json and flats-out.json entries were written by hand to match build_data.py:
# add_tuner_data.py); the tuner and the client deploy to DEV (only with 0 connections on the dev relay); the release
# candidate; push. Never promotes to live.
# The tuner deploy is run WITHOUT its line that copies engine/client/icons.js over tools/spawn-tuner/ring/line-icons.js,
# and without deploying that file (it is someone else's work in progress and must not be touched); everything else is
# tools/spawn-tuner/deploy.sh as it is.
# The binaries are already in the main checkout (git-ignored): engine/client/data/caves/*.glb (prep_chunks.mjs),
# engine/client/data/icons/room-cave.png (gen_icon.py, post_icon.py), tools/spawn-tuner/assets/flat/floor-cave-rock.webp.
set -euo pipefail
BR=${1:?branch}
W=$(cd "$(dirname "$0")/../.." && pwd); M=$TW_REPO; I=$W/experiments/2026-10-25-caves-game
LOG=$I/landing-$(date +%Y%m%d-%H%M%S).log; exec > >(tee -a "$LOG") 2>&1
conns=$(curl -s 127.0.0.1:8098/health | python3 -c 'import json,sys; print(json.load(sys.stdin)["conns"])')
[[ $conns == 0 ]] || { echo "dev has $conns connection(s): Harry may be building; not deploying"; exit 3; }
for f in cave-corner-column cave-rubble-low cave-wall-arch cave-wall-crack cave-wall-ledge cave-wall-overhang cave-wall-plain-a cave-wall-plain-b; do [[ -s $M/engine/client/data/caves/$f.glb ]] || { echo "missing binary engine/client/data/caves/$f.glb in main"; exit 5; }; done
[[ -s $M/engine/client/data/icons/room-cave.png ]] || { echo "missing engine/client/data/icons/room-cave.png in main"; exit 5; }
[[ -s $M/tools/spawn-tuner/assets/flat/floor-cave-rock.webp ]] || { echo "missing tools/spawn-tuner/assets/flat/floor-cave-rock.webp in main"; exit 5; }
cd "$M"
[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "main checkout is not on main"; exit 1; }
git fetch -q origin
git merge --ff-only origin/main
git merge --ff-only "$BR"
GEN="tools/spawn-tuner/data tools/spawn-tuner/prep/jobs.json tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/flats-out.json"
if [[ -z $(git status --porcelain -- $GEN) ]]; then
  (cd tools/spawn-tuner && python3 build_data.py > /dev/null)
  changed=$(git status --porcelain -- $GEN | awk '{print $2}')
  echo "generated files changed in main by build_data.py: ${changed:-none}"
  if [[ -n $changed ]]; then git diff --stat -- $changed; git diff -- $changed | head -40; git checkout -- $changed; echo "WARNING: build_data.py would write other data than what is committed (shown above); the committed files are kept, as tested"; fi
else echo "SKIPPED the build_data.py check: generated files already modified in main (someone else's work): $(git status --porcelain -- $GEN | awk '{print $2}' | tr '\n' ' ')"; fi
node engine/tools/sync_cave_rule.mjs --check
# the tuner (its rooms.json, walls.js, solver2.js, library.json carry the cave type and its floor)
T=$(mktemp); trap 'rm -f "$T"' EXIT
grep -v 'cp "$SRC/../../engine/client/icons.js" "$SRC/ring/line-icons.js"' tools/spawn-tuner/deploy.sh | sed "s#rsync -aH --delete --exclude '\*.owner'#rsync -aH --delete --exclude ring/line-icons.js --exclude '*.owner'#; s#^SRC=.*#SRC=$M/tools/spawn-tuner#; s#\"\$(dirname \"\$0\")/\.\./\.\./engine#\"\$SRC/../../engine#g" > "$T"
grep -q 'dirname "$0"' "$T" && { echo "the tuner deploy copy still uses its own path: not deploying the tuner"; exit 6; }
grep -q 'line-icons.js' "$T" && ! grep -q 'cp "$SRC/../../engine/client/icons.js"' "$T" || { echo "could not neutralise the line-icons copy: not deploying the tuner"; exit 6; }
bash "$T"
git diff --quiet -- tools/spawn-tuner/ring/line-icons.js || { echo "line-icons.js CHANGED (should not have)"; exit 7; }
TW_LOCK_HELD=1 engine/deploy.sh
TW_LOCK_HELD=1 tools/release.sh candidate
GH_CONFIG_DIR=$HOME/.config/gh git push origin main
git log --oneline -3
echo "LANDED $(git rev-parse --short HEAD)"
