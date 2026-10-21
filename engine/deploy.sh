#!/usr/bin/env bash
# DEV DEPLOY (2026-10-19: two servers; docs/NETCODE.md "Two servers", docs/STATUS.md "Working rules agents follow").
# Deploys the game client (engine/client + engine/core) to the DEV tree and restarts the DEV relay. Prod is never
# touched: https://turnipworks.net/ serves a pinned release and moves only by the nightly roll (tw-release-roll.timer,
# 03:30 America/Los_Angeles) or `tools/release.sh promote-now`.
#   https://dev.turnipworks.net/  (box-local: http://127.0.0.1:8180/)   the game at the root (client/index.turnipworks.html)
#   https://implausible.enterprises/projects/turnip-works/engine/      alternate entry (client/index.html), also dev
#   relay: tw-relay-dev.service on 127.0.0.1:8098, data /var/lib/tw-relay-dev/data (its own campaigns; restarts are free)
# The game imports the Spawn Tuner LIVE from the dev tree (../../tuner/ on implausible.enterprises, /look/ on the dev
# host; nginx exposes only the tuner's js/, data/, assets/ and version.json there). The tuner's own deploy
# (tools/spawn-tuner/deploy.sh) writes version.json and restarts the DEV relay.
#   engine/deploy.sh            deploy + copy the dev campaigns aside + restart the dev relay
#   engine/deploy.sh --no-relay deploy the client only
# After the landing suites pass, the landing script marks what dev now serves as the release candidate:
#   TW_LOCK_HELD=1 tools/release.sh candidate      (inside the landing lock; the nightly roll promotes it)
# Both also put the feedback tickets' triage page (tools/tickets/index.html) at $WEB/tickets/.
set -euo pipefail
[[ "${1:-}" == "--prod" ]] && { echo "engine/deploy.sh deploys to DEV only. Prod moves by the nightly roll or tools/release.sh promote-now."; exit 2; }
SRC="$(cd "$(dirname "$0")" && pwd)"
WEB=/var/www/implausible-landing/projects/turnip-works
DST=$WEB/engine
V=$(date +%Y%m%d%H%M%S)
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
# gate (2026-10-12): never deploy a half-merged or unparseable tree (a conflict-marked world.js went live for a minute)
"$SRC/../tests/check_source_sane.sh" || { echo "NOT DEPLOYED: the source tree is not sane (see above)"; exit 1; }
python3 "$SRC/tools/build_types.py"   # the Build menu's types from the catalog's setting codes (client/data/types.json)
# gate (2026-10-05): every room and type the tray lists has its icon, every listed tuner file exists
python3 "$SRC/../tools/spawn-tuner/test/assets_check.py" --quiet || { echo "NOT DEPLOYED: listed files are missing (python3 tools/spawn-tuner/test/assets_check.py names them)"; exit 1; }
mkdir -p "$STAGE"/{client,core}
rsync -a --exclude "*.md" "$SRC/client/" "$STAGE/client/"
cp "$SRC"/core/*.js "$STAGE/core/"
# version-stamp every relative module import and the page's own URLs (Cloudflare caches assets ~4 h)
sed -i -E "s#from '(\.\.?/[^']+)\.js'#from '\1.js?v=$V'#g" "$STAGE"/client/*.js "$STAGE"/client/surfaces/*.js "$STAGE"/client/ringlab/*.js "$STAGE"/core/*.js
sed -i -E "s#\?v=dev#?v=$V#g; s#TW_V = 'dev'#TW_V = '$V'#" "$STAGE/client/index.html"
# this page is the dev server's: the DEV ribbon shows (a release re-stamps it "prod": tools/release.sh)
sed -i -E 's#<meta name="tw-channel" content="[a-z]+">#<meta name="tw-channel" content="dev">#' "$STAGE/client/index.html"
# turnipworks.net serves the game at "/": same page, resolving everything under /engine/client/, the tuner under /look/
sed -E "s#<head>#<head>\n<base href=\"/engine/client/\">#; s#content=\"\.\./\.\./tuner/\"#content=\"/look/\"#; s#\"\.\./\.\./tuner/js/#\"/look/js/#g" "$STAGE/client/index.html" > "$STAGE/client/index.turnipworks.html"
cat > "$STAGE/index.html" <<HTML
<!doctype html><meta charset="utf-8"><title>Turnip Works</title>
<script>location.replace('client/' + location.search + location.hash);</script>
<a href="client/">Turnip Works</a>
HTML
# gate: the deployed tuner's room engine must load and solve in Node (the relay runs exactly this)
node --input-type=module -e "
import { loadRoomgen } from '$SRC/relay/server.js';
const rg = await loadRoomgen('$WEB/tuner/js', '$WEB/tuner/data', { orientApi: 'http://127.0.0.1:8096' });
const L = rg.solve({}, { id: 'room_deploy001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 4242 }, 1);
if (L.objects.length < 10) throw new Error('room engine produced ' + L.objects.length + ' objects');
console.log('room engine ok:', rg.version, L.objects.length, 'objects, hash', L.hash);
"
grep -q '"v"' "$WEB/tuner/version.json" || { echo "the tuner has no version.json: deploy the tuner first (tools/spawn-tuner/deploy.sh)"; exit 1; }
mkdir -p "$DST"
rsync -a --delete "$STAGE/" "$DST/"
find "$DST" -type d -exec chmod 755 {} +
find "$DST" -type f -exec chmod 644 {} +
echo "deployed client v=$V ($(du -sh "$DST" | cut -f1)) to $DST; tuner $(cat "$WEB/tuner/version.json")"
# the triage page for the feedback tickets (2026-10-19): implausible.enterprises/projects/turnip-works/tickets/, talking to
# this relay's /tickets API (relay/tickets.js) with the triage key; tools/tickets.py link prints its address with the key
mkdir -p "$WEB/tickets" && install -m 644 "$SRC/../tools/tickets/index.html" "$WEB/tickets/index.html" && chmod 755 "$WEB/tickets"
if [[ "${1:-}" != "--no-relay" ]]; then
  # a copy of the dev campaigns first (engine/tools/backup_data.sh; its own folder, the last 10): no copy, no restart
  DATA_DIR=/var/lib/tw-relay-dev/data TW_BACKUP_DIR=/mnt/usb/turnip-works/relay-data-backups/dev TW_BACKUP_KEEP=10 TW_BACKUP_ALLOW_EMPTY=1 \
    "$SRC/tools/backup_data.sh" "engine-$V" >/dev/null || { echo "DEV RELAY NOT RESTARTED: the copy of the dev campaigns failed (the client v=$V is deployed; fix the copy, then: sudo systemctl restart tw-relay-dev)"; exit 1; }
  sudo systemctl restart tw-relay-dev
  for i in $(seq 1 50); do curl -sf http://127.0.0.1:8098/health >/dev/null && break; sleep 0.2; done
  echo "dev relay: $(curl -s http://127.0.0.1:8098/health)"
fi
# a warning, never a blocker: the house look the game loads must not be a test leftover (tests write to a sandbox)
python3 "$SRC/../tests/check_house_look.py" --warn || true
# and the review tools still show every library asset (the sweep itself runs in tools/spawn-tuner/deploy.sh)
python3 "$SRC/../tools/tool-sweep/check.py" --warn --quiet || true
# (2026-10-19) say plainly where this went: an agent used to the old rules looks for it on turnipworks.net
echo "DEV ONLY: client v=$V is on dev.turnipworks.net (from the build box: http://127.0.0.1:8180/). turnipworks.net is prod and moves at the nightly roll; after your suites pass, mark the candidate: TW_LOCK_HELD=1 tools/release.sh candidate (docs/STATUS.md \"Two servers\")"
