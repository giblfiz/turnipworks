#!/usr/bin/env python3
"""Flats for the cyberpunk pack, wave 2 (2026-11-07): two floors and the Cyberpunk type's icons. Was: wave 1 (sprawl):
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
# THE CYBERPUNK PACK, wave 2 (2026-11-07): the Cyberpunk type's room icons and type icon (wave 1's icon frame; the genre icon
# is wave 1's), two floors. Same route, same frames.
for key, s in {
  'room-cyb-clinic': "a back-street clinic as a small vignette: a reclined teal surgical chair under a round wheeled surgical lamp with glowing bulbs, a chrome robotic arm hanging on a wall rack beside it",
  'room-cyb-lobby': "a corporate lobby as a small vignette: a sleek dark reception desk with a glowing cyan light strip along its front, a tall pane of blue-grey glass wall behind it",
  'room-cyb-server': "a server room as a small vignette: two tall black server racks side by side covered in tiny glowing blue and green lights, a thick bundle of cables on top",
  'room-cyb-noodle': "a noodle bar as a small vignette: a steel street-food counter with a big steaming pot and a white bowl of noodles with chopsticks, a red-topped stool in front",
  'room-cyb-capsule': "a capsule hotel as a small vignette: two moulded off-white sleeping capsules stacked one on the other, each with a round-cornered hatch glowing warm inside",
  'room-cyb-hideout': "a gang hideout as a small vignette: a rusty oil drum with fire glowing in it beside a section of silver chain-link fence and a battered mustard sofa",
  'room-cyb-talisman': "a magic-supply shop as a small vignette: a dark wooden shelf crammed with glass jars of coloured powders, bundles of herbs and a glowing violet crystal cluster",
  'room-cyb-rigger': "a rigger's garage as a small vignette: a chunky grey quadcopter drone with four round rotor rings resting on a red rolling tool chest",
  'room-cyb-safehouse': "a safehouse as a small vignette: a dark desk with three glowing green-and-cyan computer screens, a stack of black and olive hard equipment cases beside it",
  'room-cyb-rooftop': "a city rooftop as a small vignette: a wooden water tank on a steel stand beside a boxy grey rooftop air-conditioning unit with round fans on top, on a gravel roof",
  'type-CYB': "a near-future city tower as a small vignette: a chunky dark high-rise building with rows of glowing cyan windows and a glowing magenta stripe down its side, a small rooftop antenna with a red light",
}.items():
    J[key] = dict(kind='icon', subject=s + '. A gritty NEAR-FUTURE (cyberpunk) subject, in the same icon style; a palette of gunmetal, warm grey, brick red, muted teal, mustard and cream with small glowing accents of cyan and magenta instead of wood and stone; no real-world brand or logo, no words', key='green')

def floor(sku, subject, detail): J[sku] = dict(kind='floor', subject=subject, detail=detail + ' A modern, present-day floor. No text, no markings, no logos, no objects.')
floor('floor-roof-gravel', 'a tar-and-gravel flat city roof', 'A flat city ROOF of TAR AND GRAVEL: a dark warm-grey bitumen surface thickly scattered with small rounded pale grey and buff pebbles, a few darker patches where the gravel is thin, evenly toned across the square.')
floor('floor-raised-tile', 'grey perforated raised-floor tiles of a server room', 'A data-centre RAISED FLOOR of 2-ft square steel floor tiles (a grid of square tiles, about two and a half across the square), pale cool grey, some tiles perforated with a neat grid of small round holes, thin dark joints between the tiles.')


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
