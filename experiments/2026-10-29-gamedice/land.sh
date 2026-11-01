#!/usr/bin/env bash
# Land gamedice on main, under the lock:   flock /tmp/tw-main.lock experiments/2026-10-29-gamedice/land.sh   (run the worktree's copy)
# (after experiments/2026-10-27-roofs-flat/land.sh) the six generated face symbols (git-ignored binaries) copied into
# main's tools/spawn-tuner/assets/dice (new names only; never over a different file); ff-only merge; the TUNER deploy
# (js/fx dice*.js changed) from main WITHOUT its line that copies engine/client/icons.js over ring/line-icons.js and
# without shipping ring/line-icons.js or the uncommitted ring/registry.json (others' work in progress); the client to
# DEV; the release candidate; push. Never live.
set -euo pipefail
W=$(cd "$(dirname "$0")/../.." && pwd); M=$TW_REPO
[[ $W != "$M" ]] || { echo "run the worktree's copy"; exit 1; }
LOG=$W/experiments/2026-10-29-gamedice/landing-$(date +%Y%m%d-%H%M%S).log; exec > >(tee -a "$LOG") 2>&1
n=0; mkdir -p "$M/tools/spawn-tuner/assets/dice"
for f in "$W"/tools/spawn-tuner/assets/dice/*.png; do b=tools/spawn-tuner/assets/dice/$(basename "$f")
  if [[ -e $M/$b ]]; then cmp -s "$f" "$M/$b" || { echo "REFUSING: main has a different $b"; exit 1; }; else cp -p "$f" "$M/$b"; n=$((n+1)); fi; done
echo "copied $n symbols into main"; ls "$M/tools/spawn-tuner/assets/dice" | wc -l | grep -qx 6 || { echo "main lacks the six symbols"; exit 5; }
cd "$M"
[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "main checkout is not on main"; exit 1; }
git fetch -q origin
git merge --ff-only gamedice
T=$(mktemp); trap 'rm -f "$T"' EXIT
grep -v 'cp "$SRC/../../engine/client/icons.js" "$SRC/ring/line-icons.js"' tools/spawn-tuner/deploy.sh | sed "s#rsync -aH --delete --exclude '\*.owner'#rsync -aH --delete --exclude ring/line-icons.js --exclude ring/registry.json --exclude '*.owner'#; s#^SRC=.*#SRC=$M/tools/spawn-tuner#; s#\"\$(dirname \"\$0\")/\.\./\.\./engine#\"\$SRC/../../engine#g" > "$T"
grep -q 'dirname "$0"' "$T" && { echo "the tuner deploy copy still uses its own path: not deploying the tuner"; exit 6; }
grep -q 'cp "$SRC/../../engine/client/icons.js"' "$T" && { echo "could not neutralise the line-icons copy: not deploying the tuner"; exit 6; }
grep -q 'exclude ring/registry.json' "$T" || { echo "could not exclude ring/registry.json: not deploying the tuner"; exit 6; }
bash "$T"
git diff --quiet -- tools/spawn-tuner/ring/line-icons.js || { echo "line-icons.js CHANGED (should not have)"; exit 7; }
ls /var/www/implausible-landing/projects/turnip-works/tuner/assets/dice/ | wc -l | grep -qx 6 || { echo "the dev tuner lacks the symbols"; exit 8; }
TW_LOCK_HELD=1 engine/deploy.sh
TW_LOCK_HELD=1 tools/release.sh candidate
GH_CONFIG_DIR=$HOME/.config/gh git push origin main
git log --oneline -3
echo "LANDED $(git rev-parse --short HEAD)"
