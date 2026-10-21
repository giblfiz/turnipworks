#!/usr/bin/env python3
"""Flats for the wizard's tower batch (2026-10-11): the ritual circles, the star floor, a star chart, eleven room icons
(the generator is the castle / crypt / mansion batch's flats/gen.py with this batch's jobs). FREE route only: Codex's built-in image tool (`codex exec`, ChatGPT login), as experiments/2026-10-05-outdoors
and experiments/2026-10-03-build-icons. ONE request at a time, 20 s pause between requests (a mesh plate queue shares the
quota and has priority). On a usage / rate limit: writes QUOTA_STOP.txt with the exact text and stops (no retry loop).
    python3 gen.py name,name,...
Outputs: floors and roofing -> inputs/<sku>.jpg (1024, opaque; finish.py makes seamless/<sku>.png)
         decals and the cloth -> decals/<sku>.jpg (1024, chroma-blue plate; tools/spawn-tuner/prep/flats.py keys them)
         icons -> raw/<name>.png (chroma green; post.py -> icons/<name>.png, 128 px RGBA)
Every request is appended to requests.log (the count of Codex requests used)."""
import os, sys, subprocess, time, shutil, tempfile, re, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); B = os.path.dirname(HERE); ROOT = os.path.dirname(os.path.dirname(B))
ICON_ANCHOR = os.path.join(ROOT, 'experiments/2026-10-03-build-icons/raw/type-TAV.png')
STYLE_ANCHOR = os.path.join(ROOT, 'style-references/heroic-handpainted-tavern-v1.png')
GROUND = os.path.join(ROOT, 'experiments/2026-10-01-floors/seamless/floor-flagstone-damp.png')   # the floor crypt decals lie on
PAUSE = 20
LIMIT = re.compile(r"usage limit|rate limit|rate_limit|quota|too many requests|\b429\b|try again (in|at)|limit reached|hit your .*limit", re.I)


ICON = """Use your built-in image generation tool. Generate ONE square image: a single app icon for a tabletop-RPG building toolkit, showing {subject}.
Style: bold, simple, chunky silhouette that reads at 48 pixels; a small three-quarter vignette seen from slightly above; flat-shaded with soft matte gradients, quiet and modern (no outlines, no comic inking, no gloss, no photorealism); minimal detail; a restrained palette of warm honey wood, blue-gray stone, moss green, ochre, cream and a touch of muted burgundy. Exactly one subject, centred, filling about 80% of the frame, clear space around every edge. No text, no letters, no frame, no badge shape, no border, no drop shadow, no floor plane.
Background: perfectly uniform solid chroma green (#00FF00) edge to edge; the subject must not reflect green light.
The attached image is the style anchor for this icon set: match its rendering, lighting, palette, level of detail, camera angle and scale exactly (a different subject, the same family of icons).
Save the resulting PNG into the current directory as {name}.png and print its path and pixel size."""

FLOOR = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint a ground material swatch: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, logos and emblems.

Presentation: a perfectly top-down orthographic view looking straight down at the ground. The ground surface fills the ENTIRE square canvas edge to edge: no border, no frame, no background colour, no vignette, no perspective, no cast shadows, no objects, no flowers, no rocks bigger than a thumb. Even, flat, shadowless lighting. The square shows a 5 ft x 5 ft patch of ground, so keep elements at true scale for that area. It must tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the overall tone EVEN across the whole square (no big light or dark blotches), so that a grid of these squares does not show.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""

ROOF = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint a roofing material swatch: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, logos and emblems.

Presentation: a perfectly top-down orthographic view looking straight down at the roof surface, laid flat. The roof surface fills the ENTIRE square canvas edge to edge: no border, no frame, no background colour, no vignette, no perspective, no long cast shadows, no objects, no ridge, no eaves edge, no gutter, no chimney. Even, flat lighting. The square shows a 5 ft x 5 ft patch of roof, so keep elements at true scale for that area. It must tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the overall tone EVEN across the whole square (no big light or dark blotches), so that a grid of these squares does not show.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""

