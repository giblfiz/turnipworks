#!/usr/bin/env python3
"""RENDER: the whole promo, one command (tools/promo, 2026-10-22).

  python3 tools/promo/render.py [V1 V5 ...] [--keep-frames] [--reuse]

For the variants named (default: all of variants.json): the cards; the 1x measure of every drop a speed fit needs; each
capture the variants use (frames on /mnt/usb/turnip-works/promo/captures/); the EDLs (cut moments chosen from the
motion); the MP4s, squares and contact sheets in .../finals/; check.py. A capture's frames are deleted once every
variant named that uses it is encoded (--keep-frames keeps them; --reuse skips a capture whose frames are all there).
Re-rendering after an engine change (a new spawn-in, a new storey drop) is this command, from the checkout that has it.
"""
import argparse, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); PY = sys.executable
ENV = {**os.environ, 'TW_GPU': os.environ.get('TW_GPU', '1')}

def run(*a):
    print('$', ' '.join(a), flush=True); subprocess.run(list(a), check=True, env=ENV)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('names', nargs='*'); ap.add_argument('--keep-frames', action='store_true'); ap.add_argument('--reuse', action='store_true')
    A = ap.parse_args()
    shots = json.load(open(os.path.join(HERE, 'shots.json'))); VS = json.load(open(os.path.join(HERE, 'variants.json')))
    full = lambda n: {**VS[VS[n]['like']], **VS[n]} if 'like' in VS[n] else VS[n]
    names = A.names or [k for k in VS if not k.startswith('_')]
    def shot(n):
        S = shots[n]
        while 'like' in S: S = {**shots[S['like']], **{k: v for k, v in S.items() if k != 'like'}}
        return S
    caps = []
    for n in names:
        for c in (full(n)['capture'], full(n).get('square_capture')):  # (square_capture: a 1080x1080 take of the same drop, framed for the square)
            if c and c not in caps: caps.append(c)
    run(PY, os.path.join(HERE, 'cards.py'))
    bases = []
    for c in caps:
        sp = shot(c).get('speed')
        if isinstance(sp, dict) and sp['from'] not in bases: bases.append(sp['from'])
        end = (shot(c).get('orbit') or {}).get('end')  # (an orbit that ends on an event of a measure)
        if isinstance(end, dict) and end['from'] not in bases: bases.append(end['from'])
    for b in bases: run(PY, os.path.join(HERE, 'capture.py'), '--shot', b, '--measure')
    done, gone = set(), set()
    for c in caps:
        d = os.path.join(shots['_root'], 'captures', c)
        have = os.path.exists(os.path.join(d, 'capture.json')) and os.path.isdir(os.path.join(d, 'frames')) and len([f for f in os.listdir(os.path.join(d, 'frames')) if f.endswith('.png')]) == json.load(open(os.path.join(d, 'capture.json')))['frames']
        if A.reuse and have: print('reusing', c)
        else: run(PY, os.path.join(HERE, 'capture.py'), '--shot', c)
        needs = lambda n: [x for x in (full(n)['capture'], full(n).get('square_capture')) if x]
        ready = [n for n in names if n not in done and all(caps.index(x) <= caps.index(c) for x in needs(n))]  # every take it needs is in
        if ready: run(PY, os.path.join(HERE, 'edl.py'), *ready); run(PY, os.path.join(HERE, 'assemble.py'), *ready); done.update(ready)
        for x in caps[:caps.index(c) + 1]:  # a take's frames go once every variant named that uses it is encoded
            if not A.keep_frames and x not in gone and all(n in done for n in names if x in needs(n)):
                shutil.rmtree(os.path.join(shots['_root'], 'captures', x, 'frames'), ignore_errors=True); gone.add(x); print('frames deleted:', x)
    run(PY, os.path.join(HERE, 'check.py'), *names)

if __name__ == '__main__': main()
