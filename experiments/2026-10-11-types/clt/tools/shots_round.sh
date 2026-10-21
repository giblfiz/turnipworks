#!/bin/sh
# one round of local room shots + blind reads: all nine rooms as devils, the four flavor rooms again as spiders
cd "$(dirname "$0")/.."; R=$1
S=/tmp/scratch/tw-slot; PY=python3
$S $PY integration/room_shots.py "cult sanctum" http://127.0.0.1:8795 shots-$R http://127.0.0.1:8096 --seeds 11,12 --sizes default --flavors devils --reads 2 --read > shots-$R.log 2>&1
$S $PY integration/room_shots.py "cult sanctum" http://127.0.0.1:8795 shots-$R-spiders http://127.0.0.1:8096 --seeds 11,12 --sizes default --flavors spiders --keys cult-sanctum,cult-passage,cult-summoning,cult-vault --reads 2 --read > shots-$R-spiders.log 2>&1
touch shots-$R.done
