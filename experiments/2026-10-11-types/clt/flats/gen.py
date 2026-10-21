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
# ---- cult sanctum (2026-10-11): the two FLAT flavor slots (banner, floor sigil) for devils and spiders, the neutral
# ritual circle, the sanctum floor, and nine room icons. Text prompts and our own style anchors only.
# The banner and sigil templates (FB, FS) are the Temple batch's, word for word, so the two types' slots match in shape.
FB = ('ONE long temple wall banner of heavy cloth hanging from a short thick horizontal wooden rod at its top, 30 in wide and 84 in tall (drawn upright, a tall narrow strip exactly 5:14 proportions, '
      'filling about 88% of the canvas height, with broad blue background to its left and right). {d} Bold flat colour fields, big simple shapes that read from far away.' + CARD)
flat('flavor-banner--devils', 'a sanctum banner of a devil cult, seen flat from the front', FB.format(d='A deep crimson field with a broad soot-black border; in the upper half ONE big emblem in brass-gold: a plain horned head seen from the front, reduced to a bold silhouette (a broad triangle face with two thick horns curving up and inward, two small slanted eye slits, a short pointed beard); below it ONE plain brass-gold trident head pointing up. The bottom is cut into three long pointed tongues like flames, edged in black. NO blood, no skull, no star.'))
flat('flavor-banner--spiders', 'a sanctum banner of a spider cult, seen flat from the front', FB.format(d='A charcoal-black field with a broad poison yellow-green border; in the upper half ONE big bone-white spider seen from straight above, reduced to a bold silhouette (a big round abdomen, a small round head, eight thick bent legs spread evenly); behind it a plain web of eight thin bone-white spokes and two rings filling the field; below it three plain bone-white round dots in a vertical row, from large to small. Swallow-tailed at the bottom (a deep V notch) with a yellow-green fringe. NO blood, no skull.'))
FS = ('ONE great ROUND emblem of inlaid stone set flush in a temple floor, 8 ft across: a perfect circle filling about 88% of the canvas, with blue background outside the circle only. {d} '
      'Flat inlaid stone with thin dark joints between the pieces, a little worn; no relief, no objects on it.' + TOP)
flat('flavor-sigil--devils', 'a great round devil-cult emblem inlaid in a stone floor, seen from straight above', FS.format(d='A soot-black slate disc inside a broad border ring of deep crimson stone edged with two thin brass-ochre lines; in the middle ONE big emblem of brass-ochre and crimson stone: a plain horned head seen from the front as a bold flat silhouette (a broad triangle face, two thick horns curving up and inward to almost meet, two slanted eye slits), ringed by eight small plain flame-shaped tongues of crimson stone pointing outward. NO blood, no star, no letters.'))
flat('flavor-sigil--spiders', 'a great round spider-cult emblem inlaid in a stone floor, seen from straight above', FS.format(d='A charcoal-black slate disc inside a broad border ring of pale bone-white stone; filling the disc, a big WEB of pale bone-white stone lines: eight straight spokes from the centre to the border ring and three rings of slightly sagging lines between them; at the centre ONE fat spider seen from above as a bold flat silhouette in poison yellow-green stone (round abdomen, small head, eight thick legs lying along the spokes). NO blood, no letters.'))
FR = ('ONE thick carved stone wall tablet, 4 ft wide and 5 ft tall with an arched top and a heavy plain moulded frame (drawn upright, filling about 88% of the canvas height, blue background all round it). {d} Painted as carved stone in strong, simple relief with clear light from the upper left: bold shapes that read from far away.' + CARD)
flat('flavor-relief--devils', 'a carved stone wall tablet of a devil cult, seen flat from the front', FR.format(d='Inside the frame: one big frontal horned head (a broad heavy-browed face, two thick horns curving up to touch the arch, a short pointed beard, a grim closed mouth), and below it two short crossed tridents. Dark red-brown stone with soot-black hollows and paler worn high points. NO blood, no skull.'))
flat('flavor-relief--spiders', 'a carved stone wall tablet of a spider cult, seen flat from the front', FR.format(d='Inside the frame: a great wheel-shaped web of thick raised strands (eight spokes, three rings) filling the panel, and at its centre one fat spider seen from above (round abdomen, small head, eight short thick legs lying along the spokes). Charcoal-grey stone; the web strands picked out in pale bone-white, the spider in poison yellow-green. NO blood, no skull.'))
flat('decal-ritual-circle--plain', 'a plain ritual circle marked on a stone floor, seen from straight above', 'ONE great ring 9 ft across, a perfect circle filling about 90% of the canvas: TWO thin concentric lines of pale chalk-white about 8 in apart, and between the two lines a row of plain short tick marks all the way round (like the minute marks of a clock face, about sixty of them), with a small solid dot at each of the four compass points. The whole INSIDE of the ring and everything outside it is EMPTY chroma-blue background: only the ring itself is painted. Slightly uneven, hand-drawn chalk lines, a little smudged in two places. NO symbols, no star, no letters, no runes.' + TOP)
J['floor-basalt-dark'] = dict(kind='floor', subject='dark basalt paving for a hidden underground sanctum',
    detail='Big, smooth, square-cut paving slabs of dark charcoal basalt laid in a regular grid of four slabs across and four down (each about 15 in), with thin joints filled with dull dark red mortar. Each slab is a slightly different dark tone (charcoal, warm dark grey, soot, a few with a faint brown cast), softly worn and a little paler toward its middle, with a few fine pale scratches. Dark but NOT black: a mid-dark warm grey overall, so that dark furniture still shows on it. No emblems, no symbols, no cracks wider than a hair, no stains, no moss. No blue: the stone is warm charcoal grey.')
