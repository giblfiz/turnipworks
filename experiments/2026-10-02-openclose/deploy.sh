#!/usr/bin/env bash
# Deploy the open/close pilot to https://implausible.enterprises/projects/turnip-works/openclose/
# Stamps a version on every data/model URL (Cloudflare caches assets for 4h).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DST=/var/www/implausible-landing/projects/turnip-works/openclose
V=$(date +%Y%m%d%H%M%S)
mkdir -p "$DST/runtime"
rsync -a --delete "$SRC/runtime/" "$DST/runtime/"
sed -E "s#const V = '[0-9a-z]+';#const V = '$V';#" "$SRC/index.html" > "$DST/index.html"
chmod -R u=rwX,go=rX "$DST"
echo "deployed v=$V ($(du -sh "$DST" | cut -f1))"
