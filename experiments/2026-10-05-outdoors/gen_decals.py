#!/usr/bin/env python3
"""Grass scatter decals for the yard's ground (2026-10-05): tufts of longer grass and patches worn to earth, laid by
look.js SCATTER over floor-grass so a lawn is not one flat green. Free route: `codex exec` image generation.
    python3 gen_decals.py [-j 3]     -> decals/<sku>.jpg (chroma-blue plates; tools/spawn-tuner/prep/flats.py keys and feathers them)
The attached image is our own floor-grass texture, so the greens match the ground they lie on."""
import os, sys, subprocess, concurrent.futures as cf, time, shutil, tempfile
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ANCHOR = os.path.join(HERE, 'seamless', 'floor-grass.png')
P = """Use your built-in image generation tool. The attached image is a top-down hand-painted GRASS ground texture from a game; it is the ground this new decal will lie on. Create a new, distinct flat game asset in the same hand-painted style: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency detail, mostly matte. Match the attached texture's greens exactly where the decal is green. Avoid photorealism, gloss, tiny texture noise, comic outlines, text.

Presentation: exactly one flat patch seen from directly overhead (perfectly top-down, no perspective), evenly lit, no cast shadow, centred with clear space around every edge on a perfectly uniform solid chroma-blue (#0000FF) background. The patch itself must contain no blue. Its edges are ragged and irregular (an organic outline, not a circle or a rectangle).

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
JOBS = {}
for i, d in enumerate(['a loose clump of slightly longer, slightly darker grass blades with three or four clover leaves', 'a ragged tuft of longer grass, a little yellower at the tips, blades leaning in mixed directions', 'a patch of longer darker grass with five tiny white daisies', 'a scruffy tuft of coarse longer grass with a couple of dandelion leaves, no flowers'], 1):
    JOBS[f'decal-grass-tuft--s{i}'] = ('a patch of longer grass tufts lying on a lawn', f'{d}. About 36 in by 30 in. Variation {i}. Show exactly this patch and nothing else.')
for i, d in enumerate(['an irregular patch where the grass is worn thin to pale tan trodden earth, grass creeping back in at its ragged edges, two or three small pebbles', 'a long irregular scuffed patch of pale dry earth showing through thin grass, ragged edges with blades of grass poking in', 'a small bare patch of tan packed earth with a few thin wisps of grass across it and ragged grassy edges'], 1):
    JOBS[f'decal-grass-worn--s{i}'] = ('a patch of lawn worn down to bare earth', f'{d}. About 48 in by 36 in. Variation {i}. Show exactly this patch and nothing else.')
# The door-to-gate path (2026-10-05): laid end to end in a line over floor-grass, so each is elongated left to right.
for i, d in enumerate(['a fairly straight stretch, a little wider in the middle', 'a stretch that wanders very slightly, with one edge more ragged than the other', 'a stretch with two faint parallel foot-worn lines of slightly paler earth along it', 'a narrower stretch with more grass creeping in from both sides and a couple of pea-sized pebbles'], 1):
    JOBS[f'decal-path-worn--s{i}'] = ('a short stretch of a trodden earth footpath crossing a lawn', f'A band of pale tan packed earth where feet have worn the grass away, running LEFT TO RIGHT across the patch: clearly elongated, about 60 in long and 40 in wide, NOT a round blob or a puddle. {d}. The two long sides are ragged and soft, with thin grass and single blades creeping into the earth; the left and right ENDS do not stop in a hard line, they break up into thinning grass and scattered bare specks so that another stretch can continue the path. The earth is dry, matte and pale (not dark mud, not wet). A fringe of the lawn grass surrounds the earth on every side, so the outermost edge of the patch is grass in the attached texture\'s greens. Variation {i}. Show exactly this patch and nothing else.')

def gen(name):
    out = os.path.join(HERE, 'decals', f'{name}.jpg')
    if os.path.exists(out): return name, 'exists'
    wd = tempfile.mkdtemp(prefix=f'outd-{name}-'); subject, detail = JOBS[name]
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', ANCHOR, '-']
    t0 = time.time()
    for attempt in range(2):
        r = subprocess.run(cmd, input=P.format(subject=subject, detail=detail, name=name), capture_output=True, text=True, timeout=900)
        open(os.path.join(HERE, 'raw', f'{name}.log'), 'a').write(r.stdout[-4000:] + r.stderr[-2000:])
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got): Image.open(got).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out, quality=94); return name, f'ok {time.time() - t0:.0f}s'
    return name, 'FAILED'

if __name__ == '__main__':
    j = int(sys.argv[sys.argv.index('-j') + 1]) if '-j' in sys.argv else 3
    names = [a for a in sys.argv[1:] if a.startswith('decal-')]; names = names[0].split(',') if names else list(JOBS)
    with cf.ThreadPoolExecutor(j) as ex:
        for name, res in ex.map(gen, names): print(name, res, flush=True)
