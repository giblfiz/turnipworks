#!/bin/bash
# run_queue.sh LOG NAME NAME ... : one Codex request at a time, in order; the base furrow floor is made seamless at once (its variant needs it)
cd "$(dirname "$0")"; log=$1; shift
for n in "$@"; do
  [ -f QUOTA_STOP.txt ] && { echo "QUOTA_STOP.txt exists: stopping before $n" >> "$log"; exit 75; }
  python3 gen.py "$n" >> "$log" 2>&1
  case $n in floor-field-furrows) [ -f inputs/$n.jpg ] && python3 finish.py "$n" >> "$log" 2>&1;; esac
done
echo "$(date +%T) queue done" >> "$log"
