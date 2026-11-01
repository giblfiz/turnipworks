#!/usr/bin/env bash
# Copy this batch's git-ignored binaries (source GLBs, plates, runtime meshes, LODs, textures) from the pillars worktree
# into the main checkout, never overwriting: a file main already has must be byte-identical or the copy stops.
# Usage (from anywhere): sync_binaries.sh [--dry-run] [SKU-filter-regex]
set -euo pipefail
W=$(cd "$(dirname "$0")/../../.." && pwd); M=$TW_REPO
[[ $W != "$M" ]] || { echo "run from the worktree's copy"; exit 1; }
DRY=0; [[ ${1:-} == --dry-run ]] && { DRY=1; shift; }
RE=${1:-.}
cd "$W"; n=0; same=0
while IFS= read -r -d '' f; do
  [[ -L $f || ! -f $f ]] && continue
  case $f in tools/spawn-tuner/assets/flat/*|tools/spawn-tuner/assets/d/*|*/node_modules/*|*/__pycache__/*|*.pyc|*.log) continue;; esac
  [[ $f =~ $RE ]] || continue
  if [[ -e $M/$f ]]; then cmp -s "$f" "$M/$f" && { same=$((same+1)); continue; }
    # this batch's own folder (plates, inputs, renders) moves on with the batch; the library's runtime files never change under a sku
    [[ $f == experiments/2026-10-24-faction-pillars/* ]] || { echo "REFUSING: main has a different $f"; exit 1; }
  fi
  n=$((n+1)); [[ $DRY == 1 ]] && { echo "would copy $f"; continue; }
  mkdir -p "$M/$(dirname "$f")"; cp -p "$f" "$M/$f"
done < <(git ls-files --others --ignored --exclude-standard -z -- experiments/2026-10-24-faction-pillars tools/spawn-tuner/assets tools/spawn-tuner/prep)
echo "copied $n new files ($same already identical in main)"
