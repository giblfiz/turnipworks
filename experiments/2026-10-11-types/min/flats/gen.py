#!/usr/bin/env python3
"""Flats for the Mine type (MIN, 2026-10-11): rail strips (left-right), the turntable and buffer tiles, decals, room icons.
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
# ---- 1. room icons (mine). Flooded has green water in it: magenta key (post.py, magenta-icons.json).
NOSYM = '; no real-world religious symbols; no blue'
for key, s in {
  'min-tunnel': "a mine tunnel as a small vignette: a dark tunnel mouth in a rock face framed by two very thick timber props and a heavy timber cap beam, a short stretch of cart track (two rails on fat sleepers) running out of the dark toward the viewer, a small lit lantern hanging on one prop",
  'min-junction': "a mine track junction as a small vignette: a round timber cart turntable with an iron rim seen from slightly above, rails crossing on it and four short track stubs leaving it to four sides, on a patch of dark rock floor",
  'min-face': "a mine working face as a small vignette: one big pickaxe with a thick wooden haft leaning against a rough broken rock face that has a bright thick vein of gold-and-copper ore running diagonally through it, a few ore lumps at its foot",
  'min-collapsed': "a collapsed mine tunnel as a small vignette: a tunnel mouth framed in thick timber, completely blocked by a steep heap of big fallen rocks, one snapped timber beam with a pale splintered break sticking out of the heap",
  'min-flooded': "a flooded mine gallery as a small vignette: two thick upright timber props with a cap beam across them standing in still dark grey-green water, ripple rings round their feet, a half-sunk wooden crate floating beside, a strip of rock wall with a tide line behind; the water is dull dark grey-green (never pink or purple)",
  'min-shaft-head': "a mine shaft head as a small vignette: a chunky wooden hand winch (a thick horizontal drum wound with fat rope on two stout posts, a big crank handle) standing over a square timber-framed black hole in the floor, a big iron-bound bucket hanging on the rope just above the hole",
  'min-sorting': "an ore-sorting table as a small vignette: a heavy wooden table with a rim, on it a heap of dark ore lumps glinting copper and gold, one round wooden sieve and a short fat hammer, a crate of ore at its foot",
  'min-tool-store': "a miners' tool store emblem as a small vignette: one big pickaxe and one broad shovel crossed like an X, both with very thick wooden hafts, in front of a short stack of thick round timber props",
  'min-mess': "a miners' mess emblem as a small vignette: a round wooden bowl of stew with a spoon, a chunky wooden mug and a half loaf of bread on the corner of a rough plank table, a small squat miner's lantern standing beside them",
  'min-powder-store': "a powder store emblem as a small vignette: one stubby wooden blasting-powder keg standing upright with a broad dull red band painted round it, a fat coil of dark fuse cord lying on top with one end trailing down, a second keg lying on its side behind",
  'min-seam': "a crystal seam as a small vignette: a cluster of five fat pointed crystals in violet-purple and rose with one small amber one, growing up out of a lump of dark broken rock, a few crystal chips at its foot (matte, no glow, no sparkle stars)",
  'min-pithead': "a mine pithead as a small vignette: a squat four-legged headframe tower of very thick timbers with diagonal braces and one big solid wooden pulley wheel on top, a thick rope running over the wheel and down, a small heap of ore beside one foot",
  'min-smelter': "a smelting furnace as a small vignette: a squat bottle-shaped furnace of clay and stone bound with three iron bands on a square stone base, a warm orange glow in the arched tap hole low in its front, a short stack of dark metal bars beside it",
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM, key='magenta' if key in ('min-flooded',) else 'green')

# ---- 3. strips: opaque, painted edge to edge. The rail strips repeat LEFT-RIGHT (finish_strips.py closes the left/right edges);
# the turntable and the buffer end are laid alone (no seam step).
SQ = 'The square shows exactly one 5 ft x 5 ft floor tile, so keep everything at true scale for that area.'
RAIL = ("a mine cart track that runs from left to right across the tile",
        "A mine cart TRACK running LEFT to RIGHT, like a small railway seen from straight above. The WHOLE tile is a bed of dark grey-brown gravel ballast and trodden rock dust (no bare margin, no other floor). Lying in it, CROSSWISE (running top to bottom), are {n} very FAT rough timber SLEEPERS, evenly spaced from left to right, each about 8 in wide and 3.5 ft long, centred on the middle of the tile, warm dark brown wood with paler worn tops and end grain, clearly lighter than the ballast; the first gap and the last gap are half gaps so that the spacing continues into the next tile. On top of the sleepers run TWO perfectly straight, parallel iron RAILS from the left edge to the right edge, about 2 ft apart, placed symmetrically above and below the middle line of the tile: each rail a dark iron bar about 2.5 in wide with a thin, pale, worn-bright line along its top, held to every sleeper by a fat square iron spike plate. The rails are exactly horizontal, exactly the same distance apart at the left edge and at the right edge, and run straight off both edges. It must read at once as RAILWAY TRACK from far above: strong contrast between the pale-topped rails, the brown sleepers and the dark ballast. {var}")
RREP = ("This tile is laid in a ROW, the same tile repeated to the LEFT and to the RIGHT, to make one long cart track that runs left to right. So the two rails keep exactly the same height in the picture from the left edge to the right edge and run straight off both edges, continuing seamlessly into the next copy; the sleepers are evenly spaced; the ballast looks alike at the left and right edges; no single eye-catching feature.")
J['mine-rail-strip--s1'] = dict(kind='strip', canvas='square', scale=SQ, repeat=RREP, subject=RAIL[0], detail=RAIL[1].format(n='FIVE', var='Clean and plain: nothing lies on the track.'))
J['mine-rail-strip--s2'] = dict(kind='strip', canvas='square', scale=SQ, repeat=RREP, subject=RAIL[0], detail=RAIL[1].format(n='FIVE', var='Variation 2: the same track, a little more worn: ONE of the middle sleepers is cracked along its length, and a small spill of dark ore lumps with a few copper-orange and brassy gold glints lies in the ballast between the rails near the middle (small: under a foot across). Everything else as plain as before.'))
ALONE = 'This tile is laid alone in a rock floor. It is drawn square to the canvas (edges horizontal and vertical).'
J['mine-rail-cross--s1'] = dict(kind='strip', canvas='square', scale=SQ, repeat=ALONE, subject="a mine cart turntable set in a floor, seen from straight above",
    detail="A mine cart TURNTABLE. The whole tile is a bed of dark grey-brown gravel ballast and rock dust. In the exact centre is a ROUND turntable plate about 3.6 ft across: a disc of thick warm-brown timber planks (the planks run left to right) inside a broad dark IRON RIM with fat rivets, sitting in a thin dark circular gap. Across the plate, through its centre, runs ONE short cart track from left to right: two straight parallel iron rails about 2 ft apart with thin pale worn-bright tops. Outside the plate, FOUR short track stubs leave it, to the LEFT, RIGHT, TOP and BOTTOM: each stub is two parallel iron rails 2 ft apart on one or two fat timber sleepers, running straight from the rim to the middle of that edge of the canvas and off it. The four corners of the tile are plain ballast. The left and right stubs line up exactly with the track on the plate. It must read at once as a railway turntable from far above. Symmetrical and simple.")
J['mine-rail-end--s1'] = dict(kind='strip', canvas='square', scale=SQ, repeat=ALONE + ' A cart track arrives at its LEFT edge from another tile.', subject="the end of a mine cart track with a timber buffer stop, seen from straight above",
    detail="The END of a mine cart track. The whole tile is a bed of dark grey-brown gravel ballast and rock dust. A cart track comes in from the LEFT edge at the middle of the tile and runs to the right: two straight parallel iron rails about 2 ft apart (thin pale worn-bright tops) on three fat crosswise timber sleepers (warm dark brown with paler tops). About two thirds of the way across, the rails STOP at a BUFFER: one very fat squared timber baulk lying crosswise (top to bottom) across the end of both rails, 3.5 ft long and a foot thick, held by two fat iron straps and two short thick timber stakes behind it. To the right of the buffer there is only ballast, a little heaped against the back of the baulk. At the LEFT edge the rails are exactly horizontal, symmetrical above and below the middle line, and run straight off the edge. It must read at once as the end of a railway track with a stop block.")

# ---- 4. keyed chroma-blue plates (`decal-*`: keyed, de-spilled and feathered by prep/flats.py)
TOP = ' Seen from exactly straight above, lying flat: no perspective, no floor painted under it, no cast shadow.'
def flat(sku, subject, detail, anchor2=None): J[sku] = dict(kind='decal', anchor2=anchor2, subject=subject, detail=detail + ' No blue and no purple anywhere on it. No text, no letters. Show exactly this and nothing else.')
for i, d in enumerate(['about fifteen angular lumps and chips from thumb to fist size, loosely scattered round three bigger lumps', 'a looser, longer drift of about ten fist-sized lumps and many small chips, as if spilled from a cart, thicker at one end'], 1):
    flat(f'decal-ore-scatter--s{i}', 'a scatter of raw ore lumps and chips on a mine floor', f'A small scatter of raw ORE lying on a floor, about 3 ft across, filling about 75% of the canvas, with an irregular outline: {d}. The lumps are dark slate-grey and rust-brown rock with clear bright COPPER-ORANGE and brassy GOLD flecks and faces (matte paint, no glow, no sparkle stars) and a few green verdigris spots; they are ore, not coins and not grey rubble. Between and round them a thin film of dark grey-brown rock dust that thins out at the edges. ONE connected patch: the dust joins the lumps, no blue shows between them. Variation {i}.' + TOP, 'ground')
flat('decal-coal-dust--s1', 'a smear of black coal dust with cart ruts on a mine floor', 'A smear of COAL DUST on a floor, about 4 ft long and 3 ft wide, filling about 80% of the canvas, with a soft ragged outline: matte charcoal-black dust, dense in the middle and thinning to a dark grey film at the edges, with a dozen small black coal crumbs in it. Through it, from the left side to the right side, run TWO faint parallel cart RUTS about 2 ft apart: narrow, slightly paler grey lines where wheels have pressed the dust. Completely matte: no shine, no glow, no orange. ONE connected patch with no holes.' + TOP, 'ground')

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
