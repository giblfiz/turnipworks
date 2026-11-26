#!/usr/bin/env bash
# The phone front door's film (2026-11-24, phone front door v2; client/phone.js, docs/UI.md "The phone front door"): a
# small, muted LOOP cut from the APPROVED 15 s cut, 4:5 version (Harry 2026-10-23: "15C, 30A and 60A are all amazing";
# masters on the USB disk, approved.json beside them). Only the game footage, 1.0 to 12.8 s (the inn stands and fills, the GM
# handles things, a player joins by link: the first second is fog, murk at thumbnail size); the end card is left out because the page itself says the same lines. Its
# poster is the frame at 3.3 s (the inn standing). Not in git (*.mp4 / *.jpg are ignored, as every generated binary):
# engine/deploy.sh runs this when the files are missing, and a release copies them from the dev tree.
#   engine/tools/build_phone_media.sh [--force]
# Out: engine/client/phone/front-loop.mp4 (360x450, 24 fps, H.264 Main, no audio track, ~380 kb/s, faststart: about
# 0.4 MB; shown about 140 CSS px wide) and front-poster.jpg (360x450, about 24 KB).
# (Until 2026-11-24: promo-15c-4x5.mp4, 576x720, the whole cut, 1.4 MB, for the first phone page.)
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
M=${TW_PROMO_MASTERS:-/mnt/usb/turnip-works/promo/finals/approved/2026-10-23}
O="$SRC/client/phone"; mkdir -p "$O"
V="$O/front-loop.mp4" P="$O/front-poster.jpg"
if [[ "${1:-}" != "--force" && -s "$V" && -s "$P" ]]; then echo "phone media: present ($(du -h "$V" | cut -f1) loop)"; exit 0; fi
[[ -s "$M/15C-4x5.mp4" ]] || { echo "phone media: the approved master is not at $M (TW_PROMO_MASTERS)"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
VF="scale=360:450:flags=lanczos,fps=24"
ffmpeg -v error -y -ss 1.0 -t 11.8 -i "$M/15C-4x5.mp4" -an -vf "$VF" -c:v libx264 -preset slow -profile:v main -pix_fmt yuv420p -b:v 380k -maxrate 760k -bufsize 1520k -movflags +faststart "$T/v.mp4"
ffmpeg -v error -y -ss 3.3 -i "$M/15C-4x5.mp4" -frames:v 1 -vf "scale=360:450:flags=lanczos" -q:v 6 "$T/p.jpg"
install -m 644 "$T/v.mp4" "$V"; install -m 644 "$T/p.jpg" "$P"
echo "phone media: built $(du -h "$V" | cut -f1) loop + $(du -h "$P" | cut -f1) poster in $O"
