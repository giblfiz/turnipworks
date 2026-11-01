#!/usr/bin/env python3
"""CARDS: the four card states (1, 2, 3, 4 phrases shown) from card.html, at 1920x1080 and 1080x1080 (tools/promo).

  python3 tools/promo/cards.py [--out DIR]   -> DIR/card-{n}.png, card-{n}-sq.png
"""
import argparse, json, os, shutil, tempfile
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))

INTER = os.path.join(REPO, 'engine', 'client', 'vendor', 'inter', 'inter-latin-wght-normal.woff2')  # the site's own face
FONT_OK = "document.fonts.ready.then(() => document.fonts.check('700 40px Inter') && [...document.fonts].some(f => f.family === 'Inter' && f.status === 'loaded'))"
# the mat's layout fits: every piece of type and the mark inside the inner rule, with room to spare
MAT_FITS = """(() => { const box = document.querySelector('.in').getBoundingClientRect(), pad = innerHeight * 0.02, bad = [];
  for (const e of document.querySelectorAll('.mark, .name, .phrases > div')) { const r = e.getBoundingClientRect();
    if (r.left < box.left + pad || r.right > box.right - pad || r.top < box.top + pad || r.bottom > box.bottom - pad) bad.push(e.className || e.textContent); }
  return bad; })()"""

def stage():
    """a temp folder with the card, the mat, the existing mark and the site's Inter: what the pages load"""
    tmp = tempfile.mkdtemp(prefix='tw-card-')
    shutil.copy(os.path.join(REPO, 'engine', 'client', 'mark.svg'), os.path.join(tmp, 'mark.svg'))  # the existing mark, unchanged
    shutil.copy(INTER, os.path.join(tmp, 'inter.woff2'))
    open(os.path.join(tmp, 'card.html'), 'w').write(open(os.path.join(HERE, 'card.html')).read().replace('src="MARK"', 'src="mark.svg"'))
    shutil.copy(os.path.join(HERE, 'mat.html'), os.path.join(tmp, 'mat.html'))
    shutil.copy(os.path.join(HERE, 'card-c5.html'), os.path.join(tmp, 'card-c5.html'))
    return tmp

# the C5 card's type all inside the frame (with 2% to spare) and nothing overlapping: [] when it fits
C5_FITS = """(() => { const W = innerWidth, H = innerHeight, pad = Math.min(W, H) * 0.02, bad = [], els = [...document.querySelectorAll('.mark, .nm, .url, li b, li small, li i')];
  for (const e of els) { const r = e.getBoundingClientRect(); if (r.left < pad || r.top < pad || r.right > W - pad || r.bottom > H - pad) bad.push('out: ' + (e.textContent || e.className)); }
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !els[i].contains(els[j])) bad.push('overlap: ' + (els[i].textContent || 'mark') + ' / ' + (els[j].textContent || 'mark')); }
  return bad; })()"""

def feed(out, force=False):
    """v4: card C5 for the feed shapes only (card-c5-sq.png 1080x1080, card-c5-4x5.png 1080x1350), checked to fit; an
    existing PNG is left as it is unless force (the approved cuts' cards are never re-rendered by this)"""
    tmp = stage(); done = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox', '--hide-scrollbars'])
        for tag, q, (w, h) in (('sq', 'square=1', (1080, 1080)), ('4x5', 'shape=4x5', (1080, 1350))):
            path = os.path.join(out, f'card-c5-{tag}.png')
            if os.path.exists(path) and not force: print('kept', path); done.append(path); continue
            pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
            pg.goto(f'file://{tmp}/card-c5.html?{q}'); pg.wait_for_load_state('load')
            if not pg.evaluate(FONT_OK): raise SystemExit('card C5 did not get Inter')
            bad = pg.evaluate(C5_FITS)
            if bad: raise SystemExit(f'card C5 ({tag}) does not fit: {bad}')
            pg.screenshot(path=path); print(path); done.append(path); pg.close()
        b.close()
    return done

def main():
    shots = json.load(open(os.path.join(HERE, 'shots.json')))
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=os.path.join(shots['_root'], 'cards')); ap.add_argument('--feed', action='store_true', help='v4: only card C5 square and 4:5'); ap.add_argument('--force', action='store_true'); A = ap.parse_args()
    os.makedirs(A.out, exist_ok=True)
    if A.feed: return feed(A.out, A.force)
    tmp = stage()
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox', '--hide-scrollbars'])
        for sq, (w, h) in ((False, (1920, 1080)), (True, (1080, 1080))):
            pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
            for n in range(1, 5):
                pg.goto(f'file://{tmp}/card.html?n={n}{"&square=1" if sq else ""}'); pg.wait_for_load_state('load')
                if not pg.evaluate(FONT_OK): raise SystemExit('the card did not get Inter')
                path = os.path.join(A.out, f'card-{n}{"-sq" if sq else ""}.png'); pg.screenshot(path=path); print(path)
            pg.goto(f'file://{tmp}/card-c5.html{"?square=1" if sq else ""}'); pg.wait_for_load_state('load')
            if not pg.evaluate(FONT_OK): raise SystemExit('card C5 did not get Inter')
            bad = pg.evaluate(C5_FITS)
            if bad: raise SystemExit(f'card C5 does not fit: {bad}')
            path = os.path.join(A.out, f'card-c5{"-sq" if sq else ""}.png'); pg.screenshot(path=path); print(path)
            pg.goto(f'file://{tmp}/card.html?n=4{"&square=1" if sq else ""}'); pg.wait_for_load_state('load'); pg.evaluate(FONT_OK)
            font = pg.evaluate("(() => { const c = document.createElement('canvas').getContext('2d'); return getComputedStyle(document.querySelector('.name')).fontFamily; })()")
        b.close()
    print('name font stack:', font)

if __name__ == '__main__': main()
