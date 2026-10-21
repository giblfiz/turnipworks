#!/usr/bin/env python3
"""Re-apply the farmstead's small edits to shared engine and catalog files after taking main's version in a merge (each is skipped when already there).
    python3 engine_patch.py   (run from anywhere; edits this worktree). The test blocks come from `git show <rev>:file` (default: ORIG_HEAD's parent branch tip `type-hut@{1}` is not assumed: pass --from REV)."""
import pathlib, re, subprocess, sys, glob
WT = pathlib.Path(__file__).resolve().parents[4]
rev = sys.argv[sys.argv.index('--from') + 1] if '--from' in sys.argv else 'HEAD'
show = lambda f: subprocess.run(['git', 'show', f'{rev}:{f}'], cwd=WT, capture_output=True, text=True).stdout
# pack.js: the APART set gains the farm rooms (appended before its closing "]);")
p = WT / 'engine/client/pack.js'; s = p.read_text()
if 'hut-cottage' not in s:
    m = re.search(r"(const APART = new Set\(\[.*?)(\]\);)", s, re.S); assert m
    add = ("\n  // type:hut  farmstead: a dragged farmhouse packs its kitchen, bedroom and dairy; the one-room cottage is a building by itself, the\n"
           "  // passage, loft and cellar are drawn (beside, over, under), and everything else stands apart in the yard\n"
           "  , 'hut-cottage', 'hut-loft', 'hut-passage', 'hut-cellar', 'hut-byre', 'hut-coop', 'hut-pigsty', 'hut-barn', 'hut-granary', 'hut-garden', 'hut-field', 'hut-orchard', 'hut-farmyard'")
    head = m.group(1); tail = ''
    cm = re.search(r"\]\);[^\n]*", s[m.start(2):]); 
    s = s[:m.start(2)] + add + s[m.start(2):]; p.write_text(s); print('pack.js patched')
for f, anchor, start in (('engine/test/core.test.mjs', "  // re-roll honours pinned furniture\n", "  { // type:hut"), ('engine/test/browser_build.py', "        print('ICONS')\n", "        print('FARMSTEAD')")):
    p = WT / f; s = p.read_text()
    if start in s: continue
    old = show(f); i = old.index(start); j = old.index(anchor, i); assert s.count(anchor) == 1
    p.write_text(s.replace(anchor, old[i:j] + anchor)); print(f, 'patched')
roles = "lantern-hanging wagon vegetable-crate-mixed table-kitchen-prep demijohn cot boots-row bench-garden washstand wardrobe towel-hanging shelving-freestanding salt-block refuse-pile potato-crate malt-sacks hitching-post fruit-crate-mixed cook-hearth-spit cheese-wax-sealed cheese-stack bundle-wrapped bedroll".split()
for f in glob.glob(str(WT / 'catalog/*.catalog.md')):
    s = open(f).read(); n = 0
    for r in roles:
        def rep(m):
            global n
            if 'HUT' in m.group(2): return m.group(0)
            n += 1; return m.group(1) + m.group(2) + ',HUT' + m.group(3)
        s = re.sub(r'^(- \*\*' + re.escape(r) + r'\*\* .*? · set:)([A-Z,!]+)( ·)', rep, s, flags=re.M)
    if n: open(f, 'w').write(s); print(f, n)
# look.js: the ploughed-field ground is a structured floor (laid straight, one texture: the furrows run on from tile to tile)
p = WT / 'tools/spawn-tuner/js/look.js'; s = p.read_text()
if '|furrow/' not in s:
    a = "terracotta|floor-tile/.test(id)"; assert s.count(a) == 1; p.write_text(s.replace(a, "terracotta|floor-tile|furrow/.test(id)")); print('look.js patched')
# buildings: bench CODES and the two test lists gain HUT (the BUILDING_TYPES.HUT entry itself merges as an insertion)
for f, a, b in (('tools/spawn-tuner/buildings/bench.js', "'DUN', 'MKT'];", "'DUN', 'MKT', 'HUT'];"), ('tools/spawn-tuner/test/buildings.test.mjs', "['TAV', 'NOB', 'CAS', 'CRY']);", "['TAV', 'NOB', 'CAS', 'CRY', 'HUT']);")):
    p = WT / f; s = p.read_text()
    if "'HUT'" not in s and a in s: p.write_text(s.replace(a, b)); print(f, 'patched')
