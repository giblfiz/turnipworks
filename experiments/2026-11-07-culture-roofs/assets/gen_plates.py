#!/usr/bin/env python3
"""Roofing plates for the culture roofs (2026-11-07): kawara, tongwa, glazed, sod, tes. FREE route only: Codex's built-in image
tool (`codex exec`, ChatGPT login, no API key), the house style anchor attached, the ROOF swatch prompt structure of
experiments/2026-10-27-roofs-temple/gen.py (top-down, edge to edge, seamless, eaves at the bottom, whole courses).
    python3 gen_plates.py name,name,...      -> raw/<name>.png (as generated), raw/<name>.log, prompts/<name>.md
On a usage limit: QUOTA_STOP.txt and stop. Runs several names in parallel with -j N."""
import os, sys, subprocess, time, shutil, tempfile, re
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = 'style-references/heroic-handpainted-tavern-v1.png'
LIMIT = re.compile(r"usage limit|rate limit|rate_limit|quota|too many requests|\b429\b|limit reached|hit your .*limit", re.I)
FINISH = ("Finish: diffuse-first hand-painted game art with broad soft gradients, subtle brush texture, low-frequency surface detail, mostly "
          "matte, softened natural colours. Avoid photorealism, gloss, tiny texture noise, comic outlines, text, letters, logos.")
HEAD = "Use your built-in image generation tool. Using the attached image only as a visual style guide for the Turnip Works house style (heroic hand-painted), "
PRES = ("Presentation: a perfectly top-down orthographic view looking straight down at the roof surface, laid flat. The roof surface fills the ENTIRE "
        "square canvas edge to edge: no border, no frame, no background colour, no vignette, no perspective, no long cast shadows, no objects, no ridge, "
        "no eaves edge, no gutter. Even, flat lighting. The square shows a 5 ft x 5 ft patch of roof, so keep elements at true scale for that area. It must "
        "tile seamlessly: whatever leaves the left edge continues on the right edge, and top continues to bottom. Keep the overall tone EVEN across the "
        "whole square (no big light or dark blotches), so that a grid of these squares does not show.")
FLAT = ("Painted FLAT, as if the roof slope were laid on the ground and seen from straight above (no foreshortening). Courses run exactly HORIZONTALLY "
        "across the image; the eaves are at the BOTTOM of the image and the ridge at the top, so each course overlaps the one BELOW it and its overlap "
        "shadow falls along its lower edge only. A whole number of courses fills the height and a whole number of pieces the width, so the square tiles "
        "seamlessly.")
SAVE = "\nSave the resulting PNG (any size is fine; square is best) into the current directory as {name}.png and print its path and pixel size."

def roof(subject, design):
    return HEAD + f"paint a roofing material swatch: {subject}.\n\n" + FINISH + "\n\n" + PRES + "\n\nSpecific design: " + design + " " + FLAT + SAVE

