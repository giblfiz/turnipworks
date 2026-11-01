#!/usr/bin/env python3
"""Plates for the temple roof and the gable ends (2026-10-27). FREE route only: Codex's built-in image tool (`codex exec`,
ChatGPT login, no API key), one request at a time, the style anchor attached (as experiments/2026-10-05-castle-crypt-mansion/
flats/gen.py, whose ROOF prompt this copies). On a usage limit: QUOTA_STOP.txt and stop.
    python3 gen.py name,name,...      -> raw/<name>.png (as generated), raw/<name>.log; requests.log counts requests"""
import os, sys, subprocess, time, shutil, tempfile, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
STYLE = os.path.join(ROOT, 'style-references/heroic-handpainted-tavern-v1.png')
LIMIT = re.compile(r"usage limit|rate limit|rate_limit|quota|too many requests|\b429\b|limit reached|hit your .*limit", re.I)
FINISH = ("Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly "
          "matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters, logos.")
HEAD = "Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), "
ROOF = HEAD + """paint a roofing material swatch: classical white marble roof tiles of a Greek temple.

""" + FINISH + """

Presentation: a perfectly top-down orthographic view looking straight down at the roof surface, laid flat. The roof surface fills the ENTIRE square canvas edge to edge: no border, no frame, no background colour, no vignette, no perspective, no long cast shadows, no objects, no ridge, no eaves edge, no gutter. Even, flat lighting. The square shows a 5 ft x 5 ft patch of roof, so keep elements at true scale for that area. It must tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the overall tone EVEN across the whole square (no big light or dark blotches), so that a grid of these squares does not show.

Specific design: large flat marble pan tiles in FIVE horizontal courses of 12 in, FIVE pan tiles per course (each 12 in wide), and every joint between two pan tiles covered by a narrow ROUNDED cover tile (an imbrex, about 3 in wide) running straight up the slope. The cover tiles line up in five straight vertical columns from the bottom edge to the top edge (NOT a broken bond: every course is directly above the one below). Warm white and pale cream marble with very faint soft grey veining, single tiles a touch warmer or cooler, spread evenly; a soft grey shadow under each course's lower edge and a thin soft shadow along both sides of every cover tile. Painted FLAT, as if the roof slope were laid on the ground and seen from straight above (no foreshortening). Courses run exactly HORIZONTALLY across the image; the eaves are at the BOTTOM of the image and the ridge at the top, so each course overlaps the one BELOW it and its overlap shadow falls along its lower edge only. A whole number of courses fills the height and a whole number of tiles the width, so the square tiles seamlessly. No moss, no cracks, no missing tiles, no gold.
Save the resulting PNG (square, at least 1024 px) into the current directory as {name}.png and print its path and pixel size."""
FLATBLUE = ("Presentation: a flat FRONT ELEVATION (orthographic, seen straight on, no perspective, no foreshortening), evenly lit from the "
            "front, NO cast shadow, nothing painted around it, centred with clear space around every edge on a perfectly uniform solid "
            "chroma-blue (#0000FF) background. The subject itself must contain no blue and no purple, and the blue background must not "
            "show through gaps inside it (glass is painted as dark smoky glass, not as see-through).")
