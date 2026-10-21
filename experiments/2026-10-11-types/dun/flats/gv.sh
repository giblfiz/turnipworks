#!/bin/bash
# gv.sh PROMPTFILE OUTFILE IMG... : Gemini read (gemini-2.5-pro). The images are copied to neutral names first
# (image-1.jpg, image-2.jpg ...): gemini-vision.py tells the model each file's name, and a blind read must not see the subject.
cd "$(dirname "$0")"; p=$1; o=$2; shift 2
d=$(mktemp -d); i=0; a=()
for f in "$@"; do i=$((i+1)); e=${f##*.}; cp "$f" "$d/image-$i.$e"; a+=("$d/image-$i.$e"); done
python3 $HOME/fauna-tools/gemini-vision.py gemini-2.5-pro "$p" "${a[@]}" > "$o" 2>"$o.err"; [ -s "$o.err" ] || rm -f "$o.err"; rm -rf "$d"; cat "$o"
