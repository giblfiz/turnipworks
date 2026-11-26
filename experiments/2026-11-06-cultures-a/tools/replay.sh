#!/usr/bin/env bash
# Replay one cultures-a commit onto the current branch with its generated files rebuilt (cultures-a, 2026-11-07).
#   replay.sh COMMIT code [code ...]
set -uo pipefail
W=.claude/worktrees/agent-ae26e6116fac3df22; S=$(dirname "$0"); cd "$W" || exit 1
C=$1; shift
git cherry-pick "$C" > /dev/null 2>&1; picked=$?
mapfile -t U < <(git diff --name-only --diff-filter=U)
echo "$C: cherry-pick rc=$picked conflicted: ${U[*]:-none}"
O=tools/spawn-tuner/data/orient.json; T=$(mktemp); FO=tools/spawn-tuner/prep/flats-out.json; T2=$(mktemp)
printf '%s\n' "${U[@]}" | grep -qx "$O" && git show ":3:$O" > "$T"
printf '%s\n' "${U[@]}" | grep -qx "$FO" && git show ":3:$FO" > "$T2"
for f in "${U[@]}"; do
  case $f in experiments/2026-11-06-cultures-a/*|catalog/objects-japan*|catalog/objects-china*|catalog/objects-india*|catalog/rooms-japan*|catalog/rooms-china*|catalog/rooms-india*|catalog/runs/*|tools/spawn-tuner/cultures_a.py|tools/spawn-tuner/test/cultures.test.mjs) git checkout --theirs -- "$f";;
  *) git checkout --ours -- "$f";; esac
done
python3 - "$O" "$T" "$FO" "$T2" <<'PY'
import json, sys
for dst, src in ((sys.argv[1], sys.argv[2]), (sys.argv[3], sys.argv[4])):
    try: t = json.load(open(src))
    except Exception: continue
    o = json.load(open(dst)); add = {k: v for k, v in t.items() if any(c in k for c in ('jpn', 'chn', 'ind', 'tatami', 'mandana', 'durrie', 'stepping')) and k not in o}
    o.update(add); json.dump(o, open(dst, 'w'), indent=1); print(dst, '+', len(add))
PY
cp "$S/apply.py" experiments/2026-11-06-cultures-a/integration/apply.py
python3 experiments/2026-11-06-cultures-a/integration/apply.py "$@" | grep -v "already there\|(replaced)"
python3 - "$@" <<'PY'
import sys, re
codes = sys.argv[1:]; p = 'src/catalog_tool.py'; t = open(p).read()
names = {'jpn': 'japan', 'chn': 'china', 'ind': 'india'}
line = 'SETTINGS.update({' + ', '.join(f'"{c.upper()}": "{names[c]}"' for c in codes) + '})  # culture packs A (2026-11-06, cultures-a): genre `cultures`'
t2 = re.sub(r'SETTINGS\.update\(\{"JPN".*\n', line + '\n', t)
if 'SETTINGS.update({"JPN"' not in t2: t2 = t2.replace('CORE = list(SETTINGS)', line + '\nCORE = list(SETTINGS)', 1)
open(p, 'w').write(t2)
p = 'docs/site/assets-packs.json'; import json; d = json.load(open(p))
B = {'japan': "A Kyoto townhouse, tea house and Shinto shrine of the late Edo period: tatami rooms with their alcove, a sunken tea hearth, a dojo, a sake merchant's counting platform, a torii and stone lanterns, a tea garden.",
     'china': "A Beijing courtyard house and a Buddhist temple hall of the Qing: a long console table between armchairs, a scholar's painting table, tea house benches and copper kettles, a Taihu rock, lotus vats and a market street.",
     'india': "Eighteenth-century Rajasthan: a haveli courtyard with its tulsi, a palace hall with a canopied throne, a Shiva temple's pillared hall with Nandi, a grain merchant's shop, a household kitchen and a stepwell."}
if True:
    for c in codes:
        k = names[c]
        if k not in d['packs']: d['packs'][k] = {'blurb': B[k]}
    open(p, 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
PY
python3 src/catalog_tool.py > /dev/null 2>&1
(cd tools/spawn-tuner && python3 build_data.py > /dev/null)
cp "$S/merge_lib.py" experiments/2026-11-06-cultures-a/tools/merge_lib.py
python3 experiments/2026-11-06-cultures-a/tools/merge_lib.py HEAD
(cd tools/spawn-tuner && for c in "$@"; do python3 ../../experiments/2026-11-06-cultures-a/tools/flats_mine.py "$c" | tail -1; done)
(cd engine && node tools/library_spawns.mjs --jobs 4 | tail -1)
git checkout -- tools/spawn-tuner/prep/flats.json tools/spawn-tuner/prep/jobs.json
git add -A catalog engine/client/data/types.json engine/client/data/library-spawns.json engine/tools/build_types.py src/catalog_tool.py docs tools/spawn-tuner tools/test_matrix.json engine/client/pack.js engine/core/height.js engine/client/library-index.js experiments/2026-11-06-cultures-a/integration experiments/2026-11-06-cultures-a/tools/merge_lib.py
git diff --cached --name-only --diff-filter=U
if [[ $picked == 0 ]]; then git commit -q --amend --no-edit; else GIT_EDITOR=true git cherry-pick --continue > /dev/null; fi
git log --oneline -1
grep -l '<<<<<<<' tools/spawn-tuner/js/*.js engine/tools/build_types.py src/catalog_tool.py docs/ASSETS_TO_BUILD.md tools/spawn-tuner/ROOMS.md tools/spawn-tuner/build_data.py 2>/dev/null
