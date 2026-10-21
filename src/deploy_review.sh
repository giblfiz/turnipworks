#!/usr/bin/env bash
# Deploy the inn-01 review page (page files only; assets/ is hard-linked by build_live_review.py and left alone).
# Usage: src/deploy_review.sh [DEST]   default /var/www/implausible-landing/projects/turnip-works/review
# Cloudflare caches js/css for hours, so every deploy stamps content hashes into index.html and review.js.
set -euo pipefail
project=$(cd "$(dirname "$0")/.." && pwd)
page="$project/web/review"                 # page code (review.js / css / index.html): one copy for every run
src=${REVIEW_SRC:-$project/web/review}     # run data: assets.json, meta.json, assets/ (inn-02: web/review-02)
dst=${1:-/var/www/implausible-landing/projects/turnip-works/review}
if [[ ${REVIEW_KEEP_META:-0} == 1 ]]; then
  [[ -f "$src/meta.json" ]] || { echo "REVIEW_KEEP_META=1 but $src/meta.json is missing" >&2; exit 1; }
else
  python3 "$project/src/build_review_meta.py" --review "$src" ${REVIEW_MANIFEST:+--manifest "$REVIEW_MANIFEST"}
fi
h() { sha1sum "$1" | cut -c1-10; }
mkdir -p "$dst"
cp "$page/review.css" "$dst/review.css"
for f in meta.json assets.json; do cp "$src/$f" "$dst/$f"; done
sed -E "s#(fetch\(\"meta\.json)[^\"]*\"#\1?v=$(h "$src/meta.json")\"#; s#(fetch\(\"assets\.json)[^\"]*\"#\1?v=$(h "$src/assets.json")\"#" "$page/review.js" > "$dst/review.js"
sed -E "s#review\.css\?v=[0-9a-z]+#review.css?v=$(h "$page/review.css")#; s#review\.js\?v=[0-9a-z]+#review.js?v=$(h "$dst/review.js")#" "$page/index.html" > "$dst/index.html"
[[ -e "$dst/assets" ]] || ln -s "$(cd "$src" && pwd)/assets" "$dst/assets"
chmod 644 "$dst"/*.html "$dst"/*.js "$dst"/*.css "$dst"/*.json
grep -o 'review\.[a-z]*?v=[0-9a-f]*' "$dst/index.html" | tr '\n' ' '; echo "→ $dst"
