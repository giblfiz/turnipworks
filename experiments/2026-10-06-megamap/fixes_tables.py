#!/usr/bin/env python3
"""tables from matrix.jsonl / input.jsonl (FIXES.md): python3 tables.py"""
import json, statistics, sys, os
M = [json.loads(l) for l in open('results/fixes-matrix.jsonl')] if os.path.exists('results/fixes-matrix.jsonl') else []
def cell(rs):  # runs of one view -> "best (worst)": the best run is the least disturbed one on a shared box
    xs = [r['mean_ms'] for r in rs if r.get('mean_ms') is not None]
    if not xs: return '–'
    lo, hi = min(xs), max(xs); star = '' if all(r.get('quiet') for r in rs) else '*'
    return (f'{lo:.0f}' if hi - lo < max(1.5, 0.08 * hi) else f'{lo:.0f} ({hi:.0f})') + star
def best(rs):
    xs = [r['mean_ms'] for r in rs if r.get('mean_ms') is not None]; return min(xs) if xs else None
def merge(tag, rooms, key): return [r for m in M if m['tag'] == tag and m['rooms'] == rooms for r in m['views'].get(key, [])]
sizes = sorted({m['rooms'] for m in M})
print('## old against new, fog as shipped (ms a frame; * = the graphics card was shared during the run)\n')
print('| rooms | default: old | new | quarter: old | new | whole: old | new | pan: old | new |\n|--:|--:|--:|--:|--:|--:|--:|--:|--:|')
for n in sizes: print(f'| {n} | ' + ' | '.join(cell(merge(t, n, f'{v}|fog')) for v in ('default', 'quarter', 'whole', 'pan') for t in ('old', 'new')) + ' |')
print('\n## best run, and the ratio old / new\n')
for n in sizes:
    row = []
    for v in ('default', 'quarter', 'whole', 'pan'):
        o, w = best(merge('old', n, f'{v}|fog')), best(merge('new', n, f'{v}|fog'))
        row.append(f"{v}: {o:.0f} -> {w:.0f} ms (x{o / w:.1f})" if o and w else f'{v}: –')
    print(n, ' | '.join(row), ' | loads', [(m['tag'], m['load_start'][0], m['load_end'][0]) for m in M if m['rooms'] == n])
print('\n## as loaded (default view, straight after "everything in"; things still to seat)\n')
for n in sizes:
    for t in ('old', 'new'):
        xs = [(m['loaded']['default']['mean_ms'], m['loaded']['seating_queue'], m.get('seated'), m.get('everything_in_s')) for m in M if m['tag'] == t and m['rooms'] == n]
        print(n, t, xs)
print('\n## fog (ms): house fog / no fog / fog sea\n')
print('| rooms | code | default | quarter | whole | pan |\n|--:|--|--|--|--|--|')
for n in sizes:
    for t in ('old', 'new'):
        if not merge(t, n, 'default|nofog'): continue
        print(f'| {n} | {t} | ' + ' | '.join(' / '.join(cell(merge(t, n, f'{v}|{f}')) for f in ('fog', 'nofog', 'sea')) for v in ('default', 'quarter', 'whole', 'pan')) + ' |')
print('\n## the fixes one at a time (new code, switches; ms)\n')
for m in M:
    if not m.get('stack'): continue
    order = m['stack_order']; print(m['rooms'], 'rooms; order', order)
    for n in range(len(order) + 1): print('   ', ('+ ' + order[n - 1]) if n else 'none', ' | '.join(f"{v}: {cell(m['stack'].get(f'{n}|{v}', []))}" for v in ('default', 'quarter', 'whole')))
if os.path.exists('results/fixes-input.jsonl'):
    I = [json.loads(l) for l in open('results/fixes-input.jsonl')]
    print('\n## from the hand to the picture (ms: median / 90th percentile of events; frame = mean frame during the gesture)\n')
    for o in I:
        print(o['rooms'], o['tag'], o.get('commit'), 'seated', o.get('seated'))
        for k, rs in o['gestures'].items():
            print('    ', k, ' ; '.join(f"{r.get('lat_median')} / {r.get('lat_p90')} (frame {r.get('frame_mean')}, handler {r.get('handler_median')})" for r in rs))

# ---- markdown for FIXES.md
def md():
    out = []
    out.append('| rooms | default: before | after | quarter of the map: before | after | whole map: before | after | panning: before | after |\n|--:|--:|--:|--:|--:|--:|--:|--:|--:|')
    for n in sizes:
        cells = []
        for v in ('default', 'quarter', 'whole', 'pan'):
            for t in ('old', 'new'): cells.append(cell(merge(t, n, f'{v}|fog')))
        out.append(f'| {n} | ' + ' | '.join(cells) + ' |')
    out.append('')
    out.append('| rooms | default | quarter | whole map | panning |\n|--:|--:|--:|--:|--:|')
    for n in sizes:
        row = []
        for v in ('default', 'quarter', 'whole', 'pan'):
            o, w = best(merge('old', n, f'{v}|fog')), best(merge('new', n, f'{v}|fog')); row.append(f'{o / w:.1f} times' if o and w else '–')
        out.append(f'| {n} | ' + ' | '.join(row) + ' |')
    out.append('\nFOG\n')
    out.append('| rooms | code | default: fog / none / sea | quarter | whole map | panning |\n|--:|--|--|--|--|--|')
    for n in sizes:
        for t, name in (('old', 'before'), ('new', 'after')):
            if not merge(t, n, 'default|nofog'): continue
            out.append(f'| {n} | {name} | ' + ' | '.join(' / '.join(cell(merge(t, n, f'{v}|{f}')) for f in ('fog', 'nofog', 'sea')) for v in ('default', 'quarter', 'whole', 'pan')) + ' |')
    out.append('\nSTACK\n')
    names = {'aoList': 'and the contact-shadow pass draws from a list', 'sleep': 'and far rooms sleep', 'shadowList': "and the fire's shadow is drawn from a list", 'freeze': 'and world positions only for what moved', 'lightSlots': '(not shipped) and far fires go dark'}
    for v in ('default', 'quarter', 'whole'):
        ms = [m for m in M if m.get('stack')]; ms.sort(key=lambda m: m['rooms'])
        out.append(f'{v}:\n\n| each row adds to the one above | ' + ' | '.join(f"{m['rooms']} rooms" for m in ms) + ' |\n|--|' + '--:|' * len(ms))
        order = ['aoList', 'sleep', 'shadowList', 'freeze', 'lightSlots']
        for i in range(len(order) + 1):
            row = []
            for m in ms:
                o = m['stack_order']; k = (o.index(order[i - 1]) + 1) if i and order[i - 1] in o else (0 if i == 0 else None)
                row.append(cell(m['stack'].get(f'{k}|{v}', [])) if k is not None else '–')
            out.append(f"| {'every switch off' if i == 0 else names[order[i - 1]]} | " + ' | '.join(row) + ' |')
        out.append('')
    return '\n'.join(out)
if len(sys.argv) > 1 and sys.argv[1] == 'md': print('\n\n=========== MARKDOWN ===========\n' + md())
