#!/usr/bin/env python3
"""The nine room icons of the smithy type for the game's Build tray (engine/client/data/icons/room-<key>.png).
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
 'smi-forge': "a cutaway corner of a blacksmith's forge: a grey stone forge hearth heaped with black coal under a brick chimney hood, a black anvil on a tree stump in front of it, a big leather bellows, a wooden water trough",
 'smi-armoury': "a cutaway corner of an armourer's workshop: a shiny steel breastplate on a headless wooden stand, a rack of swords and spears on the wall, a round shield, a grindstone wheel on a wooden frame",
 'smi-carpenter': "a cutaway corner of a carpenter's woodshop: a heavy pale wooden workbench with a wooden vise and a plane, a heap of pale yellow curled wood shavings, a stack of sawn boards, a big saw on a wall board",
 'smi-potter': "a cutaway corner of a potter's workshop: a domed orange brick kiln with an arched opening, a potter's wheel with a grey clay pot on it, a shelf of terracotta pots and jugs",
 'smi-shopfront': "a cutaway corner of a blacksmith's shop front: a dark wooden counter with a steel helmet, black iron pots and horseshoes on it, a rack of swords behind it, a barrel full of swords",
 'smi-stock': "a cutaway corner of a workshop store room: a low timber rack of thick iron bars, a wooden bin heaped with black coal, a stack of pale sawn boards, two crates and a barrel",
 'smi-yard': "a smith's yard seen as a small vignette: a patch of packed earth with a heavy timber frame for shoeing horses, a wooden hitching rail, a stone water trough, a heap of black coal and a cart wheel",
 'smi-quarters': "a cutaway corner of a craftsman's plain bedroom: a wooden bed with a burgundy and ochre blanket, a small table with a candle, a wooden chest, a leather apron hanging on a peg",
 'smi-passage': "a cutaway corner of a narrow workshop passage: a straight wooden staircase going up along a half-timbered wall, a row of pegs with a leather apron, a barrel, a wall lantern",
}
def gen(name):
    out = os.path.join(RAW, f'room-{name}.png')
    if os.path.exists(out): return 'exists'
    wd = tempfile.mkdtemp(prefix=f'smi-icon-{name}-'); prompt = ICON.format(subject=J[name], name=f'room-{name}')
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
