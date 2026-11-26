#!/usr/bin/env bash
# After measure_fly.py and review.py: re-read the facing answers, thumbnails (the figure gallery's own render mode,
# experiments/2026-10-06-figures/thumbs.py, on this folder as its set), the manifest, then the game's figure list.
#   experiments/2026-11-06-pawns/fly/finish.sh
set -euo pipefail
cd "$(dirname "$0")"; W=$(cd ../../.. && pwd)
python3 refacing.py
chmod o+r models/*.glb tiers/*.glb
$HOME/.local/share/tw-trimesh-venv/bin/python measure_fly.py --manifest-only
python3 experiments/2026-10-06-figures/thumbs.py auto "$PWD" --force | tail -2
for f in thumbs/*.webp; do case $f in *-fly.webp) ;; *) mv -f "$f" "${f%.webp}-fly.webp";; esac; done
$HOME/.local/share/tw-trimesh-venv/bin/python measure_fly.py --manifest-only
python3 "$W/tools/spawn-tuner/build_figures.py" --check | tail -3
