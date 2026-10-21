#!/usr/bin/env python3
"""Flats for the Dungeon & prison type (DUN, 2026-10-11): floors, left-right strips, decals, room icons.
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
# ---- 1. room icons (FLATS.md). Sewer and flooded have green water in them: magenta key (post.py, magenta-icons.json).
NOSYM = '; no crosses or real-world religious symbols; no blue'
for key, s in {
  'dun-cell-block': "a cutaway corner of a prison cell block: a heavy barred iron cell door with fat round vertical bars and a big box lock set in a dark stone wall, a second barred cell front beside it, a ring of keys on a wall hook",
  'dun-guard-room': "a guard room emblem as a small vignette: a rounded iron guard's helm sitting on top of two big crossed iron keys, on a chunky wooden table corner with a stool and a wall torch behind",
  'dun-interrogation': "a cutaway corner of an interrogation chamber: one heavy iron chair with arm and leg straps standing in the middle of a stone floor, a wooden rack table with a winding wheel behind it, a brazier of glowing irons beside",
  'dun-vault': "a cutaway corner of a treasure vault: one big open iron-bound chest heaped full of gold coins, a few coins and a goblet spilled on the stone floor, a thick round vault door standing open in the stone wall behind",
  'dun-sewer': "a sewer as a small vignette: a big ROUND iron grate of fat bars set in a curved stone-and-brick tunnel wall, murky grey-green water dripping and running out of it into a stone channel below; the water is dull grey-green (never pink or purple)",
  'dun-corridor': "a dungeon corridor as a small vignette: one deep round stone passage arch leading into darkness, a flight of two worn steps up to it, a lit torch in an iron bracket on each side throwing warm light on the stones",
  'dun-trap-corridor': "a trapped dungeon passage as a small vignette: a short stretch of stone-flagged corridor floor between two low walls with a tight cluster of tall sharp iron SPIKES thrusting up out of square holes in the floor, one raised pressure-plate flagstone in front",
  'dun-puzzle-hall': "a puzzle hall as a small vignette: a row of three big square stone floor tiles, each carved with one different bold angular rune inlaid in dull bronze, and behind them a squat stone statue of a hooded figure standing on a round turntable base with a bronze turning ring",
  'dun-chasm': "a chasm crossing as a small vignette: a narrow rough stone slab bridge with one wooden post and rope at each end, spanning a deep black gap between two broken rock ledges, the gap falling away to darkness",
  'dun-den': "a monster's den as a small vignette: a big untidy nest of straw, sticks and old bones on a rock floor holding three large speckled grey-green eggs (one cracked), deep claw gouges scored across a boulder beside it",
  'dun-shrine': "a forgotten dungeon shrine as a small vignette: a squat carved stone idol with a blank round face sitting in an arched niche cut into a rock wall, one fat lit candle and a small offering bowl on the ledge in front of it",
  'dun-flooded': "a flooded chamber as a small vignette: one square dressed-stone pillar standing in still dark grey-green water with a slimy darker tide band round its lower third, rings of ripples round its foot, a half-sunk barrel floating beside it, a strip of stone wall with a water stain line behind; the water is dull dark grey-green (never pink or purple)",
  'dun-dead-end': "a dead-end passage as a small vignette: a short stone corridor with a round arch that ends at once in a wall of fallen rubble, big broken blocks and boulders heaped to the top of the arch and blocking it completely, a snuffed torch in a bracket on the side wall, a few chips on the floor in front",
  'dun-collapsed': "a collapsed hall as a small vignette: a steep heap of big broken rock slabs and boulders with one snapped stone column lying across it in two drum pieces and a splintered timber beam sticking out, dust-pale chips scattered at its foot",
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM, key='magenta' if key in ('dun-sewer', 'dun-flooded') else 'green')

# ---- 2. seamless floors. Base first; variants get the finished base attached as colour anchor.
ROCK = ("a dungeon floor hewn out of living rock", "ONE continuous floor of dark grey-brown rock cut out of the living stone: NOT paving. There are NO slabs, NO blocks, NO tiles and NO joints or mortar lines anywhere. The surface is covered with short diagonal chisel and pick scores running in a few loose directions, broad uneven worn planes that meet in soft low ridges, and {what}. Cool, quiet and dark: grey-brown with a little cooler grey, low contrast, no strong highlights, because furniture and props stand on it and it must stay in the background. No moss, no puddles, no pebbles, no objects.")
RW = ['two or three thin natural cracks that wander across it', 'one long thin fissure and a patch of slightly smoother foot-worn rock', 'a few shallow pick pits and two short hairline cracks']
WATER = ("deep, still, dark flood water filling a dungeon chamber, seen from straight above", "Exception to the rule above: this swatch is a WATER SURFACE, not a floor. Still, murky, dark green-black flood water about two feet deep. The water is nearly opaque: over most of the square nothing of the bottom can be seen at all, only dark bottle-green water. Here and there, very faintly, the drowned floor shows through as a few vague, blurred, slightly paler ghost shapes of big flagstones with NO crisp joints and no stone texture (like stones seen through a pond). What you mainly see is the SURFACE: {what}; and broad, soft, pale grey-green patches of reflected light with smooth wavy edges, as on a pond. It must read at once as a POOL of standing water that a person would wade through, never as a wet or damp pavement. Colours: dark bottle green, green-black, pale grey-green; NO blue. Matte overall, no bright sparkles. (Roll 2: roll 1 read as wet paving because the stones were too clear.)")
WW = ['three or four sets of thin concentric ripple rings, ragged floating mats and streaks of pale green-grey scum, and ONE small brown floating leaf near the middle', 'long faint drifting ripple lines, thin streaks and one mat of pale scum, a few floating bits of straw and two small leaves']
FLAG = ("big worn dark dungeon flagstones", "Big, worn, dark dungeon flagstones: irregular rectangular slabs of dark slate-grey and grey-brown stone, mostly about 20 in by 28 in, laid in a loose bond with deep BLACK joints, corners chipped and edges rounded, a few darker damp patches spread evenly. Exception to the rule above: the slabs ARE the surface. {what} Cool, dark and quiet (props stand on it): no slab much lighter than the rest. No moss, no puddles, no writing.")
FW = ['ONE iron ring bolt in the square: a small square iron plate with a thick dark iron ring lying flat on it (the ring about 6 in across), bolted into the MIDDLE of a slab near the middle of the square, well away from every edge, with a little rust stain round it.', 'There is NO ironwork, no ring and no object of any kind: stone only.']
for base, (subj, det), whats in (('floor-cut-rock', ROCK, RW), ('floor-water-flooded', WATER, WW), ('floor-flagstone-dungeon', FLAG, FW)):
    for i, w in enumerate(whats):
        n = base if i == 0 else f'{base}--v{i + 1}'
        d = det.format(what=w)
        if i: d += f' This is variation {i + 1} of the floor in the SECOND attached image (our finished base tile): keep exactly its colours, darkness, scale and painting style, but paint a different arrangement.'
        J[n] = dict(kind='floor', subject=subj, detail=d, base=base if i else None)

# ---- 3. strips: opaque, painted edge to edge, repeat LEFT-RIGHT (finish_strips.py closes the left/right edges)
SQ = 'The square shows exactly one 5 ft x 5 ft floor tile, so keep everything at true scale for that area.'
CH = ("a bottomless chasm that runs from left to right across the tile",
      "A bottomless chasm running LEFT to RIGHT. {lips} Between the two lips is the DROP: just inside each lip the sheer rock wall of the chasm is seen from above, falling away steeply: lit grey-brown rock at the very top of the wall, with vertical cracks and small ledges, getting quickly darker and smaller the deeper it goes, until the broad middle band of the tile is pure BLACK emptiness; a few faint wisps of pale grey mist hang deep down in the black. It must read at once as a deep hole you would fall into, not as a dark stripe painted on the floor: the walls clearly go DOWN, the lips clearly overhang the dark, the darkness has depth. {var}")
CL = "The TOP {p} of the tile and the BOTTOM {p} of the tile are the two rock lips at floor level: flat dark grey-brown cut rock, chisel-scored, each ending toward the middle in a ragged, broken, crumbling edge with a thin pale highlight along the break."
J['chasm-strip--s1'] = dict(kind='strip', canvas='square', scale=SQ, repeat=REPEAT.format(what='chasm'), subject=CH[0], detail=CH[1].format(lips=CL.format(p='10%'), var='The broken edges are jagged in small bites only.'))
J['chasm-strip--s2'] = dict(kind='strip', canvas='square', scale=SQ, repeat=REPEAT.format(what='chasm'), subject=CH[0], detail=CH[1].format(lips=CL.format(p='10%'), var='Variation 2: the walls show two narrow stepped rock ledges on each side before the black, and the broken edges are a little more undercut.'))
J['chasm-strip-wide'] = dict(kind='strip', canvas='tall portrait (exactly twice as tall as wide, 1:2; if that shape is not possible use the tallest portrait shape you have)', scale='The canvas shows a strip of floor 5 ft wide (left to right) and 10 ft deep (top to bottom): two floor tiles, one above the other. Keep everything at true scale for that area.', repeat=REPEAT.format(what='wide chasm'), subject="a WIDE bottomless chasm that runs from left to right", detail=CH[1].format(lips=CL.format(p='5%'), var='This is the wide chasm: the black emptiness fills most of the height of the canvas; the walls under each lip take about a sixth of the height each.'))
SEW = ("a sewer channel that runs from left to right across the tile",
       "A sewer channel running LEFT to RIGHT. The TOP 10% of the tile and the BOTTOM 10% of the tile are the two kerbs at floor level: a single straight course of dressed grey stone kerb blocks with thin dark joints and a crisp straight inner edge, a dark slimy stain line along that edge. Between the kerbs, filling the middle 80%, is the channel: murky, opaque green-brown sewer water flowing left to right, with {what}. Just inside each kerb a narrow darker band shows where the channel wall drops into the water. The water is dull olive, brown-green and dark khaki: no blue, not bright. It must read at once as dirty water in a stone channel.")
J['sewer-channel-strip--s1'] = dict(kind='strip', canvas='square', scale=SQ, repeat=REPEAT.format(what='sewer channel'), subject=SEW[0], detail=SEW[1].format(what='long thin pale scum lines and streaks of froth drawn out along the flow, and a few small bits of drifting refuse (a scrap of rag, a couple of sticks), small and spread out'))
J['sewer-channel-strip--s2'] = dict(kind='strip', canvas='square', scale=SQ, repeat=REPEAT.format(what='sewer channel'), subject=SEW[0], detail=SEW[1].format(what='Variation 2: broad slow oily swirls drawn out along the flow, clumps of pale froth gathered against both kerbs, and no refuse'))
J['pit-open'] = dict(kind='strip', canvas='square', scale=SQ, repeat='This tile is laid alone in a stone floor. It is drawn square to the canvas (edges horizontal and vertical) and is the same on all four sides.', subject="an open square pit in a dungeon floor, seen from straight above",
                     detail="An open square pit trap. A rim of worn dark grey dressed stone runs all round the tile along all four edges of the canvas, about 8% of the tile wide, of big kerb stones with thin dark joints, touching the canvas edge on every side. Inside the rim is the square shaft: its four sheer stone-block walls are seen from above in one-point perspective, falling straight down and converging toward the centre, courses of masonry getting smaller and darker with depth, until the middle of the tile is pure BLACK. The inner edge of the rim has a thin pale highlight; the top course of the shaft walls is lit, everything below fades fast. It must read at once as a deep hole you would fall into, not a dark square painted on the floor. No spikes, no ladder, no objects.")

# ---- 4. keyed chroma-blue plates. Names that do not start with `decal-` are cropped to their box, not feathered.
TOP = ' Seen from exactly straight above, lying flat: no perspective, no floor painted under it, no cast shadow.'
def flat(sku, subject, detail, anchor2=None): J[sku] = dict(kind='decal', anchor2=anchor2, subject=subject, detail=detail + ' No blue and no purple anywhere on it. No text, no real letters of any alphabet. Show exactly this and nothing else.')
RUNES = ['a tall vertical stroke with two short slanting arms on its right side, like a jagged flag', 'a diamond standing on its point with two legs crossing below it', 'three zigzag strokes like a lightning bolt, with one short bar across the middle', 'two tall vertical strokes joined by one slanting bar, with a small triangle at the top of the left one']
for i, r in enumerate(RUNES, 1):
    flat(f'rune-tile--s{i}', 'a square stone floor tile carved with one big rune', f'ONE perfectly square floor tile of dark grey-brown dressed stone, 4.5 ft by 4.5 ft, drawn square to the canvas (edges horizontal and vertical), filling about 86% of the canvas, with straight edges, sharp square corners and a narrow worn bevel all round. Cut deep into its middle is ONE big, bold, angular rune made only of straight strokes, about half the width of the tile, inlaid with DULL, tarnished bronze (brown-gold, matte, no glow, no shine): {r}. It is an invented sign, not a letter of any real alphabet. A thin shallow carved border line runs round the tile a little in from the edge. The stone is worn, with a few chips and one hairline crack; cool and dark. The whole tile is ONE solid opaque square with no holes.' + TOP, 'ground')
flat('floor-mosaic--s1', 'a big round floor mosaic', "ONE big ROUND floor mosaic, a perfect circle 9 ft across filling about 90% of the canvas, made of small square stone tesserae in DULL, dusty colours: ochre, cream, grey-green, slate grey, a little muted burgundy. The design is a stylised star chart: a ring border of plain two-colour key pattern, inside it a dark slate-grey field with concentric thin cream circles and straight cream lines joining about a dozen small ochre star points of different sizes, and a small eight-pointed ochre sun at the centre. No animals, no figures, no lettering. Old and worn: three or four small patches where tesserae are missing show plain dark grey mortar bed (dark grey, NOT blue and not see-through). The disc is ONE solid opaque circle with a crisp round edge and no holes." + TOP, 'ground')
for i, d in enumerate(['a plain double ring with a ring of small simple angular marks (invented signs: short strokes, triangles, dots) between the two rings and an empty middle', 'a single thick ring crossed by a big seven-pointed star drawn with one continuous line, with a small dot at each point'], 1):
    flat(f'decal-glyph-warding--s{i}', 'a warding circle painted on a stone floor', f'A warding circle PAINTED on a floor in dull red-ochre paint (earthy brick red-brown, matte, never bright red), about 2 ft across, filling about 80% of the canvas: {d}. Hand-painted with a broad brush: lines of uneven width, a little worn and scuffed, a few dry-brush gaps and small drips. Paint only: the parts between the lines are EMPTY (the blue background shows there; that is correct for this asset). Variation {i}.' + TOP, 'ground')
for i, d in enumerate(['one main crack running roughly corner to corner with four or five side branches', 'a star of cracks spreading from one impact point a little off centre, with small chips of stone missing at the point'], 1):
    flat(f'decal-cracks--s{i}', 'cracks in a stone floor', f'Branching CRACKS in a stone floor, as a flat overlay about 4 ft across, filling about 80% of the canvas: {d}. Each crack is a dark charcoal-black ragged line, thick (two fingers wide) at the main break and tapering to hairlines at the ends, with a thin pale grey chipped edge along one side. Cracks only: the stone between them is NOT painted (the blue background shows between the cracks; that is correct). Bold enough to read from far away. Variation {i}.' + TOP, 'ground')
for i, d in enumerate(['about fifteen chips and small broken stones from thumb to fist size, loosely scattered, with pale grey stone dust between and round them', 'a looser, wider scatter of about ten fist-sized broken stone pieces and many small chips, with a fan of pale dust to one side'], 1):
    flat(f'decal-rubble-scatter--s{i}', 'a scatter of stone chips and dust on a floor', f'A small scatter of broken stone lying on a floor, about 3 ft across, filling about 75% of the canvas, with an irregular outline: {d}. Grey and grey-brown stone, the same colours as the floor in the second image, a shade paler. The dust is a soft pale grey film that thins out at the edges. ONE connected patch: the dust joins the stones, no blue shows between them. Variation {i}.' + TOP, 'ground')
for i, d in enumerate(['a thin, loose, roughly round scatter', 'a longer, thinner drift, thicker at one end'], 1):
    flat(f'decal-straw-scatter--s{i}', 'old straw strewn on a stone floor', f'Old dungeon straw strewn on a floor, about 4 ft across, filling about 80% of the canvas: {d} of dull, dirty yellow-brown and grey-tan straw stalks lying flat at all angles, matted and trodden, darker and damper in the middle, with single stalks straggling out at the edges. Drab and dull (NOT bright golden hay). The middle is dense enough that no background shows through it; only the straggling edge is loose. Variation {i}.' + TOP, 'ground')
for i, d in enumerate(['one irregular rounded blob with three or four smaller lobes and a couple of separate small drops beside it', 'a longer creeping patch with finger-like runners spreading from one side'], 1):
    flat(f'decal-slime--s{i}', 'a patch of green slime mold on a stone floor', f'A patch of SLIME mold on a floor, about 3 ft across, filling about 75% of the canvas: {d}. Thick, wet-looking dull green slime: sickly yellow-green in the middle, darker bottle green at the rim, with a few paler bubbles and a soft darker rim line. Smooth and glistening only a little (two or three small soft highlights, no hard gloss). It is ONE solid opaque shape with NO holes in it. Not grass, not moss, not leaves: smooth slime. Variation {i}.' + TOP, 'ground')
flat('decal-scorch--s1', 'a fan of soot scorched onto a stone floor', 'A SCORCH mark on a floor: a fan of black soot about 4 ft long, spreading from a narrow point at the BOTTOM centre of the canvas to a wide ragged end near the top (a cone of about 50 degrees), as left by a jet of flame. Dense matte charcoal black near the point, breaking up toward the wide end into streaks, feathery grey-brown smoke stains and a little pale grey ash. Soot only, completely matte: no flame, no glow, no orange, no stone painted. The dense part is solid; only the far end is streaky.' + TOP, 'ground')
flat('decal-claw-marks--s1', 'three deep claw gouges across a stone floor', 'CLAW MARKS on a floor: THREE long, roughly parallel gouges raked across stone by a huge claw, about 4 ft long, running diagonally across the canvas, filling about 80% of it. Each gouge is a deep dark charcoal groove, about two fingers wide, widest in the middle and tapering at both ends, slightly curved, with a pale grey chipped lip along both sides and a few stone chips and pale scratch dust beside it. Exactly three gouges, close together like one swipe of a paw. Gouges only: the stone between them is NOT painted (the blue background shows between them; that is correct).' + TOP, 'ground')
flat('decal-web-floor--s1', 'a thick sheet of giant spider web spread over a floor', 'A thick sheet of GIANT SPIDER WEB spread flat over a floor, about 5 ft across, filling about 88% of the canvas, with a ragged, roughly round outline pulled out into six or seven anchor points. Dense, layered, pale grey-white and cream silk: so thick in the middle that it is an opaque pale mat, with thick rope-like radial strands and heavy sagging cross strands drawn on top of it, and a few small dark husks of dead insects caught in it. Pale warm grey and cream only (never bluish). ONE solid opaque sheet: NO holes, the background must not show through anywhere inside the outline; only the outer edge is ragged. No spider.' + TOP, 'ground')
flat('decal-drag-marks--s1', 'the scrape track left by a heavy stone block dragged across a floor', 'A SCRAPE TRACK on a floor, left by a very heavy stone block pushed across it: a straight band 4.5 ft wide and about 5 ft long, running from the bottom of the canvas to the top, filling about 85% of the canvas. It is made of many straight, parallel pale grey scratch lines and a few deeper dark grooves, all running exactly in the direction of travel, densest along the two outer edges of the band (where the corners of the block dug in), with pale stone dust pushed up in a low ridge along both sides and a thicker heap of dust across the far end. Dull pale grey, grey-brown and charcoal: scratches and dust only, no block, no stone floor painted. The band is one connected patch of pale dust film with the scratches drawn on it.' + TOP, 'ground')

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
