#!/bin/bash
# tools/shots.sh OUTDIR [room_shots.py args...]: rooms from sandbox/real at table distance + the blind read. Run through tw-slot.
SMI=$(cd "$(dirname "$0")/.." && pwd); OUT=$1; shift
cd $SMI/integration/sandbox/real && (python3 -m http.server 18893 --bind 127.0.0.1 > /dev/null 2>&1 & echo $! > /tmp/smi-http.pid); sleep 1
python3 $SMI/integration/tests/room_shots.py "smithy & workshop" http://127.0.0.1:18893 "$SMI/$OUT" http://127.0.0.1:8096 "$@"; rc=$?
kill $(cat /tmp/smi-http.pid); exit $rc
