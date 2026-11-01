#!/bin/bash
# game-qa.sh SRC.png TAG "intent" : table-distance mock (view.py) of SRC next to our flagstone (judged good) -> Gemini via agy-run
S=$(dirname "$0"); T=$(cd "$(dirname "$0")" && pwd); src=$1; tag=$2; intent=$3
FT=${FT:-5} python3 $S/view.py "$src" $T/raw/checks/$tag-gameview.jpg; [ -f $T/raw/checks/ref-flagstone-gameview.jpg ] || FT=5 python3 $S/view.py $T/seamless/roof-flat--flagstone.png $T/raw/checks/ref-flagstone-gameview.jpg
d=$(mktemp -d /tmp/roofgv-XXXX); cp $T/raw/checks/$tag-gameview.jpg $d/view-1.jpg; cp $T/raw/checks/ref-flagstone-gameview.jpg $d/view-2.jpg
python3 -c "import sys; print(open(sys.argv[1]).read().replace('{intent}', sys.argv[2]).replace('{ft}', sys.argv[3]))" $T/raw/prompts/game-view.txt "$intent" "${FT:-5}" > $d.prompt
flock /tmp/agy.lock $HOME/fauna-tools/agy-run -C $d -t 300 -o $T/raw/gemini-v2/$tag.gameview.txt < $d.prompt
rm -rf $d $d.prompt; cat $T/raw/gemini-v2/$tag.gameview.txt
