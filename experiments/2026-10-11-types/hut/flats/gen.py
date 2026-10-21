#!/usr/bin/env python3
"""Flats for the Farmstead type (HUT, 2026-10-12): the sixteen room icons and the ploughed-field ground (tools copied from dun/flats).
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
GROUND = os.path.join(MAIN, 'experiments/2026-10-01-floors/seamless/floor-flagstone-damp.png')   # the floor dungeon decals lie on
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

STRIP = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint ONE floor tile for a top-down tabletop dungeon map: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters.

Presentation: seen from directly overhead (perfectly top-down orthographic, the camera looks straight down). The painting fills the ENTIRE {canvas} canvas edge to edge: no border, no frame, no margin, no background colour, no vignette. {scale} Even lighting from above, no long cast shadows. No blue and no purple anywhere (dark neutral greys, grey-browns, grey-greens and black only).
{repeat}

Specific design: {detail}
Save the resulting PNG ({canvas}, at least 1024 px wide) into the current directory as {name}.png and print its path and pixel size."""
REPEAT = "This tile is laid in a ROW, the same tile repeated to the LEFT and to the RIGHT, to make one long {what} that runs left to right. So the picture is a straight horizontal band design: every band keeps exactly the same height from the left edge to the right edge, everything runs straight off the left edge and off the right edge and must continue seamlessly into the next copy; nothing begins, ends, narrows or widens inside the tile; no single eye-catching feature (it would repeat every 5 ft); the left and right thirds look alike."

