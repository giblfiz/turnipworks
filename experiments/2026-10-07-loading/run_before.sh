#!/usr/bin/env bash
# the "before" measurements that take a while (Firefox draws with software GL on this box)
export TW_LOAD_REPO=$TW_REPO  # the code before this work (main)
cd "$(dirname "$0")"; PY=python3; export TW_PORTS=18233,18863
timeout 900 $PY timeline.py --tag before --live --sizes 5 --film --runs 3 > results/before-chromium-live.log 2>&1
TW_BROWSER=firefox timeout 1500 $PY timeline.py --tag before --film --waits --runs 2 > results/before-firefox-local.log 2>&1
TW_BROWSER=firefox timeout 900 $PY timeline.py --tag before --live --sizes 5 --film --runs 2 > results/before-firefox-live.log 2>&1
echo done
