#!/usr/bin/env python3
"""QA: Gemini (agy-run, the subscription; never a paid API) looks at stills of the finals (tools/promo, 2026-10-22).

  python3 tools/promo/qa.py M1 [M2 ...] [--at 0.2,2.5,4.8,5.5] [--square-at 4.8] [--jobs 4]

For each variant: frames of <name>.mp4 at the times given (default 0.2, 2.5, 4.8 s and 5.5 s, in the end card) and of
<name>-square.mp4 at --square-at, as full-size PNGs in finals/qa/<name>/; one agy-run call per still (single-image
prompts: a several-image prompt timed out in the V-series QA). Gemini is asked to transcribe every word it can read
first, then to say whether the mat's edges are skewed or square to the frame, whether any of its type is cut off
by the frame, whether it reads as a printed rug or an
overlay, and whether anything looks broken. Answers: finals/qa/<name>/qa.json and one line per still on stdout.
"""
import argparse, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__)); AGY = '~/fauna-tools/agy-run'
PROMPT = """Look at the image file {f} in this folder: one 1920x1080 (or 1080x1080) frame of a 6-second promo video for a browser 3D tabletop game called Turnip Works. It is either a 3D scene (a building on open ground, possibly with a flat printed welcome mat or rug on the ground in front of it) or a solid title card.
Work in this order and answer ONLY with one JSON object, no prose:
1. "text": every word you can read anywhere in the frame, exactly as written, line by line (a list of strings). Read the labels before interpreting anything.
2. "kind": "scene" or "card".
3. "mat": if there is a mat/rug with writing on the ground: "square" if its near and far edges run level with the frame's horizontal and the writing sits straight, "skewed" if its edges run diagonally across the frame; "none" if no mat; "n/a" for a card.
4. "reads_as": for a mat: "printed rug" or "overlay/decal" (does it look like a physical thing lying on the ground, lit like the ground?); else "n/a".
5. "fits": for a scene: true if the whole building and the whole mat are inside the frame (nothing cut off at an edge), else false; "n/a" for a card.
6. "broken": a list of anything that looks wrong: clipping, z-fighting or flicker stripes, floating objects, grey placeholder boxes, black or blank areas, UI chrome, garbled text. [] if nothing.
7. "text_cut": for a mat: true if ANY of the writing on the mat (the logo, "Turnip Works", or any of the four phrases) is cut off by an edge of the frame, false if all of it is inside the frame; "n/a" if no mat. (The mat's own border running off the frame does not count.)
8. "note": one short sentence."""

def frame(src, t, dst):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{t:.3f}', '-i', src, '-frames:v', '1', dst], check=True)

def first_json(out):
    """the first whole JSON object in the answer (agy sometimes prints it twice)"""
    dec = json.JSONDecoder()
    for i in [m.start() for m in re.finditer(r'\{', out)]:
        try: return dec.raw_decode(out[i:])[0]
        except json.JSONDecodeError: continue
    return None

def ask(job, tries=2):
    d, f = job
    for _ in range(tries):  # (one more go after a timeout: agy's turn sometimes stalls)
        try: out = subprocess.run([AGY, '-C', d, '-t', '420', PROMPT.format(f=f)], capture_output=True, text=True, timeout=480).stdout
        except subprocess.TimeoutExpired: out = ''
        r = first_json(out)
        if r: return f, r
    return f, {'raw': out[-800:]}

def main():
    shots = json.load(open(os.path.join(HERE, 'shots.json'))); finals = os.path.join(shots['_root'], 'finals')
    ap = argparse.ArgumentParser(); ap.add_argument('names', nargs='+'); ap.add_argument('--at', default='0.2,2.5,4.8,5.5'); ap.add_argument('--square-at', default='4.8'); ap.add_argument('--jobs', type=int, default=4)
    A = ap.parse_args(); jobs = []
    for name in A.names:
        d = os.path.join(finals, 'qa', name); os.makedirs(d, exist_ok=True)
        for t in map(float, A.at.split(',')): f = f't{t:.1f}.png'; frame(os.path.join(finals, f'{name}.mp4'), t, os.path.join(d, f)); jobs.append((d, f))
        for t in map(float, A.square_at.split(',')): f = f'sq-t{t:.1f}.png'; frame(os.path.join(finals, f'{name}-square.mp4'), t, os.path.join(d, f)); jobs.append((d, f))
    with ThreadPoolExecutor(A.jobs) as ex: res = list(ex.map(ask, jobs))
    by = {}
    for (d, _), (f, r) in zip(jobs, res): by.setdefault(d, {})[f] = r
    for d, rs in by.items():
        json.dump(rs, open(os.path.join(d, 'qa.json'), 'w'), indent=1)
        for f, r in rs.items(): print(f"{os.path.basename(d)} {f}: " + (json.dumps(r) if 'raw' in r else f"{r.get('kind')} mat={r.get('mat')} text_cut={r.get('text_cut')} reads_as={r.get('reads_as')} fits={r.get('fits')} broken={r.get('broken')} text={r.get('text')} | {r.get('note')}"))

if __name__ == '__main__': main()
