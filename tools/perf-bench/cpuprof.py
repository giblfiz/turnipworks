"""A main-thread CPU profile of one phase (2026-11-06): the V8 sampling profiler over CDP, summed by function (self time
and total time), so a cost the bench's piece-by-piece timing cannot name is named. Used by lightuse.py --cpuprofile."""
import collections


def start(pg):
    s = pg.context.new_cdp_session(pg); s.send('Profiler.enable'); s.send('Profiler.setSamplingInterval', {'interval': 200}); s.send('Profiler.start'); return s


def stop(s, top=25):
    prof = s.send('Profiler.stop')['profile']; s.detach()
    nodes = {n['id']: n for n in prof['nodes']}; parent = {}
    for n in prof['nodes']:
        for c in n.get('children', []): parent[c] = n['id']
    dt = prof.get('timeDeltas', []); samples = prof.get('samples', [])
    selfc = collections.Counter(); tot = collections.Counter()
    name = lambda n: f"{n['callFrame']['functionName'] or '(anon)'} {n['callFrame']['url'].rsplit('/', 1)[-1]}:{n['callFrame']['lineNumber'] + 1}"
    for sid, d in zip(samples, dt[1:] + [0]):
        n = nodes[sid]; selfc[name(n)] += d; seen = set(); k = sid
        while k is not None:
            nm = name(nodes[k])
            if nm not in seen: tot[nm] += d; seen.add(nm)
            k = parent.get(k)
    wall = sum(dt) or 1
    return {'wall_ms': round(wall / 1000, 1), 'self': [(k, round(v / 1000, 1)) for k, v in selfc.most_common(top)], 'total': [(k, round(v / 1000, 1)) for k, v in tot.most_common(top)]}
