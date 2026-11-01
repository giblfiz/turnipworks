#!/usr/bin/env bash
# one Codex image worker per brief (built-in image_gen on the ChatGPT plan; no API key)
cd "$(dirname "$0")"
for n in "$@"; do
  ( echo "Read BRIEF-$n.md in the current directory and do exactly what it says." | env -u OPENAI_API_KEY codex exec -s workspace-write --skip-git-repo-check - > worker-$n.log 2>&1; echo "exit $?" >> worker-$n.log ) &
done
wait
