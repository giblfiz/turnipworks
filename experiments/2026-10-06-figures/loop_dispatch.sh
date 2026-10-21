#!/usr/bin/env bash
# Feed the pods every minute (the publishing rounds run separately in loop_publish.sh so a slow round never leaves a pod idle).
#   setsid nohup ./loop_dispatch.sh > /dev/null 2>&1 &      stop: touch set/DISPATCH_STOP
cd "$(dirname "$0")"; echo $$ > set/dispatch.pid
while [[ ! -f set/DISPATCH_STOP ]]; do python3 dispatch.py --min=${MIN:-8} 2>&1 | tail -7 >> set/dispatch.log; sleep ${EVERY:-60}; done
rm -f set/dispatch.pid set/DISPATCH_STOP
