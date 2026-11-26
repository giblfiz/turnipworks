#!/usr/bin/env bash
# AFTER MERGING culture-pawns into main (Fauna runs this from anywhere; it only reads the worktree / USB and writes main):
#   experiments/2026-11-07-culture-pawns/land.sh [WORKTREE] [MAIN]
# 1. the set's binaries (git-ignored: tiers, thumbs, the full-size originals) into main's copy of the set folder.
#    -L: published/models is a link to the USB disk; main gets real files, so it never depends on that disk.
# 2. the game's figure list rebuilt in main FROM INPUTS (every experiments/*/set/published set, so it also picks up the
#    cyberpunk lane's when it is there), then the delivery tiers.
set -euo pipefail
WT=${1:-$TW_REPO}; MAIN=${2:-$TW_REPO}
S=experiments/2026-11-07-culture-pawns/set/published
[[ -f $MAIN/$S/manifest.json ]] || { echo "merge first: $MAIN/$S/manifest.json is not there" >&2; exit 1; }
mkdir -p "$MAIN/$S"
rsync -aL --ignore-existing "$WT/$S/tiers" "$WT/$S/thumbs" "$WT/$S/models" "$MAIN/$S/"
echo "binaries: $(ls "$MAIN/$S/tiers" | wc -l) tier files, $(ls "$MAIN/$S/thumbs" | wc -l) thumbnails, $(ls "$MAIN/$S/models" | wc -l) originals"
cd "$MAIN"
python3 tools/spawn-tuner/build_figures.py --check | tail -6
python3 tools/spawn-tuner/build_figures.py | tail -7
python3 tools/spawn-tuner/prep/delivery.py
node engine/test/pawntree_genres.test.mjs | tail -1; node engine/test/figsearch.test.mjs | tail -1
