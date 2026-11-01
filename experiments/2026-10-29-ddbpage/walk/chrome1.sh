#!/bin/bash
# a brand-new Chrome profile, real Google Chrome, on :102
exec env DISPLAY=:102 google-chrome --user-data-dir=/tmp/scratch/walk/prof1 --no-first-run --no-default-browser-check --remote-debugging-port=9333 --window-position=0,0 --window-size=1600,900 --lang=en-US --disable-features=Translate --use-angle=vulkan --enable-features=Vulkan --ignore-gpu-blocklist --enable-gpu --hide-crash-restore-bubble "$@"
