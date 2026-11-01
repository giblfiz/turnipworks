#!/usr/bin/env python3
"""CAPTION QA (tools/promo, v3 2026-10-22): every overlay caption of a cut read by Gemini (agy-run, the subscription; never
a paid API) at 1920x1080 and at 1080x1080.

  python3 tools/promo/capqa.py 30A [60A W5 ...] [--jobs 3]
  ... capqa.py 30A-square 30A-4x5 60A-square ...     v4: a feed-shape cut, read off its own master (one still a caption)

For each captioned beat: the 16:9 still is the cut's own master at the moment the caption is fully in (it is burnt in
there); the square still is the beat's shot master at the same source moment, its middle 1080 x 1080, with the caption
rendered in caption.html's square layout (?sq=1) laid over it as cut.py lays it (full opacity). One agy-run call per still.
Gemini transcribes first, then judges the large caption: complete (nothing cut by the frame), legible at a glance, contrast
against what is behind it, what it covers. Answers: <root>/finals/qa/<cut>/captions.json. An unanswered call is "NO QA".
"""
import argparse, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import cut, shotqa  # noqa: E402

PROMPT = """Look at the image file {f} in this folder: one frame of a promo video for a browser 3D tabletop game.
Look at the image itself and answer straight away: do not crop it, write files or run code.
Answer ONLY with one JSON object, no prose:
1. "text": every word you can read anywhere in the frame, exactly as written (a list of strings). Read every label and caption before interpreting anything.
2. "caption": the large caption text laid over the picture, exactly as written ("" if there is none).
3. "complete": true if every letter of that caption is inside the frame (none cut off by an edge), else false.
4. "glance": true if the caption can be read at a glance at normal viewing size, else false.
5. "contrast": "strong", "ok" or "weak": how well the caption stands out from what is directly behind it.
6. "covers": one short sentence: what part of the picture the caption covers, and whether that seems to hide anything important.
7. "note": one short sentence."""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('names', nargs='+'); ap.add_argument('--jobs', type=int, default=3)
    A = ap.parse_args(); jobs = []; plan = []
    from PIL import Image
    for name in A.names:
        E = json.load(open(os.path.join(cut.ROOT, 'finals', f'{name}.edl.json'))); d = os.path.join(cut.ROOT, 'finals', 'qa', name, 'captions'); os.makedirs(d, exist_ok=True)
        beats = [b for b in E['beats'] if b.get('caption')]
        if E.get('shape'):  # v4: a feed-shape cut (15C-square, 30A-4x5): its own master, the caption burnt in, one still a beat
            for k, b in enumerate(beats):
                t = b['at'][0] + min(1.6, (b['at'][1] - b['at'][0]) / 2)
                f1 = f'{k:02d}-{b["shot"]}-{E["shape"]}.png'; shotqa.still(E['master'], t, os.path.join(d, f1)); jobs.append((d, f1)); plan.append((name, b['shot'], b['caption'], d, f1))
            continue
        sq = cut.captions(sorted({b['caption'] for b in beats}), os.path.join(cut.ROOT, 'captions'), sq=True)
        for k, b in enumerate(beats):
            t = b['at'][0] + min(1.6, (b['at'][1] - b['at'][0]) / 2)  # (the caption is fully in from 0.75 s after the beat starts)
            f1 = f'{k:02d}-{b["shot"]}-wide.png'; shotqa.still(E['master'], t, os.path.join(d, f1))
            src = os.path.join(cut.ROOT, 'finals', 'shots', f'{b["shot"]}.mp4'); ts = b['src_in'] + (t - b['at'][0])
            raw = os.path.join(d, f'{k:02d}-raw.png'); shotqa.still(src, ts, raw)
            im = Image.open(raw).convert('RGB'); W, H = im.size; im = im.crop(((W - H) // 2, 0, (W - H) // 2 + H, H)).convert('RGBA')
            im.alpha_composite(Image.open(sq[b['caption']]).convert('RGBA')); f2 = f'{k:02d}-{b["shot"]}-square.png'; im.convert('RGB').save(os.path.join(d, f2)); os.remove(raw)
            for f in (f1, f2): jobs.append((d, f)); plan.append((name, b['shot'], b['caption'], d, f))
    def ask(job):
        d, f = job; out = ''
        for _ in range(2):
            try: out = subprocess.run([shotqa.AGY, '-C', d, '-t', '420', PROMPT.format(f=f)], capture_output=True, text=True, timeout=480).stdout
            except subprocess.TimeoutExpired: out = ''
            r = shotqa.first_json(out)
            if r and 'caption' in r: return r
        return {'raw': (out or '')[-400:]}
    with ThreadPoolExecutor(A.jobs) as ex: res = dict(zip(jobs, ex.map(ask, jobs)))
    by = {}
    for name, shot, capn, d, f in plan:
        r = res[(d, f)]; ok = 'caption' in r
        norm = lambda x: ''.join(c for c in str(x).replace('\u2019', "'").lower() if c.isalnum())  # (a line break, "|" or a space: the same words)
        line = 'NO QA' if not ok else ('OK' if r.get('complete') and r.get('glance') and r.get('contrast') in ('strong', 'ok') and norm(r.get('caption', '')) == norm(capn) else 'FLAG')
        by.setdefault(name, []).append({'shot': shot, 'caption': capn, 'still': os.path.join(d, f), 'verdict': line, 'answer': r})
        print(f"{name} {shot} {'square' if 'square' in f else ('4x5   ' if '4x5' in f else 'wide  ')} {line:5} read={r.get('caption')!r} complete={r.get('complete')} glance={r.get('glance')} contrast={r.get('contrast')} | {str(r.get('covers') or r.get('raw', ''))[:140]}")
    for name, v in by.items(): json.dump(v, open(os.path.join(cut.ROOT, 'finals', 'qa', name, 'captions.json'), 'w'), indent=1)

if __name__ == '__main__': main()
