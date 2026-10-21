#!/usr/bin/env bash
# Sandbox pass: rebuild the sandbox, then every node suite that must hold, one at a time. `run_tests.sh [SANDBOX_NAME]`
# (the engine's core test reads engine/tuner-data = this worktree's data: the sandbox's library and rooms are copied in
#  for that one suite and put back with git checkout)
set -u
I=$(cd "$(dirname "$0")" && pwd); W=$(cd "$I/../../../.." && pwd); SB=$I/sandbox/${1:-cult}; MAIN=tools/spawn-tuner
python3 "$I/make_sandbox.py" ${1:-cult} | head -1
cd "$SB"
echo "cult: $(node test/cult.test.mjs . 2>&1 | tail -1)"
echo "$(node test/golden.mjs $MAIN . 2>&1 | tail -4)"
for t in crypt castle mansion; do echo "$t: $(node test/$t.test.mjs . 2>&1 | tail -1 | cut -c1-160)"; done
for t in solver solver2 yard repeat zones stable stacks focal wall_items logcabin wallkit anim; do echo "$t: $(node test/$t.test.mjs 2>&1 | tail -1 | cut -c1-120)"; done
echo "fuzz: $(node test/v2_fuzz.mjs 2>&1 | tail -1 | cut -c1-160)"
cp "$SB/data/library.json" "$SB/data/rooms.json" "$W/tools/spawn-tuner/data/"
( cd "$W" && echo "core: $(node engine/test/core.test.mjs 2>&1 | tail -3 | cut -c1-300)" )
( cd "$W" && git checkout tools/spawn-tuner/data/library.json tools/spawn-tuner/data/rooms.json )
echo DONE
