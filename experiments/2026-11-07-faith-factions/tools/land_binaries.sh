#!/usr/bin/env bash
# For Fauna's landing (under /tmp/tw-main.lock): copy one culture's git-ignored binaries from this worktree into main.
#   experiments/2026-11-07-faith-factions/tools/land_binaries.sh fth [--dry-run]      (run the WORKTREE's copy)
# What: the accepted source meshes and flats build_data.py reads (experiments/2026-11-06-cultures-a/CODE/{models,
# flats/seamless, flats/decals}), their runtime tier, LOD ladder and texture ladder (tools/spawn-tuner/assets/{m,lod,tex}
# with the .owner notes), the flat pictures (assets/flat), and the Build tray icons (engine/client/data/icons/room-CODE-*,
# type-CODE, genre-cultures). NEW names only: a name main already has with different bytes is a REFUSAL (nothing here
# replaces another batch's file); identical files are skipped. Never deploys, never touches git.
set -euo pipefail
W=$(cd "$(dirname "$0")/../../.." && pwd); M=$TW_REPO; C=$1; DRY=${2:-}
[[ $W != "$M" ]] || { echo "run the worktree's copy"; exit 1; }
E=experiments/2026-11-07-faith-factions
mapfile -t skus < <(python3 -c "import csv; [print(r['sku']) for r in csv.DictReader(open('$W/catalog/runs/$C-01/manifest.tsv'), delimiter='\t')]")
mapfile -t srcs < <(python3 -c "import csv; [print(r['source']) for r in csv.DictReader(open('$W/catalog/runs/$C-01/manifest.tsv'), delimiter='\t')]")
files=()
for s in "${srcs[@]}"; do files+=("$E/$C/models/$s.glb"); done
for s in "${skus[@]}"; do
  files+=("tools/spawn-tuner/assets/m/$s.glb")
  [[ -e $W/tools/spawn-tuner/assets/m/$s.glb.owner ]] && files+=("tools/spawn-tuner/assets/m/$s.glb.owner")
  for f in "$W"/tools/spawn-tuner/assets/lod/*/"$s".glb "$W"/tools/spawn-tuner/assets/tex/*/"$s".webp; do [[ -e $f ]] && files+=("${f#$W/}"); done
done
for f in "$W/$E/$C"/flats-clean/flavor-*.png; do [[ -e $f ]] || continue; files+=("${f#$W/}"); s=$(basename "${f%.*}"); [[ -e $W/tools/spawn-tuner/assets/flat/$s.webp ]] && files+=("tools/spawn-tuner/assets/flat/$s.webp"); done
for f in christian buddhist hindu muslim; do [[ -e $W/tools/spawn-tuner/assets/emblems/$f.webp && ! -L $W/tools/spawn-tuner/assets/emblems/$f.webp ]] && files+=("tools/spawn-tuner/assets/emblems/$f.webp"); done  # the picker emblems
n_new=0; n_same=0
for r in "${files[@]}"; do
  src=$W/$r; dst=$M/$r
  [[ -L $src ]] && { echo "REFUSING: $r is a link in the worktree (not built here)"; exit 2; }
  [[ -e $src ]] || { echo "REFUSING: $r missing in the worktree"; exit 2; }
  if [[ -e $dst ]]; then
    if cmp -s "$src" "$dst"; then n_same=$((n_same+1)); continue; fi
    [[ $r == */genre-cultures.png ]] && { echo "keeping main's genre-cultures.png (cultures-b's, or an earlier landing)"; continue; }
    echo "REFUSING: main has a different $r"; exit 3
  fi
  n_new=$((n_new+1))
  [[ $DRY == --dry-run ]] && { echo "would copy $r"; continue; }
  mkdir -p "$(dirname "$dst")"; cp -p "$src" "$dst"; chmod 664 "$dst"
done
echo "$C: ${#files[@]} binaries: $n_new new, $n_same already identical in main${DRY:+ (dry run)}"
