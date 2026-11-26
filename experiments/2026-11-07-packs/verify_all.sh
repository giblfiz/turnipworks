#!/bin/bash
# verify every zip of the release: unpack to USB, verify_pack.mjs, keep the JSON line, delete the unpack
set -u
OUT=/mnt/usb/turnip-works/asset-packs/assets-2026-11-07
V=/mnt/usb/turnip-works/lanes-2026-11-07/packs/verify
cd $TW_REPO
one() {
  z=$1; b=$(basename $z .zip); d=$V/x/$b
  rm -rf $d; mkdir -p $V/x; unzip -q $z -d $V/x
  node --max-old-space-size=6000 tools/asset-packs/verify_pack.mjs $d --three-dir /var/tmp/tw-asset-cost/tools/trialA/node_modules/three > $V/$b.json 2> $V/$b.err
  echo "$b exit $?"
  rm -rf $d
}
export -f one; export V
ls -S $OUT/*.zip | xargs -P 5 -I{} bash -c 'one {}'
