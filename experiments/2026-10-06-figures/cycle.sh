#!/usr/bin/env bash
# One publishing round for the default set: harvest what the pod has finished (if a pod is up), measure and judge the
# new meshes, cut the tiers, publish the accepted ones, draw their thumbnails, Gemini's blind read, deploy the gallery.
#   ./cycle.sh [--no-harvest] [--no-deploy]
set -uo pipefail
cd "$(dirname "$0")"; PYT=$HOME/.local/share/tw-trimesh-venv/bin/python; PYB=python3; PYG=python3
if [[ " $* " != *" --no-harvest "* && -f pod.json ]]; then tools/harvest.sh set auto auto 2>&1 | tail -2; fi
$PYT set_qa.py --procs=6 2>&1 | tail -4
python3 publish.py --expected=518 | tail -1
$PYB thumbs.py auto set/published 2>&1 | tail -2
$PYG set_blind.py 2>&1 | tail -1
python3 publish.py --expected=518 | tail -1
if [[ " $* " != *" --no-deploy "* ]]; then ./deploy_set.sh 2>&1 | tail -1; fi
date +"%H:%M:%S round done"
