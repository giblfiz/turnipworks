# THE CUT: trims and crops of the one real take (take3/raw.mkv, 2560x1440: the sheet's window left, the table's right),
# each scaled to 1280x720, joined, with captions burned in (an ASS file: text only). Then the web encodes, the poster and
# the page's pictures (frames of the same take).   python3 edit.py TAKE OUTDIR
import json, os, subprocess, sys
TAKE, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
RAW = os.path.join(TAKE, 'raw.mkv'); OFF = 1.0   # the recording started a second before the take's clock
DATE = '20261029d'
# (start, end in take time, crop x, y, w, h, caption or None)
SEG = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'segments.json')))

def ass_time(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'
HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Noto Sans,36,&H00FFFFFF,&H00FFFFFF,&H26141412,&H00000000,-1,0,0,0,100,100,0,0,3,12,0,2,50,50,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
lines, t, parts, extra = [], 0.0, [], []
for i, s in enumerate(SEG):
    if 'still' in s:   # a real capture of the same flow (an earlier rehearsal), held: x11grab missed what it shows in the take
        extra += ['-loop', '1', '-framerate', '30', '-t', f"{s['b'] - s['a']:.2f}", '-i', s['still']]
        a, b, x, y, w, h = s['a'], s['b'], *s['crop']
        src = f"[{len(extra) // 8}:v]setpts=PTS-STARTPTS"
    else:
        a, b, x, y, w, h = s['a'], s['b'], *s['crop']
        src = f"[0:v]trim=start={a + OFF:.2f}:end={b + OFF:.2f},setpts=PTS-STARTPTS"
    # (a seat link is a key: wherever the table window's address bar is in frame, it is blurred out)
    for j, (bx, by, bw, bh) in enumerate(s.get('blur', [])):
        parts.append(f"{src},split[s{i}_{j}a][s{i}_{j}b]"); parts.append(f"[s{i}_{j}b]crop={bw}:{bh}:{bx}:{by},boxblur=luma_radius=10:luma_power=4:chroma_radius=5:chroma_power=4[s{i}_{j}c]")
        src = f"[s{i}_{j}a][s{i}_{j}c]overlay={bx}:{by}"
    parts.append(f"{src},crop={w}:{h}:{x}:{y},scale=1280:720:flags=lanczos,fps=30,setsar=1[v{i}]")
    for c in s.get('caps', []):
        ca, cb, text = c[:3]; top = len(c) > 3 and c[3] == 'top'   # (top: where a caption at the bottom would cover what it names)
        lines.append(f"Dialogue: 0,{ass_time(t + ca)},{ass_time(t + cb)},Cap,,0,0,0,,{'{\\an8}' if top else ''}{text}")
    s['out'] = round(t, 2); t += b - a
open(os.path.join(OUT, 'captions.ass'), 'w').write(HEAD + '\n'.join(lines) + '\n')
fc = ';'.join(parts) + ';' + ''.join(f'[v{i}]' for i in range(len(SEG))) + f'concat=n={len(SEG)}:v=1:a=0[cat];[cat]subtitles={os.path.join(OUT, "captions.ass")}[out]'
master = os.path.join(OUT, 'master.mp4')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', RAW, *extra, '-filter_complex', fc, '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', master], check=True)
print(f'master {t:.1f} s', flush=True)
json.dump(SEG, open(os.path.join(OUT, 'segments.out.json'), 'w'), indent=1)
base = os.path.join(OUT, f'connect-dnd-beyond-{DATE}')
# web encodes: H.264 (two pass, faststart) and VP9 (two pass); no audio track
for p in (1, 2):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-an', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '620k', '-maxrate', '1400k', '-bufsize', '2800k',
                    '-g', '120', '-pass', str(p), '-passlogfile', os.path.join(OUT, 'x264'), '-movflags', '+faststart'] + (['-f', 'mp4', '/dev/null'] if p == 1 else [base + '.mp4']), check=True)
for p in (1, 2):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-an', '-c:v', 'libvpx-vp9', '-b:v', '520k', '-maxrate', '1200k', '-bufsize', '2400k', '-row-mt', '1', '-tile-columns', '2',
                    '-deadline', 'good', '-cpu-used', '2' if p == 2 else '4', '-g', '150', '-pass', str(p), '-passlogfile', os.path.join(OUT, 'vp9')] + (['-f', 'webm', '/dev/null'] if p == 1 else [base + '.webm']), check=True)
for f in (base + '.mp4', base + '.webm'): print(os.path.basename(f), f'{os.path.getsize(f) / 1e6:.2f} MB')
# the poster and the page's pictures: frames of the take itself (no caption), same crops
STILLS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stills.json')))
for name, v in STILLS.items():
    tt, x, y, w, h = v[:5]; src = v[5] if len(v) > 5 else RAW
    dst = os.path.join(OUT, name.replace('DATE', DATE) + '.jpg')
    sc = ',scale=1280:720:flags=lanczos' if w > 1280 else ''   # (a tighter crop stays at its own pixels: never blown up)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *(['-ss', f'{tt + OFF:.2f}'] if src == RAW else []), '-i', src, '-frames:v', '1', '-vf', f'crop={w}:{h}:{x}:{y}{sc}', '-q:v', '3', dst], check=True)
    print(os.path.basename(dst), f'{os.path.getsize(dst) / 1e3:.0f} KB')
