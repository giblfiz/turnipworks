#!/bin/bash
# chain.sh PID LOG NAMES... : start run_queue.sh after process PID has ended (keeps Codex requests strictly one at a time)
cd "$(dirname "$0")"; p=$1; shift
while kill -0 $p 2>/dev/null; do sleep 5; done; sleep 20
exec ./run_queue.sh "$@"
