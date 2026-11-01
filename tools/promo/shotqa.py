#!/usr/bin/env python3
"""SHOT QA: Gemini (agy-run, the subscription; never a paid API) reads stills of a shot or a cut (tools/promo, 2026-10-22).

  python3 tools/promo/shotqa.py RZ4 [RQ8 ...] [--n 4] [--jobs 4]       shots: stills from finals/shots/<label>.mp4
  python3 tools/promo/shotqa.py --cut 15A [30A ...]                    cuts: a still from the middle of each beat + the end card

One agy-run call per still (single-image prompts: several images in one prompt timed out in the V-series QA). Gemini is
told nothing about what the shot is meant to show (a reader handed the intent tends to confirm it): it transcribes every
word first, then says what it sees and lists anything broken. Answers: captures/shots/<label>/qa/qa.json (cuts:
finals/qa/<cut>/qa.json); for shots a one-line verdict goes into the registry (shots/registry.json: verdict, qa).
"""
import argparse, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import library as L  # noqa: E402
AGY = '~/fauna-tools/agy-run'
ROOT = json.load(open(os.path.join(HERE, 'shots.json')))['_root']
PROMPT = """Look at the image file {f} in this folder: one frame of a promo video for a browser 3D tabletop game called Turnip Works.
Look at the image itself and answer straight away: do not crop it, write files or run code.
Answer ONLY with one JSON object, no prose:
1. "text": every word you can read anywhere in the frame, exactly as written, line by line (a list of strings). Read every label, caption and piece of on-screen UI before interpreting anything.
2. "shows": two short sentences: what is in the frame, and what seems to be happening (which UI panels or menus are open, where the mouse pointer is, what is selected, highlighted or in motion).
3. "broken": a list of anything that looks wrong: objects clipping through walls or floors, z-fighting or flicker stripes, objects floating above the floor, grey placeholder boxes, black or blank areas, UI glitches (overlapping, cut-off or half-drawn panels), garbled or illegible text, a mouse pointer that looks wrong. [] if nothing.
4. "legible": true if a viewer could read the frame's text at normal viewing size, false if not, "n/a" if there is no text.
5. "note": one short sentence."""

def still(src, t, dst):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{t:.3f}', '-i', src, '-frames:v', '1', dst], check=True)

def dur(src):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True, check=True).stdout)

def first_json(out):
    dec = json.JSONDecoder()
    for m in re.finditer(r'\{', out or ''):
        try: return dec.raw_decode(out[m.start():])[0]
        except json.JSONDecodeError: continue
    return None

def ask(job, tries=2):
    d, f = job; out = ''
    for _ in range(tries):
        try: out = subprocess.run([AGY, '-C', d, '-t', '420', PROMPT.format(f=f)], capture_output=True, text=True, timeout=480).stdout
        except subprocess.TimeoutExpired: out = ''
        r = first_json(out)
        if r: return r
    return {'raw': (out or '')[-600:]}

def verdict(rs):
    """one line: OK / FLAG with what Gemini flagged, and what it saw mid-shot; NO QA if any still went unanswered (a quota
    error comes back as JSON too: it is not an answer)"""
    if not rs or any('shows' not in r for r in rs.values()): return 'NO QA (Gemini did not answer: ' + str(next((r.get('short_error') or r.get('raw', '')[:80] for r in rs.values() if 'shows' not in r), ''))[:90] + ')'

    flags = [b for r in rs.values() for b in (r.get('broken') or []) if isinstance(b, str)]
    illeg = [f for f, r in rs.items() if r.get('legible') is False]
    mid = list(rs.values())[len(rs) // 2].get('shows', '') if rs else ''
    head = 'OK' if not flags and not illeg else 'FLAG: ' + '; '.join(dict.fromkeys(flags))[:220] + (f' (illegible: {", ".join(illeg)})' if illeg else '')
    return f'{head} | {mid[:200]}'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('names', nargs='+'); ap.add_argument('--cut', action='store_true'); ap.add_argument('--n', type=int, default=4); ap.add_argument('--jobs', type=int, default=4)
    A = ap.parse_args(); jobs, plan = [], []
    for name in A.names:
        if A.cut:
            src = os.path.join(ROOT, 'finals', f'{name}.mp4'); d = os.path.join(ROOT, 'finals', 'qa', name)
            E = json.load(open(os.path.join(HERE, 'cuts', f'{name}.json')))
            built = json.load(open(os.path.join(ROOT, 'finals', f'{name}.edl.json')))
            ts = [(b['at'][0] + b['at'][1]) / 2 for b in built['beats']] + [built['end_at'] + 0.8]
        else:
            src = os.path.join(ROOT, 'finals', 'shots', f'{name}.mp4'); d = os.path.join(ROOT, 'captures', 'shots', name, 'qa')
            D = dur(src); ts = [D * (k + 0.5) / A.n for k in range(A.n)]
        os.makedirs(d, exist_ok=True); fs = []
        for t in ts:
            f = f't{t:06.2f}.png'; still(src, t, os.path.join(d, f)); jobs.append((d, f)); fs.append(f)
        plan.append((name, d, fs))
    with ThreadPoolExecutor(A.jobs) as ex: res = dict(zip(jobs, ex.map(ask, jobs)))
    R = None if A.cut else L.load()
    for name, d, fs in plan:
        rs = {f: res[(d, f)] for f in fs}; json.dump(rs, open(os.path.join(d, 'qa.json'), 'w'), indent=1)
        v = verdict(rs); print(f'== {name}: {v}')
        for f, r in rs.items(): print(f"  {f}: text={r.get('text')} broken={r.get('broken')} legible={r.get('legible')} | {r.get('shows') or r.get('raw', '')[:200]}")
        if R is not None and name in R['shots']:
            R['shots'][name]['verdict'] = v; R['shots'][name]['qa'] = {'rev': R['shots'][name]['rev'], 'stills': [os.path.join(d, f) for f in fs], 'answers': rs}
    if R is not None: L.save(R)

if __name__ == '__main__': main()
