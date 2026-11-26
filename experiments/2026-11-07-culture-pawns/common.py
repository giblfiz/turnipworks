"""Shared bits of the culture-pawns run (experiments/2026-11-07-culture-pawns): paths, the roster, the Gemini read.
Big intermediates (plates, meshes, renders) live on the USB disk (USB below); this folder keeps the code, the small JSON
and the published set's manifest (set/published), whose binaries are git-ignored."""
import json, os, shutil, subprocess, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]                                   # the worktree
MAIN = Path('<repo>')         # the main checkout: READ ONLY (the body references live there)
FIGS = MAIN / 'experiments/2026-10-06-figures'           # the figure set's route: measure.py, thumbs.py, the body plates
USB = Path('/mnt/usb/turnip-works/lanes-2026-11-07/culture-pawns')
SET = HERE / 'set'                                    # the set folder, laid out as the 10-06 set's (assets.json, masked/, models/, qa/, tiers/, published/)
WORK = USB / 'work'                                      # plates as painted, composites, rejects, renders
AGY = '~/fauna-tools/agy-run'


def roster():
    return json.loads((HERE / 'roster.json').read_text())['figures']


def gemini(prompt, images, model='gemini-3.8-flash-high', timeout=420):
    """A blind visual read through agy-run (the subscription; never an API key): the images are copied into an empty
    folder under neutral random names, agy runs THERE with stdin closed, file writes forbidden in the prompt."""
    import secrets
    d = tempfile.mkdtemp(prefix='cpread-', dir=str(USB / 'agy') if (USB / 'agy').exists() else None)
    names = []
    for k, p in enumerate(images, 1):
        n = f'img{k}-{secrets.token_hex(3)}{Path(p).suffix}'; shutil.copy2(p, os.path.join(d, n)); names.append(n)
    P = prompt + "\n\nThe images, in order: " + ', '.join(f'img{k} = {n}' for k, n in enumerate(names, 1)) + \
        ". Look at them. Do NOT create, crop or write any files. Do not read any other files or folders."
    out = os.path.join(d, 'out.txt')
    for m in (model, 'gemini-4-argon-high'):
        subprocess.run(['flock', '/tmp/agy.lock', 'timeout', str(timeout + 300), AGY, '-m', m, '-C', d, '-t', str(timeout), '-o', out, P],
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(out) and os.path.getsize(out) > 20: break
    txt = open(out).read() if os.path.exists(out) else ''
    shutil.rmtree(d, ignore_errors=True)
    return txt


def last_json(txt):
    """The last {...} block in a reply that parses (an inner object of one already parsed is not the answer)."""
    best, end = None, -1
    for k, c in enumerate(txt):
        if c != '{' or k < end: continue
        depth = 0
        for j in range(k, len(txt)):
            if txt[j] == '{': depth += 1
            elif txt[j] == '}':
                depth -= 1
                if depth == 0:
                    try: best = json.loads(txt[k:j + 1]); end = j + 1
                    except Exception: pass
                    break
    return best
