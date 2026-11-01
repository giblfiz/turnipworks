#!/usr/bin/env python3
"""POST: a stylised shot made from another shot's master by a rig-side effect (tools/promo, 2026-10-22). STYLISED, and
labelled so in the registry (variant "stylised: ..."): the footage is the game's, the look is not.

  python3 tools/promo/post.py LABEL          a registry entry with script "post" and params {"src": <label>, "effect": ...}

effect "tiltshift" (W3, "tabletop"): a tilt-shift lens: a sharp band across the frame (centre `band_y`, half-height
`band`), a progressive Gaussian blur above and below it (sigma `sigma`), and a little more saturation and contrast, so the
scene reads as real miniatures on a table. Same frames, same timing (1x): nothing is sped up.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import library as L  # noqa: E402
import shoot  # noqa: E402

def tiltshift(src, out, P):
    by, band, ramp, sig = P.get('band_y', 0.56), P.get('band', 0.11), P.get('ramp', 0.24), P.get('sigma', 9)
    mask = f"color=c=black:s=1920x1080:d=1,format=gray,geq=lum='255*clip((abs(Y-H*{by})-H*{band})/(H*{ramp}),0,1)'"
    fc = (f"[0:v]split[a][b];[b]gblur=sigma={sig}:steps=3[bl];{mask},loop=loop=-1:size=1[m];[bl][m]alphamerge[blm];"
          f"[a][blm]overlay=shortest=1,eq=saturation={P.get('sat', 1.22)}:contrast={P.get('contrast', 1.05)},format=yuv420p[out]")
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', fc, '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
                    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', '-an', out], check=True)

def main():
    for lab in sys.argv[1:]:
        R = L.load(); S = R['shots'][lab]; P = S['params']
        src = shoot.master_of(P['src']); out = shoot.master_of(lab)
        {'tiltshift': tiltshift}[P['effect']](src, out, P)
        S2 = R['shots'][lab]
        shoot.encode(lab, S2)
        pm = shoot.probe(out)
        R = L.load(); E = R['shots'][lab]; E['duration_s'] = round(pm['frames'] / 60, 3); E['master'] = out; E['review'] = os.path.join(shoot.REVIEW, 'shots', f'{lab}.mp4'); E['rendered_rev'] = E['rev']; L.save(R)
        print(lab, pm)

if __name__ == '__main__': main()
