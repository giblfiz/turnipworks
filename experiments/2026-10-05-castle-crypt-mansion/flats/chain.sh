#!/bin/bash
# chain.sh PID LOG NAMES : run gen.py NAMES after process PID has ended (keeps Codex requests strictly one at a time)
while kill -0 $1 2>/dev/null; do sleep 5; done; sleep 20
exec python3 gen.py $3 > $2 2>&1
