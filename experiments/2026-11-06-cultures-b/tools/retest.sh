#!/usr/bin/env bash
# spec -> sandbox (all four packs applied) -> the culture test with planned meshes (--fake).   tools/retest.sh [--pack=nrs,mde]
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); cd "$E"
python3 spec.py > /dev/null
python3 tools/fake_types.py > /dev/null
python3 integration/apply.py nrs mde rus mes --root sandbox > /dev/null
cp ../../tools/spawn-tuner/test/cultures_b.test.mjs sandbox/tools/spawn-tuner/test/
timeout 900 node sandbox/tools/spawn-tuner/test/cultures_b.test.mjs sandbox/tools/spawn-tuner/ --fake "$@" 2>&1 | tail -32
