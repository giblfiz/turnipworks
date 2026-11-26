#!/usr/bin/env python3
"""Plates (for the ASSETS agent's TRELLIS session) and the court decal, FREE route: codex exec's built-in image tool,
one request at a time (the cultures-a flats/gen.py method).  python3 gen.py name,name,...|all"""
import os, sys, subprocess, time, tempfile, shutil
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLE = 'style-references/heroic-handpainted-tavern-v1.png'
MESH = """Use your built-in image generation tool. Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset: {subject}.

Geometry: stout, miniature-compatible proportions; broad soft bevels; deep readable form rather than fine detail; NEVER add handles, rings, loops, straps or fittings the real object would not have. Every part thick enough to reconstruct as 3D geometry.
Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, sparing painted edge highlights and gentle wear, low-frequency surface detail, mostly matte.
Avoid: multiple views, variants or a grid of the object in one image; photorealism, plastic toy gloss, strong reflections, black outlines, hard cel-shading bands, comic inking, flat vector art, thin fragile parts, text, letters, logos, emblems, glyphs or symbols.

Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light casts, no environment, no people, no additional loose objects. Any image size is fine.

Specific design: {detail} It stands on nothing: NO floor, NO base slab, platform or plinth under it. Show exactly this one object and nothing else, whole and well inside the frame.
Save the resulting PNG into the current directory as {name}.png and print its path and pixel size."""
DECAL = """Use your built-in image generation tool. The attached image is the style guide for the Turnip Works house style (heroic hand-painted). Create a new, distinct flat game asset in that hand-painted style: {subject}.

Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency detail, mostly matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters, glyphs, symbols.

Presentation: seen from directly overhead (perfectly top-down orthographic, no perspective), evenly lit, NO cast shadow and no ground painted, centred with clear space around every edge on a perfectly uniform solid chroma-blue (#0000FF) background. The subject itself must contain no blue and no purple, and the blue background must not show through gaps inside it. Any image size is fine.

Specific design: {detail}
Save the resulting PNG into the current directory as {name}.png and print its path and pixel size."""
J = {
 'mes-court-endwall-v2': ('plates-for-assets', MESH, 'a straight section of the low wall that closes the end zone of a Mexica ballcourt (Late Postclassic Tenochtitlan, c. 1400-1520)', 'ONE straight wall section about 120 in long, 24 in thick and 36 in tall: thick masonry under smooth, CLEAN, evenly cream-white lime plaster, a flat plastered top, gently rounded edges. Completely plain and unmarked on every face: NO paint, NO stains, NO cracks drawn as lines, NO dark specks or spots, NO lettering, scribbles, graffiti, glyphs or marks of any kind, NO carvings, NO frieze, NO steps, NO openings; only soft broad shading. Much longer than tall, shown three-quarter from slightly above so its long face and its flat top both show.'),
 'ind-stepwell-v2': ('plates-for-assets', MESH, 'a Rajasthani stepwell (baori), 18th-century Jaipur-Amber, made to be SUNK into the ground of a game table (its rim level with the ground)', 'ONE big square sunken tank of pale golden sandstone, about 180 in x 180 in in plan and 60 in deep: its plan PERFECTLY SQUARE; a flat paved rim of EVEN width runs unbroken round all four sides at one level, and its outer faces are plain vertical stone walls, complete to every corner (no missing corners, no broken edges, nothing outside the square). Inside, three sides are many flights of narrow stairs in a zigzag going down level after level with small landings to a square pool of still deep-green water at the bottom; the fourth side is a pillared gallery with arched openings set INTO that side, below the rim (nothing rises above the rim). NO writing, letters, symbols or figures anywhere.'),
 'mes-court-ball': ('plates-for-assets', MESH, 'a Mexica rubber ball (olli) for the Mesoamerican ballgame, Late Postclassic central Mexico', 'ONE solid natural-rubber ball, near-perfectly round, about 10 in across, brown-black to black, matte with a faint dull sheen, a restrained slightly uneven hand-made surface (no seams, no stitching, no panels, no valve, not lumpy, not a modern sports ball).'),
 'mes-court-endwall': ('plates-for-assets', MESH, 'a straight section of the low wall that closes the end zone of a Mexica ballcourt (Late Postclassic Tenochtitlan, c. 1400-1520)', 'ONE straight wall section about 120 in long, 24 in thick and 48 in tall: thick masonry under smooth cream-white lime plaster, a flat plastered top, gently rounded edges, the plaster a little worn at the foot. Plain: NO paint bands, NO carvings, NO frieze, NO steps, NO openings. Much longer than tall, shown three-quarter from slightly above so its long face and its flat top both show.'),
 'mes-court-hip-guard': ('plates-for-assets', MESH, "a Mexica ballplayer's leather hip guard laid down, Late Postclassic central Mexico (after Sahagun, Florentine Codex Book 8)", 'ONE folded thick tan-brown deer-hide hip guard of adult waist size lying flat with its simple cloth girdle coiled on it: a broad stiff leather piece that wraps the hips, subdued tan and brown, about 30 in wide, 18 in deep, 8 in tall as it lies. NOT a carved stone yoke, no feathers, no ornaments, no glyphs.'),
 'decal-mes-court-line': ('flats', DECAL, 'the painted centre line across the plastered alley of a Mexica ballcourt', 'ONE long straight painted band seen from straight above: a hand-brushed transverse line in dark green-black plant paint on a strip of smooth cream-white lime plaster, the line running the whole LENGTH of the strip, its edges soft and a little uneven as if brushed, very faint plaster mottling. The strip is very long and narrow, about TWELVE times as long as it is wide, laid horizontally across the canvas, filling about 90% of the canvas width. Nothing else: no dots, no circles, no symbols.'),
}
def gen(name):
    sub, frame, subject, detail = J[name]; d = os.path.join(HERE, sub); os.makedirs(d, exist_ok=True); out = os.path.join(d, f'{name}.png')
    if os.path.exists(out): return 'exists'
    prompt = frame.format(subject=subject, detail=detail, name=name)
    open(os.path.join(d, f'{name}.prompt.md'), 'w').write(prompt + f'\n\n[attached: {STYLE}]\n')
    wd = tempfile.mkdtemp(prefix=f'such-{name}-')
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', STYLE, '-']
    for attempt in range(2):
        try: r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900); txt = r.stdout[-4000:] + '\n' + r.stderr[-3000:]
        except subprocess.TimeoutExpired: txt = 'TIMEOUT'
        open(os.path.join(d, f'{name}.log'), 'a').write(txt)
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got): shutil.move(got, out); return 'ok'
        time.sleep(10)
    return 'FAILED'
if __name__ == '__main__':
    names = list(J) if sys.argv[1] == 'all' else sys.argv[1].split(',')
    for n in names: print(time.strftime('%T'), n, gen(n), flush=True)
