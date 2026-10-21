#!/bin/bash
# apply the integration to this worktree's tuner, rebuild sandbox/real (the accepted meshes and their manifest), copy the test in
cd "$(dirname "$0")" && python3 apply_smi.py > /dev/null && python3 make_sandbox_smi.py real --real | head -1 && cp tests/smi.test.mjs sandbox/real/test/ && cp tests/smi.test.mjs ../../../../tools/spawn-tuner/test/
