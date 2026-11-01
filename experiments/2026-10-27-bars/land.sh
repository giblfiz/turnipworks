#!/usr/bin/env bash
# Land the bars branch's post on main, under the lock:   flock /tmp/tw-main.lock experiments/2026-10-27-bars/land.sh
# ff-only merge; this batch's git-ignored binaries copied into main (never overwriting a different file); the tuner deploy
# WITHOUT its line that copies engine/client/icons.js over tools/spawn-tuner/ring/line-icons.js (someone else's work in
# progress: experiments/2026-10-25-caves-game/land.sh did the same), then the client to DEV, the release candidate, push.
# The runtime files (assets/m, lod, tex, prep/tex-src) were written straight into main's asset store through the
# worktree's symlinks (a new sku: nothing overwritten). Never promotes to live.
set -euo pipefail
W=$(cd "$(dirname "$0")/../.." && pwd); M=$TW_REPO; I=$W/experiments/2026-10-27-bars
[[ $W != "$M" ]] || { echo "run the worktree's copy"; exit 1; }
LOG=$I/landing-$(date +%Y%m%d-%H%M%S).log; exec > >(tee -a "$LOG") 2>&1
for f in assets/m/cell-bars-post.glb assets/lod/f5000/cell-bars-post.glb assets/tex/t256/cell-bars-post.webp; do [[ -s $M/tools/spawn-tuner/$f ]] || { echo "missing $f in main"; exit 5; }; done
# the batch's ignored binaries (source meshes, plates) into main, so build_data.py there keeps the sku
n=0; while IFS= read -r -d '' f; do
  [[ -L $W/$f || ! -f $W/$f ]] && continue
  if [[ -e $M/$f ]]; then cmp -s "$W/$f" "$M/$f" || { echo "REFUSING: main has a different $f"; exit 1; }; continue; fi
  mkdir -p "$M/$(dirname "$f")"; cp -p "$W/$f" "$M/$f"; n=$((n+1))
done < <(cd "$W" && git ls-files --others --ignored --exclude-standard -z -- experiments/2026-10-27-bars)
echo "copied $n batch binaries into main"
cd "$M"
[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || { echo "main checkout is not on main"; exit 1; }
git merge --ff-only bars
T=$(mktemp); trap 'rm -f "$T"' EXIT
grep -v 'cp "$SRC/../../engine/client/icons.js" "$SRC/ring/line-icons.js"' tools/spawn-tuner/deploy.sh | sed "s#rsync -aH --delete --exclude '\*.owner'#rsync -aH --delete --exclude ring/line-icons.js --exclude '*.owner'#; s#^SRC=.*#SRC=$M/tools/spawn-tuner#; s#\"\$(dirname \"\$0\")/\.\./\.\./engine#\"\$SRC/../../engine#g" > "$T"
grep -q 'dirname "$0"' "$T" && { echo "the tuner deploy copy still uses its own path: not deploying the tuner"; exit 6; }
grep -q 'cp "$SRC/../../engine/client/icons.js"' "$T" && { echo "could not neutralise the line-icons copy: not deploying the tuner"; exit 6; }
bash "$T"
git diff --quiet -- tools/spawn-tuner/ring/line-icons.js || { echo "line-icons.js CHANGED (should not have)"; exit 7; }
TW_LOCK_HELD=1 engine/deploy.sh
TW_LOCK_HELD=1 tools/release.sh candidate
GH_CONFIG_DIR=$HOME/.config/gh git push origin main
git log --oneline -3
echo "LANDED $(git rev-parse --short HEAD)"
