#!/usr/bin/env python3
"""Flat-roof surface textures (2026-10-27, branch roofs-flat). Method and request loop copied from
experiments/2026-10-11-types/dun/flats/gen.py (FLOOR frame, re-worded for a roof surface). FREE route only: Codex's
built-in image tool (`codex exec`, ChatGPT login), ONE request at a time, 20 s pause between requests.
On a usage / rate limit: writes QUOTA_STOP.txt with the exact text and stops.
    python3 gen.py name,name,...  |  python3 gen.py list  |  python3 gen.py show NAME
    a re-roll: python3 gen.py NAME --roll2 "extra instruction"   (moves the old input to raw/rolls/ first)
Outputs: inputs/roof-flat--<S>.jpg (1024, opaque; finish.py makes seamless/<S>.png). Every request -> requests.log.
Provenance: text prompts plus our own images only (the house style reference; our own dressed-stone wall plate)."""
import os, sys, subprocess, time, shutil, tempfile, re
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
MAIN = '<repo>'       # main tree, READ ONLY (images are not in git)
STYLE_ANCHOR = os.path.join(MAIN, 'style-references/heroic-handpainted-tavern-v1.png')
CASTLE_STONE = os.path.join(MAIN, 'experiments/2026-10-01-walls/inputs/wall-straight--dressed-stone--s2.jpg')
PAUSE = 20
LIMIT = re.compile(r"usage limit|rate limit|rate_limit|quota|too many requests|\b429\b|try again (in|at)|limit reached|hit your .*limit", re.I)

ROOF = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted miniature game art), paint a FLAT ROOF surface material swatch: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, bold visible brushwork, chunky low-frequency surface detail, matte, softened natural colours, bold enough to read from a tabletop camera 40 ft away. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, logos and emblems.

Presentation: a perfectly top-down orthographic view looking straight down at the roof surface. The surface fills the ENTIRE square canvas edge to edge: no border, no frame, no parapet, no roof edge, no background colour, no vignette, no perspective, no cast shadows, no objects lying on it. Even, flat, shadowless lighting (no sun direction and no cast shadows; soft painted edge highlights on raised shapes are wanted). The square shows a {ft} ft x {ft} ft patch of roof, so keep elements at true scale for that area. It must tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the AVERAGE tone even from one side of the square to the other (no single big light or dark blotch), so that a grid of these squares does not show.

Specific design: {detail}
{anchor2}Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
A2_STONE = "The SECOND attached image is our castle's dressed-stone wall kit: use it ONLY for the colour, tone and tooling of the stone so the roof matches the castle; do NOT paint a wall, a wall face or any background from it.\n"

J = {
 'deck': ("an outdoor weathered timber plank ROOF DECK",
   "Straight timber planks about 7 to 8 in wide, so EIGHT planks side by side across the square, all running straight from the TOP edge to the BOTTOM edge (vertical in the picture), parallel and of equal width. Between the planks are dark tarred, caulked seams: a narrow, even, near-black pitch line. A few staggered butt joints where one plank ends and the next begins, each a short dark tarred cross-seam with a pair of nail heads on each side; and two straight rows of small dark nail heads running across the square where the planks are nailed to the joists. The wood is sun- and rain-weathered: silvery grey-brown, driftwood grey with warmer brown undertones, dry raised grain, a few faint water stains and pitch smears beside the seams. It is an outdoor roof deck exposed to the weather, NOT a polished indoor floor: no varnish, no warm honey colour, no shine.", None),
 'flagstone': ("a castle roof and wall-walk paved with large dressed grey stone slabs",
   "Big rectangular slabs of grey dressed (squared, tooled) stone, each about 2 ft by 2.5 ft, so about two to two-and-a-half slabs across the square, laid in straight staggered courses with neat mortared joints: a narrow, slightly recessed pale grey-buff mortar line. Cool-to-warm mid grey stone with gentle variation from slab to slab, finely tooled faces, a few chipped corners, faint rain stains, and a few small patches of pale grey-green and ochre crusty lichen near some joints. Quiet and mid-toned: no slab much lighter or darker than the rest. No moss carpet, no puddles, no drains, no writing.", 'stone'),
 'lead': ("a LEAD-SHEET roof, as on the flat roofs of churches and castles",
   "Dull, matte blue-grey lead sheets with soft, slightly wavy dressed surfaces. Every 2.5 ft there is a raised wooden ROLL seam: a round-topped ridge about 2 in wide where two sheets are dressed over a timber roll, running straight from the TOP edge to the BOTTOM edge (vertical in the picture). So exactly TWO rolls in the square, at one quarter and three quarters of the width, parallel and evenly spaced, each a slightly lighter grey rounded ridge with a soft darker line along each side. A few faint horizontal laps across the sheets where one sheet overlaps the next, irregularly spaced. White and pale grey OXIDISED PATINA: soft chalky white streaks and blooms running along the sheets, a little more along the rolls. Colours: dull blue-grey, dove grey, slate grey, chalk white. Matte, no metallic shine.", None),
 'turf': ("a SOD / TURF roof, a living earth roof as on Norse and highland cottages",
   "A thick mat of short, rough, unmown grass and cushions of moss growing over earth sod: tufts of short grass in several greens (olive, yellow-green, darker moss green), soft rounded cushions of moss, a few small bare patches where dark brown earth shows through, a sprinkle of tiny white clover flowers and a few tiny yellow and pink wildflower specks spread evenly. Slightly lumpy and uneven, with the faint soft furrows of the laid sod squares (about 1.5 ft across) just visible under the grass. It must read as a rough, wild turf roof: NOT a tidy lawn, NOT a garden: no paths, no stones, no mowing stripes, no flowerbeds.", None),
 'plaster': ("a whitewashed lime-plaster / adobe FLAT ROOF of a desert house",
   "Warm off-white limewash (cream, bone, very pale ochre) over a smooth plastered mud roof: broad soft trowel marks in overlapping curved sweeps, a few fine hairline cracks wandering across it, a light film of pale tan dust settled in places, and three or four small worn patches where the whitewash has flaked away to show the warm ochre-brown straw-and-mud plaster beneath with tiny flecks of straw. Low contrast, warm and sun-bleached. No tiles, no joints, no drains, no objects.", None),
}

