#!/usr/bin/env bash
# Deploy the Import Lab to https://implausible.enterprises/projects/turnip-works/import-lab/
# Same pattern as tools/spawn-tuner/deploy.sh: every module import, the stylesheet and the entry script get a version
# stamp, so a browser (or Cloudflare, which caches ~4 h) never mixes old and new modules. The samples (git-ignored
# binaries, built by prep/) are stamped with their own size, so they are only fetched again when they change.
# The lab imports the house lighting from the deployed Spawn Tuner (../tuner/js/fx/lighting.js at ../tuner/version.json).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DST=/var/www/implausible-landing/projects/turnip-works/import-lab
V=$(date +%Y%m%d%H%M%S)
for f in samples/garden-gnome.glb; do [ -f "$SRC/$f" ] || { echo "missing $f: run prep/pack_polyhaven.py (see README.md)"; exit 1; }; done
mkdir -p "$DST"
rsync -a --delete --exclude test --exclude prep --exclude '*.py' --exclude '*.md' --exclude deploy.sh --exclude '__pycache__' "$SRC/" "$DST/"
cp "$SRC/vendor/LICENSE.meshoptimizer.md" "$DST/vendor/" 2>/dev/null || true
sed -i -E "s#from '\./([a-z0-9]+)\.js'#from './\1.js?v=$V'#g" "$DST"/js/*.js
sed -i -E "s#(styles\.css|main\.js)\?v=[0-9a-z]+#\1?v=$V#g" "$DST/index.html"
for f in "$DST"/samples/*.glb; do n=$(basename "$f"); sed -i -E "s#samples/$n'#samples/$n?v=$(stat -c %s "$f")'#g" "$DST/js/main.js"; done
find "$DST" -type d -exec chmod 755 {} +
find "$DST" -type f -exec chmod 644 {} +
printf '{"v":"%s","at":"%s"}\n' "$V" "$(date -Iseconds)" > "$DST/version.json"; chmod 644 "$DST/version.json"
echo "deployed v=$V ($(du -sh "$DST" | cut -f1))"
grep -o "pipeline.js?v=[0-9]*" "$DST/js/main.js" | head -1
grep -o "samples/[a-z-]*.glb?v=[0-9]*" "$DST/js/main.js"
