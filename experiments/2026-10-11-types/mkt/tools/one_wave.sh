#!/usr/bin/env bash
# A short pod session for late plates: up (RTX 4090, 1 h timers), mesh what has no GLB, harvest, down. Log: mkt/one-wave.log
cd "$(dirname "$0")/../.."; export TW_B=$PWD POD_NAME=tw-mkt; T=../2026-10-05-castle-crypt-mansion/tools
exec >> mkt/one-wave.log 2>&1; echo "=== $(date -Is)"
for try in 1 2 3; do mkt/tools/pod_up_mkt.sh 1 --gpu 4090 && break; sleep 45; done
test -f pod.json || { echo "NO POD"; exit 1; }
mkt/tools/pod_deadman.sh || true
$T/launch_wave.sh mkt auto auto; $T/wait_wave.sh mkt auto auto | tr '\r' '\n' | tail -2; $T/harvest.sh mkt auto auto
$T/pod_down.sh --force; mv pod-*.json pod-create.* mkt/ 2>/dev/null; cat spend.log >> mkt/spend.log; rm -f spend.log; cat deletion-timer.log >> mkt/deletion-timer.log; rm -f deletion-timer.log
echo "=== $(date -Is) done"
