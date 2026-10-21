#!/usr/bin/env bash
# Bring origin/main into this branch (never the local main ref: a landing in progress may sit on it untested).
# Append-only files conflict whenever another type has landed: main's side is taken for them and this type's hunks are
# put back mechanically (integration/apply_smi.py, the catalog's SMI tags, the engine and docs blocks below).
set -euo pipefail
SMI=$(cd "$(dirname "$0")/.." && pwd); cd "$SMI/../../.."
git fetch -q origin
git merge origin/main --no-commit || true
for f in $(git diff --name-only --diff-filter=U); do git checkout --theirs -- "$f"; git add -- "$f"; echo "took main's: $f"; done
python3 - <<'PY'
import subprocess, re, glob, pathlib
out = subprocess.run(['python3', 'src/catalog_tool.py'], capture_output=True, text=True).stdout
want = {m.group(1) for m in re.finditer(r"WARN smi-[a-z-]+: ([a-z0-9-]+) lacks set:SMI", out)}
for p in glob.glob('catalog/*.catalog.md'):
    t = pathlib.Path(p).read_text()
    for rid in want: t = re.sub(r"(^- \*\*" + re.escape(rid) + r"\*\* — (?:[^·\n]+· )+?set:)([A-Z!,]+)", lambda m: m.group(1) + m.group(2) + ",SMI", t, flags=re.M)
    pathlib.Path(p).write_text(t)
print('catalog: SMI tag put back on', len(want), 'roles')
def old(p): return subprocess.run(['git', 'show', 'HEAD:' + p], capture_output=True, text=True).stdout
def mine(p, start, end=None):
    o = old(p); i = o.index(start); return o[i:(o.index(end, i) if end else len(o))]
def ensure(p, marker, anchor, text):
    t = open(p).read()
    if marker in t: return
    assert t.count(anchor) == 1, (p, anchor[:50], t.count(anchor)); open(p, 'w').write(t.replace(anchor, text + anchor)); print('re-added to', p)
t = open('engine/client/pack.js').read()
if "'smi-yard'" not in t:
    i = t.index('const APART'); k = i + re.search(r"\]\);", t[i:]).start()
    open('engine/client/pack.js', 'w').write(t[:k] + ",\n  'smi-yard', 'smi-passage', 'smi-quarters'" + t[k:]); print('re-added to pack.js')
ensure('engine/test/browser_build.py', "print('SMITHY')", "        print('ICONS')\n", mine('engine/test/browser_build.py', "        print('SMITHY')", "        print('ICONS')\n"))
ensure('engine/test/core.test.mjs', 'smithy & workshop (2026-10-11)', "  // re-roll honours pinned furniture\n", mine('engine/test/core.test.mjs', "  { // smithy & workshop (2026-10-11)", "  // re-roll honours pinned furniture\n"))
ensure('tools/spawn-tuner/ROOMS.md', '## Smithy & workshop (nine', '## Rooms that are not rectangles', mine('tools/spawn-tuner/ROOMS.md', '## Smithy & workshop (nine', '## Rooms that are not rectangles'))
s = open('docs/STATUS.md').read()
if '- **Smithy & workshop type (2026-10-12):**' not in s:
    o = old('docs/STATUS.md'); i = o.index('- **Smithy & workshop type (2026-10-12):**'); ln = o[i:o.index('\n', i) + 1]
    k = s.index('- **Market & village type (2026-10-12):**'); k = s.index('\n', k) + 1
    open('docs/STATUS.md', 'w').write(s[:k] + ln + s[k:]); print('re-added to STATUS.md')
t = open('docs/ASSETS_TO_BUILD.md').read()
if '\n## Smithy & workshop\n' not in t:
    sec = mine('docs/ASSETS_TO_BUILD.md', '## Smithy & workshop\n'); nxt = sec.find('\n## ', 5); sec = sec[:nxt + 1] if nxt > 0 else sec
    open('docs/ASSETS_TO_BUILD.md', 'w').write(t.rstrip('\n') + '\n\n' + sec); print('re-added to ASSETS_TO_BUILD.md')
PY
python3 "$SMI/integration/apply_smi.py" | grep -v "already there" | tail -8
python3 src/catalog_tool.py | grep -E "WARN smi|ERROR.*smi" | head -3 || true
git add -A catalog engine/client/pack.js engine/test docs tools/spawn-tuner/ROOMS.md tools/spawn-tuner/build_data.py tools/spawn-tuner/js tools/spawn-tuner/buildings
test -z "$(git diff --name-only --diff-filter=U)" || { echo "STILL CONFLICTED"; git diff --name-only --diff-filter=U; exit 1; }
git commit -q -m "Merge origin/main into type-smi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" || echo "(nothing to commit)"
git log --oneline -1
