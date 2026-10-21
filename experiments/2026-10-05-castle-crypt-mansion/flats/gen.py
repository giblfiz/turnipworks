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
# ---- 1. crypt floors (crypt/flats.json). Base first; v2..v4 get the finished base attached as colour anchor.
SLABS = ("dark, worn tomb paving", "Dark, worn tomb paving of big rectangular slate-grey and grey-green stone slabs laid in a loose running bond with thin dark joints, the slab edges rounded by centuries of feet, two or three slabs with a fine crack. Exception to the rule above: these slabs ARE the surface. Slabs are large: mostly about 20 in by 30 in, so only about three courses fit the height of the square. ONE slab in the square is a carved grave slab: slightly paler, about 22 in by 36 in, with a shallow carved border line and one simple emblem worn almost flat ({emblem}); it lies in the MIDDLE of the square, well away from every edge. NO letters, no writing, no runes. A little damp darkening and thin dark-green moss in some joints, spread evenly. It must read as old stone at table distance, not as a diagram of rectangles: soft tonal variation from slab to slab, but no slab much lighter or darker than the rest except the grave slab.")
EMB = ['a ring-cross (a plain cross inside a circle)', 'a sun-disc with short rays', 'a plain heater shield', 'a laurel wreath']
BONES = ("dark packed grave earth strewn with old bones", "Dark packed grave earth, grey-brown with paler dusty patches at a fine even scale, strewn SPARSELY with old bones pressed half into the soil and lying flat: {what}, scattered at random angles, never in rows or a regular pattern, none touching the edge of the square. Exception to the rule above: these bones ARE wanted, at true size (a thigh bone is about 17 in long, a skull about 8 in). Old ivory and tan bone, NOT white, partly dusted with earth so they sit IN the ground. The earth is the main read: at least four fifths of the square is plain earth, so that furniture can stand on it. No blood, no flesh, no cloth, no stones bigger than a thumb.")
BW = ['six or seven long bones, a few loose ribs, three vertebrae, one jawbone and ONE skull seen from above', 'five long bones, a short run of ribs, a few vertebrae and finger bones and ONE skull seen from above, lying on its side', 'seven long bones (two of them broken), a shoulder blade, a few ribs and ONE skull seen from above', 'six long bones, half a pelvis, loose ribs and vertebrae and ONE skull seen from above']
VAR = " The SECOND attached image is variation 1 of this same floor, already in the game: match its colours, contrast and painting scale EXACTLY; this is variation {i}: the same material, a different arrangement."
for i in range(1, 5):
    sfx = '' if i == 1 else f'--v{i}'
    J[f'floor-tomb-slabs{sfx}'] = dict(kind='floor', subject=SLABS[0], detail=SLABS[1].format(emblem=EMB[i - 1]) + (f' Variation 1.' if i == 1 else VAR.format(i=i)), base=None if i == 1 else 'floor-tomb-slabs')
    J[f'floor-bone-strewn{sfx}'] = dict(kind='floor', subject=BONES[0], detail=BONES[1].format(what=BW[i - 1]) + (f' Variation 1.' if i == 1 else VAR.format(i=i)), base=None if i == 1 else 'floor-bone-strewn')
# ---- crypt decals (chroma-blue plates)
for i, d in enumerate(['one skull lying tipped on its side at one END of the group (not in the middle), two long bones lying apart at different angles (they do NOT cross each other and do not pass behind the skull) and four or five loose ribs strewn unevenly; the group is lopsided and asymmetric, like remains kicked aside, NOT an arranged emblem, not a skull-and-crossbones, not a ring or nest of bones round the skull', 'a broken ribcage (a short run of ribs still on a piece of spine) and a pelvis', 'three long bones, a jawbone and a few small finger bones lying in a rough line'], 1):
    J[f'decal-bones-scatter--s{i}'] = dict(kind='decal', anchor2='ground', subject='a small loose scatter of old bones lying flat on a floor',
        detail=f'A small loose scatter of old bones: {d}. Old ivory and tan bone with brownish dusty shading, not white. The bones lie close together, most of them touching or overlapping, in a loose irregular group about 36 in by 30 in (true size: a thigh bone about 17 in long, a skull about 8 in), filling about two thirds of the canvas. Bones only: no ground, no dirt patch, no cloth, no blood. Variation {i}. Show exactly this and nothing else.')
