#!/usr/bin/env bash
# Deploy the Spawn Tuner to https://implausible.enterprises/projects/turnip-works/tuner/ (the DEV tree; the dev game at
# dev.turnipworks.net imports it at /look/). Prod has its own pinned copy: tools/release.sh.
# Stamps a version on every module import, stylesheet and data URL so browsers never mix stale modules.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DST=/var/www/implausible-landing/projects/turnip-works/tuner
V=$(date +%Y%m%d%H%M%S)
# gate (2026-10-12): two batches must not claim one sku (one mesh file per sku: the later build overwrote the earlier
# batch's mesh four times in two days). tools/tool-sweep/sku_guard.py names both batches; TW_SKU_GUARD=warn lets a deploy through.
python3 "$SRC/../tool-sweep/sku_guard.py" || { echo "NOT DEPLOYED: a sku is claimed by two batches (see above; tools/tool-sweep/README.md)"; exit 1; }
# the delivered copies of the assets (2026-10-11, docs/ASSET_DELIVERY.md): built here so a mesh or picture added by
# anyone since the last deploy is delivered like the rest. Only what changed is built; a first run is long.
# the palette's groups are the game's building types (data/types.json, written by engine/tools/build_types.py; 2026-10-12)
python3 "$SRC/../../engine/tools/build_types.py" >/dev/null || { echo "NOT DEPLOYED: engine/tools/build_types.py failed"; exit 1; }
python3 "$SRC/prep/delivery.py" || { echo "NOT DEPLOYED: prep/delivery.py failed"; exit 1; }
# gate (2026-10-05): nothing may be listed without its file (library urls, ladder files, wall families, room and type icons)
# gate (2026-10-12): never deploy a half-merged or unparseable tree (a conflict-marked world.js went live for a minute)
"$SRC/../../tests/check_source_sane.sh" || { echo "NOT DEPLOYED: the source tree is not sane (see above)"; exit 1; }
python3 "$SRC/test/assets_check.py" --quiet || { echo "NOT DEPLOYED: listed files are missing (python3 tools/spawn-tuner/test/assets_check.py names them; usually prep/flats.py then build_data.py)"; exit 1; }
node "$SRC/ring/extract.mjs"
cp "$SRC/../../engine/client/icons.js" "$SRC/ring/line-icons.js"
mkdir -p "$DST"
rsync -aH --delete --exclude '*.owner' --exclude 'assets/d/.*' --exclude test --exclude prep --exclude '*.py' --exclude '*.md' --exclude deploy.sh --exclude '__pycache__' "$SRC/" "$DST/"
sed -i -E "s#from './([a-z0-9]+)\.js'#from './\1.js?v=$V'#g; s#\.json\?v=[0-9a-z]+#.json?v=$V#g" "$DST"/js/*.js
# FX modules (js/fx/, 2026-10-02): stamp their relative imports too, and main.js's './fx/index.js'
sed -i -E "s#from '(\.\.?/)(fx/)?([a-z0-9]+)\.js'#from '\1\2\3.js?v=$V'#g" "$DST"/js/fx/*.js
sed -i -E "s#\.json\?v=[0-9a-z]+#.json?v=$V#g" "$DST"/js/fx/*.js
sed -i -E "s#from './fx/([a-z0-9]+)\.js'#from './fx/\1.js?v=$V'#g" "$DST"/js/main.js
sed -i -E "s#(styles\.css|main\.js)\?v=[0-9a-z]+#\1?v=$V#g" "$DST/index.html"
sed -i -E "s#ring/app\.js(\?v=[0-9a-z]+)?#ring/app.js?v=$V#g; s#ring/style\.css(\?v=[0-9a-z]+)?#ring/style.css?v=$V#g" "$DST/ring.html"
find "$DST" -type d -exec chmod 755 {} +
find "$DST" -type f -exec chmod 644 {} +
# the game (engine/client) imports this deployed tuner directly: version.json tells it which stamp to import, and the
# DEV relay (tw-relay-dev) solves rooms with the same code, so restart it onto the new version. This is the DEV tree:
# prod (turnipworks.net) has its own copy of the tuner files inside its release and never sees this deploy
# (2026-10-19; docs/NETCODE.md "Two servers"; tools/release.sh)
printf '{"v":"%s","at":"%s"}\n' "$V" "$(date -Iseconds)" > "$DST/version.json"; chmod 644 "$DST/version.json"
# (a copy of every saved campaign first, 2026-10-06: engine/tools/backup_data.sh; no copy, no restart)
if systemctl list-unit-files tw-relay-dev.service >/dev/null 2>&1; then DATA_DIR=/var/lib/tw-relay-dev/data TW_BACKUP_DIR=/mnt/usb/turnip-works/relay-data-backups/dev TW_BACKUP_KEEP=10 TW_BACKUP_ALLOW_EMPTY=1 "$(dirname "$0")/../../engine/tools/backup_data.sh" "tuner-$V" >/dev/null && sudo systemctl restart tw-relay-dev && echo "tw-relay-dev restarted onto tuner v=$V"; fi
echo "deployed v=$V ($(du -sh "$DST" | cut -f1))"
grep -o "solver.js?v=[0-9]*" "$DST/js/main.js" | head -1
# a warning, never a blocker: the house look the game loads must not be a test leftover (tests write to a sandbox)
python3 "$SRC/../../tests/check_house_look.py" --warn || true
# every library asset reaches Harry's review tools (2026-10-12, tools/tool-sweep/README.md): the sweep lists whatever is
# new in the asset rater, the Alignment Bench queues and the open/shut tester; the check says so loudly if a library
# asset is in none of the tools it belongs in. Neither can stop a deploy of the game.
python3 "$SRC/../tool-sweep/sweep.py" || echo "TOOL SWEEP FAILED (python3 tools/tool-sweep/sweep.py): new assets may be missing from the review tools"
python3 "$SRC/../tool-sweep/check.py" --warn || true
