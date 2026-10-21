#!/usr/bin/env bash
# Deploy the Alignment Bench to https://implausible.enterprises/projects/turnip-works/align/
# Cloudflare caches js/css for ~4 h, so every module import, the stylesheet and the entry script get a content-hash
# query (?v=<sha1-10>) — a changed file gets a new URL, an unchanged one keeps its cache. The tuner code the bench runs
# (../tuner/js/look.js, fx/fire.js, hinge.js) is imported at the stamp in ../tuner/version.json, like the game does.
#   web/align/deploy.sh [DEST]
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DST=${1:-/var/www/implausible-landing/projects/turnip-works/align}
STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
h() { sha1sum "$1" | cut -c1-10; }
mkdir -p "$STAGE/js"
cp "$SRC"/js/*.js "$STAGE/js/"
# stamp leaf modules first, then the modules that import them (main.js imports all the others)
for f in queues vessel mode-fire mode-water mode-open; do
  sed -i -E "s#from '\./$f\.js'#from './$f.js?v=$(h "$STAGE/js/$f.js")'#g" "$STAGE"/js/*.js
done
cp "$SRC/align.css" "$STAGE/align.css"
sed -E "s#align\.css\?v=[0-9a-z]+#align.css?v=$(h "$STAGE/align.css")#; s#js/main\.js\?v=[0-9a-z]+#js/main.js?v=$(h "$STAGE/js/main.js")#" "$SRC/index.html" > "$STAGE/index.html"
mkdir -p "$DST"
rsync -a --delete "$STAGE/" "$DST/"
find "$DST" -type d -exec chmod 755 {} +
find "$DST" -type f -exec chmod 644 {} +
grep -o '\(align\.css\|main\.js\)?v=[0-9a-f]*' "$DST/index.html" | tr '\n' ' '; echo "→ $DST"
