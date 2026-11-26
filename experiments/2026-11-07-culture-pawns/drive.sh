#!/usr/bin/env bash
# Keep the plates moving: judge whatever is painted and not judged (gate.py, 6 a call), and when the main painting run
# has finished, paint again what the gate refused (plates.py), until every plate is accepted or rejected.
#   experiments/2026-11-07-culture-pawns/drive.sh  (logs to the USB folder)
cd "$(dirname "$0")"; L=/mnt/usb/turnip-works/lanes-2026-11-07/culture-pawns; PY=python3
for round in $(seq 1 30); do
  python3 gate.py --n=6 >> $L/gate.log 2>&1
  left=$(python3 -c "
import json; st=json.load(open('set/plates.json')); G=json.load(open('set/gate.json')) if __import__('os').path.exists('set/gate.json') else {}
A=[a['id'] for a in json.load(open('set/assets.json'))['assets']]
print(sum(1 for i in A if G.get(i,{}).get('status') not in ('accepted','rejected')))")
  echo "$(date +%H:%M) round $round: $left not settled" >> $L/drive.log
  [[ $left == 0 ]] && break
  if ! pgrep -f "plates.py --workers=6" >/dev/null; then $PY plates.py --workers=4 >> $L/plates-retry.log 2>&1; fi
  sleep 30
done
echo "$(date +%H:%M) drive done" >> $L/drive.log
