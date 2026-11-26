# COPY of ../2026-11-07-cyberpunk-pawns/agy.py (dinos lane, 2026-11-07)
"""Gemini through agy-run (the subscription; never an API key), as the fly lane's common.py: the images are copied into
an empty folder under the names given (neutral, random), agy runs THERE with stdin closed, file access forbidden in the
prompt, under the shared /tmp/agy.lock (one read at a time on this box), with a timeout."""
import json, os, re, shutil, subprocess, tempfile
from pathlib import Path
AGY = '~/fauna-tools/agy-run'


def gemini(prompt, images, model='gemini-3.8-flash-high', timeout=420):
    """images: [path] or [(path, name)]"""
    d = tempfile.mkdtemp(prefix='dnread-')
    names = []
    for k, p in enumerate(images, 1):
        p, n = (p if isinstance(p, tuple) else (p, f'img{k}{Path(p).suffix}'))
        shutil.copy2(p, os.path.join(d, n)); names.append(n)
    P = prompt + f"\n\nThe images are in this folder: {', '.join(names)}. Look at every one of them. Do NOT run commands, create, crop or write any files. Do not read any other files or folders."
    out = os.path.join(d, 'out.txt')
    for m in (model, 'gemini-4-argon-high'):
        subprocess.run(['flock', '/tmp/agy.lock', 'timeout', str(timeout + 600), AGY, '-m', m, '-C', d, '-t', str(timeout), '-o', out, P],
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(out) and os.path.getsize(out) > 20: break
    txt = open(out).read() if os.path.exists(out) else ''
    shutil.rmtree(d, ignore_errors=True)
    return txt


def last_json(txt):
    """The last top-level {...} block in a reply that parses."""
    best, end = None, -1
    for m in re.finditer(r'\{', txt):
        if m.start() < end: continue
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
