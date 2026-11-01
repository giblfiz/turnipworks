#!/usr/bin/env python3
"""EDLs: the variants (variants.json) -> one edit-decision list each (variants/V*.json), cut moments chosen by the motion
in the capture (tools/promo, 2026-10-22).

  python3 tools/promo/edl.py [V1 V5 ...]

An EDL is the whole film as segments on the 6 s output clock (frames at 60 fps):
  { "out": [a, b], "footage": c }   footage from the capture, starting at capture clock c (s), running 1:1
  { "out": [a, b], "card": n }      the card with n phrases shown
A variant in variants.json says the idea; this file turns it into frames:
  mode "continue"  the build runs on under the cards: after a card the footage clock is where it would have been
  mode "freeze"    the build stops under the cards and resumes where it left off
  cards            baseline start times (s) of the three flash cards; flash: their length (s); final: when the
                   last card (all four phrases) comes in and holds to the end
  sequence         (instead of cards) a list of [time, n]: a card state from that time on (the uncut control)
  window           cut moments may move this far (s) from the baseline to land mid-flight: the cut frame and the return
                   frame are chosen to maximise the pieces in flight on the last frame before the card and the first
                   after it (never a settle pause, where nothing moves); ties go to the baseline
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); FPS = 60

def flying(e): return e['T']['g'][2] + e['T']['u'][2]

def make(name, V, shots):
    cap = json.load(open(os.path.join(shots['_root'], 'captures', V['capture'], 'capture.json')))
    log = {e['i']: e for e in cap['log']}
    fly = lambda i: flying(log[i]) if i in log else 0
    total = round(V.get('duration', 6.0) * FPS)
    segs, chosen, out_f, clock_f = [], [], 0, 0
    def footage_to(f_end):
        nonlocal out_f, clock_f
        if f_end > out_f: segs.append({'out': [out_f, f_end], 'footage': clock_f}); clock_f += f_end - out_f; out_f = f_end
    if 'sequence' in V:
        for k, (t, n) in enumerate(V['sequence']):
            f = round(t * FPS); footage_to(f) if k == 0 else None
            end = round(V['sequence'][k + 1][0] * FPS) if k + 1 < len(V['sequence']) else total
            segs.append({'out': [f, end], 'card': n}); out_f = end
            chosen.append({'card': n, 'at_s': f / FPS, 'in_flight_before': fly(f - 1) if k == 0 else None})
    else:
        L = round(V['flash'] * FPS); win = round(V.get('window', 0) * FPS)
        for n, t in enumerate(V['cards'], 1):
            b = round(t * FPS); best = None
            for s in range(b - win, b + win + 1):
                if s <= out_f + 6: continue  # at least a tenth of a second of footage between cards
                before = clock_f + (s - out_f) - 1                      # the last footage frame shown before the card
                after = before + 1 + (L if V['mode'] == 'continue' else 0)  # the first footage frame after it
                score = (min(fly(before), fly(after)), -abs(s - b))
                if best is None or score > best[0]: best = (score, s, before, after)
            _, s, before, after = best
            footage_to(s)
            segs.append({'out': [s, s + L], 'card': n}); out_f = s + L
            if V['mode'] == 'continue': clock_f += L
            chosen.append({'card': n, 'baseline_s': t, 'at_s': round(s / FPS, 4), 'back_s': round((s + L) / FPS, 4), 'footage_before_s': round(before / FPS, 4), 'footage_after_s': round(after / FPS, 4), 'in_flight_before': fly(before), 'in_flight_after': fly(after)})
        f = round(V['final'] * FPS); footage_to(f)
        segs.append({'out': [f, total], 'card': 4})
        chosen.append({'card': 4, 'at_s': f / FPS, 'in_flight_before': fly(clock_f - 1)})
    last = max((s['footage'] + s['out'][1] - s['out'][0] - 1 for s in segs if 'footage' in s), default=0)
    if last >= cap['frames']: sys.exit(f'{name}: needs footage frame {last}, the capture {V["capture"]} has {cap["frames"]}')
    if V.get('square_capture'):  # the square from its own take of the same drop: same clock, so the same frame numbers
        sq = json.load(open(os.path.join(shots['_root'], 'captures', V['square_capture'], 'capture.json')))
        if last >= sq['frames']: sys.exit(f"{name}: needs footage frame {last}, the square take {V['square_capture']} has {sq['frames']}")
        if abs(sq['speed'] - cap['speed']) > 1e-9: sys.exit(f"{name}: the square take runs at x{sq['speed']}, the main at x{cap['speed']}")
    edl = {'name': name, 'desc': V['desc'], 'capture': V['capture'], **({'square_capture': V['square_capture']} if V.get('square_capture') else {}), 'speed': cap['speed'], 'fit': cap.get('fit'), 'fps': FPS, 'frames': total,
           'segments': [{**s, 'out_s': [round(s['out'][0] / FPS, 4), round(s['out'][1] / FPS, 4)], **({'footage_s': round(s['footage'] / FPS, 4)} if 'footage' in s else {})} for s in segs],
           'cuts': chosen, 'capture_events_out_s': cap['events_out_s'], 'spawn_ms_1x': cap['events']}
    assert segs[0]['out'][0] == 0 and segs[-1]['out'][1] == total and all(a['out'][1] == b['out'][0] for a, b in zip(segs, segs[1:])), segs
    os.makedirs(os.path.join(HERE, 'variants'), exist_ok=True)
    json.dump(edl, open(os.path.join(HERE, 'variants', f'{name}.json'), 'w'), indent=1)
    print(f"{name}: {V['desc']} | x{cap['speed']:.3f} | cuts " + ', '.join(f"{c['at_s']:.3f}" + (f"->{c['back_s']:.3f} ({c['in_flight_before']}/{c['in_flight_after']} in flight)" if 'back_s' in c else '') for c in chosen))

def main():
    shots = json.load(open(os.path.join(HERE, 'shots.json'))); VS = json.load(open(os.path.join(HERE, 'variants.json')))
    names = sys.argv[1:] or [k for k in VS if not k.startswith('_')]
    for n in names:
        V = VS[n]
        if 'like' in V: V = {**VS[V['like']], **{k: v for k, v in V.items() if k != 'like'}}
        make(n, V, shots)

if __name__ == '__main__': main()