for i, d in enumerate(['a long-stemmed ring-cross (a plain cross inside a circle, on a long plain stem) in the upper two thirds, and, clearly SEPARATE below the end of the stem with a gap between them, one small knightly heater shield (flat top edge, straight sides curving to a point at the bottom, with a plain diagonal band across it) near the foot of the slab; the shield must not look like a spade or shovel blade on the end of the stem', 'a sun-disc with short rays near the head, over a sword laid point-down along the middle'], 1):
    J[f'decal-grave-ledger--s{i}'] = dict(kind='decal', anchor2='slabs', subject='one carved grave ledger stone (a flat tomb slab set flush in a floor)',
        detail=f'ONE flat rectangular grave slab of pale grey stone, 3 ft wide and 7 ft long, drawn UPRIGHT (its long side vertical, exactly 3:7 proportions, straight square corners, filling about 85% of the canvas height). A carved raised border runs round it a hand-width in from the edge, and inside, carved in shallow worn relief: {d}. A thin dark joint line round the very edge of the slab. The stone is worn by feet, with soft tonal variation, a hairline crack and a little lichen; fully opaque. NO letters, no writing, no runes, no numbers. Variation {i}. Show exactly this slab and nothing else.')
for i, d in enumerate(['a LONG NARROW strip, about 60 in long and 12 in wide, running left to right, lying FLAT on the floor and seen from straight above (it grows along the foot of a wet wall): one long edge a little straighter, the other creeping outward in small rounded lobes and separate specks; nothing hangs, drips or trails downward, it is not a fringe hanging from a ledge', 'a CORNER FAN, as moss grows out of the corner of a room: a quarter-circle about 30 in in radius whose two straight sides meet at a right angle in the TOP-LEFT of the patch, the curved outer edge ragged and thinning', 'a ROUND irregular blotch about 30 in across with a ragged lobed outline'], 1):
    J[f'decal-moss--s{i}'] = dict(kind='decal', anchor2='ground', subject='a patch of moss and lichen growing flat on a damp stone floor',
        detail=f'An irregular patch of dark green MOSS and a few paler grey-green LICHEN stains, and round its edge a thin fringe of damp, darker grey-brown stain on the stone: {d}. The moss is a low, flat, velvety mat, like dark green felt or velvet with a soft lumpy surface: NO individual leaves, no blades, no stems, no rosettes, no plants, nothing that looks like a bush, clover or foliage. The lichen is three or four FLAT, crusty, irregular pale grey-green stains (like dried paint splashes) beside and overlapping the moss; they are NOT dots, not round blossoms, not white, and must not look like flowers. The moss is thickest in the middle and breaks up into small separate flat specks at the ragged edges. Dull, dark, muted greens (no bright or yellow-green, no blue-green, no white). No stones, no leaves, no flowers, no mushrooms, no soil. Variation {i}. Show exactly this patch and nothing else.')
J['rite-altar-cloth'] = dict(kind='decal', anchor2=None, subject='an altar cloth laid out flat',
    detail='ONE rectangular altar cloth, 6 ft wide and 3 ft deep, drawn with its long side horizontal: a WIDE band exactly TWICE as wide as it is tall (2:1; on the square canvas it is about 85% of the canvas wide and only about 42% of the canvas tall, with a broad band of plain blue background above it and below it), straight edges, square corners. Cream linen with a broad embroidered border in muted burgundy and dull gold running all the way round, and ONE gold sun-disc with short rays embroidered in the very middle. A few soft fold lines (it has been kept folded). All four edges are plain, straight, hemmed edges: NO fringe, no tassels, no loose threads. No blue anywhere. No crosses or real-world religious symbols, no letters. Nothing on it and no table under it. Show exactly this cloth and nothing else.')
