#!/usr/bin/env python3
"""CUTS: a list of labelled shots -> a 15 / 30 / 60 s film (tools/promo, 2026-10-22).

  python3 tools/promo/cut.py 15A [30A ...] [--no-review]
  python3 tools/promo/cut.py 15C 30A 60A --shape square|4x5     (v4 feed shapes)

--shape (v4, 2026-10-23): the same cut (same beats, order, in/out, captions, end) built from each beat's feed-shape twin
(library.py: the 16:9 shot's `shapes`), at the shape's size (square 1080x1080, 4x5 1080x1350), captions in the shape's
layout, the card's shape PNG (card-c5.png -> card-c5-sq.png / card-c5-4x5.png); written as <name>-<shape>.mp4.

A cut is cuts/<name>.json:
  { "name": "15A", "title": "build, then invite", "duration": 15.0,
    "captions": "overlay" | "none",                   overlay: a small lower-third per beat (caption.html), faded in/out
    "beats": [ { "shot": "QM5", "in": 0.3, "out": 5.0, "caption": "Drop a building. Watch it build." }, ... ],
    "end": { "secs": 2.5, "dissolve": 0.5 } }       the house end card (cards/card-4.png: the mark, the name, the four
                                                    phrases, turnipworks.net) dissolving in over the last beat's tail
Recombining is editing the list of labels. Beats are cut hard (one idea per beat; Polymancer's structure); in/out are
seconds of that shot's master. The beats' lengths plus end.secs must equal duration exactly (frames at 60 fps).

Writes  <root>/finals/<name>.mp4         master, 1920x1080, 60 fps, x264 CRF 16, yuv420p, faststart, no audio (clean)
        <root>/finals/<name>.edl.json    the cut as built: each beat's shot label + revision and its time on the film
        <review>/<name>.mp4              review copy: smaller, CRF 23, each beat's label (rev above r1) burnt in top-left
and checks both with ffprobe (codec, size, fps, frame count = duration, one stream, faststart) and signalstats (no flat
frame).
"""
import argparse, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import library as L  # noqa: E402
import shoot  # noqa: E402

ROOT = shoot.ROOT; REVIEW = shoot.REVIEW; FPS = 60; CARD = None
CUT_REVIEW_W = int(os.environ.get('TW_PROMO_CUT_REVIEW_W', 1280)); CUT_REVIEW_CRF = os.environ.get('TW_PROMO_CUT_REVIEW_CRF', '23'); CUT_REVIEW_FPS = os.environ.get('TW_PROMO_CUT_REVIEW_FPS', '30')

SHAPES = {'square': {'size': (1080, 1080), 'q': {'sq': 1}, 'card': '-sq', 'pre': 'capsq-'}, '4x5': {'size': (1080, 1350), 'q': {'shape': '4x5'}, 'card': '-4x5', 'pre': 'cap45-'}}

def stack_above(shape):
    """v4: the y (px) where a split beat's caption ends in a feed shape: 24 px above the bottom of the GM's window (the
    upper one; rig.py's stacked layout), so the player's window below stays clear"""
    top, gap = 56, 16  # (rig.SPLIT; rig.py is not imported here: importing capture.py clears the sandbox's campaigns)
    W, H = SHAPES[shape]['size']; ph = (H - 2 * top - gap) // 2; return top + ph - 24

