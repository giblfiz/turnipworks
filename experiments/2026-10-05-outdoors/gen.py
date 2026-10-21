#!/usr/bin/env python3
"""Outdoors (2026-10-05): the Yard room icon and ground textures (grass, gravel), generated with Codex's built-in image
tool (`codex exec`, ChatGPT login: no API spend), the same route as experiments/2026-10-03-build-icons.
    python3 gen.py [names,comma,separated] [-j 3]
Icon: raw/room-yard.png (chroma green; post with ../2026-10-03-build-icons/post.py's method -> engine/client/data/icons/).
Ground: inputs/<sku>.jpg (1024 px, opaque) -> make_seamless.py -> seamless/<sku>.png, read by tools/spawn-tuner/build_data.py.
"""
import os, sys, subprocess, concurrent.futures as cf, time, shutil, tempfile
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
ICON_ANCHOR = os.path.join(ROOT, 'experiments/2026-10-03-build-icons/raw/type-TAV.png')
FLOOR_ANCHOR = os.path.join(ROOT, 'style-references/heroic-handpainted-tavern-v1.png')
ICON = """Use your built-in image generation tool. Generate ONE square image: a single app icon for a tabletop-RPG building toolkit, showing {subject}.
Style: bold, simple, chunky silhouette that reads at 48 pixels; a small three-quarter vignette seen from slightly above; flat-shaded with soft matte gradients, quiet and modern (no outlines, no comic inking, no gloss, no photorealism); minimal detail; a restrained palette of warm honey wood, blue-gray stone, moss green, ochre, cream and a touch of muted burgundy. Exactly one subject, centred, filling about 80% of the frame, clear space around every edge. No text, no letters, no frame, no badge shape, no border, no drop shadow, no floor plane.
Background: perfectly uniform solid chroma MAGENTA (#FF00FF) edge to edge (the subject has green grass, so green cannot be the key colour); the subject must not reflect magenta light and must contain no pink or purple.
The attached image is the style anchor for this icon set: match its rendering, lighting, palette, level of detail, camera angle and scale exactly (a different subject, the same family of icons).
Save the resulting PNG into the current directory as {name}.png and print its path and pixel size."""
FLOOR = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint a ground material swatch: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, logos and emblems.

