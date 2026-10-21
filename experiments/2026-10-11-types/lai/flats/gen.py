#!/usr/bin/env python3
"""Flats for the Monster lair type (LAI, 2026-10-11): rail strips (left-right), the turntable and buffer tiles, decals, room icons.
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
GROUND = 'experiments/2026-10-11-types/dun/flats/seamless/floor-cut-rock.png'   # our own cut-rock floor (dungeon batch): the floor mine decals lie on
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
# ---- room icons (monster lair): small vignettes in the build tray's set
NOSYM = '; no real-world religious symbols; no blue; no creature and no person in it'
for key, s in {
  'lair-mouth': "the mouth of a monster's cave as a small vignette: a dark arched cave opening in a hump of grey-brown rock, a thick wooden post hung with three skulls standing beside it, a few bones on the ground in front",
  'lair-passage': "a winding cave passage as a small vignette: a narrow rock tunnel that bends out of sight between two rounded boulders and a fat stalagmite, a scatter of small bones on its floor",
  'lair-warren': "a goblin chieftain's seat as a small vignette: a crude high-backed throne lashed from big bones with a horned skull on its back, standing on a low heap of stolen crates, sacks and a round shield",
  'lair-beast': "a beast's den as a small vignette: a wide round nest of thick branches, bones and torn rags with a trampled hollow in the middle, a big picked rib cage lying beside it",
  'lair-spider': "a giant spider's nest as a small vignette: a thick pale funnel of web with one dark round tunnel mouth, two victims wrapped in web like fat cocoons standing beside it",
  'lair-larder': "a monster's larder as a small vignette: two large skinned carcasses hanging from a thick timber bar on fat hooks over a heavy chopping block with a cleaver stuck in it",
  'lair-pit': "a prisoner pit as a small vignette: a round black pit in a rock floor ringed with rough stones, a cage of thick lashed poles standing at its edge",
  'lair-hatchery': "a monster hatchery as a small vignette: three large mottled red-bronze eggs standing together in a round bed of straw and ash, one egg with a jagged crack",
  'lair-trophy': "a trophy cave as a small vignette: a huge horned reptile skull on a rough stone plinth, a dented knight's helmet and a round shield leaning at its foot",
  'lair-dragon': "a dragon's hoard as a small vignette: a great rounded mound of gold coins with a crown, a goblet and an open iron-bound chest half buried in it, and a wide shallow hollow pressed into its top",
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM, key='green')

# ---- keyed chroma-blue plates (keyed by tools/spawn-tuner/prep/flats.py)
TOP = ' Seen from exactly straight above, lying flat: no perspective, no floor painted under it, no cast shadow.'
def flat(sku, subject, detail, anchor2=None): J[sku] = dict(kind='decal', anchor2=anchor2, subject=subject, detail=detail + ' No blue and no purple anywhere on it. No text, no letters. Show exactly this and nothing else.')
flat('giant-web-floor--s1', "a sheet of giant spider web spread over a cave floor", "A SHEET of giant spider web lying on a floor, about 9 ft across, filling about 85% of the canvas, roughly round with a ragged outline of thick anchor strands. Dense pale grey-white web, almost opaque in the middle like felt, with a clear painted pattern of THICK radial ropes and rings (each strand as thick as a finger at this scale), thinner and more open toward the edge; two small bones and a boot caught in it. Matte, no glow." + TOP)
for i, d in enumerate(['a wide fan-shaped burn, darkest at one end where the fire struck and spreading out', 'a ragged round burn with five soot rays'], 1):
    flat(f'decal-scorch--s{i}', "a scorch mark burnt onto a stone floor by dragon fire", f"A SCORCH MARK on a floor, about 6 ft across, filling about 80% of the canvas: {d}. Matte charcoal black in the middle, thinning to brown-grey soot and pale ash at a soft ragged edge, with a few pale cracked patches where stone has spalled. It is a burn, NOT a hole and NOT a puddle: flat, dry, no depth, no shine, no flames, no embers." + TOP)

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
