#!/usr/bin/env python3
"""Build-menu icons (Harry 2026-10-03: "big chunky icons for everything"): genres, types and rooms, generated with
Codex's built-in image tool (`codex exec`, ChatGPT login: no API spend). One style anchor (the inn) is made first;
every other icon is made WITH the anchor attached, so the set stays consistent. Raw PNGs land in raw/; post.py keys
out the chroma background and writes engine/client/data/icons/<key>.png.
    python3 gen.py anchor        # the style anchor only
    python3 gen.py all [-j 4]    # everything missing in raw/
"""
import os, sys, subprocess, concurrent.futures as cf, time, shutil, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, 'raw'); os.makedirs(RAW, exist_ok=True)
ICONS = {
  'genre-fantasy': 'a tiny storybook castle on a grassy mound, one pennant flying',
  'type-TAV': 'a two-storey timber-framed inn with a steep roof, a chimney and a hanging sign on a bracket',
  'type-NOB': 'a stately stone manor house, symmetrical windows, slate roof, two chimneys',
  'type-CAS': 'a stone castle keep with two round crenellated towers and a gate',
  'type-TEM': 'a small stone chapel with a bell tower and an arched door; no crosses or real-world religious symbols (a plain round window instead)',
  'type-SMI': 'an open-sided smithy: anvil on a stump, a brick forge with a glowing mouth, a chimney',
  'type-MKT': 'a market stall with a striped awning, crates of produce and a sack',
  'type-HUT': 'a thatched cottage with a small wooden fence and a well',
  'type-DUN': 'an iron-barred cell door set in a thick stone wall, a ring of keys hanging beside it',
  'type-CRY': 'a stone mausoleum with steps, columns and a heavy stone door',
  'type-ARC': "a tall slender wizard's tower with a pointed roof and one glowing window",
  'type-CLT': 'a dark stone altar ringed by candles under a hanging plain banner',
  'type-MIN': 'a timber-braced mine entrance in a rock face, a small ore cart on rails',
  'type-RUI': 'broken stone columns and a crumbling arch with ivy',
  'type-LAI': 'a cave mouth in rock with scattered bones and two glowing eyes in the dark',
  'type-CMP': 'a canvas tent beside a small campfire and a bedroll',
  'type-GRV': 'a ring of mushrooms around a small glowing tree',
  'tool-build': 'a carpenter\'s claw hammer and a hand saw crossed in an X, wooden handles, steel heads and blade',
  'tool-pawns': 'a single chunky wooden game pawn (a meeple-like token: round head, sturdy body, flat base) painted red with a small brass rim, standing upright',
  'tool-settings': 'a chunky brass cogwheel gear with eight square teeth and a round hole in the middle, a smaller iron gear meshed behind it',
  'cursor-build': 'a tiny timber-framed house with a steep roof, seen three-quarter, with a yellow carpenter\'s pencil leaning on it',
  'cursor-room': 'a carpenter\'s square (an L-shaped steel ruler) lying on a single wooden floor tile',
  'cursor-place': 'a small wooden crate with iron corners',
  'room-common': 'a cutaway corner of a tavern common room: a long table with tankards, a bench, a hearth',
  'room-kitchen': 'a cutaway corner of a kitchen: a cook hearth with a spit and a hanging pot, a prep table',
  'room-storeroom': 'a cutaway corner of a storeroom: stacked crates, sacks and a barrel',
  'room-cellar': 'a cutaway corner of a stone cellar vault: casks on a rack',
  'room-guest': 'a cutaway corner of a simple guest room: a plain bed, a nightstand with a candle',
  'room-fine': 'a cutaway corner of a fine guest room: a canopy bed with drapes, a small rug',
  'room-privy': 'a cutaway corner of a privy: a wooden seat bench and a bucket',
  'room-hallway': 'a cutaway corridor with a runner rug, two doors and a wall sconce',
  'room-desk': 'a cutaway corner of an inn front desk: a counter with a ledger, a bell, a key board behind',
  'room-stable': 'a cutaway corner of a stable: a horse stall with hay and a saddle on the rail',
  'room-barn': 'a cutaway corner of a barn: big plank doors, hay bales and a pitchfork',
}
STYLE = """Use your built-in image generation tool. Generate ONE square image: a single app icon for a tabletop-RPG building toolkit, showing {subject}.
Style: bold, simple, chunky silhouette that reads at 48 pixels; a small three-quarter vignette seen from slightly above; flat-shaded with soft matte gradients, quiet and modern (no outlines, no comic inking, no gloss, no photorealism); minimal detail; a restrained palette of warm honey wood, blue-gray stone, moss green, ochre, cream and a touch of muted burgundy. Exactly one subject, centred, filling about 80% of the frame, clear space around every edge. No text, no letters, no frame, no badge shape, no border, no drop shadow, no floor plane.
Background: perfectly uniform solid chroma green (#00FF00) edge to edge; the subject must not reflect green light.
{anchor}Save the resulting PNG into the current directory as {name}.png and print its path and pixel size."""
ANCHOR_NOTE = "The attached image is the style anchor for this icon set: match its rendering, lighting, palette, level of detail, camera angle and scale exactly (a different subject, the same family of icons).\n"

def gen(name, anchor=None):
    out = os.path.join(RAW, f'{name}.png')
    if os.path.exists(out): return name, 'exists'
    wd = tempfile.mkdtemp(prefix=f'icon-{name}-')
    prompt = STYLE.format(subject=ICONS[name], name=name, anchor=ANCHOR_NOTE if anchor else '')
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write'] + (['-i', anchor] if anchor else []) + ['-']
    t0 = time.time()
    for attempt in range(2):
        r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=600)
        open(os.path.join(RAW, f'{name}.log'), 'a').write(r.stdout[-4000:] + r.stderr[-2000:])
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got): shutil.move(got, out); return name, f'ok {time.time() - t0:.0f}s'
    return name, 'FAILED'

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    j = int(sys.argv[sys.argv.index('-j') + 1]) if '-j' in sys.argv else 4
    if what == 'anchor': print(gen('type-TAV')); sys.exit()
    anchor = os.path.join(RAW, 'type-TAV.png')
    if not os.path.exists(anchor): print(gen('type-TAV'))
    names = [n for n in ICONS if n != 'type-TAV'] if what == 'all' else what.split(',')
    with cf.ThreadPoolExecutor(j) as ex:
        for name, res in ex.map(lambda n: gen(n, anchor), names): print(name, res, flush=True)