DECAL = """Use your built-in image generation tool. The FIRST attached image is the style guide for the Turnip Works house style (heroic hand-painted). {anchor2}Create a new, distinct flat game asset in that hand-painted style: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters.

Presentation: seen from directly overhead (perfectly top-down orthographic, no perspective), evenly lit, NO cast shadow and no ground painted, centred with clear space around every edge on a perfectly uniform solid chroma-blue (#0000FF) background. The subject itself must contain no blue and no purple, and the blue background must not show through gaps inside it.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
A2_GROUND = "The SECOND attached image is the stone floor this decal will lie on in the game: it is there only so that the decal's colours and painting scale sit well on it; do NOT paint any of that floor. "
A2_SLABS = "The SECOND attached image is our tomb-paving floor texture: the new slab must look like one of its paler carved grave slabs (the same stone colours and painting scale); do NOT paint the surrounding floor. "


J = {}
NOSYM = ' (no text, no letters, no runes, no magic symbols)'
for key, s in {
    'wiz-lab': 'an alchemist\'s laboratory bench: a wooden table with three fat round flasks in green, red and amber and a small brick furnace beside it',
    'wiz-study': 'a wizard\'s study: a big open book on a wooden lectern beside a tall bookcase and a lit candle',
    'wiz-summoning': 'a summoning circle: a white chalk ring drawn on a stone floor with five tall candles standing round it',
    'wiz-observatory': 'an observatory: a big brass telescope on a wooden mount pointing up at a slant',
    'wiz-scrying': 'a scrying room: a big milky-white crystal ball on a clawed bronze stand on a small round table with a dark red cloth',
    'wiz-store': 'a potion store: a wooden shelf unit packed with rows of fat bottles in red, green and amber',
    'wiz-apothecary': 'an apothecary shop: a shop counter with a brass balance scale and a row of lidded jars',
    'wiz-bedchamber': 'a wizard\'s bedchamber: a four-poster bed with dark red curtains and a tall pointed wizard hat hanging on the bedpost',
    'wiz-menagerie': 'a familiars\' menagerie: a tall domed brass birdcage on a stand beside a bare branch perch',
    'wiz-stair': 'a tower stair: a stone spiral staircase winding up round a central post',
    'wiz-workshop': 'an enchanter\'s workshop: a free-standing stone archway with a large amber crystal on a pedestal in front of it',
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM + '; no blue', key='green')
TOP = ' Seen from exactly straight above, lying flat: no perspective, no floor painted under it, no cast shadow.'
CARD = ' Seen exactly square-on from the front, flat like a scan: no perspective, no wall behind it, no cast shadow, no room.'
def flat(sku, subject, detail, anchor2=None, lines=False):
    J[sku] = dict(kind='decal', anchor2=anchor2, lines=lines, subject=subject, detail=detail + ' No blue and no purple anywhere on it. No text, no letters, no numbers. Show exactly this and nothing else.')
CIRC = ('ONE ritual circle drawn on a floor, 9 ft across, filling about 90% of the canvas, perfectly round and centred. It is LINE WORK ONLY: every line is a bold band about 2 in wide'
        ' (drawn thick, never hairline), and BETWEEN the lines the plain blue background shows (the floor of the game will show there): do NOT fill the inside of the circle. {d}'
        ' Abstract geometry only: NO letters, NO runes, NO writing, NO pentagram, NO faces or creatures.')
flat('decal-ritual-circle--s1', 'a chalk ritual circle drawn on a floor, seen from straight above',
     CIRC.format(d='Drawn in slightly smudged WHITE CHALK (warm off-white with soft dusty edges): two concentric rings close together at the outside with a row of evenly spaced short tick'
                   ' marks between them; inside, a seven-pointed star drawn in one continuous line whose points touch the inner ring; a small plain ring at the very centre; and a small'
                   ' filled chalk dot at each star point.') + TOP, 'ground', lines=True)
flat('decal-ritual-circle--s2', 'a painted ritual circle on a floor, seen from straight above',
     CIRC.format(d='Painted in matte RED OCHRE (dull brick red, a little worn): one thick outer ring; inside it a large equilateral triangle whose corners touch the ring, and a second ring'
                   ' inside the triangle touching its sides; three small plain rings, one at each corner of the triangle, each about 10 in across; short straight strokes like sun rays'
                   ' between the outer ring and the triangle.') + TOP, 'ground', lines=True)
flat('decal-star-floor', 'a great inlaid star-chart floor medallion, seen from straight above',
     'ONE perfectly round floor medallion, 9 ft across, filling about 90% of the canvas, a SOLID disc of inlaid stone and metal (no holes in it): a dark green-black polished stone field;'
     ' a broad outer band of pale cream stone divided into twelve equal plain segments by thin brass lines; inside it a ring of dull brass; in the middle a bold SIXTEEN-pointed compass'
     ' star in cream and ochre stone with a brass disc at its centre; and scattered over the dark field between star and band about twenty small round brass studs of three sizes, some'
     ' joined by thin brass lines into simple constellation shapes. Flat, level, worn smooth.' + TOP, 'ground')
flat('map-wall--stars', 'a big star chart on parchment, pinned flat',
     'ONE large sheet of aged cream parchment, 72 in wide and 48 in tall (landscape, exactly 3:2, filling about 90% of the canvas width, with blue background above and below), with gently'
     ' wavy edges, a fold cross, and a fat brass pin at each corner. Drawn on it in brown ink and ochre: two big overlapping circles side by side filling the sheet, each crossed by a few'
     ' curved lines, with many bold round star dots of three sizes, some joined by straight lines into simple constellation shapes, and a small sun with rays in one corner.' + CARD)

def out_path(name):
    k = J[name]['kind']
    return os.path.join(HERE, 'raw', f'{name}.png') if k == 'icon' else os.path.join(HERE, 'decals' if k == 'decal' else 'inputs', f'{name}.jpg')

def gen(name):
    j = J[name]; kind = j['kind']; out = out_path(name)
    if os.path.exists(out): return 'exists'
    imgs = [ICON_ANCHOR] if kind == 'icon' else [STYLE_ANCHOR]
    if kind == 'icon':
        prompt = ICON.format(subject=j['subject'], name=name)
        if j.get('key') == 'magenta': prompt = prompt.replace('perfectly uniform solid chroma green (#00FF00) edge to edge; the subject must not reflect green light.', 'perfectly uniform solid chroma MAGENTA (#FF00FF) edge to edge (the subject has green in it, so green cannot be the key colour); the subject must not reflect magenta light and must contain no pink or purple.')
    elif kind in ('floor', 'roof'):
        prompt = (FLOOR if kind == 'floor' else ROOF).format(subject=j['subject'], detail=j['detail'], name=name)
        if j.get('base'):
            b = os.path.join(HERE, 'seamless', j['base'] + '.png')
            if not os.path.exists(b): return f'WAITING (base {j["base"]} not finished)'
            imgs.append(b)
    else:
        a2 = {'ground': (A2_GROUND, GROUND), 'slabs': (A2_SLABS, os.path.join(HERE, 'seamless', 'floor-tomb-slabs.png')), None: ('', None)}[j['anchor2']]
        if a2[1]:
            if not os.path.exists(a2[1]): return f'WAITING ({a2[1]} missing)'
            imgs.append(a2[1])
        prompt = DECAL.format(anchor2=a2[0], subject=j['subject'], detail=j['detail'], name=name)
        if j.get('lines'): prompt = prompt.replace(', and the blue background must not show through gaps inside it', '; between its lines the blue background DOES show')
    wd = tempfile.mkdtemp(prefix=f'flats-{name}-')
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write']
    for i in imgs: cmd += ['-i', i]
    cmd += ['-']
    t0 = time.time()
    for attempt in range(2):           # a second try only when the first returned no image and no limit message
        open(os.path.join(HERE, 'requests.log'), 'a').write(f'{time.strftime("%F %T")} {name} attempt {attempt + 1}\n')
        try: r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900); txt = r.stdout[-6000:] + '\n' + r.stderr[-4000:]
        except subprocess.TimeoutExpired: txt = 'TIMEOUT 900s'
        open(os.path.join(HERE, 'raw', f'{name}.log'), 'a').write(txt)
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got):
            if kind == 'icon': shutil.move(got, out)
            else: Image.open(got).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out, quality=94)
            return f'ok {time.time() - t0:.0f}s'
        if re.search(r'at capacity', txt, re.I) and attempt == 0:
            print(time.strftime('%T'), name, 'model at capacity: waiting 2 min, one more try', flush=True); time.sleep(120); continue
        hit = [l for l in txt.splitlines() if LIMIT.search(l) and 'Use your built-in' not in l and 'at capacity' not in l.lower()]
        if hit:
            open(os.path.join(HERE, 'QUOTA_STOP.txt'), 'a').write(f'{time.strftime("%F %T")} while generating {name}:\n' + '\n'.join(hit[-12:]) + '\n')
            return 'QUOTA'
        time.sleep(PAUSE)
    return 'FAILED'

if __name__ == '__main__':
    names = sys.argv[1].split(',')
    if names == ['list']: print('\n'.join(J)); sys.exit()
    if names[0] == 'show': print(J[names[1]]); sys.exit()
    for n in names:
        if os.path.exists(os.path.join(HERE, 'QUOTA_STOP.txt')): print('QUOTA_STOP.txt exists: not sending', n, flush=True); break
        res = gen(n); print(time.strftime('%T'), n, res, flush=True)
        if res == 'QUOTA': break
        if res.startswith(('ok', 'FAILED')): time.sleep(PAUSE)

