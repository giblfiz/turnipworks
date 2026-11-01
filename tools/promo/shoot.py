#!/usr/bin/env python3
"""SHOOT: shots of the library by label -> frames -> a clean master and a labelled review clip (tools/promo, 2026-10-22).

  python3 tools/promo/shoot.py RZ4 [RQ8 ...] [--keep-frames] [--encode-only] [--bump "note"]

For each label (shots/registry.json): runs its script (shots/scripts.py) in a Rig, writes capture.json (frames, fails,
console errors, the script's own notes), then encodes
  master  <root>/finals/shots/<label>.mp4   1920x1080 (or the shot's params.size: v4 feed shapes), 60 fps, x264 CRF 16 slow, yuv420p, +faststart, no audio (clean;
          encoded as the frames are captured, piped: no frame files)
  review  <review>/shots/<label>.mp4        smaller, CRF 23 slow, the label (with rev above r1) burnt in top-left
plus stills/ (every 30th frame, JPEG) in the capture folder. FAILS (no encode) on any grey stand-in drawn or a script failure.
--bump: a re-render of the same shot (rev + 1, the note in its history) before shooting.
"""
import argparse, asyncio, importlib, json, os, shutil, subprocess, sys, time, traceback

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'shots'))
import library as L  # noqa: E402

ROOT = json.load(open(os.path.join(HERE, 'shots.json')))['_root']
REVIEW = os.environ.get('TW_PROMO_REVIEW', '/tmp/scratch/promo-review/v4')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
REVIEW_W = int(os.environ.get('TW_PROMO_REVIEW_W', 1280)); REVIEW_CRF = os.environ.get('TW_PROMO_REVIEW_CRF', '23'); REVIEW_FPS = os.environ.get('TW_PROMO_REVIEW_FPS', '30')

def cap_dir(label): return os.path.join(ROOT, 'captures', 'shots', label)

def burn(text, size_frac=0.024):
    """drawtext: the label small in the top-left, on a dark box (review copies only)"""
    return f"drawtext=fontfile={FONT}:text='{text}':x=w*0.012:y=h*0.016:fontsize=h*{size_frac}:fontcolor=white@0.92:box=1:boxcolor=black@0.55:boxborderw=6"

def encode_master(frames, out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '60', '-i', os.path.join(frames, 'f_%05d.png'),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', '-an', out], check=True)

def encode_review(master, out, text, small=False):
    """small: a zoom variant (the library's extra framings): 640 wide, CRF 28, to keep the review set small"""
    os.makedirs(os.path.dirname(out), exist_ok=True)
    vf = f"fps={REVIEW_FPS},scale={640 if small else REVIEW_W}:-2:flags=lanczos,{burn(text)},format=yuv420p"  # (fps first: exact frame count)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', master, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28' if small else REVIEW_CRF,
                    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], check=True)

def probe(path):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', path], capture_output=True, text=True, check=True).stdout)
    v = [s for s in j['streams'] if s['codec_type'] == 'video'][0]
    return {'codec': v['codec_name'], 'size': [v['width'], v['height']], 'fps': v['r_frame_rate'], 'frames': int(v['nb_read_frames']), 'dur': float(j['format']['duration']), 'streams': len(j['streams']), 'bytes': int(j['format']['size'])}

def master_of(label): return os.path.join(ROOT, 'finals', 'shots', f'{label}.mp4')

def encode(label, S):
    master = master_of(label); review = os.path.join(REVIEW, 'shots', f'{label}.mp4')
    encode_review(master, review, L.tag(label, S['rev']), small=S.get('zoom', 'default') != 'default' or bool(S.get('variant')) or bool(S.get('shape')))
    pm, pr = probe(master), probe(review)
    ok = pm['codec'] == 'h264' and pm['size'] == list(S.get('params', {}).get('size', [1920, 1080])) and pm['fps'] == '60/1' and pm['streams'] == 1
    print(f"  master {master}: {pm}\n  review {review}: {pr}", flush=True)
    if not ok: raise SystemExit(f'{label}: master failed the probe {pm}')
    return pm, pr

