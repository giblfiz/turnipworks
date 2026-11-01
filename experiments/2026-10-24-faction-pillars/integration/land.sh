#!/usr/bin/env bash
# Land the pillars branch on main, under the lock:   flock /tmp/tw-main.lock experiments/2026-10-24-faction-pillars/integration/land.sh
# ff-only merge, binaries synced (no overwrite), generated data rebuilt in main and checked to carry only this batch,
# dev deploys (only with 0 connections on the dev relay), the release candidate, push. Never promotes to live.
set -euo pipefail
W=$(cd "$(dirname "$0")/../../.." && pwd); M=$TW_REPO; I=$W/experiments/2026-10-24-faction-pillars/integration
LOG=$I/landing-$(date +%Y%m%d-%H%M%S).log; exec > >(tee -a "$LOG") 2>&1
conns=$(curl -s 127.0.0.1:8098/health | python3 -c 'import json,sys; print(json.load(sys.stdin)["conns"])')
[[ $conns == 0 ]] || { echo "dev has $conns connection(s): Harry may be building; not deploying"; exit 3; }
cd "$M"
[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "main checkout is not on main"; exit 1; }
git fetch -q origin
git merge --ff-only origin/main
git merge --ff-only pillars
"$I/sync_binaries.sh"
cd tools/spawn-tuner
python3 build_data.py > /dev/null; python3 prep/flats.py > /dev/null; python3 build_data.py > /dev/null
cd "$M"
changed=$(git status --porcelain -- tools/spawn-tuner/data tools/spawn-tuner/prep/jobs.json tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/flats-*.json | awk '{print $2}')
echo "generated files changed in main: ${changed:-none}"
for f in $changed; do
  bad=$(git diff -U0 -- "$f" | grep '^[-+][^-+]' | grep -v 'flavor-pillar\|flavor-buttress\|faction-pillars\|factionpillars' | grep -v '^[-+] *[]}{,[]*$' | grep -v '^[-+] *"\(sku\|family\|tier\|shape\|piece\|src\|kind\|lod\|tex\|faces\|kb\|force\|kitfix\|plate\|opaque\|url\|mesh\|model\|glb\|out\|src_glb\|bounds\)"' | grep -v '^[-+] *[0-9.e-]*,\?$' | head -5 || true)
  [[ -z $bad ]] || { echo "REFUSING to commit $f: it changed beyond this batch:"; echo "$bad"; git checkout -- "$f"; exit 4; }
done
if [[ -n $changed ]]; then git add $changed; git commit -q -m "faction pillars: generated data rebuilt in main

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>"; fi
python3 tools/tool-sweep/sku_guard.py | tail -1
tools/spawn-tuner/deploy.sh   # first: it builds the delivered copies engine/deploy.sh checks for
engine/deploy.sh
TW_LOCK_HELD=1 tools/release.sh candidate
GH_CONFIG_DIR=$HOME/.config/gh git push origin main
git log --oneline -3
echo "LANDED $(git rev-parse --short HEAD)"
