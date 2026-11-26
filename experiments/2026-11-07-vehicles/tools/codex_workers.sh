#!/usr/bin/env bash
# Start one Codex image worker per brief (ChatGPT plan, built-in image_gen; no API key), 20 s apart, and wait for all.
#   tools/codex_workers.sh BRIEF-a.md [BRIEF-b.md ...]      logs: work/codex-<brief>.log
set -uo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); mkdir -p "$E/work" "$E/plates"
pids=()
for b in "$@"; do
  n=$(basename "$b" .md)
  env -u OPENAI_API_KEY codex exec --skip-git-repo-check -s workspace-write -C "$E" \
    "Read ./$n.md in this folder and carry out every shot in it exactly as it says, in order, until plates/DONE file it names is written." \
    > "$E/work/codex-$n.log" 2>&1 < /dev/null &
  pids+=($!); echo "$(date -Is) started $n pid $!"; sleep 20
done
for p in "${pids[@]}"; do wait "$p"; echo "$(date -Is) worker $p exited $?"; done
echo "$(date -Is) ALL-WORKERS-DONE"