async def run_script(label, S):
    import rig as R, scripts
    importlib.reload(scripts)
    fn = getattr(scripts, S['script']); P = S.get('params', {})
    t = time.time()
    async with R.Rig(label, cap_dir(label), layout=P.get('layout', 'single'), master=master_of(label), size=P.get('size', (1920, 1080)), page_scale=P.get('page_scale', 1.0)) as rig:
        if P.get('rug'): rig.before_freeze = lambda: scripts.add_rug(rig, rig.seats[0], P['rug'])  # 30B: the beat's caption on a rug in the scene
        try: meta = await fn(rig, P)
        except Exception as e:
            rig.fails.append(f'script: {e!r}'); traceback.print_exc(); meta = None
        rep = rig.report(); rig.close(keep=not rig.fails)
    rep.update({'meta': meta, 'rev': S['rev'], 'script': S['script'], 'params': P, 'wall_s': round(time.time() - t, 1)})
    json.dump(rep, open(os.path.join(cap_dir(label), 'capture.json'), 'w'), indent=1)
    return rep

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('labels', nargs='*'); ap.add_argument('--pending', action='store_true'); ap.add_argument('--keep-frames', action='store_true'); ap.add_argument('--encode-only', action='store_true'); ap.add_argument('--bump')
    A = ap.parse_args(); bad = []
    def pending():
        """--pending: every shot not rendered at its revision; the ones the cuts use first (re-read before each shot)"""
        import glob
        R = L.load(); used = []
        for f in sorted(glob.glob(os.path.join(HERE, 'cuts', '*.json'))):
            for b in json.load(open(f))['beats']:
                if b['shot'] not in used: used.append(b['shot'])
        todo = [l for l, S in R['shots'].items() if S['script'] != 'post' and not (S.get('rendered_rev') == S['rev'] and os.path.exists(master_of(l))) and l not in bad]
        return sorted(todo, key=lambda l: (l not in used, list(R['shots']).index(l)))
    labels = list(A.labels)
    while True:
        if not labels:
            if not A.pending: break
            nxt = [l for l in pending() if not (os.path.exists(os.path.join(cap_dir(l), '.lock')) and os.path.exists('/proc/' + open(os.path.join(cap_dir(l), '.lock')).read().strip()))]
            if not nxt: break
            labels = [nxt[0]]
        label = labels.pop(0)
        R = L.load(); S = R['shots'][label]
        # several lanes may share one queue: a shot already rendered at its revision, or being shot by another lane, is skipped
        if not A.bump and not A.encode_only and S.get('rendered_rev') == S['rev'] and os.path.exists(master_of(label)): print(f'== {label}: done at r{S["rev"]}, skipped'); continue
        lock = os.path.join(cap_dir(label), '.lock'); os.makedirs(cap_dir(label), exist_ok=True)
        def take():  # atomic: one lane only (a lock left by a dead process is taken over)
            try: fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY); os.write(fd, str(os.getpid()).encode()); os.close(fd); return True
            except FileExistsError:
                try: alive = os.path.exists('/proc/' + open(lock).read().strip())
                except OSError: alive = False
                if alive: return False
                try: os.remove(lock)
                except OSError: pass
                return take()
        if not take(): print(f'== {label}: another lane has it, skipped'); continue
        if A.bump: L.bump(R, label, A.bump); L.save(R); S = R['shots'][label]
        print(f'== {L.tag(label, S["rev"])}: {S["desc"]}', flush=True)
        if not A.encode_only:
            try: rep = asyncio.run(run_script(label, S))
            finally:
                try: os.remove(lock)
                except OSError: pass
            print(f"  {rep['frames']} frames, {rep['n_fails']} fails, wall {rep['wall_s']} s; errors {sum(len(v) for v in rep['errors'].values())}", flush=True)
            for f in rep['fails'][:6]: print('  FAIL', f)
            if rep['n_fails'] or not rep['frames']: bad.append(label); continue  # (--pending: a failed shot is not retried in this run)
        pm, pr = encode(label, S)
        R = L.load(); E = R['shots'][label]; E['duration_s'] = round(pm['frames'] / 60, 3); E['master'] = os.path.join(ROOT, 'finals', 'shots', f'{label}.mp4'); E['review'] = os.path.join(REVIEW, 'shots', f'{label}.mp4'); E['rendered'] = time.strftime('%Y-%m-%d %H:%M'); E['rendered_rev'] = E['rev']; L.save(R)
    if bad: print('FAILED:', bad); sys.exit(1)

if __name__ == '__main__': main()
