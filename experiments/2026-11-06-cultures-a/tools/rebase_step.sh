#!/usr/bin/env bash
# One conflicted step of `git rebase main` (cultures-a): every conflicted file is taken as main has it (with the steps
# already replayed), the culture hooks are put back (integration/apply.py CODES), and the generated files are rebuilt
# from the merged sources (catalog/out + types.json, library.json / rooms.json, orient.json, flats-out.json, the
# library spawns). Then the step's files are staged; the caller runs `git rebase --continue`.
#   experiments/2026-11-06-cultures-a/tools/rebase_step.sh jpn [chn ind]
set -euo pipefail
W=$(cd "$(dirname "$0")/../../.." && pwd); cd "$W"
mapfile -t U < <(git diff --name-only --diff-filter=U)
echo "conflicted: ${U[*]}"
O=tools/spawn-tuner/data/orient.json; T=$(mktemp)
if printf '%s\n' "${U[@]}" | grep -qx "$O"; then git show ":3:$O" > "$T"; fi
for f in "${U[@]}"; do git checkout --ours -- "$f"; done
if [[ -s $T ]]; then python3 - "$O" "$T" <<'PY'
import json, sys
o, t = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
add = {k: v for k, v in t.items() if any(f'{c}-01/' in k for c in ('jpn', 'chn', 'ind'))}
o.update(add); json.dump(o, open(sys.argv[1], 'w'), indent=1); print(len(add), 'culture orientations from the step')
PY
fi
python3 experiments/2026-11-06-cultures-a/integration/apply.py "$@" | grep -v "already there" || true
python3 src/catalog_tool.py > /dev/null 2>&1 || true
(cd tools/spawn-tuner && python3 build_data.py > /dev/null && for c in "$@"; do python3 ../../experiments/2026-11-06-cultures-a/tools/flats_mine.py "$c" | tail -1; done && python3 build_data.py > /dev/null)
(cd engine && node tools/library_spawns.mjs --jobs 4 | tail -1)
git checkout -- tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/jobs.json
git add "${U[@]}" catalog/out engine/client/data/types.json engine/client/data/library-spawns.json tools/spawn-tuner/data tools/spawn-tuner/prep/flats-out.json experiments/2026-11-06-cultures-a/integration/apply.py engine/tools/build_types.py
git diff --cached --name-only --diff-filter=U | head
echo "step ready: git rebase --continue"
