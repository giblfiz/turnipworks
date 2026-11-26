"""Shared bits of the flying-alt run (experiments/2026-11-06-pawns/fly): paths, the flier list, the standing set."""
import json, os, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]                      # the worktree
MAIN = Path('<repo>')   # the main checkout: READ ONLY (the standing set's binaries live there)
SET = MAIN / 'experiments/2026-10-06-figures/set'
PUB = SET / 'published'
FLIERS = """foe-dragon-wyrmling foe-dragon-young-black foe-dragon-young-green foe-dragon-young-red foe-dragon-young-white
foe-wyvern foe-griffon foe-hippogriff foe-pegasus foe-giant-eagle foe-giant-bat foe-harpy foe-gargoyle foe-angel foe-imp
foe-pixie foe-stirge foe-giant-wasp foe-vulture-demon foe-manticore foe-chimera foe-kobold-winged foe-couatl foe-succubus
foe-mephit foe-homunculus beast-hawk beast-owl beast-raven""".split()


def standing():
    return {f['id']: f for f in json.loads((PUB / 'manifest.json').read_text())['figures']}


def spec():
    return {a['id']: a for a in json.loads((SET / 'assets.json').read_text())['assets']}


AGY = '~/fauna-tools/agy-run'


def gemini(prompt, images, model='gemini-3.8-flash-high', timeout=300):   # (a read takes 30-60 s; one hung 9 min holding the shared lock)
    """A blind visual read through agy-run (the subscription; never an API key): the images are copied into an empty
    folder under neutral names (img1.png ...), agy runs THERE with stdin closed, file access forbidden in the prompt."""
    import shutil, tempfile
    d = tempfile.mkdtemp(prefix='flyread-')
    names = []
    for k, p in enumerate(images, 1):
        n = f'img{k}{Path(p).suffix}'; shutil.copy2(p, os.path.join(d, n)); names.append(n)
    P = prompt + f"\n\nThe images are in this folder: {', '.join(names)}. Look at them. Do NOT create, crop or write any files. Do not read any other files or folders."
    out = os.path.join(d, 'out.txt')
    for m in (model, 'gemini-4-argon-high'):
        subprocess.run(['flock', '/tmp/agy.lock', 'timeout', str(timeout + 300), AGY, '-m', m, '-C', d, '-t', str(timeout), '-o', out, P],
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(out) and os.path.getsize(out) > 20: break
    txt = open(out).read() if os.path.exists(out) else ''
    shutil.rmtree(d, ignore_errors=True)
    return txt


def last_json(txt):
    """The last {...} block in a reply that parses."""
    import re
    best, end = None, -1
    for m in re.finditer(r'\{', txt):
        if m.start() < end: continue   # inside the object already parsed: an inner object is not the answer
        depth = 0
        for j in range(m.start(), len(txt)):
            c = txt[j]
            if c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    try: best = json.loads(txt[m.start():j + 1]); end = j + 1
                    except Exception: pass
                    break
    return best