Presentation: a perfectly top-down orthographic view looking straight down at the ground. The ground surface fills the ENTIRE square canvas edge to edge: no border, no frame, no background colour, no vignette, no perspective, no cast shadows, no objects, no flowers, no rocks bigger than a thumb. Even, flat, shadowless lighting. The square shows a 5 ft x 5 ft patch of ground, so keep elements at true scale for that area. It must tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the overall tone EVEN across the whole square (no big light or dark blotches), so that a grid of these squares does not show.

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
JOBS = {
  'room-yard': ('icon', "an inn's back yard seen as a small vignette: a patch of green grass with a round stone well with a little roof and bucket, a stack of split firewood, and a wooden bench", ''),
  'floor-grass': ('floor', 'short mown yard grass', 'Short, slightly trodden yard grass in a calm moss green, painted as soft overlapping tufts and strokes at a fine even scale; a few slightly yellower and slightly darker tufts spread evenly. No bare patches, no flowers, no leaves. Variation 1.'),
  'floor-grass--v2': ('floor', 'short mown yard grass', 'Short, slightly trodden yard grass in a calm moss green, painted as soft overlapping tufts and strokes at a fine even scale; the tufts lean in mixed directions. No bare patches, no flowers, no leaves. Variation 2: the same colours, a different arrangement.'),
  'floor-grass--v3': ('floor', 'short mown yard grass', 'Short, slightly trodden yard grass in a calm moss green, painted as soft overlapping tufts and strokes at a fine even scale, with a very few tiny clover leaves. No bare patches, no flowers. Variation 3: the same colours, a different arrangement.'),
  'floor-grass--v4': ('floor', 'short mown yard grass', 'Short, slightly trodden yard grass in a calm moss green, painted as soft overlapping tufts and strokes at a fine even scale, a touch thinner so a little dark earth shows evenly between the blades. No flowers, no leaves. Variation 4: the same colours, a different arrangement.'),
  'floor-gravel': ('floor', 'raked pea gravel', 'Fine pale warm-gray pea gravel, pebbles about half an inch across, evenly spread, with a few ochre and blue-gray pebbles mixed evenly through. No ruts, no weeds. Variation 1.'),
  # 2026-10-05 second batch. The two grass ones get our own floor-grass attached as a colour anchor (4th field).
  'floor-grass-worn': ('floor', 'yard grass worn to bare earth in patches', 'The SECOND attached image is our existing yard-grass texture: match its greens and its painting scale exactly. Short trodden yard grass in the same calm moss green, worn through to pale tan packed earth in MANY SMALL irregular soft-edged scuffs (fifteen to twenty of them, each only 4 to 9 inches across, all different shapes, none of them a landmark) scattered EVENLY and irregularly over the whole square, never in rows or a lattice (roughly a quarter earth, three quarters grass), grass thinning into the earth with ragged edges and a few blades across the bare parts. No large bare area anywhere. No patch touches or crosses the edge of the square in a way that would not wrap. No flowers, no leaves, no pebbles bigger than a pea.', 'grass'),
  'floor-grass-meadow': ('floor', 'longer meadow grass with small flowers', 'The SECOND attached image is our existing short yard-grass texture: stay in the same family of calm moss greens (this one may be a touch richer). Longer, softer meadow grass painted as overlapping curved blades and tufts leaning in mixed directions, with small white and pale-yellow wildflowers (daisies, buttercups, each under an inch across) sprinkled EVENLY as single flowers, never in clusters or pairs, about sixty in the whole square, all much the same size, so that no group of flowers is a landmark. Exception to the rule above: these small flowers ARE wanted. No blue or purple flowers, no bare earth, no big leaves.', 'grass'),
  'floor-cobble-mossy': ('floor', 'old cobblestones with moss and grass in the joints', 'Old rounded blue-gray and warm-gray cobblestones, each about 4 to 6 inches across (so roughly eleven or twelve stones along each side of the square), irregular but evenly packed, worn smooth. Exception to the rule above: these cobbles ARE the surface. The joints between them are filled with soft moss-green moss and short tufts of grass, with moss creeping over the edges of some stones, spread evenly across the whole square. No puddles, no large weeds, no flowers, no missing stones.'),
  'floor-gravel--v2': ('floor', 'raked pea gravel', 'Fine pale warm-gray pea gravel, pebbles about half an inch across, evenly spread, with a few ochre and blue-gray pebbles mixed evenly through. No ruts, no weeds. Variation 2: the same colours, a different arrangement.'),
}

def gen(name):
    kind, subject, detail = JOBS[name][:3]; extra = ['-i', os.path.join(HERE, 'seamless', 'floor-grass.png')] if len(JOBS[name]) > 3 else []
    out = os.path.join(HERE, 'raw', f'{name}.png') if kind == 'icon' else os.path.join(HERE, 'inputs', f'{name}.jpg')
    if os.path.exists(out): return name, 'exists'
    wd = tempfile.mkdtemp(prefix=f'outd-{name}-')
    prompt = (ICON if kind == 'icon' else FLOOR).format(subject=subject, detail=detail, name=name)
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', ICON_ANCHOR if kind == 'icon' else FLOOR_ANCHOR, *extra, '-']
    t0 = time.time()
    for attempt in range(2):
        r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900)
        open(os.path.join(HERE, 'raw', f'{name}.log'), 'a').write(r.stdout[-4000:] + r.stderr[-2000:])
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got):
            if kind == 'icon': shutil.move(got, out)
            else: Image.open(got).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out, quality=93)
            return name, f'ok {time.time() - t0:.0f}s'
    return name, 'FAILED'

if __name__ == '__main__':
    names = [a for a in sys.argv[1:] if not a.startswith('-') and not a.isdigit()]
    names = names[0].split(',') if names else list(JOBS)
    j = int(sys.argv[sys.argv.index('-j') + 1]) if '-j' in sys.argv else 3
    with cf.ThreadPoolExecutor(j) as ex:
        for name, res in ex.map(gen, names): print(name, res, flush=True)