# ---- 2. crypt room icons (crypt/rooms.json). type-CRY already exists in the set (2026-10-03) and is copied, not re-made.
NOSYM = '; no crosses or real-world religious symbols'
for key, s in {
  'crypt-antechamber': 'a cutaway corner of a crypt antechamber: a stone statue of a robed mourning figure with bowed, hooded head on a plinth against the wall, an iron fire bowl on a stand at each side of it, a stone bench',
  'crypt-vault': 'a cutaway corner of a burial vault: a big stone sarcophagus with a carved lid in the middle of the floor, a tall iron candle stand with a lit candle at its corner, an arched burial niche in the wall behind',
  'crypt-ossuary': 'a cutaway corner of an ossuary: stone walls faced with neat rows of stacked skulls and bones in arched recesses, a small heap of skulls on the floor',
  'crypt-catacomb': 'a cutaway length of a narrow catacomb corridor: both stone walls lined with rows of dark rectangular burial niches, a burning wall torch between them, a stone coffin pushed against one wall',
  'crypt-chapel': 'a cutaway corner of a small funeral chapel: a stone altar with a cream and burgundy cloth and two lit candles against the wall, two plain stone benches in a row facing it',
  'crypt-embalming': 'a cutaway corner of an embalming room: a heavy stone slab table with a folded linen shroud on it, a wooden tub of white salt beside it, a wall shelf of clay jars and bottles',
  'crypt-relic': 'a cutaway corner of a relic chamber: a small golden reliquary casket on a stone pedestal, an iron fire bowl on a stand at each side, an open chest of gold coins against the wall',
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM)
# ---- 3. roof surfaces (vertical/flats.json): subject and detail straight from the designer's prompt_detail
for f in json.load(open(os.path.join(B, 'vertical', 'flats.json')))['flats']:
    J[f['id']] = dict(kind='roof', subject=f"{f['id']} ({f['description'].split(',')[0].split(' seen flat')[0].lower()})", detail=f['prompt_detail'])

# ======================= STAGE 2 (castle, mansion) =======================
NOEX = ' Variation 1.'
def floor4(sku, subject, detail, per_var=None):
    """base + --v2..v4; variants get the finished base attached as colour anchor. per_var: 4 texts for {what}."""
    for i in range(1, 5):
        d = detail.format(what=per_var[i - 1]) if per_var else detail
        J[sku + ('' if i == 1 else f'--v{i}')] = dict(kind='floor', subject=subject, detail=d + (NOEX if i == 1 else VAR.format(i=i)), base=None if i == 1 else sku)
# ---- castle floors
floor4('floor-flagstone-rushes', 'hall flagstones strewn with rushes',
       'Big worn rectangular hall flagstones (each roughly 18 to 28 in) in warm grey and blue-grey with thin dark joints, strewn with a LOOSE, CRISS-CROSSING LAYER of fresh green-gold rushes (several hundred long thin straw-like stalks, each 10 to 20 in long) and a few small sprigs of herbs, lying flat in all directions, overlapping one another, spread over the whole square with no heap and no bare zone: the rushes hide about HALF of the floor and the flagstones and their joints show through between them over the other half. This is a rush-strewn hall floor, not a clean floor with a few straws on it. Exception to the rule above: the flagstones and the rushes ARE the surface. No rush mat, no woven pattern, no flowers.')
floor4('floor-setts-courtyard', 'a castle courtyard paved with big granite setts',
       'Big, rounded, worn granite setts, each about 8 in across (so about seven or eight setts along each side of the square), laid in slightly wavering horizontal rows, in blue-grey and warm grey with a few ochre ones spread evenly, with dark muddy joints, a little trodden straw in some joints and a wisp of moss here and there. Exception to the rule above: these setts ARE the surface. Matte and dry: no puddles, no reflections, no missing setts, no large weeds.')
floor4('floor-sand-training', 'training-ground sand',
       'Pale ochre training-ground sand mixed with a little trampled earth, softly raked in broad curved strokes and scuffed all over with shallow, soft, overlapping footprints (no crisp shoe shapes) and a few slightly darker damp patches no bigger than a hand, spread evenly. Low contrast and even: no landmark, no stones, no straw, no lines.')
# ---- mansion floors. The three patterned ones are painted as an exact lattice whose joints lie on the canvas edges and
# centre lines; finish.py then crops to whole pattern periods, so they tile exactly on the 5-ft cell.
GRIDRULE = ' This is an exact, regular, machine-straight pattern drawn perfectly square to the canvas: every line is exactly horizontal or vertical (or exactly 45 degrees where said), all units are identical in size, and the pattern is cut by the canvas edges exactly on its joint lines, so the square tiles seamlessly. Exception to the rule above: this laid pattern IS the surface.'
floor4('floor-marble-cabochon', 'a polished pale marble floor with small dark inset squares',
       'Big SQUARE slabs of creamy white marble with soft grey and ochre veining, each slab 30 in: EXACTLY four slabs fill the square, in a 2 x 2 grid, with thin joints that run exactly along the vertical and horizontal centre lines of the canvas and along its four edges. Each slab has its four corners clipped, and at every crossing of the joints sits ONE small dark moss-green marble square, about 5 in, set square (not turned as a diamond): one in the very centre of the canvas, a half one in the middle of each edge and a quarter one in each corner of the canvas. Gentle wear, soft and matte: no gloss highlights, no reflections, no blue. Veining is soft and low-contrast and different in each slab; no slab is much lighter or darker than the others.' + GRIDRULE)
