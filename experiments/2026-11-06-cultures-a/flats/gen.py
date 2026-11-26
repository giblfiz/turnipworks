#!/usr/bin/env python3
"""Flats for the culture packs (cultures-a, 2026-11-06): room and type icons, floors, decals. The method and the prompt
frames are the Farmstead's (experiments/2026-10-11-types/hut/flats/gen.py, from the castle/crypt/mansion flats): FREE
route only, Codex's built-in image tool (`codex exec`, ChatGPT login), one request at a time.
    python3 flats/gen.py CODE name,name,...|all      |  python3 flats/gen.py CODE list
Outputs (CODE/flats/): floors -> inputs/<sku>.jpg (finish.py -> seamless/), tiles composed from a painted unit ->
units/<sku>.png (compose.py -> seamless/), decals -> decals/<sku>.jpg (chroma blue; prep/flats.py keys them), icons ->
raw/<name>.png (magenta; post.py -> icons/<name>.png 128 px). Every request is appended to requests.log."""
import os, sys, subprocess, time, shutil, tempfile, re
from PIL import Image
E = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = '<repo>'
ICON_ANCHOR = os.path.join(MAIN, 'experiments/2026-10-03-build-icons/raw/type-TAV.png')
STYLE_ANCHOR = os.path.join(MAIN, 'style-references/heroic-handpainted-tavern-v1.png')
PAUSE = 15
LIMIT = re.compile(r"usage limit|rate limit|rate_limit|quota|too many requests|\b429\b|try again (in|at)|limit reached|hit your .*limit", re.I)
ICON = """Use your built-in image generation tool. Generate ONE square image: a single app icon for a tabletop-RPG building toolkit, showing {subject}; no people, no animals, no writing, letters or characters; no pink or purple anywhere.
Style: bold, simple, chunky silhouette that reads at 48 pixels; a small three-quarter vignette seen from slightly above; flat-shaded with soft matte gradients, quiet and modern (no outlines, no comic inking, no gloss, no photorealism); minimal detail; a restrained palette of warm honey wood, blue-gray stone, moss green, ochre, cream and a touch of muted burgundy (and the subject's own colours where they are its point). Exactly one subject, centred, filling about 80% of the frame, clear space around every edge. No text, no letters, no frame, no badge shape, no border, no drop shadow, no floor plane.
Background: perfectly uniform solid chroma MAGENTA (#FF00FF) edge to edge; the subject must not reflect magenta light and must contain no pink or purple.
The attached image is the style anchor for this icon set: match its rendering, lighting, palette, level of detail, camera angle and scale exactly (a different subject, the same family of icons).
Save the resulting PNG into the current directory as {name}.png and print its path and pixel size."""
FLOOR = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint a ground material swatch: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, logos and emblems.

Presentation: a perfectly top-down orthographic view looking straight down at the ground. The ground surface fills the ENTIRE square canvas edge to edge: no border, no frame, no background colour, no vignette, no perspective, no cast shadows, no objects. Even, flat, shadowless lighting. The square shows a 5 ft x 5 ft patch of ground, so keep elements at true scale for that area. It must tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the overall tone EVEN across the whole square (no big light or dark blotches), so that a grid of these squares does not show.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
UNIT = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, logos and emblems.

Presentation: a perfectly top-down orthographic view looking straight down. The subject fills the ENTIRE canvas edge to edge ({canvas}): no border beyond what is described, no background colour, no vignette, no perspective, no cast shadows, no objects on it. Even, flat, shadowless lighting.

Specific design: {detail}
Save the resulting PNG ({canvas}) into the current directory as {name}.png and print its path and pixel size."""
DECAL = """Use your built-in image generation tool. The attached image is the style guide for the Turnip Works house style (heroic hand-painted). Create a new, distinct flat game asset in that hand-painted style: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters.