J = {
    'roofing-kawara': roof('Japanese silver-grey fired clay roof tiles (sangawara) of a late-Edo Kyoto townhouse', (
        "SIX horizontal courses of 10 in, SIX sangawara tiles per course (each 10 in wide). A sangawara is ONE wavy tile: a broad shallow concave pan on its"
        " left that rises into a rounded roll on its right, so every course reads as a row of soft S-waves, and the rolls line up in SIX straight vertical"
        " ridges running from the bottom edge to the top edge (NOT a broken bond: every course is directly above the one below). Each tile's lower end is a"
        " neat rounded lip. Smoky silver-grey ibushi clay, matte, cool blue-grey to warm pewter, single tiles a touch lighter or darker, spread evenly; a soft"
        " dark shadow under each course's lower lip and in each pan's trough beside the roll. No moss, no cracks, no missing tiles, no plants, no snow.")),
    'roofing-tongwa': roof('Chinese grey cylinder-tile roof (tongwa) of a mid-Qing Beijing courtyard house', (
        "SIX straight vertical columns of ROUND COVER TILES (half cylinders, about 5 in wide) running from the bottom edge to the top edge, and between them"
        " six channels of broad shallow CONCAVE PAN TILES (about 5 in of pan showing each side). The columns are spaced exactly 10 in apart. The tiles are"
        " laid in SIX courses of 10 in up the slope: each cover tile overlaps the one below with a small rounded lip and a thin soft shadow, each pan tile"
        " overlaps the pan below with a soft shadow line (NOT a broken bond: every course is directly above the one below). Matte unglazed blue-grey fired"
        " clay, cool slate grey with a few slightly warmer tiles spread evenly; the cover tiles a touch lighter on their rounded tops, the pan channels a"
        " touch darker. No glaze, no moss, no grass, no cracks, no ornaments, no end discs.")),
    'roofing-glazed': roof('Chinese GREEN glazed tile roof of a mid-Qing Beijing Buddhist temple hall', (   # green: the sensitivity read (yellow implies imperial patronage)
        "SIX straight vertical columns of ROUND glazed COVER TILES (half cylinders, about 5 in wide) running from the bottom edge to the top edge, and between"
        " them six channels of broad shallow CONCAVE glazed PAN TILES. The columns are spaced exactly 10 in apart. The tiles are laid in SIX courses of 10 in"
        " up the slope: each cover tile overlaps the one below with a small rounded lip and a thin soft shadow, each pan tile overlaps the pan below with a"
        " soft shadow line (NOT a broken bond: every course is directly above the one below). Deep jade to malachite GREEN glaze, single tiles a touch more"
        " blue-green or olive, spread evenly, a soft restrained sheen along the rounded tops of the cover tiles (no mirror gloss, no white glare), the pan"
        " channels a touch darker green. No yellow, no gold, no moss, no cracks, no ornaments, no end discs.")),
    'roofing-sod': roof('a Viking-Age turf roof (grass sods over birch bark) of a Norse longhouse', (
        "FOUR horizontal courses of overlapping cut TURF SODS, each course 15 in tall, laid grass side up like big ragged shingles: every course's lower"
        " edge is an irregular, slightly lumpy edge of earth and grass roots with a soft dark shadow beneath it, the grass on top short, thick and dense."
        " Painted as BROAD soft masses of green: mid summer green and olive with warmer straw-yellow patches of dry grass and a few darker clumps, evenly"
        " spread, the occasional dark earthy brown showing at a course edge. No flowers, no stones, no birch bark showing, no single blades of grass, no"
        " separate pieces: one continuous turf surface broken only by the four ragged course edges.")),
    'roofing-tes': roof("a medieval Rus' plank roof (tes) of a log house: long split boards running down the slope", (
        "TWO horizontal courses of 30 in each. Every course is SIX long split pine boards side by side, each 10 in wide and running straight UP and DOWN the"
        " image (along the slope, from the eaves at the bottom towards the ridge at the top), so the board joints are SIX straight vertical lines. Each"
        " board's lower end is cut square, slightly thicker, with a soft dark shadow under it where it laps over the course below; the boards of both"
        " courses line up in the same six columns. The boards OVERLAP sideways: each board's right edge laps over its neighbour's left edge, so every joint"
        " is a narrow raised board edge with a soft shadow beside it (double coverage, NO open gaps between boards). Weathered silvery grey-brown wood"
        " with warm honey streaks and a soft wood grain running along each board, single boards a touch lighter or darker, spread evenly. No nails, no"
        " moss, no knots bigger than a coin, no cross boards.")),
}

def gen(name):
    out = os.path.join(HERE, 'raw', f'{name}.png')
    if os.path.exists(out): return 'exists'
    wd = tempfile.mkdtemp(prefix=f'culture-roofs-{name}-')
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
    os.makedirs(os.path.join(HERE, 'raw'), exist_ok=True); os.makedirs(os.path.join(HERE, 'prompts'), exist_ok=True)
    names = sys.argv[1].split(','); j = int(sys.argv[sys.argv.index('-j') + 1]) if '-j' in sys.argv else 1
    def one(n):
        if os.path.exists(os.path.join(HERE, 'QUOTA_STOP.txt')): return n, 'QUOTA_STOP.txt exists: not sent'
        return n, gen(n)
    with ThreadPoolExecutor(j) as ex:
        for n, res in ex.map(one, names): print(time.strftime('%T'), n, res, flush=True)