CARD = HEAD + "create a new, distinct flat game asset in that hand-painted style: {subject}.\n\n" + FINISH + "\n\n" + FLATBLUE + """

Specific design: {detail}
Save the resulting PNG ({size}) into the current directory as {name}.png and print its path and pixel size."""
J = {
    'roofing-marble': ROOF,
    'gable-window': CARD.format(subject='a small attic window for the gable end of a half-timbered house', size='square, 1024 px', name='{name}', detail=(
        "ONE small square attic casement window, 30 in wide and 34 in tall, filling about 60% of the canvas height: a chunky frame of "
        "dark weathered oak with a thicker sill board at the bottom, four leaded panes in a two-by-two grid of dark smoky green-grey glass with "
        "one soft warm glint, the outer edges of the frame cut perfectly straight and square to the canvas. No shutters, no wall around it, "
        "no flower box, no curtains.")),
    'gable-vent': CARD.format(subject='a louvred wooden vent for the gable end of a wooden house or barn', size='square, 1024 px', name='{name}', detail=(
        "ONE louvred gable vent, 26 in wide and 32 in tall, filling about 60% of the canvas height: a frame of weathered grey-brown oak "
        "planks with a POINTED top (two short sloped boards meeting at a peak, like a little gable), six horizontal slanted louvre boards inside "
        "it with deep dark shadow gaps between them (very dark brown, nearly black). The bottom edge is straight. No wall around it, no nails "
        "bigger than a dot, no moss.")),
    'gable-oculus': CARD.format(subject='a round oculus window for the gable end of a stone church or manor', size='square, 1024 px', name='{name}', detail=(
        "ONE round oculus window, 30 in across, filling about 62% of the canvas: a thick ring of pale warm-grey dressed stone blocks "
        "(voussoirs, about twelve, with fine joints) and inside it a simple quatrefoil of dark lead came holding dark smoky glass with "
        "one soft warm glint. A perfect circle, centred. No wall around it.")),
    'pediment-tympanum': HEAD + "create a new, distinct flat game asset in that hand-painted style: the carved marble relief of a classical temple pediment.\n\n" + FINISH + "\n\n" + FLATBLUE + """

Specific design: ONE long, low ISOSCELES TRIANGLE of pale cream-white marble, with its long flat base at the bottom and its apex at the top centre: exactly FIVE times as wide as it is tall (base edge about 94% of the canvas width, apex height about 19% of the canvas width), with broad blue above it and below it. Inside the triangle, a shallow carved relief in the same marble: in the centre a round laurel wreath around a sunburst disc, flanked left and right by mirrored, flowing acanthus scrolls that taper away into the two narrow corners. Soft carved shading only (the relief is low, like a coin), no colour except warm cream, pale grey and a little honey in the deepest cuts. The three edges of the triangle are crisp straight lines. NO people, no faces, no animals, no letters.
Save the resulting PNG (landscape, 1536 x 1024 px) into the current directory as {name}.png and print its path and pixel size.""",
    'cornice-marble': HEAD + "create a new, distinct flat game asset in that hand-painted style: a strip of carved classical marble cornice moulding.\n\n" + FINISH + "\n\n" + FLATBLUE + """

Specific design: ONE perfectly straight horizontal band of carved classical cornice in pale cream-white marble, seen straight on from the front, running the FULL WIDTH of the canvas from the left edge to the right edge (it is the only thing allowed to touch the canvas edges) and about 22% of the canvas height tall, with broad blue above and below. From top to bottom: a plain flat top fillet, a row of egg-and-dart ornament, a row of square dentil blocks with dark shadow gaps between them, and a plain flat bottom fillet. Every ornament repeats at a regular spacing so that the strip continues seamlessly from its right end into its left end. Soft carved shading; warm cream, pale grey and a little honey in the deepest cuts. No letters.
Save the resulting PNG (landscape, 1536 x 1024 px) into the current directory as {name}.png and print its path and pixel size.""",
}

def gen(name):
    out = os.path.join(HERE, 'raw', f'{name}.png')
    if os.path.exists(out): return 'exists'
    wd = tempfile.mkdtemp(prefix=f'roofs-temple-{name}-')
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', STYLE, '-']
    prompt = J[name].replace('{name}', name)
    open(os.path.join(HERE, 'prompts', f'{name}.md'), 'w').write(prompt + '\n')
    t0 = time.time()
    for attempt in range(2):
        open(os.path.join(HERE, 'requests.log'), 'a').write(f'{time.strftime("%F %T")} {name} attempt {attempt + 1}\n')
        try: r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900); txt = r.stdout[-6000:] + '\n' + r.stderr[-4000:]
        except subprocess.TimeoutExpired: txt = 'TIMEOUT 900s'
        open(os.path.join(HERE, 'raw', f'{name}.log'), 'a').write(txt)
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got): shutil.move(got, out); return f'ok {time.time() - t0:.0f}s'
        hit = [l for l in txt.splitlines() if LIMIT.search(l) and 'Use your built-in' not in l]
        if hit: open(os.path.join(HERE, 'QUOTA_STOP.txt'), 'a').write('\n'.join(hit[-12:]) + '\n'); return 'QUOTA'
        time.sleep(20)
    return 'FAILED'

if __name__ == '__main__':
    for n in sys.argv[1].split(','):
        if os.path.exists(os.path.join(HERE, 'QUOTA_STOP.txt')): print('QUOTA_STOP.txt exists: not sending', n, flush=True); break
        res = gen(n); print(time.strftime('%T'), n, res, flush=True)
        if res == 'QUOTA': break
