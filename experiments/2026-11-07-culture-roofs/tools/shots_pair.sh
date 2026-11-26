#!/bin/bash
# before (the old code at a7b5c59e, in a throwaway worktree on USB) and after (this worktree): the same buildings, cameras, no UI
U=/mnt/usb/turnip-works/lanes-2026-11-07/culture-roofs
B=${1:-before2}; A=${2:-after1}
mkdir -p $U/$B $U/$A
cd $U/oldtree && TW_GPU=1 TW_PORTS=18473,18974 timeout 1200 python3 engine/test/browser_cultureroofs.py --local --shots $U/$B 2>&1 | grep -E "shot|FAIL|Traceback" | tr '\n' ' '; echo
cd $TW_REPO && TW_GPU=1 TW_PORTS=18473,18974 timeout 1200 python3 engine/test/browser_cultureroofs.py --local --shots $U/$A 2>&1 | grep -E "shot|FAIL|Traceback" | tr '\n' ' '; echo
