#!/usr/bin/env python3
"""Tile icons for the Modern genre's six BUILDING types (2026-11-07, modtypes lane: Harry's "types should be kinds of
*building*"). The sprawl pack's icon frame and route, unchanged (experiments/2026-11-06-sprawl/flats/gen.py): FREE route
only, Codex's built-in image tool (`codex exec`, ChatGPT login), one request at a time, 20 s apart; the icon set's anchor
(experiments/2026-10-03-build-icons/raw/type-TAV.png, main tree, read only) attached. On a usage limit: QUOTA_STOP.txt.
    python3 gen.py type-APT,type-OFC,...   |  python3 gen.py list
Raw plates -> /mnt/usb/turnip-works/lanes-2026-11-07/modtypes/icons/raw/<name>.png (git-ignored PNGs, kept off the
worktree); then post.py -> icons/<name>.png, 128 px RGBA, which go to engine/client/data/icons/ (git-ignored too)."""
import os, sys, subprocess, time, shutil, tempfile, re
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = '/mnt/usb/turnip-works/lanes-2026-11-07/modtypes/icons/raw'
ICON_ANCHOR = 'experiments/2026-10-03-build-icons/raw/type-TAV.png'
PAUSE = 20
LIMIT = re.compile(r"usage limit|rate limit|rate_limit|quota|too many requests|\b429\b|try again (in|at)|limit reached|hit your .*limit", re.I)
ICON = """Use your built-in image generation tool. Generate ONE square image: a single app icon for a tabletop-RPG building toolkit, showing {subject}.
Style: bold, simple, chunky silhouette that reads at 48 pixels; a small three-quarter vignette seen from slightly above; flat-shaded with soft matte gradients, quiet and modern (no outlines, no comic inking, no gloss, no photorealism); minimal detail
Background: perfectly uniform solid chroma green (#00FF00) edge to edge; the subject must not reflect green light.
The attached image is the style anchor for this icon set: match its rendering, lighting, palette, level of detail, camera angle and scale exactly (a different subject, the same family of icons).
Save the resulting PNG into the current directory as {name}.png and print its path and pixel size."""
TAIL = ('. A MODERN present-day subject, in the same icon style; a palette of warm grey, brick red, muted teal, mustard, cream and a touch of '
        'navy instead of wood and stone; no real-world brand or logo; no text, no letters, no numbers')
J = {k: s + TAIL for k, s in {
    'type-APT': "a modern apartment block as a small vignette: a chunky five-storey block of flats in warm grey and brick red with rows of small balconies and lit windows, a wooden water tank on its flat roof",
    'type-OFC': "a modern office tower as a small vignette: a chunky tall skyscraper of blue-grey glass and steel bands, a bright lit glass entrance lobby at its foot",
    'type-BAR': "a bar and nightclub as a small vignette: a chunky two-storey dark brick building with a black door, a glowing hot-pink neon cocktail-glass sign above the door, a short red velvet rope on two chrome posts in front",
    'type-SHP': "a row of city storefronts as a small vignette: three chunky little shop units side by side, each with a big glass shop window and a striped awning, one mustard, one teal, one red",
    'type-WHS': "a warehouse and garage as a small vignette: a chunky corrugated-metal warehouse with a big half-raised roller shutter door, a toy-like white delivery van parked in front of it",
    'type-HID': "a gang hideout as a small vignette: a chunky run-down brick building with boarded-up windows, a rusted oil drum with a fire glowing in it in front, a short section of chain-link fence beside it",
}.items()}

def gen(name):
    out = os.path.join(RAW, f'{name}.png')
    if os.path.exists(out): return 'exists'
    prompt = ICON.format(subject=J[name], name=name)
    open(os.path.join(RAW, 'prompts', f'{name}.gen.txt'), 'w').write(prompt + f'\n\n[attached: {ICON_ANCHOR}]\n')
    wd = tempfile.mkdtemp(prefix=f'modtypes-{name}-')
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write', '-i', ICON_ANCHOR, '-']
    t0 = time.time()
    for attempt in range(2):
        open(os.path.join(HERE, 'requests.log'), 'a').write(f'{time.strftime("%F %T")} {name} attempt {attempt + 1}\n')
        try: r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900); txt = r.stdout[-6000:] + '\n' + r.stderr[-4000:]
        except subprocess.TimeoutExpired: txt = 'TIMEOUT 900s'
        open(os.path.join(RAW, f'{name}.log'), 'a').write(txt)
        got = os.path.join(wd, f'{name}.png')
        if os.path.exists(got): shutil.move(got, out); return f'ok {time.time() - t0:.0f}s'
        if re.search(r'at capacity', txt, re.I) and attempt == 0: time.sleep(120); continue
        hit = [l for l in txt.splitlines() if LIMIT.search(l) and 'Use your built-in' not in l and 'at capacity' not in l.lower()]
        if hit:
            open(os.path.join(HERE, 'QUOTA_STOP.txt'), 'a').write(f'{time.strftime("%F %T")} while generating {name}:\n' + '\n'.join(hit[-12:]) + '\n')
            return 'QUOTA'
        time.sleep(PAUSE)
    return 'FAILED'

if __name__ == '__main__':
    names = sys.argv[1].split(',')
    if names == ['list']: print('\n'.join(J)); sys.exit()
    for n in names:
        if os.path.exists(os.path.join(HERE, 'QUOTA_STOP.txt')): print('QUOTA_STOP.txt exists: not sending', n, flush=True); break
        res = gen(n); print(time.strftime('%T'), n, res, flush=True)
        if res == 'QUOTA': break
        if res.startswith(('ok', 'FAILED')): time.sleep(PAUSE)