def captions(texts, out, sq=False, shape=None, above=None):
    """caption.html -> one transparent 1920x1080 PNG per caption text (sq: 1080x1080, the square frame's layout; shape:
    a v4 feed shape's size and layout); each checked: Inter loaded, every word inside the frame"""
    from playwright.sync_api import sync_playwright
    import hashlib, urllib.parse as U
    os.makedirs(out, exist_ok=True); stage = tempfile.mkdtemp(prefix='tw-cap-')
    shutil.copy(os.path.join(HERE, 'caption.html'), stage)
    shutil.copy(os.path.join(os.path.dirname(os.path.dirname(HERE)), 'engine', 'client', 'vendor', 'inter', 'inter-latin-wght-normal.woff2'), os.path.join(stage, 'inter.woff2'))
    paths = {}
    with sync_playwright() as p:
        if shape: sq = False
        Z = SHAPES[shape] if shape else ({'size': (1080, 1080), 'q': {'sq': 1}, 'pre': 'capsq-'} if sq else {'size': (1920, 1080), 'q': {}, 'pre': 'cap3-'})
        b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page(viewport={'width': Z['size'][0], 'height': Z['size'][1]})
        for t in texts:
            f = os.path.join(out, Z['pre'] + hashlib.sha1(t.encode()).hexdigest()[:10] + (f'-a{above}' if above else '') + '.png')
            pg.goto(f'file://{stage}/caption.html?' + U.urlencode({'t': t, **Z['q'], **({'above': above} if above else {})})); pg.wait_for_load_state('load')
            if not pg.evaluate("document.fonts.ready.then(() => [...document.fonts].some(f => f.family === 'Inter' && f.status === 'loaded'))"): sys.exit('caption: Inter did not load')
            pg.wait_for_timeout(50)
            out_of = pg.evaluate("(() => { const W = innerWidth, H = innerHeight, bad = []; for (const e of document.querySelectorAll('#t span, .rule')) { const r = e.getBoundingClientRect(); if (r.left < 0 || r.top < 0 || r.right > W || r.bottom > H) bad.push(e.textContent || 'rule'); } return bad; })()")
            if out_of: sys.exit(f'caption {t!r} runs off the {Z["size"]} frame: {out_of}')
            pg.screenshot(path=f, omit_background=True); paths[t] = f
        b.close()
    return paths

