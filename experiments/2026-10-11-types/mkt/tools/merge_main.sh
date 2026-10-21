#!/usr/bin/env bash
# Merge main into this worktree's branch. The append-only files conflict whenever another type has landed: main's side is
# taken for them and this type's hunks are put back mechanically (integration/apply_mkt.py + the small edits below).
set -euo pipefail
MKT=$(cd "$(dirname "$0")/.." && pwd); cd "$MKT/../../.."
git merge main --no-commit || true   # (run it again after a stop: an unfinished merge is carried on)
for f in $(git diff --name-only --diff-filter=U); do git checkout --theirs -- "$f"; echo "took main's: $f"; done
python3 "$MKT/integration/apply_mkt.py" | tail -1
python3 - <<'PY'
import subprocess
def ensure(p, marker, anchor, text, before=True):
    t = open(p).read()
    if marker in t: return
    assert t.count(anchor) == 1, (p, anchor[:60], t.count(anchor))
    open(p, 'w').write(t.replace(anchor, text + anchor if before else anchor + text)); print('re-added to', p)
def mine(p, start, end=None):
    old = subprocess.run(['git', 'show', 'HEAD:' + p], capture_output=True, text=True).stdout; i = old.index(start); return old[i:(old.index(end, i) if end else len(old))]
t = open('engine/client/pack.js').read()
if "'mkt-square'" not in t:
    old = subprocess.run(['git', 'show', 'HEAD:engine/client/pack.js'], capture_output=True, text=True).stdout
    line = next(l for l in old.splitlines() if "'mkt-square'" in l); 
    import re
    m = re.search(r"\]\);", t[t.index('const APART'):]); k = t.index('const APART') + m.start()
    open('engine/client/pack.js', 'w').write(t[:k] + ",\n  'mkt-square', 'mkt-street', 'mkt-passage', 'mkt-house', 'mkt-bedroom'" + t[k:]); print('re-added to pack.js')
ensure('engine/test/browser_build.py', "print('MARKET')", "        print('ICONS')\n", mine('engine/test/browser_build.py', "        print('MARKET')", "        print('ICONS')\n"))
ensure('engine/test/core.test.mjs', 'market & village (2026-10-11)', "  // re-roll honours pinned furniture\n", mine('engine/test/core.test.mjs', "  { // market & village (2026-10-11)", "  // re-roll honours pinned furniture\n"))
ensure('tools/spawn-tuner/ROOMS.md', '## Market & village (twelve room types', '## Rooms that are not rectangles', mine('tools/spawn-tuner/ROOMS.md', '## Market & village (twelve room types', '## Rooms that are not rectangles'))
t = open('docs/ASSETS_TO_BUILD.md').read()
if '\n## Market & village\n' not in t:
    sec = mine('docs/ASSETS_TO_BUILD.md', '## Market & village\n'); nxt = sec.find('\n## ', 5); sec = sec[:nxt + 1] if nxt > 0 else sec
    open('docs/ASSETS_TO_BUILD.md', 'w').write(t.rstrip('\n') + '\n\n' + sec.rstrip('\n') + '\n'); print('re-added to ASSETS_TO_BUILD.md')
PY
if grep -rn "^<<<<<<<\|^>>>>>>>" tools/spawn-tuner/js tools/spawn-tuner/build_data.py docs engine/test engine/client/pack.js tools/spawn-tuner/ROOMS.md catalog/*.md 2>/dev/null | head -3 | grep .; then echo "CONFLICT MARKERS LEFT"; exit 1; fi
node -e "Promise.all([import('./tools/spawn-tuner/js/solver2.js'),import('./tools/spawn-tuner/js/walls.js'),import('./engine/client/pack.js')]).then(()=>console.log('modules parse')).catch(e=>{console.log('PARSE ERROR',e.message);process.exit(1)})"
git add -u; git add docs tools/spawn-tuner engine catalog experiments 2>/dev/null
git commit -q -m "Merge main into type-mkt; hunks re-applied mechanically (tools/merge_main.sh)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" || true
git log --oneline | head -1
