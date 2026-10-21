#!/bin/bash
cd /tmp/scratch/ac; PY=python3
export TW_MM_PORTS=18234,18861 TW_AC_DATA=/var/tmp/tw-delivery/relay-data-wt TW_MM_REPO=$TW_REPO
python3 ac.py stack > stack-wt.log 2>&1 & SP=$!
for i in $(seq 60); do curl -sf -m 2 http://127.0.0.1:18234/health >/dev/null && break; sleep 1; done
TW_AC_TAG=s3 $PY pixdiff.py room s3 img='&imgtex' bmp='' 2>&1 | grep -v "tw_sandbox\|video memory"
for r in 1 2; do for s in room inn; do
  TW_AC_TAG=s3-img$r TW_AC_EXTRA='&imgtex' $PY load.py $s > /var/tmp/tw-delivery/out/load-$s-s3img$r.log 2>&1
  TW_AC_TAG=s3-bmp$r $PY load.py $s > /var/tmp/tw-delivery/out/load-$s-s3bmp$r.log 2>&1
done; done
python3 sumload.py s3-img1 s3-bmp1 s3-img2 s3-bmp2
echo FIREFOX
TW_BROWSER=firefox PIX_FX=nofx TW_AC_TAG=s3ff timeout 900 $PY pixdiff.py room s3ff img='&imgtex' bmp='' 2>&1 | grep -v "video memory" | tail -14
kill $SP; pkill -P $SP