def build(name, review=True, shape=None):
    C = json.load(open(os.path.join(HERE, 'cuts', f'{name}.json'))); R = L.load()
    W, H = SHAPES[shape]['size'] if shape else (1920, 1080); out_name = f'{name}-{shape}' if shape else name
    def shot_of(lab):  # v4: the beat's feed-shape twin
        if not shape: return lab
        t = R['shots'][lab].get('shapes', {}).get(shape)
        if not t: sys.exit(f'{name}: {lab} has no {shape} twin (library.py shape {shape} {lab})')
        return t
    beats = C['beats']; end = C.get('end', {'secs': 2.5, 'dissolve': 0.5}); D = round(C['duration'] * FPS)
    fr = [round((b['out'] - b['in']) * FPS) for b in beats]; endf = round(end['secs'] * FPS); dz = round(end.get('dissolve', 0.5) * FPS)
    if sum(fr) + endf != D: sys.exit(f"{name}: beats {sum(fr) / FPS:.3f} s + end {endf / FPS:.3f} s = {(sum(fr) + endf) / FPS:.3f} s, want {C['duration']} s")
    caps = captions(sorted({b['caption'] for b in beats if b.get('caption')}), os.path.join(ROOT, 'captions'), shape=shape) if C.get('captions', 'overlay') == 'overlay' else {}
    # v4: a split beat in a feed shape (its windows stacked) has its caption over the GM's (upper) window
    split = {b['caption'] for b in beats if b.get('caption') and shape and R['shots'][shot_of(b['shot'])].get('params', {}).get('layout') == 'split'}
    caps_up = captions(sorted(split), os.path.join(ROOT, 'captions'), shape=shape, above=stack_above(shape)) if split and caps else {}
    # the end card is swappable (v3, 2026-10-22: card variants are being designed apart): cut.py --card PNG, or the cut's
    # end.card, or TW_PROMO_CARD; a bare name is looked for in <root>/cards/. Default: the house card (card.html, n=4).
    card = CARD or end.get('card') or os.environ.get('TW_PROMO_CARD') or 'card-4.png'
    if shape: card = card[:-4] + SHAPES[shape]['card'] + '.png'  # (card-c5.png -> card-c5-sq.png / card-c5-4x5.png)
    if not os.path.isabs(card): card = os.path.join(ROOT, 'cards', card)
    if not os.path.exists(card): sys.exit(f'no end card {card}: run tools/promo/cards.py')
    args, fc, labels = [], [], []; t = 0
    for k, (b, n) in enumerate(zip(beats, fr)):
        lab = shot_of(b['shot']); S = R['shots'][lab]; src = shoot.master_of(lab)
        if not os.path.exists(src): sys.exit(f"{name}: {lab} has no master")
        if shape and shoot.probe(src)['size'] != [W, H]: sys.exit(f"{name}: {lab}'s master is not {W}x{H}")
        last = k == len(beats) - 1
        span = n + (dz if last else 0)  # the last beat runs on under the card's dissolve
        dur_src = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)
        if b['in'] + span / FPS > dur_src + 1e-3: sys.exit(f"{name}: beat {k} ({lab}) wants {b['in'] + span / FPS:.3f} s of a {dur_src:.3f} s shot")
        args += ['-i', src]; i = sum(1 for a in args if a == '-i') - 1
        fc.append(f"[{i}:v]trim=start_frame={round(b['in'] * FPS)}:end_frame={round(b['in'] * FPS) + span},setpts=PTS-STARTPTS,fps=60,format=rgba[v{k}]")
        if b.get('caption') and caps:
            cap_png = caps_up[b['caption']] if (b['caption'] in caps_up and S.get('params', {}).get('layout') == 'split') else caps[b['caption']]
            args += ['-loop', '1', '-framerate', '60', '-t', f'{span / FPS:.4f}', '-i', cap_png]
            j = sum(1 for a in args if a == '-i') - 1
            cin, cout = b.get('cap_in', 0.35), b.get('cap_hold', n / FPS - 0.35 - 0.45)
            fc.append(f"[{j}:v]format=rgba,fade=t=in:st={cin:.3f}:d=0.4:alpha=1,fade=t=out:st={cin + cout:.3f}:d=0.4:alpha=1[c{k}]")
            fc.append(f"[v{k}][c{k}]overlay=0:0:format=auto:shortest=1,format=rgba[w{k}]")
        else: fc.append(f"[v{k}]null[w{k}]")
        labels.append({'shot': lab, **({'shape_of': b['shot']} if shape else {}), 'rev': S['rev'], 'tag': L.tag(lab, S['rev']), 'at': [round(t / FPS, 4), round((t + n) / FPS, 4)], 'src_in': b['in'], 'src_out': round(b['in'] + n / FPS, 4), 'caption': b.get('caption'), **({'caption_at': 'over the GM window'} if b.get('caption') and b['caption'] in caps_up and S.get('params', {}).get('layout') == 'split' else {}), 'desc': S['desc']})
        t += n
    i_idx = sum(1 for a in args if a == '-i')
    args += ['-loop', '1', '-framerate', '60', '-t', f'{endf / FPS:.4f}', '-i', card]  # (the dissolve is inside the card's time: the last beat's footage runs on under it)
    fc.append(f"[{i_idx}:v]scale={W}:{H},fps=60,format=rgba[card]")
    if len(beats) > 1:
        # all but the last beat concatenated; the last (with its tail) dissolves into the card
        fc.append(''.join(f'[w{k}]' for k in range(len(beats) - 1)) + f"concat=n={len(beats) - 1}:v=1:a=0[pre]")
        fc.append(f"[w{len(beats) - 1}][card]xfade=transition=fade:duration={dz / FPS:.4f}:offset={(fr[-1]) / FPS:.4f}[tailc]")
        fc.append("[pre][tailc]concat=n=2:v=1:a=0,format=yuv420p[out]")
    else:
        fc.append(f"[w0][card]xfade=transition=fade:duration={dz / FPS:.4f}:offset={fr[0] / FPS:.4f},format=yuv420p[out]")
    master = os.path.join(ROOT, 'finals', f'{out_name}.mp4'); os.makedirs(os.path.dirname(master), exist_ok=True)
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args, '-filter_complex', ';'.join(fc), '-map', '[out]', '-frames:v', str(D), '-r', '60',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', master]
    subprocess.run(cmd, check=True)
    built = {'name': out_name, 'cut': name, 'shape': shape, 'size': [W, H], 'title': C.get('title'), 'duration': C['duration'], 'beats': labels, 'end_at': round(sum(fr) / FPS, 4), 'end': end, 'card': card, 'captions': C.get('captions', 'overlay'), 'master': master}
    json.dump(built, open(os.path.join(ROOT, 'finals', f'{out_name}.edl.json'), 'w'), indent=1)
    out = None
    if review:
        out = os.path.join(REVIEW, f'{out_name}.mp4'); os.makedirs(REVIEW, exist_ok=True)
        dt = ','.join(f"drawtext=fontfile={shoot.FONT}:text='{b['tag']}':x=w*0.012:y=h*0.016:fontsize=h*0.024:fontcolor=white@0.92:box=1:boxcolor=black@0.55:boxborderw=6:enable='between(t,{b['at'][0]:.4f},{b['at'][1] - 0.001:.4f})'" for b in labels)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', master, '-vf', f'fps={CUT_REVIEW_FPS},scale={review_w(W)}:-2:flags=lanczos,{dt},format=yuv420p',
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', CUT_REVIEW_CRF, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], check=True)
    return built, master, out

