#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 5 ]]; then
  echo "usage: $0 HOST PORT REMOTE_RUN LOCAL_RUN PUBLIC_REVIEW_DIR" >&2
  exit 2
fi

host=$1
port=$2
remote_run=$3
local_run=$(realpath "$4")
public_review=$(realpath "$5")
project=$(cd "$(dirname "$0")/.." && pwd)
manifest="$project/catalog/runs/inn-01/manifest.tsv"
review="$project/web/review"

while true; do
  rsync -az --ignore-existing -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -p $port" \
    "root@$host:$remote_run/models/" "$local_run/models/"
  python "$project/src/build_live_review.py" \
    --run "$local_run" --manifest "$manifest" --output "$review"
  rsync -a --delete "$review/" "$public_review/"
  find "$public_review" -type d -exec chmod 755 {} +
  find "$public_review" -type f -exec chmod 644 {} +
  if [[ -e "$local_run/HARVEST_COMPLETE" || -e "$local_run/HARVEST_FAILED" ]]; then
    break
  fi
  sleep 300
done