DECAL = """Use your built-in image generation tool. The FIRST attached image is the style guide for the Turnip Works house style (heroic hand-painted). {anchor2}Create a new, distinct flat game asset in that hand-painted style: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters.

Presentation: seen from directly overhead (perfectly top-down orthographic, no perspective), evenly lit, NO cast shadow and no ground painted, centred with clear space around every edge on a perfectly uniform solid chroma-blue (#0000FF) background. The subject itself must contain no blue and no purple, and the blue background must not show through gaps inside it.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
A2_GROUND = "The SECOND attached image is the stone floor this decal will lie on in the game: it is there only so that the decal's colours and painting scale sit well on it; do NOT paint any of that floor. "

J = {}
# ---- 1. room icons: the sixteen farm rooms. All keyed MAGENTA (most have green in them).
NOSYM = '; no people, no animals; no crosses or real-world religious symbols; no blue; no pink or purple anywhere in the subject'
for key, s in {
  'hut-cottage': "a tiny one-room peasant cottage as a small cutaway vignette: cracked cream daub walls on a timber sill under a thick golden thatched roof, the front cut open to show an open fire burning in a ring of stones on the earth floor with a black pot over it, a straw pallet bed in the corner and a three-legged stool",
  'hut-kitchen': "a farmhouse kitchen as a small cutaway vignette: a wide stone cooking hearth with a black cauldron hanging over the fire, a long plank table with a bench and a round loaf and a yellow cheese on it, a ham and a string of onions hanging from a beam",
  'hut-bedroom': "a plain farmhouse bedroom as a small cutaway vignette: one simple wooden box bed with a patchwork quilt in ochre and muted burgundy and a straw-coloured pillow, a wooden chest at its foot, a candle on a stool, a small shuttered window in a daub wall",
  'hut-loft': "a sleeping loft under a thatched roof as a small cutaway vignette: the triangular space under sloping rafters, two straw pallets with rough blankets on a plank floor, the top of a ladder coming up through a square hatch, strings of onions and a sack of apples under the eaves",
  'hut-passage': "the cross-passage of a peasant longhouse as a small cutaway vignette: a short earth-floored passage between two plank doors, cloaks and a straw hat hanging on wall pegs, a pair of muddy boots, a wooden bucket and a broom leaning on the daub wall",
  'hut-cellar': "a root cellar as a small cutaway vignette: a low vault of rough fieldstone dug into the earth with a short ladder down, a heap of turnips and a heap of potatoes on the earth floor, a crate of cabbages, a barrel, strings of onions hanging",
  'hut-byre': "a cow byre as a small cutaway vignette: two empty wooden cattle stalls with a hay manger and thick straw on the floor, a three-legged milking stool and a wooden pail of white milk in front, under a low thatched roof",
  'hut-coop': "a hen house as a small vignette: a little plank chicken coop on short legs with a sloping plank roof and a slatted ramp up to its small door, a row of straw nest boxes with big pale eggs showing at the side, a basket of eggs in front",
  'hut-pigsty': "a pigsty as a small vignette: a squat low stone sty shelter with a plank roof and a dark low doorway, a little yard of dark brown mud in front of it enclosed by a low stone wall, a wooden feeding trough and a heap of straw (empty: no pig)",
  'hut-barn': "a hay barn as a small cutaway vignette: a tall timber barn with wide double plank doors standing open and a thatched roof, golden hay piled high inside up to a loft, a pitchfork stuck in the hay and a wooden hand cart in front",
  'hut-granary': "a granary and threshing floor as a small cutaway vignette: a heap of golden grain on a swept plank floor with a wooden shovel stuck in it, three fat sacks of grain tied at the neck, two bound wheat sheaves and a jointed wooden flail lying beside them",
  'hut-dairy': "a farm dairy as a small cutaway vignette: a cool whitewashed stone room with a tall wooden butter churn with its plunger, a stack of three round yellow cheeses on a scrubbed table, a wooden pail of white milk and a shelf of cheeses behind",
  'hut-garden': "a cottage vegetable garden as a small vignette: three raised earth beds with rows of green cabbages, orange carrot tops and leeks, a wigwam of bean poles with red flowers, a spade stuck in the earth, enclosed by a low woven wattle fence with a little gate",
  'hut-field': "the edge of a harvest field as a small vignette: a strip of dark brown ploughed furrows beside a strip of standing golden wheat, three bound sheaves stood together in a stook, a scarecrow with a straw hat on a post, a post-and-rail fence corner",
  'hut-orchard': "an orchard corner as a small vignette: two small round apple trees heavy with red apples standing in long grass, a leaning wooden ladder against one, a basket of red apples and a straw beehive skep on a bench, a low dry-stone wall behind",
  'hut-farmyard': "a farmyard as a small vignette: a round stone well with a wooden windlass, roof and bucket in the middle of trodden earth, a wooden water trough, a two-wheeled hay cart and a round haystack behind, a bit of woven wattle fence",
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM, key='magenta')

# ---- 2. the ploughed field: ground for the Field edge room (seamless; the furrows run LEFT-RIGHT and must meet from tile to tile)
FUR = ("a ploughed field seen from straight above", "Exception to the rule above about low detail: the surface IS a pattern. Freshly PLOUGHED earth: straight parallel FURROWS running exactly LEFT to RIGHT across the whole square, SIX ridges evenly spaced from top to bottom (each ridge and its furrow together one sixth of the height), every ridge and furrow perfectly horizontal and of constant width from the left edge to the right edge so that the rows continue unbroken into the next tile on the left and right, and the spacing continues evenly over the top and bottom edges. Ridges are rounded, crumbly, warm mid-brown earth lit from above; the furrows between them are darker chocolate-brown shadowed troughs. {what} Earth colours only: warm browns and dark umber, no grey, no green except where said.")
for i, w in enumerate(['A few small pale stones and scraps of old straw lie scattered sparsely; NO plants.']):  # (one tile only: a structured floor lays its base everywhere, look.js floorSpecs)
    n = 'floor-field-furrows' if i == 0 else f'floor-field-furrows--v{i + 1}'
    d = FUR[1].format(what=w)
    if i: d += ' This is a variation of the ground in the SECOND attached image (our finished base tile): keep exactly its colours, darkness, ridge spacing and painting style.'
    J[n] = dict(kind='floor', subject=FUR[0], detail=d, base='floor-field-furrows' if i else None)

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
