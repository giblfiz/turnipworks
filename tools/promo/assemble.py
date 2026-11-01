#!/usr/bin/env python3
"""ASSEMBLE: an EDL (variants/V*.json) -> <out>/<name>.mp4 (1920x1080) and <name>-square.mp4 (1080x1080), H.264,
60 fps, yuv420p, +faststart, no audio; plus a contact sheet <name>-sheet.jpg (tools/promo, 2026-10-22).

  python3 tools/promo/assemble.py V1 [V2 ...] [--out DIR] [--nvenc]

Each output frame is one file: a capture frame (captures/<capture>/frames/f_NNNNN.png) or a card (cards/card-n.png).
The frame list is laid out as numbered links in a temp folder and handed to ffmpeg as an image sequence, so every frame
is exactly where the EDL puts it. The square is the middle 1080 of the footage and the square card (card-n-sq.png,
padded into a 1920 frame so one crop serves both), or, when the EDL names a square_capture (a 1080x1080 take framed for
the square), that take's frames and card-n-sq.png as they are.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))

def pad_square_cards(cards):
    from PIL import Image
    for n in range(1, 5):
        dst = os.path.join(cards, f'card-{n}-sqpad.png')
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(os.path.join(cards, f'card-{n}-sq.png')): continue
        sq = Image.open(os.path.join(cards, f'card-{n}-sq.png')).convert('RGB'); bg = Image.new('RGB', (1920, 1080), sq.getpixel((2, 2)))
        bg.paste(sq, (420, 0)); bg.save(dst)

def encode(seq, out, crop, nvenc):
    vf = (f'crop=1080:1080:420:0,' if crop else '') + 'format=yuv420p'
    enc = ['-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '16', '-b:v', '0'] if nvenc else ['-c:v', 'libx264', '-preset', 'slow', '-crf', '15']
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '60', '-i', os.path.join(seq, '%05d.png'), '-vf', vf, *enc, '-profile:v', 'high', '-r', '60', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]
    subprocess.run(cmd, check=True)

def main():
    shots = json.load(open(os.path.join(HERE, 'shots.json')))
    ap = argparse.ArgumentParser(); ap.add_argument('names', nargs='+'); ap.add_argument('--out', default=os.path.join(shots['_root'], 'finals')); ap.add_argument('--nvenc', action='store_true')
    A = ap.parse_args(); os.makedirs(A.out, exist_ok=True)
    cards = os.path.join(shots['_root'], 'cards'); pad_square_cards(cards)
    for name in A.names:
        E = json.load(open(os.path.join(HERE, 'variants', f'{name}.json')))
        for square in (False, True):
            own = square and E.get('square_capture')  # a square take of its own: its frames as they are, the square card unpadded
            frames = os.path.join(shots['_root'], 'captures', own or E['capture'], 'frames')
            seq = tempfile.mkdtemp(prefix=f'tw-promo-{name}-')
            k = 0
            for s in E['segments']:
                for f in range(s['out'][0], s['out'][1]):
                    src = os.path.join(frames, f"f_{s['footage'] + f - s['out'][0]:05d}.png") if 'footage' in s else os.path.join(cards, f"card-{s['card']}{('-sq' if own else '-sqpad') if square else ''}.png")
                    if not os.path.exists(src): sys.exit(f'{name}: missing {src}')
                    os.symlink(src, os.path.join(seq, f'{k:05d}.png')); k += 1
            assert k == E['frames'], (k, E['frames'])
            out = os.path.join(A.out, f"{name}{'-square' if square else ''}.mp4"); encode(seq, out, square and not own, A.nvenc)
            if True:  # contact sheet: every 12th frame (0.2 s), 6 across, frame numbers burnt in
                subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', out, '-vf', "drawtext=text='%{n}':x=20:y=20:fontsize=64:fontcolor=yellow:box=1:boxcolor=black@0.6,select='not(mod(n,12))',scale=480:-2,tile=6x5:padding=4", '-frames:v', '1', '-update', '1', os.path.join(A.out, f"{name}{'-square' if square else ''}-sheet.jpg")], check=True)
            shutil.rmtree(seq)
            print(out)

if __name__ == '__main__': main()
