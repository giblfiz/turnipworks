#!/usr/bin/env bash
# The last lines of a culture's worker logs on the pod:   tools/pod_tail.sh CODE [N=6]
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
resolve_type "$1"; resolve_host_port auto auto
ssh_ "for f in $R/worker-*.log; do echo == \$f; tail -${2:-6} \$f | cut -c1-220; done; nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader"
