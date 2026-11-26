#!/usr/bin/env bash
# Read whatever trio pictures have no read yet, one reads_trio.py at a time (it is the only writer of reads_trio.json),
# up to 12 a call; stop when every picture is read and the meshing is over (the file pod/figs-done exists), or at 13:30.
cd "$(dirname "$0")"; L=/mnt/usb/turnip-works/lanes-2026-11-07/culture-pawns
while [[ 10#$(date +%H%M) -lt 1330 ]]; do
  while pgrep -f "python3 reads_trio.py" > /dev/null; do sleep 20; done
  left=$(python3 -c "
import json,os; D=json.load(open('reads_trio.json')) if os.path.exists('reads_trio.json') else {}
import glob; print(sum(1 for p in glob.glob('$L/stills/trio/*.png') if os.path.basename(p)[:-4] not in D))")
  if [[ $left == 0 ]]; then [[ -e pod/figs-done ]] && break; sleep 60; continue; fi
  echo "$(date +%H:%M) reading $left" >> $L/reads-loop.log
  python3 reads_trio.py --n=14 --first=IND >> $L/reads-loop.log 2>&1
done
echo "$(date +%H:%M) reads loop done" >> $L/reads-loop.log
