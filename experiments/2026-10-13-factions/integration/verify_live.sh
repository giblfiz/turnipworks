#!/usr/bin/env bash
# Run AFTER releasing the landing lock.
set -euo pipefail
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  cat <<'HELP'
Usage: integration/verify_live.sh [--help]
Read-only post-deploy verification outside the landing lock: live asset URLs, SKU ownership, tool coverage and version stamps.
HELP
  exit 0
fi
M=$TW_REPO
cd "$M"
python3 tools/spawn-tuner/test/assets_check.py --live
python3 tools/tool-sweep/sku_guard.py
python3 tools/tool-sweep/check.py
curl -fsS https://implausible.enterprises/projects/turnip-works/tuner/version.json
curl -fsS https://turnipworks.net/ | rg -o "main\.js\?v=[0-9]+"
