#!/usr/bin/env python3
"""A rock ground texture for the cliff faces of the banks demo, by the free Codex image route (the same prompt frame and
seam-joining as ../2026-10-05-outdoors/gen.py and finish_new.py; no API spend).
    python3 gen_rock.py [name,name]   -> inputs/<name>.jpg, tex/<name>.webp (1024 px, tiles)"""
import os, sys, subprocess, tempfile, time, importlib.util
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', '2026-10-05-outdoors')
spec = importlib.util.spec_from_file_location('ogen', os.path.join(OUT, 'gen.py')); ogen = importlib.util.module_from_spec(spec); spec.loader.exec_module(ogen)
src = open(os.path.join(OUT, 'finish_new.py')).read(); fn = {}
exec(src[src.index('BAND, FEATHER'):src.index('def green')], {'np': np, 'ndimage': ndimage}, fn)   # seam, blotch, flatten, path, cut
fn['cut'].__globals__.update(fn)
JOBS = {
  'ground-rock': ('bare weathered rock, the face of a rocky outcrop', 'Exception to the rules above: rock IS the surface here. Solid bare bedrock in blue-gray and warm-gray, the same stone family as the stone walls of the house style, broken by irregular cracks and joints into blocky slabs and ledges of mixed sizes (roughly 8 to 20 inches across), with chipped edges, a few lighter worn faces and darker crevices, and small patches of moss-green lichen in a few cracks. Low contrast overall, no single block that stands out as a landmark, no soil, no grass tufts, no pebbles, no puddles.'),
  'ground-earth-bank': ('bare earth of a steep bank with small stones', 'Dry crumbly brown earth as on a steep bank where grass does not hold: warm mid-brown soil with fine darker and lighter streaks, small embedded stones (under an inch) spread evenly, a few thin exposed roots and a very few short blades of moss-green grass. Even tone, no large patches, no pebbles bigger than a thumb.'),
}
# a rock FACE is seen from the side, so it gets its own frame (the ground frame above paints pavement-like slabs)
FACE = """Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), paint a material swatch: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, logos and emblems.

Presentation: a perfectly flat, straight-on orthographic view of a vertical rock wall, as if photographed square-on from in front. The rock fills the ENTIRE square canvas edge to edge: no sky, no ground, no grass line, no border, no frame, no vignette, no perspective, no cast shadows, no plants bigger than a patch of moss. Even, flat, shadowless lighting. The square shows a 5 ft x 5 ft patch of the wall. It must tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the overall tone EVEN across the whole square (no big light or dark blotches).

Specific design: {detail}
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
JOBS['ground-rock-face'] = ('the face of a natural cliff of layered rock', 'One solid mass of natural warm-grey and blue-grey bedrock, NOT separate stones and NOT masonry: horizontal strata (layers) of uneven thickness, 4 to 12 inches each, running left to right across the whole square, broken by a few irregular vertical cracks and small chipped ledges, with lighter worn edges on the ledges, darker recesses under them, and a few small patches of moss-green lichen. The layers run level and continue off both side edges. Low contrast, no single feature that stands out as a landmark.')
ogen.FLOOR_BY = {'ground-rock-face': FACE}
os.makedirs(f'{HERE}/inputs', exist_ok=True)
for name in (sys.argv[1].split(',') if len(sys.argv) > 1 else list(JOBS)):
    out = f'{HERE}/inputs/{name}.jpg'
    if not os.path.exists(out):
        wd = tempfile.mkdtemp(prefix=f'banks-{name}-'); t0 = time.time()
        prompt = ogen.FLOOR_BY.get(name, ogen.FLOOR).format(subject=JOBS[name][0], detail=JOBS[name][1], name=name)
        for attempt in range(2):
            r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', ogen.FLOOR_ANCHOR, '-'], input=prompt, capture_output=True, text=True, timeout=900)
            open(f'{HERE}/inputs/{name}.log', 'a').write(r.stdout[-4000:] + r.stderr[-2000:])
            if os.path.exists(f'{wd}/{name}.png'): Image.open(f'{wd}/{name}.png').convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out, quality=93); break
        print(name, 'generated' if os.path.exists(out) else 'FAILED', f'{time.time() - t0:.0f}s', flush=True)
    if not os.path.exists(out): continue
    a = np.asarray(Image.open(out).convert('RGB')).astype(float); before = (fn['seam'](a, 1), fn['seam'](a, 0), fn['blotch'](a))
    a = fn['flatten'](a); a = fn['cut'](a); a = fn['cut'](a.transpose(1, 0, 2)).transpose(1, 0, 2)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f'{HERE}/tex/{name}.webp', quality=88)
    print(f"{name} seam LR {before[0]:.1f}->{fn['seam'](a, 1):.1f} TB {before[1]:.1f}->{fn['seam'](a, 0):.1f} blotch {before[2]:.2f}->{fn['blotch'](a):.2f}", flush=True)
