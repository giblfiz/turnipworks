#!/bin/bash
# qa_floor.sh SKU : 3x3 sheet + measured seams (check.py) -> Gemini blind read (neutral file names)
cd "$(dirname "$0")"; n=$1
python3 check.py $n
./gv.sh raw/prompts/floor-blind.txt raw/gemini/$n.blind.txt raw/checks/$n-single.jpg raw/checks/$n-3x3.jpg
