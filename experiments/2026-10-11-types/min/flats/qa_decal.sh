#!/bin/bash
# qa_decal.sh SKU : key with the tuner's own prep/flats.py (check.py: box, residue, sheets) -> Gemini blind read
cd "$(dirname "$0")"; n=$1
python3 check.py $n 2>&1 | grep -v Deprec
./gv.sh raw/prompts/decal-blind.txt raw/gemini/$n.blind.txt raw/checks/$n-cut-on-white.jpg raw/checks/$n-on-floor.jpg