for v in (2, 3, 4):
    J[f'floor-basalt-dark--v{v}'] = dict(kind='floor', base='floor-basalt-dark', subject='dark basalt paving for a hidden underground sanctum (another patch of the SAME floor as the second attached image)',
        detail=f'The SECOND attached image is the finished floor: paint another 5 ft patch of exactly that floor, the same slab size (four across, four down), the same joint width and dull dark red mortar, the same colours, brightness and painting scale, with a different arrangement of lighter and darker slabs' + ('' if v == 2 else ', one slab with a chipped corner' if v == 3 else ', one slab cracked across by a hairline') + '. No emblems, no symbols, no stains. No blue.')
NOSYM = '; very dark, near-black stone walls with one dark red band; no real-world religious symbols, no pentagrams, no figures, no faces, no blood'
for key, s in {
  'cult-entry': 'a cutaway corner of a plain cellar storeroom in which a tall bookcase full of books has swung open like a door, showing a dark black stone passage behind it; one barrel and one crate beside it',
  'cult-passage': 'a cutaway length of a dark processional corridor: two tall grey stone statues of hooded robed figures facing each other across a strip of dark red carpet, an iron fire bowl with orange flames between them',
  'cult-sanctum': 'a cutaway of a dark underground sanctum: a long black stone altar slab with two tall black candles with orange flames on it, a big round chalk circle drawn on the dark floor in front of it, two iron fire bowls with orange flames',
  'cult-summoning': 'a cutaway corner of a summoning chamber: a big round white chalk circle on a dark floor with four short black standing stones round it, each with a lit candle, and a tall empty black stone archway behind',
  'cult-cells': 'a cutaway corner of a prison room: one big box cage of very thick dark wooden bars with an iron padlock, a pile of straw beside it, iron manacles hanging on the dark wall',
  'cult-vestry': 'a cutaway corner of a robing room: a wooden rail with a row of dark charcoal-brown hooded robes hanging from it, a plain bench, a plain white oval mask lying on the bench',
  'cult-library': 'a cutaway corner of a forbidden library: a wooden lectern holding one huge closed black book bound with a thick chain and padlock, a dark bookcase of old books behind it, one lit candle',
  'cult-quarters': "a cutaway corner of a bare dormitory: two plain straw pallets on the dark floor side by side with a small wooden chest at the foot of each, a dark hooded robe hanging on a wall peg, one candle",
  'cult-vault': 'a cutaway corner of an idol chamber: a wide bronze bowl heaped with gold coins standing before a tall blank dark stone pedestal draped with a dark red cloth, an open treasure chest of gold beside it, two iron fire bowls with orange flames',
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM)
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
