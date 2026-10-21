#!/bin/bash
# qa_icons.sh NAME... : post.py (key, trim, 128 px) -> icon_sheets.py -> Gemini blind read against the reference sheet.
# The read is saved as raw/gemini/icons-<first>.blind.txt with the image-number -> name map on its first line.
cd "$(dirname "$0")"; IFS=,; python3 post.py "$*" | tee -a raw/checks/icons-measured.txt; unset IFS
python3 icon_sheets.py
a=(raw/checks/icons-reference.png); m=""; i=1
for n in "$@"; do i=$((i+1)); a+=(raw/checks/$n-view.png); m="$m image-$i=$n"; done
o=raw/gemini/icons-$1.blind.txt
./gv.sh raw/prompts/icon-blind.txt $o.tmp "${a[@]}" > /dev/null; { echo "MAP:$m"; cat $o.tmp; } > $o; rm -f $o.tmp; cat $o
