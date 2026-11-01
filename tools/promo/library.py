#!/usr/bin/env python3
"""THE SHOT LIBRARY: labels and the registry (tools/promo, 2026-10-22).

Every shot the 15/30/60 s cuts use has a label: two letters + one digit (RZ4, RQ8). Letters from
ABCDEFGHJKMNPQRSTUVWXYZ (no I, L, O), digits 2-9 (no 0, 1). Labels are drawn at random and never reused: a label once
handed out stays in `used` even if its shot is retired. A re-render of the same shot keeps its label and bumps its
revision (RZ4 r2); a materially different shot gets a new label. The registry is shots/registry.json:

  { "used": [...every label ever handed out...],      (each shot also: "family" = the label it is a variant of, "zoom")
    "shots": { "RZ4": { "rev": 1, "desc", "scene", "camera", "duration_s", "script": "<function in shots/scripts.py>",
                        "params": {...}, "history": [{rev, date, note}], "verdict": "...", "qa": {...} } } }

  python3 tools/promo/library.py list                      the table
  python3 tools/promo/library.py new SCRIPT --desc ... [--scene ...] [--camera ...] [--params JSON]   -> a new label
  python3 tools/promo/library.py bump RZ4 --note "why"     a re-render of the same shot: rev + 1
  python3 tools/promo/library.py show RZ4
  python3 tools/promo/library.py shape square SY7 [FF2 ...]   v4: a feed-shape twin of each (its own label, same family)

FEED SHAPES (v4, 2026-10-23). A 16:9 shot's twin for a feed placement (square 1080x1080, 4x5 1080x1350) is a different
take, so it gets its own label in the shot's family: the same script and params plus `size` and `page_scale`, so it is
framed for the shape (camera.frame solves for the page's aspect) rather than cropped. The twin carries `shape` and
`shape_of`; the 16:9 shot carries `shapes: {square: <label>, 4x5: <label>}`, which is how cut.py --shape finds them.
"""
import argparse, json, os, secrets, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REG = os.path.join(HERE, 'shots', 'registry.json')
LETTERS, DIGITS = 'ABCDEFGHJKMNPQRSTUVWXYZ', '23456789'

def load():
    if not os.path.exists(REG): return {'_about': 'The promo shot library (tools/promo/library.py). Labels are never reused.', 'used': [], 'shots': {}}
    return json.load(open(REG))

def save(R):
    os.makedirs(os.path.dirname(REG), exist_ok=True)
    tmp = REG + '.tmp'; json.dump(R, open(tmp, 'w'), indent=1, ensure_ascii=False); open(tmp, 'a').write('\n'); os.replace(tmp, REG)

def valid(label):
    return len(label) == 3 and label[0] in LETTERS and label[1] in LETTERS and label[2] in DIGITS

def fresh(R):
    for _ in range(10000):
        lab = secrets.choice(LETTERS) + secrets.choice(LETTERS) + secrets.choice(DIGITS)
        if lab not in R['used']: return lab
    sys.exit('no free label')

def tag(label, rev):
    """the burn-in text: RZ4, or RZ4 r2 above the first revision"""
    return label if rev <= 1 else f'{label} r{rev}'

def new(R, script, desc, scene='', camera='', params=None, duration=None, family=None, zoom='default'):
    """family: the label of the shot this is a variant of (its own label for an original); zoom: default / tight /
    edge / spill (Harry 2026-10-22: zoom-depth variants are shots of their own, grouped by family)"""
    lab = fresh(R); R['used'].append(lab)
    R['shots'][lab] = {'rev': 1, 'family': family or lab, 'zoom': zoom, 'desc': desc, 'scene': scene, 'camera': camera, 'duration_s': duration, 'script': script,
                       'params': params or {}, 'history': [{'rev': 1, 'date': time.strftime('%Y-%m-%d %H:%M'), 'note': 'new'}], 'verdict': None}
    return lab

SHAPES = {'square': {'size': [1080, 1080], 'page_scale': 0.8, 'name': '1:1'}, '4x5': {'size': [1080, 1350], 'page_scale': 0.8, 'name': '4:5'}}

def twin(R, src, shape):
    """the feed-shape twin of shot `src` (made once: an existing twin is returned)"""
    import copy
    S = R['shots'][src]; sh = SHAPES[shape]
    if S.get('shapes', {}).get(shape): return S['shapes'][shape]
    P = copy.deepcopy(S.get('params', {})); P.update({'size': sh['size'], 'page_scale': sh['page_scale']})
    w, h = sh['size']
    lab = new(R, S['script'], S['desc'] + f" [feed shape {sh['name']}: its own {w}x{h} take of this shot ({src}), framed for the shape; the page laid out {round(w / sh['page_scale'])} CSS px wide, scaled {sh['page_scale']}]",
              S.get('scene', ''), S.get('camera', ''), P, None, S.get('family', src), S.get('zoom', 'default'))
    T = R['shots'][lab]; T.update({'shape': shape, 'shape_of': src, 'variant': ', '.join(x for x in (S.get('variant'), sh['name']) if x)})
    T['history'][0]['note'] = f'new: feed shape {shape} of {src} r{S["rev"]}'
    S.setdefault('shapes', {})[shape] = lab
    return lab

def bump(R, lab, note):
    S = R['shots'][lab]; S['rev'] += 1; S['verdict'] = None; S.pop('qa', None)
    S['history'].append({'rev': S['rev'], 'date': time.strftime('%Y-%m-%d %H:%M'), 'note': note})
    return S['rev']

def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('list')
    n = sub.add_parser('new'); n.add_argument('script'); n.add_argument('--desc', required=True); n.add_argument('--scene', default=''); n.add_argument('--camera', default=''); n.add_argument('--params', default='{}')
    b = sub.add_parser('bump'); b.add_argument('label'); b.add_argument('--note', required=True)
    s = sub.add_parser('show'); s.add_argument('label')
    t = sub.add_parser('shape'); t.add_argument('shape', choices=sorted(SHAPES)); t.add_argument('labels', nargs='+')
    A = ap.parse_args(); R = load()
    if A.cmd == 'list':
        for lab, S in sorted(R['shots'].items(), key=lambda kv: (kv[1].get('family', kv[0]), kv[1].get('zoom') != 'default', kv[0])): print(f"{S.get('family', lab)}/{S.get('zoom', 'default'):7} {tag(lab, S['rev']):8} {S.get('duration_s') or '-':>6} {S['script']:22} {S['desc'][:70]}  | {(S.get('verdict') or '')[:60]}")
    elif A.cmd == 'new':
        lab = new(R, A.script, A.desc, A.scene, A.camera, json.loads(A.params)); save(R); print(lab)
    elif A.cmd == 'bump':
        print(tag(A.label, bump(R, A.label, A.note))); save(R)
    elif A.cmd == 'shape':
        for lab in A.labels: print(lab, '->', twin(R, lab, A.shape))
        save(R)
    elif A.cmd == 'show':
        print(json.dumps(R['shots'][A.label], indent=1))

if __name__ == '__main__': main()
