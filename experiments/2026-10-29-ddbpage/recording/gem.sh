#!/bin/bash
# gem.sh "prompt" img1 [img2 ...] : Gemini (agy-run, subscription) looks at copies of the images in a fresh folder
P="$1"; shift; D=$(mktemp -d /tmp/scratch/gemv-XXXX); n=0; names=""
for f in "$@"; do n=$((n+1)); e="${f##*.}"; cp "$f" "$D/image$n.$e"; names="$names image$n.$e"; done
FULL="Look at these image files in this folder:$names. Answer from looking at the image(s) alone. Do NOT create, crop or write any files. Do not run any commands other than viewing these images, and do not open or search any other file. First read and list every explicit label, caption and piece of text you can see, then answer.

$P"
flock /tmp/agy.lock $HOME/fauna-tools/agy-run -C "$D" -t 400 "$FULL" < /dev/null
