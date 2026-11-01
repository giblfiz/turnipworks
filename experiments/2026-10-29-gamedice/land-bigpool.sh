#!/usr/bin/env bash
# Land bigpool on main, under the lock:   flock /tmp/tw-main.lock experiments/2026-10-29-gamedice/land-bigpool.sh   (run the worktree's copy)
# (land.sh without the symbols, which main already has) ff-only merge; the TUNER deploy (js/fx dice*.js changed) from
# main WITHOUT its line that copies engine/client/icons.js over ring/line-icons.js and without shipping
# ring/line-icons.js or the uncommitted ring/registry.json (others' work in progress); the client to DEV; the release
# candidate; push. Never live.
set -euo pipefail
W=$(cd "$(dirname "$0")/../.." && pwd); M=$TW_REPO
[[ $W != "$M" ]] || { echo "run the worktree's copy"; exit 1; }
LOG=$W/experiments/2026-10-29-gamedice/landing-bigpool-$(date +%Y%m%d-%H%M%S).log; exec > >(tee -a "$LOG") 2>&1
cd "$M"
[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "main checkout is not on main"; exit 1; }
git fetch -q origin
git merge --ff-only bigpool
T=$(mktemp); trap 'rm -f "$T"' EXIT
grep -v 'cp "$SRC/../../engine/client/icons.js" "$SRC/ring/line-icons.js"' tools/spawn-tuner/deploy.sh | sed "s#rsync -aH --delete --exclude '\*.owner'#rsync -aH --delete --exclude ring/line-icons.js --exclude ring/registry.json --exclude '*.owner'#; s#^SRC=.*#SRC=$M/tools/spawn-tuner#; s#\"\$(dirname \"\$0\")/\.\./\.\./engine#\"\$SRC/../../engine#g" > "$T"
grep -q 'dirname "$0"' "$T" && { echo "the tuner deploy copy still uses its own path: not deploying the tuner"; exit 6; }
grep -q 'cp "$SRC/../../engine/client/icons.js"' "$T" && { echo "could not neutralise the line-icons copy: not deploying the tuner"; exit 6; }
grep -q 'exclude ring/registry.json' "$T" || { echo "could not exclude ring/registry.json: not deploying the tuner"; exit 6; }
bash "$T"
git diff --quiet -- tools/spawn-tuner/ring/line-icons.js || { echo "line-icons.js CHANGED (should not have)"; exit 7; }
grep -q 'BIG_POOL' /var/www/implausible-landing/projects/turnip-works/tuner/js/fx/dicephys.js || { echo "the dev tuner lacks BIG_POOL"; exit 8; }
TW_LOCK_HELD=1 engine/deploy.sh
TW_LOCK_HELD=1 tools/release.sh candidate
GH_CONFIG_DIR=$HOME/.config/gh git push origin main
git log --oneline -3
echo "LANDED $(git rev-parse --short HEAD)"
