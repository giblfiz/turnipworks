#!/usr/bin/env python3
"""Flats for the castle / crypt / mansion batch (2026-10-05): crypt floors, decals, altar cloth, crypt room icons, roof
surfaces. FREE route only: Codex's built-in image tool (`codex exec`, ChatGPT login), as experiments/2026-10-05-outdoors
and experiments/2026-10-03-build-icons. ONE request at a time, 20 s pause between requests (a mesh plate queue shares the
quota and has priority). On a usage / rate limit: writes QUOTA_STOP.txt with the exact text and stops (no retry loop).
    python3 gen.py name,name,...
Outputs: floors and roofing -> inputs/<sku>.jpg (1024, opaque; finish.py makes seamless/<sku>.png)
         decals and the cloth -> decals/<sku>.jpg (1024, chroma-blue plate; tools/spawn-tuner/prep/flats.py keys them)
         icons -> raw/<name>.png (chroma green; post.py -> icons/<name>.png, 128 px RGBA)
Every request is appended to requests.log (the count of Codex requests used)."""
import os, sys, subprocess, time, shutil, tempfile, re, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); B = os.path.dirname(HERE); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(B)))
ICON_ANCHOR = 'experiments/2026-10-03-build-icons/raw/type-TAV.png'   # git-ignored: only in the main tree
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
CARD = ' Seen exactly square-on from the front, flat like a scan: no perspective, no wall behind it, no cast shadow, no room.'
TOP = ' Seen from exactly straight above, lying flat: no perspective, no floor painted under it, no cast shadow.'
def flat(sku, subject, detail, anchor2=None): J[sku] = dict(kind='decal', anchor2=anchor2, subject=subject, detail=detail + ' No blue and no purple anywhere on it. No text, no letters. Show exactly this and nothing else.')
# ---- temple & chapel (2026-10-11): the two FLAT flavor slots (banner, floor sigil) for sun and moon, and nine room icons.
# Text prompts and our own style anchors only.
FB = ('ONE long temple wall banner of heavy cloth hanging from a short thick horizontal wooden rod at its top, 30 in wide and 84 in tall (drawn upright, a tall narrow strip exactly 5:14 proportions, '
      'filling about 88% of the canvas height, with broad blue background to its left and right). {d} Bold flat colour fields, big simple shapes that read from far away.' + CARD)
flat('flavor-banner--sun', 'a temple banner of a sun faith, seen flat from the front', FB.format(d='A cream-white field with a broad gold border; in the upper half ONE big golden sun: a plain round disc with sixteen short broad triangular rays, on a round warm orange-red ground; below it three plain narrow gold horizontal bars. The bottom ends in ONE central point with a gold fringe. NO face on the sun, no moon, no stars.'))
flat('flavor-banner--moon', 'a temple banner of a moon faith, seen flat from the front', FB.format(d='A charcoal-black field with a broad pale silver-grey border; in the upper half ONE big silver-white CRESCENT moon with both horns pointing straight up, holding a plain white round disc between its horns; below it five small plain white round dots in a vertical row, from large to small. Swallow-tailed at the bottom (a deep V notch) with a silver-grey fringe. NO face on the moon, no sun, no rays. Night is charcoal black, never blue.'))
FS = ('ONE great ROUND emblem of inlaid stone set flush in a temple floor, 8 ft across: a perfect circle filling about 88% of the canvas, with blue background outside the circle only. {d} '
      'Flat inlaid stone with thin dark joints between the pieces, a little worn; no relief, no objects on it.' + TOP)
flat('flavor-sigil--sun', 'a great round sun emblem inlaid in a stone floor, seen from straight above', FS.format(d='A cream marble disc inside a broad border ring of warm red-brown stone edged with two thin gold-ochre lines; in the middle ONE big sun of gold-ochre and amber stone: a plain round centre and sixteen long tapering rays, alternately straight and wavy, reaching almost to the border ring. NO face on the sun, no moon, no stars.'))
flat('flavor-sigil--moon', 'a great round moon emblem inlaid in a stone floor, seen from straight above', FS.format(d='A charcoal-black slate disc inside a broad border ring of pale silver-grey stone; in the middle ONE big pearl-white CRESCENT moon with both horns pointing to the top of the picture, holding a plain white round disc between its horns; round the inside of the border ring, eight small plain white round discs evenly spaced. NO face on the moon, no sun, no rays. The dark stone is charcoal black, never blue.'))
FR = ('ONE round carved wall medallion, 34 in across: a perfect circle filling about 85% of the canvas, with blue background outside the circle only. {d} '
      'Painted to look carved in bold relief, with soft shading; big simple shapes that read from far away.' + CARD)
flat('flavor-relief--sun', 'a round carved stone wall medallion of a sun faith, seen flat from the front', FR.format(d='A disc of cream limestone with a bold raised rim; in it ONE gilded golden sun: a plain domed round centre and sixteen thick rays, alternately straight wedges and wavy flames, reaching to the rim, on a sunk warm orange-red ground. NO face on the sun, no moon, no stars.'))
flat('flavor-relief--moon', 'a round carved stone wall medallion of a moon faith, seen flat from the front', FR.format(d='A disc of charcoal-black slate with a bold raised pale silver-grey rim; in it ONE fat silver-white CRESCENT moon with both horns pointing straight up, holding a plain pearl-white round disc between its horns, and five small round silver studs in an arc below. NO face on the moon, no sun, no rays. The dark stone is charcoal black, never blue.'))
NOSYM = '; pale cream stone walls; no crosses or real-world religious symbols, no figures, no faces'
for key, s in {
  'temple-nave': 'a cutaway corner of a small chapel: a stone altar table with two lit candles against a pale stone wall with one tall pointed window, and two wooden pews in a row facing it',
  'cathedral': 'a cutaway of a great cathedral nave: two tall round pale stone columns, a row of wooden pews between them, a tall pointed stained-glass window of red, gold and green in the wall behind',
  'temple-shrine': 'a cutaway corner of a small shrine: a plain round golden disc on a short white stone pillar against a pale stone wall, a low rack of small lit candles before it, one red kneeling cushion on the floor',
  'temple-vestry': 'a cutaway corner of a vestry: a cream and red ceremonial robe hanging on a wooden stand, a wooden chest, a small table with a gold cup on it',
  'temple-cloister': 'a cutaway length of a cloister walk: a row of three round pale stone columns joined by round arches on a low wall, a stone bench against the back wall, a strip of green lawn outside the arches',
  'temple-scriptorium': 'a cutaway corner of a scriptorium: a wooden desk with a steeply slanted top and an open book on it, a stool, a rack of rolled scrolls against the wall, one lit candle on a stand',
  'temple-infirmary': 'a cutaway corner of an infirmary: two plain narrow beds with cream sheets side by side with their heads to the wall, a small cabinet of many little drawers, a bowl and a folded cloth on a stool',
  'temple-cell': "a cutaway corner of a monk's cell: one narrow plain cot with a grey-brown blanket, a small wooden kneeling desk, one candle on a stand, a small arched window in the pale stone wall",
  'temple-belltower': 'a cutaway of the base of a bell tower: one big bronze bell hanging in a heavy wooden frame, a thick rope coiled beside it, pale stone walls',
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM)
J['room-cathedral-dark'] = dict(kind='icon', subject='a cutaway of a dark, sinister cathedral nave: two tall round columns of dark charcoal-grey stone, a row of dark wooden pews between them, a black stone altar with two red-flamed candles at the far wall; dark slate-grey stone walls; no crosses or real-world religious symbols, no figures, no faces')
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
