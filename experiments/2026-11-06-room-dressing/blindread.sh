#!/bin/bash
# blind Gemini read: blindread.sh <isolated dir holding the images and prompt.md> [outfile]
# (runs agy-run from inside the isolated folder, stdin closed, under the shared agy lock)
set -e
dir="$1"; out="${2:-$1/answer.txt}"
cd "$dir"
flock /tmp/agy.lock $HOME/fauna-tools/agy-run -C "$dir" -t 420 -o "$out" "$(cat prompt.md)" < /dev/null
cat "$out"