floor4('floor-parquet-versailles', 'a palace panel-parquet floor (Versailles pattern)',
       'Panel parquet: EXACTLY four identical square panels fill the square, in a 2 x 2 grid, each panel 30 in. Each panel is a frame of straight honey-oak boards (about 4 in wide) holding a DIAGONAL lattice (at 45 degrees) of interlaced darker walnut strips with small square honey-oak blocks between them: the classic palace parquet panel. The panel frames meet along the vertical and horizontal centre lines of the canvas and along its four edges (so half a frame board lies along each canvas edge). Polished wood but painted matte: warm honey and brown, slight tone variation between blocks, fine painted grain; no gloss, no reflections, no knots that stand out, no gaps.' + GRIDRULE)
floor4('floor-tile-encaustic', 'a floor of small patterned clay tiles (encaustic tiles)',
       'Small patterned clay tiles in terracotta red, cream, ochre and black, laid as a repeating geometric carpet: EXACTLY five by five identical pattern squares fill the canvas, each pattern square 12 in (made of four 6-in tiles) and holding one eight-pointed star inside a square border, with a little four-lobed quatrefoil at every crossing where four pattern squares meet (so quarter quatrefoils in the canvas corners and half ones along the edges). Thin dark joints. Matte, slightly worn, a few single tiles a shade darker, spread evenly. No blue, no green.' + GRIDRULE)
floor4('floor-lawn-mown', 'a close-mown formal lawn',
       'A close-mown formal lawn: very short, dense, even grass in a rich but soft green, painted as fine short strokes all lying roughly the same way (up the image), at a fine even scale, perfectly even in tone from edge to edge: NO mowing stripes, no bands (they are added afterwards), no flowers, no clover, no bare patches, no yellow tufts, no leaves, no path. Painted texture, not photographic.')
# ---- room icons: castle (rooms.json reads_by) and mansion (reads_as). type-CAS and type-NOB exist in the set and are copied.
for key, s in {
  'great-hall': "a cutaway corner of a castle great hall: a huge hooded stone fireplace on the wall, a long feast table with benches, a banner hanging on the stone wall",
  'throne-room': "a cutaway corner of a throne room: a tall-backed throne on a stepped stone dais with a burgundy carpet runner leading up to it, a stone pillar and a standing iron fire bowl beside it",
  'armoury': "a cutaway corner of a castle armoury: a wooden rack of spears and swords against the stone wall, a suit of plate armour on a stand, a round shield hung on the wall",
  'barracks': "a cutaway corner of a castle barracks: two wooden bunk beds in a row, each with a footlocker chest at its foot, a helmet and a shield hung on the stone wall",
  'castle-kitchen': "a cutaway corner of a castle kitchen: a very wide stone cooking hearth with a roast on a spit over the fire, a big iron cauldron hanging from a swinging crane, a domed bread oven",
  'chapel': "a cutaway corner of a small castle chapel: a stone altar on a step with two tall candle stands, two wooden pews facing it, one tall arched stained-glass window of plain coloured panes",
  'dungeon': "a cutaway corner of a castle dungeon: a barred cell with an iron-bar front and barred door and a plank bed inside, wall manacles on a chain, a brazier of glowing irons",
  'gatehouse': "a cutaway castle gatehouse passage: a stone arch with a half-raised iron portcullis, a wooden windlass winch with its chain beside it, a spear leaning on the wall",
  'courtyard': "a castle courtyard seen as a small vignette: a patch of grey cobbles inside a low battlemented stone wall with one corner turret, a round stone well, a straw training dummy on a post and a round archery target",
  'mansion-hall': "a cutaway corner of a mansion entrance hall: a grand staircase with a curved polished banister and a burgundy stair carpet, a pale marble floor with small dark squares, a tall gilt mirror above a console table",
  'mansion-drawing': "a cutaway corner of a mansion drawing room: a white marble fireplace with a tall gilt mirror above it, a burgundy upholstered sofa and an armchair on a big patterned carpet, a low table",
  'mansion-dining': "a cutaway corner of a mansion dining room: one long polished table with a white cloth, a silver candelabra and a row of high-backed chairs, dark oak panelled walls, a sideboard with silver",
  'mansion-library': "a cutaway corner of a mansion library: tall bookcases full of books lining the walls with a ladder leaning on them, a big desk with a green top, a floor globe on a stand",
  'mansion-bedroom': "a cutaway corner of a mansion master bedroom: a grand four-poster state bed with a carved canopy and moss-green curtains, a bedside cabinet with a candle, an upholstered bench at its foot",
  'mansion-ballroom': "a cutaway corner of a mansion ballroom: a wide empty polished patterned dance floor under a big crystal chandelier, a row of small gilt chairs along the wall, a tall gilt mirror, a harpsichord at the end",
  'mansion-conservatory': "a cutaway corner of a mansion conservatory: tall glazed walls of white glazing bars on a low brick plinth, a big potted palm, a stepped stand of flowerpots, a wicker chair on patterned tiles; the glass panes are pale cream, not blue",
  'mansion-garden': "a formal garden seen as a small vignette: a square of striped lawn inside a low clipped hedge, a tiered stone fountain in the middle where two pale gravel walks cross, a cone-shaped topiary at each corner; the fountain water is pale grey-green, not blue",
  'mansion-kitchen': "a cutaway corner of a great house's servants' kitchen: an iron cooking range in a plastered wall, a row of copper pans hanging above it, a row of small brass call bells high on the wall, a scrubbed table with a silver serving dome",
  'mansion-cellar': "a cutaway corner of a wine cellar: brick-arched wine bins full of dark bottles lying on their sides along the stone wall, one very big wooden wine barrel on a cradle, a small table with a decanter and two goblets",
}.items():
    J[f'room-{key}'] = dict(kind='icon', subject=s + NOSYM + '; no blue', key='magenta' if key in ('courtyard', 'mansion-garden', 'mansion-conservatory', 'mansion-bedroom') else 'green')
