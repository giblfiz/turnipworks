#!/usr/bin/env bash
# Start one Codex image worker per BRIEF-<k>.md given (ChatGPT plan, built-in image_gen; never an API key), detached.
#   tools/plates.sh 1 2 3 ...        logs: worker-logs/codex-<k>.log ; pid files: worker-logs/codex-<k>.pid
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); cd "$E"; mkdir -p plates worker-logs
for k in "$@"; do
  p=worker-logs/codex-$k.pid
  if [[ -f $p ]] && kill -0 "$(cat "$p")" 2>/dev/null; then echo "worker $k already running"; continue; fi
  nohup setsid codex exec --skip-git-repo-check -s workspace-write -C "$E" - < "BRIEF-$k.md" > "worker-logs/codex-$k.log" 2>&1 &
  echo $! > "$p"; echo "worker $k: pid $(cat "$p")"
  sleep 3
done
