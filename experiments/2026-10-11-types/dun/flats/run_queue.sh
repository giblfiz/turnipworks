#!/bin/bash
# run_queue.sh LOG NAME NAME ... : one Codex request at a time, in the order given; a base floor is made seamless
# (finish.py) as soon as it is painted, because its variants are painted against the finished base.
cd "$(dirname "$0")"; log=$1; shift
for n in "$@"; do
  [ -f QUOTA_STOP.txt ] && { echo "QUOTA_STOP.txt exists: stopping before $n" >> "$log"; exit 75; }
  python3 gen.py "$n" >> "$log" 2>&1
  case $n in floor-cut-rock|floor-water-flooded|floor-flagstone-dungeon) [ -f inputs/$n.jpg ] && python3 finish.py "$n" >> "$log" 2>&1;; esac
done
echo "$(date +%T) queue done" >> "$log"
