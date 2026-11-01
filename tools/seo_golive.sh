#!/usr/bin/env bash
# SEARCH AND LINK PREVIEWS ON PROD (2026-10-23; docs/STATUS.md "Search and link previews"). Run ONLY on Harry's word
# ("push it live"), AFTER `tools/release.sh promote-now --harry <id>` has put a release with the new site files live.
# It installs the repo's prod nginx conf (robots.txt, sitemap.xml, llms.txt at the root, instead of the 301 that 404s),
# checks it, reloads nginx (a graceful reload: no connection is dropped), verifies through the box's own nginx, purges
# Cloudflare's copies of the three files, and verifies the public way. On a failed nginx -t the old conf is put back.
#   tools/seo_golive.sh --harry          do it
#   tools/seo_golive.sh --check          only the verification (box-local, then public)
#   tools/seo_golive.sh --purge          only the Cloudflare purge (needs CLOUDFLARE_API_TOKEN: run it through secrets-wrapper)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF="$ROOT/engine/relay/nginx-turnipworks.net.conf"
LIVE=/etc/nginx/sites-available/turnipworks.net
PY=python3
ZONE=1a4eb4f7d06a695cd3ef89ecc3fea85a   # turnipworks.net
verify() {
  echo "== through the box's nginx (Host: turnipworks.net)"; "$PY" "$ROOT/engine/test/seo_check.py" --page http://127.0.0.1 --host turnipworks.net
  echo "== the public way (Cloudflare)"; "$PY" "$ROOT/engine/test/seo_check.py" --page https://turnipworks.net
}
# Cloudflare keeps robots.txt for 4 h (cf-cache-status was EXPIRED on the old 301): purge the three addresses.
purge() {
  local body='{"files":["https://turnipworks.net/robots.txt","https://turnipworks.net/sitemap.xml","https://turnipworks.net/llms.txt"]}'
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    curl -s -X POST -H "Authorization: Bearer $(printf %s "$CLOUDFLARE_API_TOKEN" | tr -d '[:space:]')" -H 'Content-Type: application/json' \
      "https://api.cloudflare.com/client/v4/zones/$ZONE/purge_cache" --data "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("cloudflare purge:", d.get("success"), d.get("errors"))'
  else
    echo "no CLOUDFLARE_API_TOKEN in this shell: purge with  secrets-wrapper -a -p \"Run exactly: bash $ROOT/tools/seo_golive.sh --purge; reply with its output verbatim\""
  fi
}
case "${1:-}" in
  --check) verify; exit ;;
  --purge) purge; exit ;;
  --harry) ;;
  *) echo "usage: $0 --harry | --check | --purge   (prod changes only on Harry's word: docs/STATUS.md \"Working rules agents follow\")"; exit 2 ;;
esac
for f in robots.txt sitemap.xml llms.txt og-20261023.jpg; do
  [[ -f /var/lib/tw-releases/current/engine/client/site/$f ]] || { echo "NOT APPLIED: the live release has no engine/client/site/$f (promote the candidate first: tools/release.sh promote-now --harry)"; exit 1; }
done
BAK=$(mktemp /tmp/turnipworks.net.nginx.XXXXXX); sudo cp "$LIVE" "$BAK"
sudo cp "$CONF" "$LIVE"
if ! sudo nginx -t; then sudo cp "$BAK" "$LIVE"; echo "NOT APPLIED: nginx -t failed; the old conf is back ($BAK)"; exit 1; fi
sudo systemctl reload nginx; sleep 1
echo "nginx reloaded with $CONF (previous conf kept at $BAK)"
purge
verify
