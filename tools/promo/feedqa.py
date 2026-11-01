#!/usr/bin/env python3
"""FEED-SHAPE QA (tools/promo, v4 2026-10-23): Gemini (agy-run, the subscription; never a paid API) reads stills of the
feed-shape cuts (15C-square, 30A-4x5, ...) straight off their masters, so it sees each beat as a viewer does: the shot
framed for the shape, its caption burnt in, the end card.

  python3 tools/promo/feedqa.py 15C-square 30A-square 60A-square 15C-4x5 ... [--per 3] [--jobs 4]

For each beat, `per` stills spread over the beat (20 % .. 85 % of it; a caption is fully in from 0.75 s), plus the cut's
very last frame. A still of the same shot at the same source moment (to 0.1 s) in another cut of the same shape is asked
once. Gemini is told nothing of what the beat is meant to show: it transcribes every word first, then the large caption,
then what it sees, what is cut off by the frame's edges and what looks broken. Answers: <root>/finals/qa/feed/<cut>.json;
a line per still on stdout. The beat's verdict per twin goes into the registry (shots/registry.json: verdict, qa) as
shotqa.py does.
"""
import argparse, json, os, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import library as L, shotqa  # noqa: E402

PROMPT = """Look at the image file {f} in this folder: one frame of a promo video for a browser 3D tabletop game called Turnip Works, made for a social feed ({shape} frame).
Look at the image itself and answer straight away: do not crop it, write files or run code.
Answer ONLY with one JSON object, no prose:
1. "text": every word you can read anywhere in the frame, exactly as written, line by line (a list of strings). Read every label, caption and piece of on-screen UI before interpreting anything.
2. "caption": the large caption text laid over the picture (big words near the bottom), exactly as written ("" if there is none).
3. "caption_complete": true if every letter of that caption is inside the frame and nothing covers it, false if not, "n/a" if there is no caption.
4. "shows": two short sentences: what is in the frame, and what seems to be happening (which UI panels, menus or rings of buttons are open, where the mouse pointer is, what is selected, highlighted or in motion; if the frame is split into two windows, what each window shows).
5. "cut_off": a list of anything important cut off by the frame's edges or hidden behind other things: a menu or ring of buttons, the object being moved or selected, a pawn, a window of a split screen, a caption. [] if nothing.
6. "broken": a list of anything that looks wrong: objects clipping through walls or floors, objects floating, grey placeholder boxes, black or blank areas, UI glitches (overlapping, cut-off or half-drawn panels), banners about connection problems, garbled or illegible text, a mouse pointer that looks wrong. [] if nothing.
7. "note": one short sentence."""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('names', nargs='+'); ap.add_argument('--per', type=int, default=3); ap.add_argument('--jobs', type=int, default=4); ap.add_argument('--only', nargs='*', help='only the beats of these shots (and the last frame)')
    A = ap.parse_args(); out = os.path.join(shotqa.ROOT, 'finals', 'qa', 'feed'); os.makedirs(out, exist_ok=True)
    jobs, plan, seen = [], [], {}
    for name in A.names:
        E = json.load(open(os.path.join(shotqa.ROOT, 'finals', f'{name}.edl.json'))); d = os.path.join(out, name); os.makedirs(d, exist_ok=True)
        shape = {'square': '1:1 square, 1080x1080', '4x5': '4:5 portrait, 1080x1350'}[E['shape']]
        for k, b in enumerate(E['beats']):
            if A.only and b['shot'] not in A.only: continue
            a, z = b['at']
            for j in range(A.per):
                u = 0.2 + (0.65 * j / max(1, A.per - 1)); t = a + (z - a) * u
                if b.get('caption'): t = max(t, a + 0.8)
                key = (E['shape'], b['shot'], round(b['src_in'] + t - a, 1))
                f = f'{k:02d}-{b["shot"]}-{j}.png'
                if key in seen: plan.append((name, b, t, seen[key], key)); continue
                shotqa.still(E['master'], t, os.path.join(d, f)); seen[key] = (d, f, shape); jobs.append((d, f, shape)); plan.append((name, b, t, (d, f, shape), key))
        f = 'zz-last.png'; shotqa.still(E['master'], E['duration'] - 1 / 60, os.path.join(d, f)); jobs.append((d, f, shape)); plan.append((name, {'shot': 'END', 'caption': None}, E['duration'], (d, f, shape), None))
    def ask(job):
        d, f, shape = job; o = ''
        for _ in range(2):
            try: o = __import__('subprocess').run([shotqa.AGY, '-C', d, '-t', '420', PROMPT.format(f=f, shape=shape)], capture_output=True, text=True, timeout=480).stdout
            except Exception: o = ''
            r = shotqa.first_json(o)
            if r and 'shows' in r: return r
        return {'raw': (o or '')[-500:]}
    with ThreadPoolExecutor(A.jobs) as ex: res = dict(zip(jobs, ex.map(ask, jobs)))
    norm = lambda x: ''.join(c for c in str(x).replace('’', "'").lower() if c.isalnum())
    by, per_shot = {}, {}
    for name, b, t, job, key in plan:
        r = res[job]; ok = 'shows' in r
        cap_ok = (not b.get('caption') and not r.get('caption')) or (b.get('caption') and norm(r.get('caption', '')) == norm(b['caption']) and r.get('caption_complete') is True)
        line = 'NO QA' if not ok else ('OK' if cap_ok and not r.get('broken') and not r.get('cut_off') else 'FLAG')
        by.setdefault(name, []).append({'shot': b['shot'], 'shape_of': b.get('shape_of'), 'at': round(t, 2), 'still': os.path.join(job[0], job[1]), 'caption': b.get('caption'), 'verdict': line, 'answer': r})
        if b['shot'] != 'END' and key: per_shot.setdefault(b['shot'], {})[job[1] + '@' + name] = r
        print(f"{name:11} {b['shot']:4} {t:6.2f} {line:5} cap={r.get('caption')!r} ok={r.get('caption_complete')} cut_off={r.get('cut_off')} broken={r.get('broken')} | {str(r.get('shows') or r.get('raw', ''))[:160]}", flush=True)
    for name, v in by.items():
        p = os.path.join(out, f'{name}.json')
        if A.only and os.path.exists(p):  # (a partial re-read replaces those beats' answers, keeps the rest)
            v = [x for x in json.load(open(p)) if x['shot'] not in A.only and x['shot'] != 'END'] + v
        json.dump(v, open(p, 'w'), indent=1)
    R = L.load()
    for lab, rs in per_shot.items():
        if lab not in R['shots']: continue
        flags = [x for r in rs.values() for x in (r.get('broken') or []) + (r.get('cut_off') or []) if isinstance(x, str)]
        v = 'NO QA' if any('shows' not in r for r in rs.values()) else ('OK' if not flags else 'FLAG: ' + '; '.join(dict.fromkeys(flags))[:240])
        mid = list(rs.values())[len(rs) // 2].get('shows', '')
        R['shots'][lab]['verdict'] = f'{v} | {mid[:200]}'; R['shots'][lab]['qa'] = {'rev': R['shots'][lab]['rev'], 'by': 'feedqa.py (stills off the feed-shape cuts)', 'answers': rs}
    L.save(R)

if __name__ == '__main__': main()
