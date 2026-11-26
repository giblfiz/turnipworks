#!/usr/bin/env python3
"""Side by side: the configs of one lightuse.py run (or several runs), per map and phase (2026-11-06).

  python3 tools/perf-bench/compare.py results/levers-the front web server.json [more.json ...] [--metric p50,p95,long,lat50,gpu]

Each cell is the median over the rounds of that config. A config named in several files is pooled. A row 'moving' is
the frames of pan + orbit + zoom + drag pooled (the camera or a pawn moving), recomputed from the raw frames.
"""
import argparse, json, statistics, sys
ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); ap.add_argument('--metric', default='p50,p95,p99,long,lat50,lat95,gpu')
A = ap.parse_args(); MET = A.metric.split(',')
def pct(xs, q):
    xs = sorted(x for x in xs if x is not None); return None if not xs else xs[min(len(xs) - 1, int(round(q * (len(xs) - 1))))]
def pooled(raws):
    iv = [f[3] for r in raws for f in r['frames'] if f[3] is not None]; lat = [f[2] for r in raws for f in r['frames'] if f[2] is not None]
    gpu = [x for r in raws for x in r['gpu'] if 0 < x < 2000]
    prs = [f[5] for r in raws for f in r['frames'] if len(f) > 5]; top = max(prs) if prs else 0
    return {'lowres': round(100 * sum(1 for x in prs if x < top - 1e-3) / len(prs)) if prs else None,'p50': pct(iv, .5), 'p95': pct(iv, .95), 'p99': pct(iv, .99), 'long': sum(1 for x in iv if x > 50), 'lat50': pct(lat, .5), 'lat95': pct(lat, .95), 'gpu': round(statistics.mean(gpu), 1) if gpu else None, 'frames': len(iv)}
data = {}  # map -> config -> phase -> [summary per round]
for f in A.files:
    d = json.load(open(f))
    for m, rec in d['maps'].items():
        for run in rec['runs']:
            c = run['config']; ph = data.setdefault(m, {}).setdefault(c, {})
            for row, raw in zip(run['rows'], run['raw']): ph.setdefault(row['phase'], []).append(pooled([raw]))
            mv = [r for r in run['raw'] if r['name'] in ('pan', 'orbit', 'zoom', 'drag')]
            if mv: ph.setdefault('MOVING', []).append(pooled(mv))
def med(xs):
    xs = [x for x in xs if x is not None]; return None if not xs else round(statistics.median(xs), 1)
for m, cs in data.items():
    configs = list(cs); phases = list(next(iter(cs.values())).keys())
    print(f'\n## {m}   (' + ' | '.join(configs) + ')')
    print(f"{'phase':<8} " + ' '.join(f'{k:>{8 * len(configs)}}' for k in MET))
    for ph in phases:
        cells = []
        for k in MET:
            vals = [med([s[k] for s in cs[c].get(ph, [])]) for c in configs]
            cells.append(' '.join(f"{('-' if v is None else (f'{v:.0f}' if isinstance(v, float) and v >= 10 else str(v))):>7}" for v in vals))
        print(f'{ph:<8} ' + ' '.join(f'{c:>{8 * len(configs)}}' for c in cells))
