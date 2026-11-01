#!/bin/bash
# gemini.sh OUT.txt PROMPT.txt img... : the images (as view-1.png, view-2.png ...) and the prompt to Gemini via agy-run, serially
out=$1; prompt=$2; shift 2
d=$(mktemp -d /tmp/piplib-gem-XXXX); i=1
for f in "$@"; do cp "$f" $d/view-$i.png; i=$((i+1)); done
flock /tmp/agy.lock $HOME/fauna-tools/agy-run -C $d -t 600 -o "$out" < "$prompt"
rm -rf $d; cat "$out"