def review_w(W): return CUT_REVIEW_W if W == 1920 else 720  # (v4: a feed shape's review copy 720 wide)

def check(path, dur, w=1920, h=1080, fps='60/1'):
    p = shoot.probe(path)
    head = open(path, 'rb').read(1 << 16); fast = head.find(b'moov') != -1 and (head.find(b'mdat') == -1 or head.find(b'moov') < head.find(b'mdat'))
    out = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', path, '-vf', 'signalstats,metadata=print:file=-', '-f', 'null', '-'], capture_output=True, text=True).stdout
    lo = None; flat = 0
    for line in out.splitlines():
        if 'YMIN=' in line: lo = float(line.split('=')[1])
        elif 'YMAX=' in line and lo is not None and float(line.split('=')[1]) - lo < 12: flat += 1
    nf = round(dur * int(fps.split('/')[0]))
    ok = p['codec'] == 'h264' and p['size'] == [w, h] and p['fps'] == fps and abs(p['frames'] - nf) <= 1 and abs(p['dur'] - dur) <= 1 / 30 + 1e-6 and p['streams'] == 1 and fast and not flat
    print(f"  {'ok  ' if ok else 'FAIL'} {os.path.basename(path)}: {p} faststart={fast} flat={flat}")
    return ok

def last_frame_is_card(path, card, nframes):
    """the film's very last frame is the end card, fully drawn (Harry 2026-10-22: a player stopped on the last frame shows
    the card): the last frame decoded and compared with the card PNG (mean absolute difference per channel, 0..255; x264 at
    CRF 16 leaves ~1-2); also the frame 0.5 s before the end (the card held, not fading)"""
    import numpy as np
    from PIL import Image
    tmp = tempfile.mkdtemp(prefix='tw-last-'); out = {}
    for tag, k in (('last', nframes - 1), ('hold', nframes - 31)):
        f = os.path.join(tmp, f'{tag}.png')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', path, '-vf', f'select=eq(n\\,{k})', '-vsync', '0', '-frames:v', '1', f], check=True)
        cw, ch = Image.open(card).size; sz = (480, round(480 * ch / cw))
        a = np.asarray(Image.open(f).convert('RGB').resize(sz), dtype=float); b = np.asarray(Image.open(card).convert('RGB').resize(sz), dtype=float)
        out[tag] = round(float(np.abs(a - b).mean()), 2)
    shutil.copy(os.path.join(tmp, 'last.png'), path[:-4] + '-last.png')
    ok = out['last'] < 4 and out['hold'] < 4
    print(f"  {'ok  ' if ok else 'FAIL'} last frame = end card: mean diff {out}  ({path[:-4] + '-last.png'})")
    return ok

def main():
    global CARD
    ap = argparse.ArgumentParser(); ap.add_argument('names', nargs='+'); ap.add_argument('--no-review', action='store_true'); ap.add_argument('--card', help='end card PNG (1920x1080), or a name in <root>/cards/'); ap.add_argument('--shape', choices=sorted(SHAPES))
    A = ap.parse_args(); bad = []; CARD = A.card
    for name in A.names:
        built, master, rev = build(name, not A.no_review, A.shape); W, H = built['size']
        print(f"== {built['name']}: " + ' | '.join(f"{b['tag']} {b['at'][0]:.2f}-{b['at'][1]:.2f}" for b in built['beats']) + f" | end {built['end_at']:.2f}")
        ok = check(master, built['duration'], W, H) and last_frame_is_card(master, built['card'], round(built['duration'] * FPS))
        if rev: ok = check(rev, built['duration'], review_w(W), round(review_w(W) * H / W / 2) * 2, f'{CUT_REVIEW_FPS}/1') and ok
        if not ok: bad.append(built['name'])
    if bad: print('FAILED:', bad); sys.exit(1)

if __name__ == '__main__': main()
