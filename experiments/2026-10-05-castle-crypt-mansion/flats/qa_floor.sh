#!/bin/bash
# qa_floor.sh SKU ["spec"] : finish -> 3x3 sheet + numbers -> Gemini blind read (+ match read against the spec, bases only;
# variants get the tiling-damage read instead)
n=$1
python3 finish.py $n | tail -1; python3 check.py $n
if [ -n "$2" ]; then
  python3 $HOME/fauna-tools/gemini-vision.py gemini-2.5-pro raw/prompts/floor-blind.txt raw/checks/$n-single.jpg raw/checks/$n-3x3.jpg > raw/gemini/$n.blind.txt; cat raw/gemini/$n.blind.txt
  ./match.sh $n "$2 (First image: one tile; second: the tile repeated 3x3.)" raw/checks/$n-single.jpg raw/checks/$n-3x3.jpg
else
  python3 $HOME/fauna-tools/gemini-vision.py gemini-2.5-pro raw/prompts/floor-count2.txt raw/checks/$n-single.jpg raw/checks/$n-3x3.jpg > raw/gemini/$n.tiling.txt; cat raw/gemini/$n.tiling.txt
fi
