#!/bin/bash
cd /tmp/scratch/ac; PY=python3
export TW_MM_PORTS=18234,18861 TW_AC_DATA=/var/tmp/tw-delivery/relay-data-wt TW_MM_REPO=$TW_REPO
python3 ac.py stack > stack-wt.log 2>&1 & SP=$!
for i in $(seq 60); do curl -sf -m 2 http://127.0.0.1:18234/health >/dev/null && break; sleep 1; done
for s in room inn; do PIX_FX=nofx TW_AC_TAG=s4 $PY pixdiff.py $s s4 f10k='' fit='&faces=fit' f5k='&faces=5000' 2>&1 | grep -v "tw_sandbox\|video memory\|/nofx/"; done
for s in room inn town; do TW_AC_TAG=s4-fit TW_AC_EXTRA='&faces=fit' $PY load.py $s > /var/tmp/tw-delivery/out/load-$s-s4fit.log 2>&1; done
TW_AC_TAG=s4-10k $PY load.py town > /var/tmp/tw-delivery/out/load-town-s4-10k.log 2>&1
python3 sumload.py s3-bmp2 s4-10k s4-fit
kill $SP; pkill -P $SP
