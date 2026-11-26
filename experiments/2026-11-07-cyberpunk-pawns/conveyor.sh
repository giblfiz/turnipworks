#!/usr/bin/env bash
# every 2 min: meshes home from the pod, QA on the new ones. Stops when STOP exists. (pod waves are started by hand)
cd "$(dirname "$0")"
while [ ! -e STOP ]; do
  (cd pod && tools/harvest.sh figs auto auto >/dev/null 2>&1)
  python3 pod_prep.py home
  $HOME/.local/share/tw-trimesh-venv/bin/python qa.py --procs=3 2>&1 | grep -v cached | tail -3
  sleep 120
done
