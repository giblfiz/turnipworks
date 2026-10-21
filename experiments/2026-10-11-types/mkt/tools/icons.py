#!/usr/bin/env python3
"""The twelve room icons of the market type for the game's Build tray (engine/client/data/icons/room-<key>.png).
The castle / crypt / mansion flats agent's method (experiments/2026-10-05-castle-crypt-mansion/flats/gen.py + post.py):
one Codex image request per icon (free route), chroma-magenta ground, keyed and trimmed to 128 px RGBA.
    python3 tools/icons.py gen [name,...]     # icons/raw/<name>.png   (skips what exists; stops at a limit message)
    python3 tools/icons.py post               # icons/raw/*.png -> icons/*.png, prints the key residue"""
import os, re, sys, glob, shutil, subprocess, tempfile, time
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); MAIN = '<repo>'
ANCHOR = os.path.join(MAIN, 'experiments/2026-10-03-build-icons/raw/type-TAV.png'); RAW = os.path.join(HERE, 'icons/raw'); OUT = os.path.join(HERE, 'icons')
LIMIT = re.compile(r"usage limit|rate limit|rate_limit|quota|too many requests|\b429\b|try again (in|at)|limit reached|hit your .*limit", re.I)
ICON = """Use your built-in image generation tool. Generate ONE square image: a single app icon for a tabletop-RPG building toolkit, showing {subject}; no people, no animals, no writing; no pink or purple anywhere.
Style: bold, simple, chunky silhouette that reads at 48 pixels; a small three-quarter vignette seen from slightly above; flat-shaded with soft matte gradients, quiet and modern (no outlines, no comic inking, no gloss, no photorealism); minimal detail; a restrained palette of warm honey wood, blue-gray stone, moss green, ochre, cream and a touch of muted burgundy. Exactly one subject, centred, filling about 80% of the frame, clear space around every edge. No text, no letters, no frame, no badge shape, no border, no drop shadow, no floor plane.
Background: perfectly uniform solid chroma MAGENTA (#FF00FF) edge to edge (the subject has green in it, so green cannot be the key colour); the subject must not reflect magenta light and must contain no pink or purple.
The attached image is the style anchor for this icon set: match its rendering, lighting, palette, level of detail, camera angle and scale exactly (a different subject, the same family of icons).
Save the resulting PNG into the current directory as {name}.png and print its path and pixel size."""
J = {
 'mkt-square': "a market square seen as a small vignette: a patch of grey cobbles with a tall stone market cross on steps in the middle and two market stalls with striped burgundy-and-cream and ochre-and-cream awnings, crates of apples and cabbages before them",
 'mkt-street': "a town street seen as a small vignette: a short strip of cobbled street with a tall iron lamp post, a hanging wooden shop sign on a bracket, a striped awning, a barrel and two stone bollards",
 'mkt-general': "a cutaway corner of a village general store: a wooden shop counter with brass scales, shelves of sacks, jars and lanterns behind it, a barrel of brooms and an open sack of grain",
 'mkt-bakery': "a cutaway corner of a bakery: a brick bread oven with an arched mouth, a wooden rack of golden round loaves, a counter with a basket of long loaves and a pie",
 'mkt-apothecary': "a cutaway corner of an apothecary's shop: a tall cabinet of many small square drawers, a shelf of green and amber bottles and cream jars, a stone mortar and pestle on the counter, bunches of dried herbs",
 'mkt-tailor': "a cutaway corner of a tailor's shop: a headless dress form wearing a burgundy gown, a shelf of thick rolled bolts of cloth in burgundy, ochre, moss green and cream, a big pair of shears on a cutting table",
 'mkt-curio': "a cutaway corner of a magic and curio shop: a crystal ball on a gold claw stand on a counter, a shelf with a horned skull, a green crystal cluster, scroll cases and a brass telescope, a carved wooden mask on the wall",
 'mkt-backroom': "a cutaway corner of a shop's back store room: plain shelving stacked with crates and sacks, two barrels, a small desk with an open ledger and a candle, a strongbox",
 'mkt-passage': "a cutaway corner of a narrow house passage: a straight wooden staircase going up along a half-timbered wall, a row of coat pegs with a cloak, a pair of boots, a wall lantern",
 'mkt-watch': "a cutaway corner of a town watch post: a corner lockup of thick wooden bars with a padlocked gate, a heavy desk with an open book and a ring of big keys, a rack of spears, a helmet",
 'mkt-house': "a cutaway corner of a townsman's living room: a stone fireplace with a kettle, a rocking chair on a round braided rug, a table with a loaf and a jug, a dresser of plates",
 'mkt-bedroom': "a cutaway corner of a modest town bedroom: a wooden bed with a patchwork quilt in burgundy and ochre, a small bedside table with a candle, a wooden chest at its foot, a washstand with a jug",
}
def gen(name):
    out = os.path.join(RAW, f'room-{name}.png')
    if os.path.exists(out): return 'exists'
    wd = tempfile.mkdtemp(prefix=f'mkt-icon-{name}-'); prompt = ICON.format(subject=J[name], name=f'room-{name}')
    for attempt in range(2):
        try: r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', ANCHOR, '-'], input=prompt, capture_output=True, text=True, timeout=900); txt = r.stdout[-6000:] + '\n' + r.stderr[-4000:]
        except subprocess.TimeoutExpired: txt = 'TIMEOUT 900s'
        open(os.path.join(RAW, f'room-{name}.log'), 'a').write(txt)
        got = os.path.join(wd, f'room-{name}.png')
        if os.path.exists(got): shutil.move(got, out); shutil.rmtree(wd, ignore_errors=True); return 'ok'
        if [l for l in txt.splitlines() if LIMIT.search(l) and 'Use your built-in' not in l]: return 'QUOTA'
        time.sleep(20)
    return 'FAILED'
def post():
    from PIL import Image; import numpy as np
    for f in sorted(glob.glob(os.path.join(RAW, 'room-*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32); r, g, b = im[..., 0], im[..., 1], im[..., 2]
        mg = np.minimum(r, b) - g; a = np.clip(1 - (mg - 40) / 70, 0, 1); k = np.clip(mg, 0, None) * 0.85
        img = Image.fromarray(np.dstack([np.where(mg > 0, r - k, r), g, np.where(mg > 0, b - k, b), a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
        box = img.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
        if not box: print('EMPTY', name); continue
        img = img.crop(box); side = int(max(img.size) * 1.08)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2)); sq = sq.resize((128, 128), Image.LANCZOS)
        sq.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        o = np.asarray(sq).astype(int); vis = o[..., 3] > 32
        print(f"{name}: raw {im.shape[1]}x{im.shape[0]}, keyed {(a < 0.5).mean():.0%}, visible {vis.mean():.0%} of icon, corner alpha {[int(o[y, x, 3]) for y in (0, 127) for x in (0, 127)]}, key colour left {(vis & (np.minimum(o[..., 0], o[..., 2]) > o[..., 1] + 40)).sum() / max(vis.sum(), 1):.2%}")
if __name__ == '__main__':
    if sys.argv[1] == 'post': post()
    else:
        for n in (sys.argv[2].split(',') if len(sys.argv) > 2 else list(J)):
            res = gen(n); print(time.strftime('%T'), n, res, flush=True)
            if res == 'QUOTA': break
            if res != 'exists': time.sleep(20)
