#!/usr/bin/env python3
"""THE LINK PREVIEW PICTURE (og:image, 2026-10-23): a real frame of the game, cropped to 1200x630, with an optional
small lockup (the real mark.svg + "Turnip Works · turnipworks.net" in the game's Inter). Never hand-drawn art.

  python3 engine/tools/og_card.py FRAME OUT.jpg --crop X0,Y0,X1,Y1 [--lockup bl|br|tl|tr|none]

FRAME is a still of the approved promo footage (/mnt/usb/turnip-works/promo/finals/approved/<date>/*.mp4, pulled with
ffmpeg -ss T -frames:v 1, or a still of the same shot under /mnt/usb/turnip-works/promo/captures/shots/<label>/stills/).
The crop is in the frame's pixels and should be close to 1.905:1. The lockup is laid out by Chromium (the font is the
game's own woff2) and the result saved as a progressive JPEG under 300 KB. The picture in use and where it came from:
engine/tools/build_site.py OG_IMAGE, docs/STATUS.md "Search and link previews".
"""
import argparse, base64, io, os, sys
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); CLIENT = os.path.join(os.path.dirname(HERE), 'client')
ap = argparse.ArgumentParser(); ap.add_argument('frame'); ap.add_argument('out')
ap.add_argument('--crop', required=True); ap.add_argument('--lockup', default='bl', choices=['bl', 'br', 'tl', 'tr', 'none'])
ap.add_argument('--quality', type=int, default=86)
ap.add_argument('--scale', type=float, default=1.18, help='lockup size (1 = name 38 px)')
ap.add_argument('--inset', default='40,30', help='lockup distance from the bottom/top edge and the side edge, px')
A = ap.parse_args()
box = tuple(int(v) for v in A.crop.split(','))
im = Image.open(A.frame).convert('RGB').crop(box).resize((1200, 630), Image.LANCZOS)
if A.lockup != 'none':
    b = io.BytesIO(); im.save(b, 'PNG'); bg = base64.b64encode(b.getvalue()).decode()
    font = base64.b64encode(open(os.path.join(CLIENT, 'vendor', 'inter', 'inter-latin-wght-normal.woff2'), 'rb').read()).decode()
    mark = base64.b64encode(open(os.path.join(CLIENT, 'mark.svg'), 'rb').read()).decode()
    v, h = ('bottom' if A.lockup[0] == 'b' else 'top'), ('left' if A.lockup[1] == 'l' else 'right')
    iv, ih = (int(x) for x in A.inset.split(',')); k = A.scale
    page = f"""<!doctype html><meta charset=utf-8><style>
    @font-face {{ font-family: Inter; src: url(data:font/woff2;base64,{font}) format('woff2'); font-weight: 100 900; }}
    html, body {{ margin: 0; width: 1200px; height: 630px; overflow: hidden; }}
    body {{ background: url(data:image/png;base64,{bg}) 0 0 / 1200px 630px no-repeat; font-family: Inter, sans-serif; }}
    .lock {{ position: absolute; {v}: {iv}px; {h}: {ih}px; display: flex; align-items: center; gap: {14*k:.0f}px; padding: {12*k:.0f}px {22*k:.0f}px {12*k:.0f}px {14*k:.0f}px;
      border-radius: {18*k:.0f}px; background: rgb(24, 20, 16); box-shadow: 0 4px 18px rgba(0, 0, 0, .35); color: #f6ead2; }}
    .lock img {{ width: {64*k:.0f}px; height: {64*k:.0f}px; }}
    .n {{ font-weight: 700; font-size: {38*k:.0f}px; line-height: 1.05; letter-spacing: -.01em; }}
    .u {{ font-weight: 500; font-size: {22*k:.0f}px; line-height: 1.2; opacity: .88; }}
    </style><div class=lock><img src="data:image/svg+xml;base64,{mark}" alt=""><div><div class=n>Turnip Works</div><div class=u>turnipworks.net</div></div></div>"""
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-sandbox']); pg = br.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        pg.set_content(page); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(150)
        shot = pg.screenshot(type='png'); br.close()
    im = Image.open(io.BytesIO(shot)).convert('RGB')
q = A.quality
while True:
    out = io.BytesIO(); im.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
    if out.tell() < 300_000 or q <= 60: break
    q -= 4
open(A.out, 'wb').write(out.getvalue())
print(f'{A.out}: 1200x630, {out.tell()} bytes, quality {q}, lockup {A.lockup}' + (f' x{A.scale} inset {A.inset}' if A.lockup != 'none' else '') + f', from {A.frame} crop {box}')
