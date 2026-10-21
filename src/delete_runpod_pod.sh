#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[a-z0-9]+$ ]]; then
  printf 'usage: %s POD_ID\n' "$0" >&2
  exit 64
fi

credential_file=${RUNPOD_CREDENTIAL_FILE:-$HOME/.config/turnip-works/runpod.json}
export RUNPOD_API_KEY
RUNPOD_API_KEY=$(jq -r .api_key "$credential_file")
exec /usr/local/bin/runpodctl pod delete "$1"
