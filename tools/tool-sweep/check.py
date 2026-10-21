#!/usr/bin/env python3
"""Gate: no library asset is missing from the review tools it belongs in.  (2026-10-12)

  python3 tools/tool-sweep/check.py            exit 1 on any finding
  python3 tools/tool-sweep/check.py --warn     the same lines, always exit 0 (tools/spawn-tuner/deploy.sh prints this)
  ... --dest DIR   another web folder       --quiet   the headline only

Compares what the library in THIS tree says (tools/spawn-tuner/data/library.json, figures.json, the catalog's
affordances, the run manifests' bench flags, the batches' BENCH.md) with what is PUBLISHED under the web folder:

  asset rater     every mesh and flat is listed on a rater page under its own batch, and the file that page shows exists;
                  every figure of data/figures.json is on review-figures/
  fire            every mesh the game lights (fx/fire.js fireType) is in the bench's fire queue; an `aff: lit` object the
                  game gives no flame is a finding unless tools/tool-sweep/waivers.json says why
  water           every vessel a batch declared (manifest flag bench:water / empty, or a BENCH.md water table)
  open / shut     every `aff: open` object, every closed mesh of an `open_of:` twin, every declared hinge;
                  every closed / open pair is on the open/shut tester's list
  plumbing        the published bench reads the declared lists; the published lists are the ones this tree would write

A finding means: run tools/spawn-tuner/deploy.sh (the sweep runs there). If it still fails after a deploy, the lines say
which asset and why. Warnings (never a failure): flames with no derived anchor, vessels with no automatic surface, waivers.
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sweep


def main():
    quiet = '--quiet' in sys.argv
    S = sweep.load(sweep.opt('--dest'), sweep.opt('--bin'))
    dest = S['dest']; objs = S['objects']
    bench = sweep.bench_lists(S)
    Q = sweep.membership(S, bench)
    rj = lambda p, d: json.loads((dest / p).read_text()) if (dest / p).exists() else d
    pub_q = rj('queues/queues.json', {}); pub_bench = rj('queues/bench.json', None); pub_pairs = rj('queues/pairs.json', {'pairs': []})
    lib_page = rj(f'{sweep.LIB_PAGE}/assets.json', {'assets': []})
    fails, warns = {}, {}
    add = lambda d, k, v: d.setdefault(k, []).append(v)

    # ---- asset rater
    shown = {(p['run'], s) for p in sweep.run_pages(S) for s in p['skus']}
    on_lib = {(a['run'], a['sku']): a for a in lib_page['assets']}
    for s in S['skus']:
        key = (s['src'], s['sku'])
        if key in shown:
            continue
        a = on_lib.get(key)
        if a is None:
            add(fails, 'not in the asset rater', f"{s['src']}/{s['sku']}"); continue
        f = dest / 'tuner' / s['url'] if a.get('model') else dest / sweep.LIB_PAGE / 'assets/models' / f"{s['sku']}.glb"
        if not f.exists():
            add(fails, 'in the asset rater, but the model it shows is not published', f"{s['src']}/{s['sku']}")
        if a.get('plate') is False:
            add(warns, 'in the asset rater with no source plate', f"{s['src']}/{s['sku']}")
    fig_page = {a['sku'] for a in rj('review-figures/assets.json', {'assets': []})['assets']}
    for f in S['figures']:
        if f['id'] not in fig_page:
            add(fails, 'figure not in the asset rater (review-figures: experiments/2026-10-06-figures/build_review.py)', f['id'])

    # ---- the bench
    pub = {m: set((pub_q.get('bench') or {}).get(m, [])) for m in ('fire', 'water', 'open')}
    names = {'fire': 'fire queue', 'water': 'water queue', 'open': 'open/shut queue'}
    for m in ('fire', 'water', 'open'):
        for e in Q[m]:
            if e['mesh'] not in pub[m]:
                add(fails, f"belongs in the bench's {names[m]}, not published there", e['sku'])
    in_q = {m: {e['id'] for e in Q[m]} for m in ('fire', 'water', 'open')}
    has_mesh = lambda o: any(s['kind'] == 'mesh' and s.get('bounds') for s in o['skus'])
    waived = sweep.waivers().get('lit_but_no_flame', {})
    for o in objs.values():
        if not has_mesh(o):
            continue
        if 'lit' in o['aff'] and o['id'] not in in_q['fire']:
            if o['id'] in waived: add(warns, 'waived: a light (aff: lit) the game gives no flame, so it has no fire anchor', o['id'])
            else: add(fails, 'a light (aff: lit) the game gives no flame: add it to fx/fire.js fireType(), or to tools/tool-sweep/waivers.json with the reason', o['id'])
        closed = o.get('open_of')
        if ('open' in o['aff'] and not closed and not o['id'].endswith('-open')) and o['id'] not in in_q['open']:
            add(fails, 'opens (aff: open), not in the open/shut queue', o['id'])
        if closed and (closed not in objs or not has_mesh(objs[closed])):
            add(warns, 'an open twin whose closed object has no mesh', f"{o['id']} -> {closed}")
        elif closed and closed not in in_q['open']:
            add(fails, 'the closed mesh of an open twin is not in the open/shut queue', f"{o['id']} -> {closed}")
    for m, key in (('water', 'water'), ('open', 'open')):
        for oid, why in bench[key].items():
            if oid not in in_q[m]:
                add(fails, f'declared for the {names[m]} ({why}), not in it', oid)
    pub_pair = {(p['sku'], p['open']['sku']) for p in pub_pairs.get('pairs', [])}
    for e in Q['open']:
        if e.get('twin') and (e['sku'], e['twin']['sku']) not in pub_pair:
            add(fails, 'closed/open pair not on the open/shut tester', f"{e['sku']} / {e['twin']['sku']}")

    # ---- plumbing
    main_js = dest / 'align/js/main.js'
    if not main_js.exists() or 'queues/bench.json' not in main_js.read_text():
        add(fails, 'the published Alignment Bench does not read the declared lists', 'align/js/main.js (web/align/deploy.sh)')
    if pub_bench != bench:
        add(fails, 'the published declared lists are not the ones this tree writes', 'queues/bench.json')
    if not (dest / 'queues/index.html').exists():
        add(fails, 'the "what is waiting" page is not published', 'queues/index.html')
    if not (dest / 'openclose/pairs/index.html').exists():
        add(fails, 'the open/shut pairs page is not published', 'openclose/pairs/index.html')
    landing = dest / 'index.html'
    if landing.exists() and sweep.MARK[0] not in landing.read_text():
        add(warns, 'the landing page has no "Waiting for you" block', 'index.html')

    # ---- warnings: the automatic first guesses the game falls back on
    fa = json.loads((S['tuner'] / 'data/fire_anchors.json').read_text()) if (S['tuner'] / 'data/fire_anchors.json').exists() else {}
    wa = json.loads((S['tuner'] / 'data/water_auto.json').read_text()) if (S['tuner'] / 'data/water_auto.json').exists() else {}
    for e in Q['fire']:
        a = fa.get(e['sku'])
        if not a or (a.get('mesh') and a['mesh'] != e['mesh']):
            add(warns, 'flame with no derived anchor for this mesh (the bench and the game start from the type default; prep/fire_anchors.py)', e['sku'])
    for e in Q['water']:
        if e['mesh'] not in wa:
            add(warns, 'vessel with no automatic water surface on file (the bench fits one when it opens; prep/water_auto.py)', e['sku'])

    n = sum(len(v) for v in fails.values())
    meshes = sum(s['kind'] == 'mesh' for s in S['skus']); flats = len(S['skus']) - meshes
    scope = (f"{meshes} meshes, {flats} flats, {len(S['figures'])} figures in the rater; bench fire {len(Q['fire'])}, water {len(Q['water'])}, "
             f"open/shut {len(Q['open'])}; {sum(1 for e in Q['open'] if e.get('twin'))} pairs")
    if n:
        print(f"TOOL COVERAGE FAILED: {n} library asset(s) are missing from a review tool they belong in  [{dest}]")
        for k, v in fails.items():
            print(f"  ✗ {k} ({len(v)}): {', '.join(v[:14])}{' …' if len(v) > 14 else ''}")
        print("  → run tools/spawn-tuner/deploy.sh (the sweep, tools/tool-sweep/sweep.py, runs there); see tools/tool-sweep/README.md")
    else:
        print(f"tool coverage OK: {scope}")
    if not quiet:
        for k, v in warns.items():
            print(f"  · {k} ({len(v)}): {', '.join(v[:10])}{' …' if len(v) > 10 else ''}")
    return 1 if n and '--warn' not in sys.argv else 0


if __name__ == '__main__':
    sys.exit(main())