Presentation: seen from directly overhead (perfectly top-down orthographic, no perspective), evenly lit, NO cast shadow and no ground painted, centred with clear space around every edge on a perfectly uniform solid chroma-blue (#0000FF) background. The subject itself must contain no blue and no purple, and the blue background must not show through gaps inside it.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""

J = {'jpn': {
 # icons: the seven rooms and the type
 'type-JPN': dict(kind='icon', subject='a small Japanese townhouse of the Edo period as a vignette: dark timber posts and white paper shoji screens under a grey tiled hip-and-gable roof with gently upturned eaves, a short wooden veranda along its front'),
 'room-jpn-house': dict(kind='icon', subject='a cutaway corner of a Japanese tatami room: pale green-gold tatami mats with dark borders, a tokonoma alcove with a hanging ink-landscape scroll and a camellia branch in a bronze vase, a very low dark lacquered table with two square indigo floor cushions'),
 'room-jpn-teahouse': dict(kind='icon', subject='a cutaway corner of a Japanese tea room: four and a half tatami mats, a small square sunken hearth with a round black iron kettle in it, a dark raku tea bowl and a bamboo whisk beside it, a small alcove with one flower in a vase'),
 'room-jpn-dojo': dict(kind='icon', subject='a cutaway corner of a Japanese dojo: a wide empty floor of polished honey-coloured boards, a small pale wooden shrine shelf with a twisted straw rope mounted high on the back wall, a rack of pale wooden practice swords, a big barrel drum on a stand in the corner'),
 'room-jpn-shrine': dict(kind='icon', subject='a cutaway of a Shinto shrine worship hall: vermilion posts and white walls, a plain pale wooden offering table with green sakaki branches and white offerings before closed doors under a thick twisted straw rope, a round brass bell on a thick red and white rope above a long wooden offering box with a slatted top'),
 'room-jpn-shrine-court': dict(kind='icon', subject='a Shinto shrine approach as a small vignette: a bright vermilion torii gate over a pale gravel path, two grey stone lanterns lining the path, a stone purification basin with bamboo ladles under a little roof, a pruned pine'),
 'room-jpn-shop': dict(kind='icon', subject="a cutaway corner of an Edo-period sake merchant's shop: a raised tatami platform with a low desk, an abacus and a low wooden lattice screen, a pyramid of round sake casks wrapped in pale straw matting, a round green ball of cedar hung over the door"),
 'room-jpn-garden': dict(kind='icon', subject='a Japanese tea garden as a small vignette: flat stepping stones across soft green moss to a low round stone wash basin with a bamboo spout, a grey stone lantern beside it, a small red-leaved maple, a low bamboo fence tied with black rope'),
 # floors
 'floor-tatami': dict(kind='unit', subject='ONE Japanese tatami mat seen from straight above', canvas='portrait, 1024 x 2048 px', detail=(
   'ONE single tatami mat fills the WHOLE canvas: its long side runs from the top edge to the bottom edge. The surface is woven rush in a soft pale green-gold'
   ' straw colour, with the weave as fine straight parallel lines running LENGTHWISE (top to bottom) and very faint broader bands; along BOTH LONG SIDES (the'
   ' left edge and the right edge) a straight cloth border strip (heri) about one twelfth of the width, dark green-black with a faint woven pattern; the two'
   ' SHORT ends (top and bottom) have NO border, the rush runs straight off them. Even tone everywhere, no stains, no shadows, nothing on it.')),
 'floor-jpn-cedar': dict(kind='floor', subject='a polished Japanese cedar plank floor seen from straight above', detail=(
   'Long straight floorboards of Japanese cedar (hinoki-like), polished to a soft warm honey-gold sheen (matte, not glossy), running exactly LEFT to RIGHT across the'
   ' whole square, SIX boards evenly spaced from top to bottom, each board 10 in wide, with thin dark seams between them; the board ends are staggered and sparse;'
   ' gentle long grain lines and a few soft knots. Even tone.')),
 'floor-jpn-moss': dict(kind='floor', subject='the soft moss ground of a Japanese tea garden seen from straight above', detail=(
   'A soft continuous carpet of low cushion moss, velvety and dense, in deep and mid moss greens, painted as many SMALL soft rounded cushions of nearly the same'
   ' green, evenly spread, all about the size of a fist; NO flowers, NO leaves, NO needles, NO specks of any other colour, no stones, no paths, no bare earth, no'
   ' blades of grass. One even tone over the whole square (v2, 2026-11-06: the first moss had red leaves that read as flowers and repeated as a blotch).')),
 # decals
 'decal-stepping-stones': dict(kind='decal', subject='one flat natural stepping stone of a Japanese garden path', detail=(
   'ONE broad flat irregular rounded stepping stone of grey granite with a slightly lighter, worn flat top, seen from straight above, about 2 ft across, filling'
   ' about 70% of the canvas; a thin soft rim of dark moss green hugging its edge.')),
}, 'ca': {
 'genre-cultures': dict(kind='icon', subject='three small roofs of the world side by side as one little vignette: a grey tiled Japanese roof with gently upturned eaves, a flat-roofed white Rajasthani pavilion with a small dome, and a steep red-tiled roof with a carved gable; one tiny path running between them'),
}, 'chn': {
 'type-CHN': dict(kind='icon', subject='a small Chinese courtyard-house gate of the Qing dynasty as a vignette: a grey brick wall with a dark red lacquered double door with round bronze knockers under a little roof of dark grey cylindrical tiles with gently upturned corners, two small stone drums at its foot'),
 'room-chn-hall': dict(kind='icon', subject='a cutaway corner of a Chinese courtyard-house hall: grey brick walls and a dark red-brown column, a long narrow dark console table with upturned ends and a blue-and-white vase against the back wall, a square table between two dark armchairs with tall curved backs, a hexagonal silk lantern hanging above'),
 'room-chn-teahouse': dict(kind='icon', subject='a cutaway corner of a Chinese tea house: square dark wooden tables with long narrow benches, small teapots and cups on them, a wooden counter with a grey brick stove and two big copper kettles at the back'),
 'room-chn-study': dict(kind='icon', subject="a cutaway corner of a Chinese scholar's study: a long dark painting table with brushes in a porcelain pot, a black ink stone and cream paper, a bookcase of flat stacked books in deep blue cloth cases, a tall standing screen with a marble panel"),
 'room-chn-temple': dict(kind='icon', subject='a cutaway of a Chinese Buddhist temple hall: red walls and red columns, a serene gilded seated Buddha on a lotus throne with a red-and-gold halo on a red altar platform, a red offering table with candlesticks and fruit before it, round straw kneeling cushions on the grey brick floor'),
 'room-chn-market': dict(kind='icon', subject='a Chinese market street as a small vignette: a wooden stall of baskets of red chillies and green vegetables under an indigo cloth awning on bamboo poles, a tall stack of round bamboo steamers, a carrying pole with two baskets set down, a red lantern on a post'),
 'room-chn-courtyard': dict(kind='icon', subject='a Chinese courtyard as a small vignette: grey brick paving, a tall twisting pale Taihu rock full of holes, a big glazed vat of water with lotus leaves, a round stone table with drum-shaped stools, a grey brick screen wall with a carved panel and a little tiled top'),
 'floor-chn-brick': dict(kind='floor', subject='a floor of square grey fired bricks seen from straight above', detail=(
   'Large SQUARE floor bricks of smooth dark blue-grey fired clay (jinzhuan), laid in a straight grid, exactly FOUR bricks across and FOUR down (each 15 in'
   ' square), with thin pale grey joints, every brick a touch lighter or darker than its neighbours, smooth and softly worn; the grid lines run straight off all'
   ' four edges.')),
 'floor-chn-paving': dict(kind='floor', subject='courtyard paving of grey bricks laid on edge seen from straight above', detail=(
   'Narrow grey bricks laid on edge in a tight HERRINGBONE pattern, blue-grey and warm grey, with thin dark joints and a few tiny tufts of moss in the joints;'
   ' even tone; the pattern runs straight off every edge.')),
 'chn-scroll-landscape': dict(kind='decal', subject='a Chinese hanging scroll painted with an ink landscape, seen straight on', detail=(
   'ONE tall narrow hanging SCROLL seen flat from the front, about three times as tall as wide, filling the canvas height: a mount of pale cream-gold silk'
   ' with a darker band at top and bottom and a dark wooden roller rod across its bottom, and in its centre panel a soft ink-and-wash painting of misty'
   ' mountains, a waterfall and a pine, in greys with touches of pale green. NO writing, NO seals, NO characters anywhere.')),
}, 'ind': {
 'type-IND': dict(kind='icon', subject='a small Rajasthani haveli of the 18th century as a vignette: ivory-white plaster walls with painted red and ochre borders, a projecting balcony window with a little curved roof on carved brackets, a carved wooden door with brass studs under a cusped arch, a flat roof with a small domed pavilion on its corner'),
 'room-ind-haveli': dict(kind='icon', subject='a Rajasthani haveli courtyard as a small vignette: a square white decorated tulsi planter with a bushy basil plant in the centre on a white folk floor painting, a rope-strung cot, a painted wooden swing on a frame, three round clay water pots on a stand'),
 'room-ind-durbar': dict(kind='icon', subject='a cutaway of a Rajput palace hall: red sandstone walls with cusped arches, a cushioned throne platform with round red-and-gold bolsters under a small domed canopy on four gilded posts, white floor mattresses with bolsters along the walls, tall brass lamp stands'),
 'room-ind-mandapa': dict(kind='icon', subject='a cutaway of a Shiva temple hall: rows of carved golden sandstone pillars, at the far end a deep carved stone doorway with a red curtain drawn across it and small brass bells, a seated stone bull with a marigold garland facing the doorway, a tall brass lamp stand'),
 'room-ind-bazaar': dict(kind='icon', subject="a cutaway of a Rajasthani grain merchant's shop: a white mattress seat with a red bolster and a small writing chest, low round baskets heaped with rice, lentils, red chilli and turmeric, a stack of shining brass pots, white plaster walls with a painted border"),
 'room-ind-stepwell': dict(kind='icon', subject='a Rajasthani stepwell as a small vignette: a square sunken tank of golden sandstone with zigzag flights of stairs going down to deep green water, a small domed pavilion on four pillars at its rim, round clay water pots'),
 'room-ind-kitchen': dict(kind='icon', subject='a cutaway of a Rajasthani household kitchen: a low red-ochre clay stove with two cooking holes and a brass pot on it, a flat grinding stone with a roller, a wall shelf of shining brass and copper plates and pots, two big clay storage jars'),
 'floor-ind-sandstone': dict(kind='floor', subject='a floor of red sandstone slabs seen from straight above', detail=(
   'Large rectangular slabs of smooth dressed RED SANDSTONE, warm rose-red with soft paler bands of the stone\'s bedding, laid in straight courses (three'
   ' courses down the square, the slabs of each course offset from the one before), with thin pale joints; softly worn. The courses run straight off the'
   ' left and right edges.')),
 'floor-ind-temple': dict(kind='floor', subject='a temple floor of pale golden sandstone slabs seen from straight above', detail=(
   'Large IRREGULAR flagstones of pale golden-buff SANDSTONE of mixed sizes (most about 2 ft across, a few bigger), fitted closely like a crazy-paving with'
   ' thin slightly darker joints, worn smooth and softly polished by bare feet; no straight grid lines, no stone larger than half the square. Even tone'
   ' (v2: the first plate, a strict 3 x 3 grid, would not close at its edges).')),
 'floor-ind-lime': dict(kind='floor', subject='a polished Indian lime floor seen from straight above', detail=(
   'A smooth polished LIME floor (araish) in warm pale ochre-cream with soft faint cloudy mottling and a few hairline crazing cracks; NO lines, NO grid,'
   ' NO pattern. Soft, even and slightly glossy-matte (v2: the first plate had an inlaid grid that would not close at its edges).')),
 'decal-mandana': dict(kind='decal', subject='a Rajasthani mandana folk floor painting', detail=(
   'ONE round MANDANA floor painting seen from straight above: on a round patch of smooth red-ochre earth plaster, a bold symmetrical geometric design of'
   ' white lines and dots (concentric squares and circles, a central eight-petalled lotus, small stepped triangles round the rim), painted as with a finger'
   ' in white lime. Filling about 80% of the canvas.')),
 'rug-ind-durrie': dict(kind='decal', subject='a flat-woven Indian cotton durrie rug seen from straight above', detail=(
   'ONE rectangular flat-woven cotton DURRIE rug, twice as long as wide, lying flat: broad stripes across it in madder red, deep brown and ochre with narrow'
   ' cream bands, a small stepped-diamond pattern in the central red stripe, short cream fringes at both ends. Filling about 85% of the canvas width.')),
}}

def fdir(code, *p):
    d = os.path.join(E, code, 'flats', *p); os.makedirs(d, exist_ok=True); return d
def out_path(code, name):
    k = J[code][name]['kind']
    return {'icon': os.path.join(fdir(code, 'raw'), f'{name}.png'), 'unit': os.path.join(fdir(code, 'units'), f'{name}.png'),
            'decal': os.path.join(fdir(code, 'decals'), f'{name}.jpg'), 'floor': os.path.join(fdir(code, 'inputs'), f'{name}.jpg')}[k]
def build(code, name):
    j = J[code][name]; k = j['kind']
    if k == 'icon': return ICON.format(subject=j['subject'], name=name), [ICON_ANCHOR]
    if k == 'unit': return UNIT.format(subject=j['subject'], canvas=j['canvas'], detail=j['detail'], name=name), [STYLE_ANCHOR]
    if k == 'decal': return DECAL.format(subject=j['subject'], detail=j['detail'], name=name), [STYLE_ANCHOR]
    return FLOOR.format(subject=j['subject'], detail=j['detail'], name=name), [STYLE_ANCHOR]
def gen(code, name):
    k = J[code][name]['kind']; out = out_path(code, name)
    if os.path.exists(out): return 'exists'
    prompt, imgs = build(code, name)
    open(os.path.join(fdir(code, 'prompts'), f'{name}.gen.txt'), 'w').write(prompt + '\n\n[attached: ' + ', '.join(imgs) + ']\n')
    wd = tempfile.mkdtemp(prefix=f'ca-flats-{name}-')
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write'] + sum((['-i', i] for i in imgs), []) + ['-']
    t0 = time.time()
    for attempt in range(2):
        open(os.path.join(fdir(code), 'requests.log'), 'a').write(f'{time.strftime("%F %T")} {name} attempt {attempt + 1}\n')
        try: r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900); txt = r.stdout[-6000:] + '\n' + r.stderr[-4000:]
        except subprocess.TimeoutExpired: txt = 'TIMEOUT 900s'
        open(os.path.join(fdir(code, 'raw'), f'{name}.log'), 'a').write(txt)
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got):
            if k in ('icon', 'unit'): shutil.move(got, out)
            else: Image.open(got).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out, quality=94)
            return f'ok {time.time() - t0:.0f}s'
        hit = [l for l in txt.splitlines() if LIMIT.search(l) and 'Use your built-in' not in l and 'must tile' not in l]
        if hit: open(os.path.join(fdir(code), 'QUOTA_STOP.txt'), 'a').write(f'{time.strftime("%F %T")} {name}:\n' + '\n'.join(hit[-8:]) + '\n'); return 'QUOTA'
        time.sleep(PAUSE)
    return 'FAILED'

if __name__ == '__main__':
    code, names = sys.argv[1], sys.argv[2].split(',')
    if names == ['list']: print('\n'.join(J[code])); sys.exit()
    if names == ['all']: names = list(J[code])
    for n in names:
        if os.path.exists(os.path.join(fdir(code), 'QUOTA_STOP.txt')): print('QUOTA_STOP.txt exists: not sending', n, flush=True); break
        res = gen(code, n); print(time.strftime('%T'), n, res, flush=True)
        if res == 'QUOTA': break
        if res.startswith(('ok', 'FAILED')): time.sleep(PAUSE)
