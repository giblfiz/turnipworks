#!/usr/bin/env bash
# The phone page's film (2026-10-24; client/phone.js, docs/UI.md "The phone page"): a small web encode of the APPROVED
# 15 s cut, 4:5 version (Harry 2026-10-23: "15C, 30A and 60A are all amazing"; masters on the USB disk, approved.json
# beside them), and its last frame as the poster. Not in git (*.mp4 / *.jpg are ignored, as every generated binary):
# engine/deploy.sh runs this when the files are missing, and a release copies them from the dev tree.
#   engine/tools/build_phone_media.sh [--force]
# Out: engine/client/phone/promo-15c-4x5.mp4 (576x720, 30 fps, H.264 High, no audio track, ~760 kb/s two-pass, faststart:
# about 1.4 MB) and promo-15c-4x5-poster.jpg (the master's own last frame, 15C-4x5-last.png, at 576x720).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
M=${TW_PROMO_MASTERS:-/mnt/usb/turnip-works/promo/finals/approved/2026-10-23}
O="$SRC/client/phone"; mkdir -p "$O"
V="$O/promo-15c-4x5.mp4" P="$O/promo-15c-4x5-poster.jpg"
if [[ "${1:-}" != "--force" && -s "$V" && -s "$P" ]]; then echo "phone media: present ($(du -h "$V" | cut -f1) film)"; exit 0; fi
[[ -s "$M/15C-4x5.mp4" && -s "$M/15C-4x5-last.png" ]] || { echo "phone media: the approved masters are not at $M (TW_PROMO_MASTERS)"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
VF="scale=576:720:flags=lanczos,fps=30"
ffmpeg -v error -y -i "$M/15C-4x5.mp4" -an -vf "$VF" -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 760k -pass 1 -passlogfile "$T/p" -f mp4 /dev/null
ffmpeg -v error -y -i "$M/15C-4x5.mp4" -an -vf "$VF" -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 760k -maxrate 1400k -bufsize 2800k -pass 2 -passlogfile "$T/p" -movflags +faststart "$T/v.mp4"
ffmpeg -v error -y -i "$M/15C-4x5-last.png" -vf scale=576:720:flags=lanczos -q:v 4 "$T/p.jpg"
install -m 644 "$T/v.mp4" "$V"; install -m 644 "$T/p.jpg" "$P"
echo "phone media: built $(du -h "$V" | cut -f1) film + poster in $O"
