#!/usr/bin/env python3
"""Flats for the modern city pack (sprawl, 2026-11-06): floors, road and bay strips, decals, room icons.
Copied from ../../2026-10-11-types/min/flats/gen.py (same frames, same route); the job table J is the modern pack's.
Was: Flats for the Mine type (MIN, 2026-10-11): rail strips (left-right), the turntable and buffer tiles, decals, room icons.
Copied from ../../dun/flats/gen.py (same frames, same route); only the job table J is the mine's.
The method and the prompt frames are those of experiments/2026-10-05-castle-crypt-mansion/flats/gen.py; new here is the
STRIP frame (an opaque edge-to-edge tile that repeats left-right). FREE route only: Codex's built-in image tool
(`codex exec`, ChatGPT login). ONE request at a time, 20 s pause between requests (other queues share the quota).
On a usage / rate limit: writes QUOTA_STOP.txt with the exact text and stops.
    python3 gen.py name,name,...      |  python3 gen.py list  |  python3 gen.py show NAME (prints the full prompt)
Outputs: floors -> inputs/<sku>.jpg (1024, opaque; finish.py makes seamless/<sku>.png)
         decals, rune tiles, mosaic -> decals/<sku>.jpg (1024, chroma-blue plate; tools/spawn-tuner/prep/flats.py keys them)
         strips and the pit -> raw/strips-in/<sku>.png as painted (finish_strips.py makes decals/<sku>.jpg)
         icons -> raw/<name>.png (chroma green or magenta; post.py -> icons/<name>.png, 128 px RGBA)
Every request is appended to requests.log (the count of Codex requests used).
Provenance: text prompts plus our own images only (the house style reference, the icon set's anchor, our own floor)."""
import os, sys, subprocess, time, shutil, tempfile, re
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
MAIN = '<repo>'       # main tree, READ ONLY: our own anchors live there (images are not in git)
ICON_ANCHOR = os.path.join(MAIN, 'experiments/2026-10-03-build-icons/raw/type-TAV.png')
STYLE_ANCHOR = os.path.join(MAIN, 'style-references/heroic-handpainted-tavern-v1.png')
GROUND = os.path.join(HERE, 'seamless', 'floor-asphalt.png')   # our own cut-rock floor (dungeon batch): the floor mine decals lie on
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

STRIP = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint ONE floor tile for a top-down tabletop battle map: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters.

Presentation: seen from directly overhead (perfectly top-down orthographic, the camera looks straight down). The painting fills the ENTIRE {canvas} canvas edge to edge: no border, no frame, no margin, no background colour, no vignette. {scale} Even lighting from above, no long cast shadows. No blue and no purple anywhere.
{repeat}

Specific design: {detail}
Save the resulting PNG ({canvas}, at least 1024 px wide) into the current directory as {name}.png and print its path and pixel size."""
REPEAT = "This tile is laid in a ROW, the same tile repeated to the LEFT and to the RIGHT, to make one long {what} that runs left to right. So the picture is a straight horizontal band design: every band keeps exactly the same height from the left edge to the right edge, everything runs straight off the left edge and off the right edge and must continue seamlessly into the next copy; nothing begins, ends, narrows or widens inside the tile; no single eye-catching feature (it would repeat every 5 ft); the left and right thirds look alike."

DECAL = """Use your built-in image generation tool. The FIRST attached image is the style guide for the Turnip Works house style (heroic hand-painted). {anchor2}Create a new, distinct flat game asset in that hand-painted style: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters.

