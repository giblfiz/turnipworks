#!/usr/bin/env bash
# The help page "Connect D&D Beyond"'s film, poster and pictures (2026-10-29; docs/site/connect-dnd-beyond.md,
# docs/BEYOND20.md). A real recording of the real flow (Beyond20 built from its source, Fauna's own D&D Beyond account and
# the Basic Rules premade Lola Jani, a throwaway dev table), cut with captions; the pictures are frames of it.
# experiments/2026-10-29-ddbpage/LAB_NOTES.md says how it was made. Not in git (*.webm / *.mp4 / *.jpg are ignored, as
# every generated binary): the finished files live on the USB disk, engine/deploy.sh runs this when any is missing, and a
# release copies them from the dev tree. A new cut gets a new date in its names (Cloudflare keeps a file ~4 h): change
# FILES here and the names in docs/site/connect-dnd-beyond.md together.
#   engine/tools/build_ddb_media.sh [--force]
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
M=${TW_DDB_MEDIA:-/mnt/usb/turnip-works/help/connect-dnd-beyond/2026-10-29}
O="$SRC/client/site/ddb"; mkdir -p "$O"
FILES=(connect-dnd-beyond-20261029d.webm connect-dnd-beyond-20261029d.mp4 connect-dnd-beyond-20261029d-poster.jpg
       ddb-attack-20261029d.jpg ddb-damage-20261029d.jpg)
# the 23 step pictures (and each whole marked screen): a fresh-profile walk in Google Chrome, Beyond20 2.21.0 from the Web Store
for n in $(seq -w 1 23); do FILES+=(step-$n-20261029e.jpg step-$n-full-20261029e.jpg); done
missing=0; for f in "${FILES[@]}"; do [[ -s "$O/$f" ]] || missing=1; done
if [[ "${1:-}" != "--force" && $missing == 0 ]]; then echo "ddb media: present ($(du -ch "${FILES[@]/#/$O/}" | tail -1 | cut -f1))"; exit 0; fi
for f in "${FILES[@]}"; do [[ -s "$M/$f" ]] || { echo "ddb media: $f is not at $M (TW_DDB_MEDIA)"; exit 1; }; done
for f in "${FILES[@]}"; do install -m 644 "$M/$f" "$O/$f"; done
echo "ddb media: copied ${#FILES[@]} files ($(du -ch "${FILES[@]/#/$O/}" | tail -1 | cut -f1)) into $O"