# ---- remaining castle and mansion flats (keyed chroma-blue plates in decals/)
CARD = ' Seen exactly square-on from the front, flat like a scan: no perspective, no wall behind it, no cast shadow, no room.'
TOP = ' Seen from exactly straight above, lying flat: no perspective, no floor painted under it, no cast shadow.'
def flat(sku, subject, detail, anchor2=None): J[sku] = dict(kind='decal', anchor2=anchor2, subject=subject, detail=detail + ' No blue and no purple anywhere on it. No text, no letters. Show exactly this and nothing else.')
BAN = 'ONE long heraldic wall banner of heavy cloth hanging from a short horizontal wooden rod at its top, 30 in wide and 72 in tall (drawn upright, exactly 5:12 proportions, filling about 85% of the canvas height, with broad blue background to its left and right). {d} Plain flat colour fields only: NO emblem, no animal, no crest, no symbol. Soft vertical fold shading.' + CARD
flat('banner-wall--s1', 'a heraldic wall banner seen flat from the front', BAN.format(d='Swallow-tailed at the bottom (a deep V notch cut up into the lower edge, leaving two points). Burgundy, with ONE broad cream vertical stripe down the middle, and a gold fringe along the lower edges.'))
flat('banner-wall--s2', 'a heraldic wall banner seen flat from the front', BAN.format(d='The bottom ends in ONE central point (like a shield). Quartered: the field is divided into four quarters, moss green top-left and bottom-right, ochre top-right and bottom-left. A gold fringe along the lower edges.'))
flat('banner-wall--s3', 'a heraldic wall banner seen flat from the front', BAN.format(d='A straight, level bottom edge with a fringe. Cream, with ONE broad burgundy chevron (an upside-down V band) across the middle and a burgundy border all round.'))
TAP = 'ONE large woven wall tapestry hanging from a thick horizontal wooden rod along its top, 96 in wide and 72 in tall (landscape, exactly 4:3 proportions, filling about 88% of the canvas width, with blue background above and below). {d} Woven look: flat colours, soft matte wool texture, no gloss. NO figures, no people, no faces, no animals, no birds.' + CARD
flat('tapestry--s1', 'a large woven hall tapestry seen flat from the front', TAP.format(d='A formal pattern: one stylised tree with big leaves and round fruit in the middle, inside a wide border of interlaced knotwork, in burgundy, moss green, ochre and cream. A straight lower edge.'))
flat('tapestry--s2', 'a large woven hall tapestry seen flat from the front', TAP.format(d='A mille-fleurs field of many small chunky flowers on dark green, with three plain heater shields in a row across the middle (one burgundy, one cream, one ochre; plain, with NO emblems on them) and a striped border. A straight lower edge.'))
# the mansion's two tapestries: castle/flats.json already took tapestry--s1 and --s2, so these are --s3 and --s4
flat('tapestry--s3', 'a large woven verdure tapestry seen flat from the front', TAP.format(d="A 'verdure': a dense field of moss-green foliage with big curling leaves and ochre and red flowers, inside a wide burgundy border of fruit swags. A fringed lower edge."))
flat('tapestry--s4', 'a large woven garden tapestry seen flat from the front', TAP.format(d='A formal garden scene with nobody in it: a stone fountain in the middle, clipped cone-shaped trees and stone urns in rows, in ochre, moss green and cream, the sky cream, inside a narrow ochre border. A fringed lower edge.'))
flat('rug-runner--royal', 'a length of rich carpet runner', 'ONE straight length of carpet runner, 36 in wide and 160 in long, drawn with its long side HORIZONTAL as a wide low band (about 92% of the canvas wide and about 21% of the canvas tall; proportions 40:9), with broad blue background above and below. A rich plain burgundy field with ONE narrow ochre-gold border line running along each long side, a little in from the edge. The two short ends are cut perfectly straight and square with NO fringe, no tassels and no end border, so that lengths can be laid end to end as one continuous runner; the gold lines run right off both ends. No pattern in the field, only soft pile shading.' + TOP)
flat('rug-fur', 'an animal-skin fur rug', 'ONE big shaggy grey-brown animal-skin rug, 48 in wide and 72 in long (drawn upright, filling about 85% of the canvas height): an irregular hide outline with four short leg flaps at the corners, NO head, no tail, no claws, no face; thick fur painted in broad soft strokes lying outward from a slightly darker stripe down the middle.' + TOP)
for i, d in enumerate(['an irregular pool-shaped stain with a few small round drips beside it', 'a longer dragged smear, wider at one end, with a few spots trailing off; the smear is ONE solid, filled shape with NO holes, gaps or windows in it (the background must not show through anywhere inside it)'], 1):
    flat(f'decal-blood--s{i}', 'an old dried stain soaked into a stone floor', f'An OLD, DRIED, dark brown-red stain soaked into stone, about 24 in across: {d}. Soft, feathery edges that thin out; darker round the rim than in the middle; perfectly matte and dull: not bright red, not wet, no gloss, no highlights. Flat stain only: no stone painted, no objects. Variation {i}.' + TOP, 'ground')
