#!/usr/bin/env python3
"""CHECK: every final MP4 is what was asked (tools/promo, 2026-10-22).

  python3 tools/promo/check.py [V1 ...]      (default: every variants/*.json)

ffprobe: H.264 High, yuv420p, 60/1 fps, 360 frames counted, 6.00 s +- one frame, 1920x1080 (the square 1080x1080),
no audio stream, moov ahead of mdat (+faststart). ffmpeg signalstats: no frame flat (luma range < 12: blank or black).
"""
import glob, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def probe(path):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', path], capture_output=True, text=True, check=True).stdout)
    v = [s for s in j['streams'] if s['codec_type'] == 'video'][0]
    return j, v

def flat_frames(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', path, '-vf', 'signalstats,metadata=print:file=-', '-f', 'null', '-'], capture_output=True, text=True, check=True).stdout
    lo = hi = None; n = -1; flat = []
    for line in out.splitlines():
        if line.startswith('frame:'): n += 1
        elif 'YMIN=' in line: lo = float(line.split('=')[1])
        elif 'YMAX=' in line:
            hi = float(line.split('=')[1])
            if hi - lo < 12: flat.append(n)
    return flat, n + 1

def main():
    shots = json.load(open(os.path.join(HERE, 'shots.json'))); finals = os.path.join(shots['_root'], 'finals')
    names = sys.argv[1:] or sorted((os.path.basename(p)[:-5] for p in glob.glob(os.path.join(HERE, 'variants', '[VM]*.json'))), key=lambda s: (s[0], int(s[1:].split('-')[0]), s))
    bad = 0
    for name in names:
        for sq in (False, True):
            path = os.path.join(finals, f"{name}{'-square' if sq else ''}.mp4")
            if not os.path.exists(path): print(f'FAIL {path}: missing'); bad += 1; continue
            j, v = probe(path); dur = float(j['format']['duration']); w, h = (1080, 1080) if sq else (1920, 1080)
            head = open(path, 'rb').read(1 << 16); fast = head.find(b'moov') != -1 and (head.find(b'mdat') == -1 or head.find(b'moov') < head.find(b'mdat'))
            flat, nf = flat_frames(path)
            ok = (v['codec_name'] == 'h264' and v['pix_fmt'] == 'yuv420p' and v['r_frame_rate'] == '60/1' and int(v['nb_read_frames']) == 360 and abs(dur - 6.0) <= 1 / 60 + 1e-6
                  and (v['width'], v['height']) == (w, h) and len(j['streams']) == 1 and fast and not flat)
            bad += not ok
            print(f"{'ok  ' if ok else 'FAIL'} {os.path.basename(path)}: {v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {v['pix_fmt']} {v['r_frame_rate']} {v['nb_read_frames']} frames {dur:.3f} s, streams {len(j['streams'])}, faststart {fast}, flat frames {flat[:8] or 'none'}")
    sys.exit(1 if bad else 0)

if __name__ == '__main__': main()