Presentation: seen from directly overhead (perfectly top-down orthographic, no perspective), evenly lit, NO cast shadow and no ground painted, centred with clear space around every edge on a perfectly uniform solid chroma-blue (#0000FF) background. The subject itself must contain no blue and no purple, and the blue background must not show through gaps inside it.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
A2_GROUND = "The SECOND attached image is the asphalt or concrete ground this decal will lie on in the game: it is there only so that the decal's colours and painting scale sit well on it; do NOT paint any of that ground. "

J = {}
MODERN = ' It is a MODERN, present-day city object, painted in the same storybook game style; no text, no letters, no numbers, no logos.'
# ---- 1. room icons (modern city); the type icon and the genre icon. Green key except where the subject is green.
for key, s in {
  'room-mod-apartment': "a modern apartment living room as a small vignette: a boxy teal-grey sofa facing a flat-screen television on a low cabinet, a potted house plant beside the sofa",
  'room-mod-office': "an office cubicle as a small vignette: a light-grey desk with a glowing computer monitor between two padded blue-grey partition panels, a black swivel chair pulled up to it",
  'room-mod-bar': "a modern bar as a small vignette: a short dark bar counter with three chrome beer taps on it and a red-topped chrome bar stool, a small glowing hot-pink neon cocktail-glass sign above",
  'room-mod-street': "a city street as a small vignette: a chunky toy-like navy-blue sedan car parked by a kerb on grey asphalt, a stout streetlight on the pavement with a warm glowing lamp head",
  'room-mod-alley': "a back alley as a small vignette: a dented dark-green dumpster against a red brick wall, two plump black trash bags beside it, a puddle",
  'room-mod-garage': "a parking garage as a small vignette: a square grey concrete column with yellow-and-black hazard stripes at its foot beside a parked toy-like red hatchback car on a grey concrete floor with a white painted bay line",
  'room-mod-store': "a convenience store as a small vignette: a short shop shelf packed with brightly coloured boxes and cans beside a white drinks fridge with glowing glass doors full of colourful bottles",
  'room-mod-warehouse': "a warehouse as a small vignette: a chunky yellow forklift truck with its forks lowered in front of a tall blue-and-orange pallet rack loaded with brown cardboard boxes",
  'type-MOD': "a modern city block as a small vignette: a chunky red-brick four-storey building with rows of windows and a flat roof, a stout streetlight in front of it",
  'genre-modern': "a modern city skyline emblem as a small vignette: three chunky blocky high-rise buildings of different heights (grey concrete, glass blue-grey, brick red) with rows of lit windows, standing together",
}.items():
    J[key] = dict(kind='icon', subject=s + '. A MODERN present-day subject, in the same icon style; a palette of warm grey, brick red, muted teal, mustard, cream and a touch of navy instead of wood and stone; no real-world brand or logo', key='magenta' if key in () else 'green')

# ---- 2. floors: opaque, seamless 5-ft squares (finish.py makes seamless/<sku>.png). Names that must be laid straight
#      (look.js: /plank|board|parquet|brick|checker|flagstone-square|terracotta|floor-tile|furrow/) say so in the sku.
def floor(sku, subject, detail): J[sku] = dict(kind='floor', subject=subject, detail=detail + ' A modern, present-day floor. No text, no markings, no logos, no objects.')
floor('floor-tile-carpet', 'grey-blue office carpet tiles', 'Commercial office CARPET TILES: four 2.5-ft square carpet tiles in a 2x2 grid (each tile with a faint woven texture and a slightly different pile direction so the grid shows softly), muted slate grey-blue with a fine darker fleck; plain, worn a little paler.')
floor('floor-planks-laminate', 'warm oak laminate floor boards', 'A modern apartment LAMINATE floor: long straight warm honey-oak boards running left to right, about 8 in wide, with neat thin joints and soft painted grain, evenly toned.')
floor('floor-tile-vinyl', 'white speckled vinyl shop floor tiles', 'A shop floor of 1-ft square VINYL TILES (a 5x5 grid of tiles), off-white with soft grey speckles, every few tiles a pale grey-green one, thin grey joints, a little scuffed.')
floor('floor-concrete-polished', 'smooth polished concrete floor', 'A smooth POLISHED CONCRETE floor for a warehouse: light warm grey with soft mottled cloud tones, a few faint hairline cracks, one straight saw-cut joint line across the middle.')
floor('floor-concrete-garage', 'stained parking-garage concrete', 'A parking-garage CONCRETE floor: medium grey rough concrete with darker oil drips and tyre scuffs, a little gritty, evenly toned across the square.')
floor('floor-asphalt', 'dark city asphalt road surface', 'City ASPHALT road surface: dark charcoal-grey asphalt with a soft gravel texture and a few faint pale patched seams, evenly toned across the square. No road markings.')
floor('floor-tile-pavement', 'concrete pavement slabs', 'A city PAVEMENT of square concrete paving slabs, 2.5 ft each (a 2x2 grid), pale warm grey with soft wear, darker joints, one slab a little cracked.')
floor('floor-tile-dark', 'dark slate bar floor tiles', 'A bar or nightclub floor of 1-ft square dark SLATE-GREY TILES (a 5x5 grid of tiles), near-black charcoal with a faint warm sheen, thin darker joints, softly scuffed.')

# ---- 3. strips: opaque, painted edge to edge, repeating LEFT-RIGHT (finish_strips.py closes the left/right edges)
SQ = 'The square shows exactly one 5 ft x 5 ft floor tile, so keep everything at true scale for that area.'
def strip(sku, what, subject, detail):
    J[sku] = dict(kind='strip', canvas='square', scale=SQ, repeat=REPEAT.format(what=what), subject=subject, detail=detail + ' A modern, present-day street. No text, no letters, no numbers.')
strip('road-strip--s1', 'road centre line', 'a stretch of city road with a dashed centre line, running left to right',
      'The WHOLE tile is dark charcoal-grey ASPHALT (soft gravel texture). Across the middle of the tile, from the LEFT edge to the RIGHT edge, runs ONE dashed road centre line: a broad (5-in) warm yellow painted stripe, one dash about 3 ft long centred in the tile, a 1-ft gap at each edge. Nothing else.')
strip('crosswalk-strip--s1', 'zebra crossing', 'a zebra pedestrian crossing painted on asphalt, seen from straight above',
      'The WHOLE tile is dark charcoal-grey ASPHALT. Painted on it are broad WHITE zebra bars: FOUR thick white bars, each about 8 in wide, running from the TOP edge to the BOTTOM edge of the tile (vertical in the picture), evenly spaced across the tile with equal dark gaps between them, the paint a little worn. So a row of these tiles makes one long crossing.')
strip('parking-line-strip--s1', 'painted parking bay divider line', 'a painted white parking line on a garage concrete floor, running left to right',
      'The WHOLE tile is medium-grey rough CONCRETE with faint oil drips (the same concrete everywhere, edge to edge). Across the exact middle of the tile, from the LEFT edge to the RIGHT edge, runs ONE straight thick WHITE painted line about 4 in wide, a little worn. Nothing else.')

# ---- 4. keyed chroma-blue plates (`decal-*`: keyed, de-spilled and feathered by prep/flats.py; others keyed and cropped)
TOP = ' Seen from exactly straight above, lying flat: no perspective, no ground painted under it, no cast shadow.'
def flat(sku, subject, detail, anchor2=None): J[sku] = dict(kind='decal', anchor2=anchor2, subject=subject, detail=detail + TOP + ' No blue and no purple anywhere on it. No text, no letters, no numbers. Show exactly this and nothing else.')
flat('decal-oil-stain--s1', 'a dark oil stain on asphalt or concrete', 'A dark OIL STAIN on the ground, about 3 ft across, filling about 75% of the canvas, with a soft irregular outline: a near-black oily blot with a faint brown-grey rim and a few drips, thinning at the edges.')
flat('decal-litter--s1', 'scattered city litter on a pavement', 'A loose scatter of city LITTER about 4 ft across, filling about 80% of the canvas: a crushed paper cup, two flattened drinks cans (plain colours, no labels), a few crumpled paper scraps and a takeaway carton, spread out with gaps between them.')
flat('manhole-cover', 'a round iron manhole cover set in the road', 'A round cast-iron MANHOLE COVER about 2.5 ft across, filling about 70% of the canvas: dark iron-grey with a raised cross-hatch grid pattern, two small lifting holes, a thin rim; slightly rusty.')


def out_path(name):
    k = J[name]['kind']
    if k == 'icon': return os.path.join(HERE, 'raw', f'{name}.png')
    if k == 'strip': return os.path.join(HERE, 'raw', 'strips-in', f'{name}.png')
    return os.path.join(HERE, 'decals' if k == 'decal' else 'inputs', f'{name}.jpg')

def build(name):
    """-> (prompt, [images]) or (None, reason)"""
    j = J[name]; kind = j['kind']
    imgs = [ICON_ANCHOR] if kind == 'icon' else [STYLE_ANCHOR]
    if kind == 'icon':
        prompt = ICON.format(subject=j['subject'], name=name)
        if j.get('key') == 'magenta': prompt = prompt.replace('perfectly uniform solid chroma green (#00FF00) edge to edge; the subject must not reflect green light.', 'perfectly uniform solid chroma MAGENTA (#FF00FF) edge to edge (the subject has green in it, so green cannot be the key colour); the subject must not reflect magenta light and must contain no pink or purple.')
    elif kind == 'floor':
        prompt = FLOOR.format(subject=j['subject'], detail=j['detail'], name=name)
        if j.get('base'):
            b = os.path.join(HERE, 'seamless', j['base'] + '.png')
            if not os.path.exists(b): return None, f'WAITING (base {j["base"]} not finished)'
            imgs.append(b)
    elif kind == 'strip':
        prompt = STRIP.format(subject=j['subject'], canvas=j['canvas'], scale=j['scale'], repeat=j['repeat'], detail=j['detail'], name=name)
    else:
        a2 = {'ground': (A2_GROUND, GROUND), None: ('', None)}[j['anchor2']]
        if a2[1]: imgs.append(a2[1])
        prompt = DECAL.format(anchor2=a2[0], subject=j['subject'], detail=j['detail'], name=name)
    return prompt, imgs

def gen(name):
    j = J[name]; kind = j['kind']; out = out_path(name)
    if os.path.exists(out): return 'exists'
    prompt, imgs = build(name)
    if prompt is None: return imgs
    open(os.path.join(HERE, 'raw', 'prompts', f'{name}.gen.txt'), 'w').write(prompt + '\n\n[attached: ' + ', '.join(imgs) + ']\n')
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
            if kind in ('icon', 'strip'): shutil.move(got, out)
            else: Image.open(got).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out, quality=94)
            return f'ok {time.time() - t0:.0f}s'
        if re.search(r'at capacity', txt, re.I) and attempt == 0:
            print(time.strftime('%T'), name, 'model at capacity: waiting 2 min, one more try', flush=True); time.sleep(120); continue
        hit = [l for l in txt.splitlines() if LIMIT.search(l) and 'Use your built-in' not in l and 'at capacity' not in l.lower() and 'must tile' not in l]
        if hit:
            open(os.path.join(HERE, 'QUOTA_STOP.txt'), 'a').write(f'{time.strftime("%F %T")} while generating {name}:\n' + '\n'.join(hit[-12:]) + '\n')
            return 'QUOTA'
        time.sleep(PAUSE)
    return 'FAILED'

if __name__ == '__main__':
    names = sys.argv[1].split(',')
    if names == ['list']: print('\n'.join(J)); sys.exit()
    if names[0] == 'show': print(build(sys.argv[2])[0]); sys.exit()
    for n in names:
        if os.path.exists(os.path.join(HERE, 'QUOTA_STOP.txt')): print('QUOTA_STOP.txt exists: not sending', n, flush=True); break
        res = gen(n); print(time.strftime('%T'), n, res, flush=True)
        if res == 'QUOTA': break
        if res.startswith(('ok', 'FAILED')): time.sleep(PAUSE)