flat('floor-drain-grate', 'a square iron floor drain', 'ONE square iron drain grate, about 16 in square, of SIX thick parallel dark iron bars, set in a square frame of four worn grey stone slabs so the whole piece is about 24 in square; between the bars it is black and wet-looking; a darker damp stain spreads irregularly a little beyond the stone frame on one side. The piece is drawn square to the canvas (edges horizontal and vertical), filling about 70% of it.' + TOP, 'ground')
PAINT = 'ONE framed oil painting: a chunky carved GILT (dull gold) frame round a canvas, landscape format about 36 in wide and 30 in tall (6:5 proportions, filling about 85% of the canvas width). The picture: {d}. Painted in the same broad, soft, hand-painted game style as the frame (not photographic). NO people, no faces, no portraits, no animals.' + CARD
flat('painting-still-life--s1', 'a framed still-life painting seen flat from the front', PAINT.format(d='on a dark warm-brown background, a heap of fruit (apples, pears, grapes), a silver jug and a cut pie on a draped table'))
flat('painting-still-life--s2', 'a framed still-life painting seen flat from the front', PAINT.format(d='on a dark warm-brown background, a big vase of red, cream and ochre flowers on a table'))
flat('tablecloth-white', 'a white damask tablecloth laid out flat', 'ONE long rectangular tablecloth, 4 ft wide and 12 ft long, drawn with its long side HORIZONTAL as a wide low band (exactly 3:1; about 90% of the canvas wide and about 30% of the canvas tall, with broad blue background above and below). Cream-white damask with a faint woven leaf pattern only a shade darker than the cloth, crisp ironed fold lines forming a regular grid of rectangles, and a narrow hem. Straight edges, square corners, NO fringe, no lace. Nothing on it, no table under it. The cloth is warm cream-white with warm grey shading (never bluish).' + TOP)
flat('table-runner-embroidered', 'a long narrow embroidered table runner', 'ONE long, narrow table runner, 16 in wide and 10 ft long, drawn with its long side HORIZONTAL as a thin band (about 92% of the canvas wide and only about 12% of the canvas tall; proportions 15:2), with very broad blue background above and below. Burgundy silk with ONE ochre embroidered vine with small leaves running down its whole length and a narrow ochre edge line; each of the two short ends comes to a point with ONE ochre tassel hanging from the tip. Nothing on it, no table under it.' + TOP)

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
