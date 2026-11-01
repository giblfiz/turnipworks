#!/bin/bash
# Ask Gemini (agy-run, the subscription; serial under /tmp/agy.lock) about stills, from an isolated folder holding only
# the images (so it reads pixels, not code).   gemini.sh <name> <prompt-file> <image> [<image> ...]
# Writes gemini/<name>.txt (the prompt, then the answer).
set -u
HERE=$(cd "$(dirname "$0")" && pwd); name=$1; pf=$2; shift 2
d=$(mktemp -d /tmp/aura-gem-XXXX); for f in "$@"; do cp "$f" "$d/"; done
mkdir -p "$HERE/gemini"
P="$(cat "$pf")
The images are in $d: $(cd "$d" && ls | tr '\n' ' ')
Do NOT create, crop or write any files. Do not read any other files or folders."
for model in gemini-4-argon-high gemini-3.8-flash-high; do
  flock /tmp/agy.lock timeout 1500 $HOME/fauna-tools/agy-run -m "$model" -C "$d" -t 900 -o "$d/out.txt" "$P" < /dev/null > "$d/log.txt" 2>&1
  if [ -s "$d/out.txt" ]; then break; fi
done
{ echo "$P"; echo; echo "===== ($model)"; cat "$d/out.txt" 2>/dev/null; } > "$HERE/gemini/$name.txt"
rm -rf "$d"
echo "done $name ($model): $(wc -c < "$HERE/gemini/$name.txt") bytes"
