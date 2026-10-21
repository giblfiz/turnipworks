#!/usr/bin/env bash
# Build the slopes-pilot page into a folder (default: the live site) with a version stamp on every URL.
#   ./deploy.sh                 -> https://implausible.enterprises/projects/turnip-works/slopes-pilot/
#   ./deploy.sh /some/dir       -> a local copy for headless shots
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
DST="${1:-/var/www/implausible-landing/projects/turnip-works/slopes-pilot}"
V=$(date +%Y%m%d%H%M%S)
mkdir -p "$DST/lib/vendor" "$DST/tex" "$DST/models"
cp "$HERE"/viewer/index.html "$HERE"/viewer/main.js "$HERE"/viewer/scenes.js "$DST/"
sed -i "s/__V__/$V/g" "$DST/index.html" "$DST/main.js" "$DST/scenes.js"
cp "$HERE/kit.json" "$DST/kit.json"
# the game's lighting module and the three libraries it needs, copied from the working tree (read-only use)
cp "$ROOT/tools/spawn-tuner/js/fx/lighting.js" "$DST/lib/lighting.js"
cp "$ROOT"/tools/spawn-tuner/js/vendor/{postprocessing-6.39.5.js,n8ao-2.0.1.js,three-good-godrays-0.12.1.js,LICENSE.postprocessing.txt,LICENSE.n8ao,LICENSE.three-good-godrays} "$DST/lib/vendor/"
cp "$ROOT"/tools/spawn-tuner/assets/flat/floor-grass.webp "$ROOT"/tools/spawn-tuner/assets/flat/decal-grass-*.webp "$DST/tex/"
rsync -a --delete "$HERE/web-models/" "$DST/models/"
find "$DST" -type d -exec chmod 755 {} +; find "$DST" -type f -exec chmod 644 {} +
echo "deployed v=$V to $DST ($(du -sh "$DST" | cut -f1))"
