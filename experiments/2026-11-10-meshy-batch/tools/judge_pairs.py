#!/usr/bin/env python3
"""Blind before/after read per sku (2026-11-10 meshy-batch), on agy-run (Gemini): random-named copies in an isolated folder,
each pair in random order, the name map kept outside the folder. Two pairs per sku: alone at zoom distance (three-quarter) and
the sku in its own room (closer view). Six skus (24 images) per call.
  judge_pairs.py BEFORE_DIR AFTER_DIR OUT.json sku [sku ...]
A sku is a clear win when "after" is the better image in BOTH pairs and its mean score beats "before" by >= 1.5."""
import json, random, sys
from pathlib import Path
sys.path.insert(0, 'experiments/2026-11-07-meshy/tools')
from judge import agy, stage, RULES  # noqa: E402
sys.path.insert(0, str(Path(__file__).parent))
from make_briefs import SHOTS  # noqa: E402

B, A, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]); SKUS = sys.argv[4:]
rng = random.Random(1110)
import os; VIEWS = os.environ.get('JUDGE_VIEWS', 'alone-close,room-close').split(',')
res = json.loads(OUT.read_text()) if OUT.exists() else {'calls': []}
for k in range(0, len(SKUS), 6):
    part = SKUS[k:k + 6]; items = []; pairs = []
    for s in part:
        for view in VIEWS:
            two = [('before', B / f'{s}--{view}.png'), ('after', A / f'{s}--{view}.png')]; rng.shuffle(two)
            items += [(f'{s}|{view}|{w}', p) for w, p in two]; pairs.append((s, view))
    d, names = stage(items, 1100); inv = {v: k2 for k2, v in names.items()}
    def pl(s, v):
        a, b = sorted([inv[f"{s}|{v}|before"], inv[f"{s}|{v}|after"]]); where = {"alone-close": "alone on the table, close up", "room-close": "in its own room, closer view", "room-high": "in its own room, seen from above"}[v]
        return f'- pair: {a} and {b} ({SHOTS[s][2].rstrip(".")}; {where})'
    lines = '\n'.join(pl(s, v) for s, v in pairs)
    ans = agy(d, RULES + "Each PAIR below shows the same game prop twice, made by two different 3D models; the pair's two images are otherwise "
              "the same view. For each image, first list any readable text; then judge the named prop: reads_as 0-10 (how clearly it reads as the named thing), "
              "clean 0-10 (straight, regular, crisp parts vs melted, blobby or fragmented), detail 0-10 (do the small repeated units it should have, such as books, "
              "drawers, jars, bottles, pipes, slots, read as separate crisp units), problems (floating, clipping, out of scale, wrong way round, holes). Then for each pair "
              "say which image shows the better prop for players who zoom in, how clear the difference is (clear / slight / none), and why in one line.\n" + lines +
              '\nAnswer ONLY with JSON: {"images": {"<name>": {"text": [], "reads_as": 0, "clean": 0, "detail": 0, "problems": "..."}}, '
              '"pairs": [{"a": "<name>", "b": "<name>", "better": "<name>", "clarity": "clear", "why": "..."}]}')
    res['calls'].append({'skus': part, 'names': names, 'answer': ans}); OUT.write_text(json.dumps(res, indent=1)); print('call', part, bool(ans), flush=True)

# summary
summ = {}
for c in res['calls']:
    ans, names = c['answer'] or {}, c['names']; im = ans.get('images', {})
    def sc(n): x = im.get(n, {}); return round(sum(x.get(f, 0) for f in ('reads_as', 'clean', 'detail')) / 3, 2)
    for s in c['skus']:
        r = summ.setdefault(s, {'pairs': []})
        for view in VIEWS:
            nb = next(n for n, v in names.items() if v == f'{s}|{view}|before'); na = next(n for n, v in names.items() if v == f'{s}|{view}|after')
            pr = next((p for p in ans.get('pairs', []) if {p.get('a'), p.get('b')} == {nb, na}), {})
            r['pairs'].append({'view': view, 'before': sc(nb), 'after': sc(na), 'better': 'after' if pr.get('better') == na else 'before' if pr.get('better') == nb else '?',
                               'clarity': pr.get('clarity'), 'why': pr.get('why'), 'problems_after': im.get(na, {}).get('problems'), 'text_after': im.get(na, {}).get('text')})
        mb = sum(p['before'] for p in r['pairs']) / len(r['pairs']); ma = sum(p['after'] for p in r['pairs']) / len(r['pairs'])
        r.update(before=round(mb, 2), after=round(ma, 2), win=all(p['better'] == 'after' for p in r['pairs']) and ma - mb >= 1.5)
res['summary'] = summ; OUT.write_text(json.dumps(res, indent=1))
for s, r in summ.items(): print(f"{s:34s} {r['before']:4.1f} -> {r['after']:4.1f}  {'WIN' if r['win'] else 'no'}  " + ' | '.join(f"{p['view']}: {p['better']} ({p['clarity']})" for p in r['pairs']))