# ---- v2 (2026-10-28): the parent's in-game Gemini read judged lead / turf / plaster BAD (industrial ribbed metal;
# high-frequency procedural noise; featureless sand placeholder). Rewritten for big chunky low-frequency brushwork, with
# a second anchor = one of OUR textures that reads well in the game, used ONLY for the scale of its brushwork.
THATCH = os.path.join(MAIN, 'experiments/2026-10-05-castle-crypt-mansion/flats/seamless/roofing-thatch.png')
FLAGSTONE = os.path.join(HERE, 'seamless', 'roof-flat--flagstone.png')
A2_BRUSH = "The SECOND attached image is another of our roof textures that reads well in the game: copy ONLY the SIZE and boldness of its brush strokes and its chunky, low-frequency painted shapes; do NOT copy its material, colours or pattern.\n"
BIG = " Paint with BIG, chunky, confident brush strokes: the surface is built from a few dozen large painted shapes per square, each with a soft painted light edge and a darker painted core, with plenty of slow low-frequency tonal variation; NO fine noise, NO speckle, NO pixel-scale texture, nothing photographic."
J['lead'] = ("a MEDIEVAL LEAD roof, as on the flat roof of a castle tower or old church",
   "Broad, soft-edged, dull WARM-GREY lead sheets (pewter grey, dove grey with a hint of warm brown-grey; NOT blue, NOT steel), each sheet a big, slightly lumpy hand-beaten panel. Every 2.5 ft the sheets are dressed over a low rounded wooden roll, drawn as a SOFT, broad, gently rounded painted BUMP about 3 in wide running from the TOP edge to the BOTTOM edge (vertical in the picture): exactly TWO rolls in the square, at one quarter and three quarters of the width, each with a soft pale painted highlight down its middle and soft shading either side; NOT a sharp rib, NOT a crisp line. A couple of soft, slightly wavy horizontal laps where one sheet overlaps the next. The sheets are mottled with big soft blooms of chalky white and pale patina and darker grey weathering stains, and the soft dents and creases of old lead. Completely matte, no metallic sheen. Nothing may read as corrugated, ribbed, standing-seam or modern industrial sheet metal: this is soft old medieval lead." + BIG, 'brush-flag')
J['turf'] = ("a SOD / TURF roof, a living earth roof as on Norse and highland cottages",
   "Chunky hand-painted CLUMPS and TUFTS: the square is covered with about twenty to thirty big rounded clumps of grass and cushions of moss, each clump about 6 to 12 in across, painted with a few bold strokes (a darker olive core, lighter yellow-green tips on top), in several greens (olive, sage, yellow-green, deep moss green); between the clumps a few dark brown bare-earth patches where the sod shows, and small dabs of white clover and yellow and pink wildflowers (one dab per flower, about a dozen dabs in all, spread evenly). Lumpy and uneven like a wild roof: NOT a lawn, NO individual grass blades, NO paths, NO stones, NO mowing stripes." + BIG, 'brush-thatch')
J['plaster'] = ("a sun-baked, whitewashed MUD-PLASTER FLAT ROOF of a desert house",
   "Warm whitewash (cream, bone, pale ochre-white) over a mud-plaster roof, clearly hand-made: big, clearly visible curved TROWEL SWEEPS overlapping across the whole square, each sweep a broad painted arc with a soft pale highlight on its raised edge and a slightly darker trailing edge; three or four thin painted cracks; and two or three medium patches where the whitewash has worn through to warm ochre and sienna MUD with a few painted straw flecks, each patch with a painted pale chipped rim, spread out and of different shapes. Strong tonal variation from bright sun-bleached white to warm dusty buff in the low places. It must read at once as the flat roof of an adobe house: NOT sand, NOT a beach, NOT a blank surface." + BIG, 'brush-flag')

