#!/usr/bin/env bash
# Ask the RunPod API, independently of pod_down.sh's own check, whether this lane's pod is gone.   pod/verify_gone.sh POD_ID
source "$(dirname "$0")/tools/pod_lib.sh"
echo "pod $1: $(rp_pod_state "$1")"
echo "pods named $POD_NAME not terminated: $(rp_our_pods)"
