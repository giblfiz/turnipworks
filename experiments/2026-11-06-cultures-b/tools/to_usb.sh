#!/usr/bin/env bash
# Copy every picture meant for Harry (and the git-ignored plates and icons) to the USB lane folder, which outlives the worktree.
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); D=/mnt/usb/turnip-works/lanes-2026-11-06/cultures-b
mkdir -p "$D/stills" "$D/room-shots" "$D/icons" "$D/plates" "$D/mesh-renders"
cp "$E"/stills/*-table.png "$D/stills/"
for c in nrs mde rus mes; do cp "$E"/shots-$c-1/*-table.png "$D/room-shots/"; done
cp "$E"/icons/*.png "$D/icons/"; cp "$E"/plates/*.png "$D/plates/"; cp "$E"/renders/*.png "$D/mesh-renders/"
ls "$D/stills"; du -sh "$D"
