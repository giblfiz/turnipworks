#!/usr/bin/env bash
# Read-only: RunPod balance, spend/hr, and the account's pods (names and status only).
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
rp_account | jq '{clientBalance, currentSpendPerHr, pods: [.pods[] | {name, desiredStatus, costPerHr}]}'
echo "ours ($POD_NAME): $(rp_our_pods)"
