#!/bin/bash
cd /tmp/scratch/ac; PY=python3
export TW_MM_PORTS=18234,18861 TW_AC_DATA=/var/tmp/tw-delivery/relay-data-wt TW_MM_REPO=$TW_REPO
python3 ac.py stack > stack-wt.log 2>&1 & SP=$!
for i in $(seq 60); do curl -sf -m 2 http://127.0.0.1:18234/health >/dev/null && break; sleep 1; done
TW_AC_TAG=s2 $PY pixdiff.py room s2 old='&nodelivery' new='' 2>&1 | grep -v tw_sandbox
for s in room inn town; do
  TW_AC_TAG=s2-raw TW_AC_EXTRA='&nodelivery' $PY load.py $s > /var/tmp/tw-delivery/out/load-$s-s2raw.log 2>&1
  TW_AC_TAG=s2-mo $PY load.py $s > /var/tmp/tw-delivery/out/load-$s-s2mo.log 2>&1
done
python3 sumload.py s2-raw s2-mo
kill $SP; pkill -P $SP
