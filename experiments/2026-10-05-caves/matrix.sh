#!/usr/bin/env bash
# Which control hides the grid? One shot of scene A at table distance per setting, two Gemini reads each (judge.txt).
#   ./matrix.sh BASE TAG "name:query" ...        e.g.  ./matrix.sh http://127.0.0.1:8791/ m1 "base:&overlap=0.3&turn=0&wander=0"
set -u; cd "$(dirname "$0")"; BASE=$1; TAG=$2; shift 2; SCENE=${SCENE:-rect}; mkdir -p shots/$TAG gemini
for spec in "$@"; do name=${spec%%:*}; q=${spec#*:}
  python3 shoot.py $BASE shots/$TAG/$name $SCENE "$q" table 2>&1 | grep -i "error" | head -3
  f=$(ls shots/$TAG/$name/$SCENE-table*.png | head -1)
  for k in 1 2; do python3 $HOME/fauna-tools/gemini-vision.py ${MODEL:-gemini-2.5-pro} gemini/judge.txt $f > gemini/$TAG-$name.$k.txt 2>&1 & done
done; wait
for spec in "$@"; do name=${spec%%:*}; echo "$name  ${spec#*:}  continuous $(grep -h '^CONTINUOUS_ROCK' gemini/$TAG-$name.?.txt | sed 's/.*: //' | tr '\n' ' ') outline $(grep -h '^OUTLINE_VISIBLE' gemini/$TAG-$name.?.txt | sed 's/.*: //' | tr '\n' ' ') | $(grep -h '^VERDICT' gemini/$TAG-$name.?.txt | sed 's/VERDICT: //' | tr '\n' ';')"; done
