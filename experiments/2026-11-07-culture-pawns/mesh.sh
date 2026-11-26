#!/usr/bin/env bash
# One wave on THE pod: stage the plates, mesh them (TRELLIS.2, the figure set's settings: 1024 cascade, 2048 px), bring
# the meshes home, measure them. Safe to run again for a second wave (only plates with no mesh yet are meshed).
#   experiments/2026-11-07-culture-pawns/mesh.sh [ids...]      (ids: re-mesh those, a fresh seed)
set -euo pipefail
cd "$(dirname "$0")"
python3 pod_prep.py prep "$@"
cd pod
PIPE=1024_cascade TEX=2048 tools/launch_wave.sh figs auto auto "$@"
tools/wait_wave.sh figs auto auto 120
tools/harvest.sh figs auto auto
cd ..
python3 pod_prep.py home
$HOME/.local/share/tw-trimesh-venv/bin/python qa.py --procs=4 | tail -60
