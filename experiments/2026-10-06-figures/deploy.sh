#!/usr/bin/env bash
# Build the figures-pilot page into a folder (default: the live site) with a version stamp on every URL.
#   ./deploy.sh                 -> https://implausible.enterprises/projects/turnip-works/figures-pilot/
#   ./deploy.sh /some/dir       -> a local copy for headless shots
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; T="$ROOT/tools/spawn-tuner"
DST="${1:-/var/www/implausible-landing/projects/turnip-works/figures-pilot}"
V=$(date +%Y%m%d%H%M%S)
mkdir -p "$DST/lib/vendor" "$DST/tex" "$DST/models"
cp "$HERE"/viewer/index.html "$HERE"/viewer/main.js "$DST/"
sed -i "s/__V__/$V/g" "$DST/index.html" "$DST/main.js"
cp "$HERE/kit.json" "$HERE/room.json" "$DST/"
# the game's lighting module and the three libraries it needs, copied from the working tree (read-only use)
cp "$T/js/fx/lighting.js" "$DST/lib/lighting.js"
cp "$T"/js/vendor/{postprocessing-6.39.5.js,n8ao-2.0.1.js,three-good-godrays-0.12.1.js,LICENSE.postprocessing.txt,LICENSE.n8ao,LICENSE.three-good-godrays} "$DST/lib/vendor/"
# the figures, and the library pieces and floor the room is built from (room.json lists them)
rsync -a --delete --exclude "raw" --exclude "packed" "$HERE/web-models/" "$DST/models/"
python3 - "$HERE/room.json" "$T" "$DST" <<'PY'
import json, shutil, sys
room, T, dst = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
for f in sorted({p["file"] for p in room["pieces"]}): shutil.copy(f"{T}/assets/m/{f}", f"{dst}/models/{f}")
for f in room["floor"]: shutil.copy(f"{T}/assets/flat/{f}", f"{dst}/tex/{f}")
PY
find "$DST" -type d -exec chmod 755 {} +; find "$DST" -type f -exec chmod 644 {} +
echo "deployed v=$V to $DST ($(du -sh "$DST" | cut -f1))"
