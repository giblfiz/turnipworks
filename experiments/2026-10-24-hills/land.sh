#!/usr/bin/env bash
# Land the hills branch on main, under the lock:   flock /tmp/tw-main.lock experiments/2026-10-24-hills/land.sh
# ff-only merge; the tuner's generated data rebuilt in main and checked to be unchanged (rooms.json's hill entry was
# written by hand to match build_data.py exactly); dev deploys (only with 0 connections on the dev relay); the release
# candidate; push. Never promotes to live. The binaries (engine/client/data/terrain/*, data/icons/room-hill.png) are
# already in the main checkout (git-ignored; experiments/2026-10-24-hills/README.md).
set -euo pipefail
W=$(cd "$(dirname "$0")/../.." && pwd); M=$TW_REPO; I=$W/experiments/2026-10-24-hills
LOG=$I/landing-$(date +%Y%m%d-%H%M%S).log; exec > >(tee -a "$LOG") 2>&1
conns=$(curl -s 127.0.0.1:8098/health | python3 -c 'import json,sys; print(json.load(sys.stdin)["conns"])')
[[ $conns == 0 ]] || { echo "dev has $conns connection(s): Harry may be building; not deploying"; exit 3; }
for f in ground-earth-bank.webp ground-rock-face.webp ground-rock.webp rock-boulder.glb; do [[ -s $M/engine/client/data/terrain/$f ]] || { echo "missing binary engine/client/data/terrain/$f in main"; exit 5; }; done
[[ -s $M/engine/client/data/icons/room-hill.png ]] || { echo "missing engine/client/data/icons/room-hill.png in main"; exit 5; }
cd "$M"
[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "main checkout is not on main"; exit 1; }
git fetch -q origin
git merge --ff-only origin/main
git merge --ff-only hills
cd tools/spawn-tuner
python3 build_data.py > /dev/null
cd "$M"
changed=$(git status --porcelain -- tools/spawn-tuner/data tools/spawn-tuner/prep/jobs.json tools/spawn-tuner/prep/flats.json | awk '{print $2}')
echo "generated files changed in main by build_data.py: ${changed:-none}"
if [[ -n $changed ]]; then git diff --stat -- $changed; git diff -- $changed | head -40; git checkout -- $changed; echo "WARNING: build_data.py would write other data than what is committed (shown above); the committed files are kept, as tested"; fi
tools/spawn-tuner/deploy.sh   # first: it builds the delivered copies engine/deploy.sh checks for
engine/deploy.sh
TW_LOCK_HELD=1 tools/release.sh candidate
GH_CONFIG_DIR=$HOME/.config/gh git push origin main
git log --oneline -3
echo "LANDED $(git rev-parse --short HEAD)"