# ---- v3 (2026-10-28): the engine now maps lead at 10 ft and turf / plaster at 15 ft per picture (ROOF_STYLES[s].ft).
# Lead and plaster are painted FOR that scale; turf v1 at 15 ft was judged acceptable in the game and is kept.
FT = {'lead': 10, 'plaster': 15}
J['lead'] = ("an old cathedral or castle LEAD flat roof",
   "NO raised rolls, NO ribs, NO battens, nothing linear, no parallel stripes. Large, irregular, overlapping lead SHEETS, each about 3 ft by 5 ft (so roughly two to three sheets across the square), laid like big flat shingles in a loose, irregular overlap: each sheet a soft, slightly lumpy hand-beaten panel whose lower edge is a soft lapped edge (a soft pale lip with a soft darker band under it), sheets of different sizes and slightly different angles, a few dressed-over seams where one sheet is folded over the next. Colour: PALE COOL GREY lead (dove grey, pale pewter, a little blue-grey) with HEAVY white and chalky pale patina streaks and blooms running across the sheets, and darker grey weathering stains in the laps. Completely matte. It must read as an old medieval lead roof, never as corrugated, ribbed, standing-seam or modern sheet metal." + BIG, 'brush-flag')
J['plaster'] = ("the whitewashed lime-plaster FLAT ROOF of a desert house, seen from above",
   "Warm whitewashed lime plaster (cream, bone white, pale warm ochre-white). The structure is BIG and low-frequency: about eight to twelve large overlapping curved TROWEL SWEEPS, each 3 to 6 ft long, with soft pale raised ridges and warmer shadowed trailing edges; three or four LONG thin wandering cracks, each several feet long; two or three darker PATCHED REPAIRS, each an irregular patch 1.5 to 3 ft across of fresher, slightly greyer or warmer plaster with a soft raised rim; and ONE shallow DRAIN GUTTER: a straight, shallow, slightly darker channel about 6 in wide with soft rounded lips, running perfectly horizontally from the LEFT edge to the RIGHT edge across the middle of the square. Faint broad brush texture of limewash over everything, and soft warm dust in the low places. Clear tonal variation between bright sun-bleached white and warm buff. It must read at once as the flat roof of a desert house: NOT sand, NOT a blank surface, NOT fabric or weaving." + BIG, 'brush-flag')

def out_path(name): return os.path.join(HERE, 'inputs', f'roof-flat--{name}.jpg')

def build(name, extra=''):
    subj, det, a2 = J[name]; imgs = [STYLE_ANCHOR]
    if a2 == 'stone': imgs.append(CASTLE_STONE)
    if a2 == 'brush-thatch': imgs.append(THATCH)
    if a2 == 'brush-flag': imgs.append(FLAGSTONE)
    if extra: det += ' ' + extra
    a2t = A2_STONE if a2 == 'stone' else A2_BRUSH if a2 and a2.startswith('brush') else ''
    return ROOF.format(subject=subj, detail=det, anchor2=a2t, name=name, ft=FT.get(name, 5)), imgs

def gen(name, extra=''):
    out = out_path(name)
    if os.path.exists(out): return 'exists'
    prompt, imgs = build(name, extra)
    tag = name + ('.roll' + str(len([f for f in os.listdir(os.path.join(HERE, 'raw', 'rolls')) if f.startswith(f'roof-flat--{name}.')]) + 1) if extra else '')
    open(os.path.join(HERE, 'raw', 'prompts-v2', f'{tag}.gen.txt'), 'w').write(prompt + '\n\n[attached: ' + ', '.join(imgs) + ']\n')
    wd = tempfile.mkdtemp(prefix=f'roofflat-{name}-')
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write']
    for i in imgs: cmd += ['-i', i]
    cmd += ['-']
    t0 = time.time()
    for attempt in range(2):
        open(os.path.join(HERE, 'requests.log'), 'a').write(f'{time.strftime("%F %T")} {tag} attempt {attempt + 1}\n')
        try: r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900); txt = r.stdout[-6000:] + '\n' + r.stderr[-4000:]
        except subprocess.TimeoutExpired: txt = 'TIMEOUT 900s'
        open(os.path.join(HERE, 'raw', f'{name}.log'), 'a').write(txt)
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got):
            Image.open(got).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out, quality=94)
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
    extra = ''
    if len(sys.argv) > 3 and sys.argv[2] == '--roll2':
        extra = sys.argv[3]
        for n in names:   # keep the earlier roll
            o = out_path(n)
            if os.path.exists(o):
                k = len([f for f in os.listdir(os.path.join(HERE, 'raw', 'rolls')) if f.startswith(f'roof-flat--{n}.')]) + 1
                shutil.move(o, os.path.join(HERE, 'raw', 'rolls', f'roof-flat--{n}.roll{k}.jpg'))
    for i, n in enumerate(names):
        if os.path.exists(os.path.join(HERE, 'QUOTA_STOP.txt')): print('QUOTA_STOP.txt exists: not sending', n, flush=True); break
        res = gen(n, extra); print(time.strftime('%T'), n, res, flush=True)
        if res == 'QUOTA': break
        if res.startswith(('ok', 'FAILED')) and i < len(names) - 1: time.sleep(PAUSE)
