#!/usr/bin/env python3
"""Culture packs B (2026-11-06): the Build tray icons: genre-cultures, type-<CODE> and room-<key> (engine/client/data/icons/), copied from the smithy's tools/icons.py.
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
 'genre-cultures': "a small globe on a wooden stand surrounded by four tiny buildings of different world cultures: a Viking longhouse with a shingle roof, a white domed Middle Eastern house, a Russian log house, a stepped Aztec pyramid temple",
 'type-NRS': "a Viking longhouse: a long low timber hall with a steep wood-shingle roof curving like an upturned boat and a carved portal at its end",
 'type-MDE': "a Mamluk stone house of Cairo: cream plaster walls over dark and honey striped stone, a pointed striped archway and a wooden lattice window",
 'type-RUS': "a medieval Russian log house (izba): walls of round logs, a steep plank roof and a small window in a carved wooden frame",
 'type-MES': "an Aztec stepped pyramid temple of white plaster with a red-painted shrine on top and a staircase up its front",
 'room-nrs-longhouse': "a cutaway corner of a Viking longhouse: a long stone-edged fire pit down the middle, raised wooden sleeping platforms with sheepskins along the walls, an upright loom with striped cloth",
 'room-nrs-meadhall': "a cutaway corner of a Viking mead hall: a carved wooden high seat between two tall carved posts, round painted shields hung on the timber wall, a long trestle table and a drinking horn",
 'room-nrs-smithy': "a cutaway corner of a Viking smithy: a low stone forge with an upright stone slab and leather bellows behind it, a black anvil on a stump, a rack of spears",
 'room-nrs-boathouse': "a cutaway corner of a Viking boathouse: a small wooden clinker-built boat with curled ends resting on stands, oars leaning in a rack, a rolled red and white striped sail",
 'room-nrs-weaving': "a cutaway corner of a Viking weaving hut: an upright wooden loom with striped red and ochre cloth and a row of round stone weights, baskets of wool and spindles",
 'room-nrs-yard': "a Viking farmstead yard seen as a small vignette: a tall grey standing runestone carved with a red serpent band, a wooden well, a rack of drying fish, a wattle fence",
 'room-mde-courtyard': "a caravanserai courtyard seen as a small vignette: an octagonal marble fountain in a paved court, a row of pointed stone archways behind, rope-tied bales of cloth and woven saddlebags",
 'room-mde-souk': "a cutaway corner of a market shop in a medieval Middle Eastern souk: a low carved wooden platform counter with a brass scale, shelves of brass pots and lanterns, open sacks heaped with red and yellow spices",
 'room-mde-hammam': "a cutaway corner of a medieval bathhouse (hammam): a low octagonal white marble fountain, a long white marble bench, a carved marble wall basin with a brass bowl",
 'room-mde-audience': "a cutaway corner of a Mamluk reception hall: a low octagonal marble floor fountain, a raised platform with a red carpet and bolster cushions, a wooden lattice window",
 'room-mde-coffee': "a cutaway corner of an old coffee house: a brass brazier with two round copper coffee pots, a low cushioned bench, a low round brass tray table with small cups",
 'room-mde-garden': "a courtyard garden seen as a small vignette: an octagonal marble fountain on paving, lemon trees in tubs around it, a stone bench and a vine on a trellis",
 'room-rus-izba': "a cutaway corner of a medieval Russian log house: a huge whitewashed clay stove with an arched mouth, a log wall, a wooden table and bench, a small icon shelf in the corner",
 'room-rus-terem': "a cutaway corner of a medieval Russian boyar's chamber: a tall green-tiled stove, a carved high-backed chair, a long table with an embroidered cloth, a red-brown chest",
 'room-rus-banya': "a cutaway corner of a Russian bathhouse (banya): a squat stone heater heaped with round rocks, a two-step wooden bench, a wooden tub and bucket, bundles of birch twigs on the wall",
 'room-rus-church': "a cutaway corner of a wooden Orthodox church: a gilded screen of painted saint icons with doors in its middle, a tall brass candle stand, a cloth-draped lectern",
 'room-rus-market': "a cutaway corner of a medieval Russian market stall: a carved plank counter with scales and beeswax cakes, shelves of clay honey pots and birch-bark boxes, bundles of furs",
 'room-rus-yard': "a Russian stockade yard seen as a small vignette: a wooden well-sweep (a tall lever pole over a log well), a fence of pointed upright logs, a wooden sledge and a woodpile",
 'room-mes-shrine': "a cutaway corner of an Aztec temple shrine: a stone altar heaped with yellow maize and orange marigolds between two big painted clay braziers, a reclining stone chacmool figure holding a dish",
 'room-mes-ballcourt': "a Mesoamerican ballcourt seen as a small vignette: two long sloping white plaster walls facing each other, a carved stone ring set upright high in each wall",
 'room-mes-house': "a cutaway corner of an Aztec noble's house: a low woven reed seat with a high back on a reed mat, woven reed chests, three hearthstones holding a round clay griddle",
 'room-mes-market': "an Aztec market seen as a small vignette: rows of reed mats on the ground heaped with yellow maize, red chilies, painted clay pots and folded patterned cloth, a white cloth awning on poles",
 'room-mes-chinampa': "an Aztec chinampa garden seen as a small vignette: long raised beds of maize plants between blue-green canals, a tall narrow willow tree, a narrow dugout canoe",
 'room-mes-scribe': "a cutaway corner of an Aztec scribe's room: a long folded painted book (codex) opened flat on a reed mat, small pots of red, black and turquoise paint, a woven reed chest",
}
def gen(name):
    out = os.path.join(RAW, f'{name}.png')
    if os.path.exists(out): return 'exists'
    wd = tempfile.mkdtemp(prefix=f'smi-icon-{name}-'); prompt = ICON.format(subject=J[name], name=name)
    for attempt in range(2):
        try: r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', ANCHOR, '-'], input=prompt, capture_output=True, text=True, timeout=900); txt = r.stdout[-6000:] + '\n' + r.stderr[-4000:]
        except subprocess.TimeoutExpired: txt = 'TIMEOUT 900s'
        open(os.path.join(RAW, f'{name}.log'), 'a').write(txt)
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got): shutil.move(got, out); shutil.rmtree(wd, ignore_errors=True); return 'ok'
        if [l for l in txt.splitlines() if LIMIT.search(l) and 'Use your built-in' not in l]: return 'QUOTA'
        time.sleep(20)
    return 'FAILED'
def post():
    from PIL import Image; import numpy as np
    for f in sorted(glob.glob(os.path.join(RAW, '*.png'))):
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
