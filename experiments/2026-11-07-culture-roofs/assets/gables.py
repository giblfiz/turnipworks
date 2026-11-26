#!/usr/bin/env python3
"""Gable pictures for the culture wall families (2026-11-07), ONLY: jpn-shoji, jpn-shrine, chn-brick, chn-temple, norse-stave, rus-log.
    python3 gables.py [bake|install|all]
bake:    experiments/2026-10-27-roofs-temple/bake/bake.py's own code (each family's generated wall-straight mesh, exterior face, unlit
         colour + normals, the body band), run with its output redirected to assets/gables/ (bake.py itself would overwrite its tracked
         out/bake.json with only these six families).
install: copies gable-wall--<family>(.normal).webp into engine/client/data/roof/ (UNLINKING any target first, so nothing writes through
         a symlink into main) and adds the six families' rows to engine/client/data/gables.json `walls` (every other key kept as it is)."""
import json, os, shutil, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.abspath(os.path.join(HERE, '../../..'))
assert W != '<repo>', 'run in the worktree'
FAMS = ['jpn-shoji', 'jpn-shrine', 'chn-brick', 'chn-temple', 'norse-stave', 'rus-log']
SRC = os.path.join(W, 'experiments/2026-10-27-roofs-temple/bake/bake.py'); OUT = os.path.join(HERE, 'gables')
DST = os.path.join(W, 'engine/client/data/roof'); MAN = os.path.join(W, 'engine/client/data/gables.json')
rev = lambda p: __import__('hashlib').sha1(open(p, 'rb').read()).hexdigest()[:8]

def bake():
    code = open(SRC).read()
    assert code.count("os.path.join(HERE, 'out'") == 3, 'bake.py changed: check the redirect'
    code = code.replace("os.path.join(HERE, 'out'", 'os.path.join(OUT_DIR')
    code = code.replace("asyncio.run(main([x for a in sys.argv[1:] for x in a.split(',') if x]))", 'asyncio.run(main(FAMS_))')
    os.makedirs(OUT, exist_ok=True)
    g = {'__file__': SRC, '__name__': 'bake_culture', 'OUT_DIR': OUT, 'FAMS_': FAMS}
    exec(compile(code, SRC, 'exec'), g)

GRADE = json.load(open(os.path.join(HERE, 'gables', 'grade.json'))) if os.path.exists(os.path.join(HERE, 'gables', 'grade.json')) else {}
# grade.json {family: gain}: the colour picture is multiplied by `gain` (2026-11-07: TRELLIS left the chn-brick and norse-stave wall
# textures dark, and a dark gable on the shaded side read as "an open dark void"; the gain is measured in game, wall body vs gable)

def install():
    b = json.load(open(os.path.join(OUT, 'bake.json'))); man = json.load(open(MAN)); walls = man['walls']
    for fam in FAMS:
        c, n = os.path.join(OUT, f'gable-wall--{fam}.webp'), os.path.join(OUT, f'gable-wall--{fam}.normal.webp')
        for s in (c, n):
            d = os.path.join(DST, os.path.basename(s))
            if os.path.lexists(d): os.unlink(d)    # never write through a symlink into main
            if fam in GRADE and '.normal' not in s:
                im = np.asarray(Image.open(s).convert('RGB')).astype(float) * GRADE[fam]
                Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).save(d, 'WEBP', quality=88, method=6)
            else: shutil.copyfile(s, d)
        c_ = os.path.join(DST, os.path.basename(c)); mean = np.asarray(Image.open(c_).convert('RGB')).reshape(-1, 3).mean(axis=0); x = b[fam]
        walls[fam] = {'mean': [round(float(v) / 255, 4) for v in mean], 'url': f'roof/gable-wall--{fam}.webp', 'normal': f'roof/gable-wall--{fam}.normal.webp',
                      'rev': rev(c_), 'ft': [5.0, round(x['body_ft'][1] - x['body_ft'][0], 3)], 'from': x['sku'], **({'gain': GRADE[fam]} if fam in GRADE else {})}
        print(fam, walls[fam]['from'], walls[fam]['ft'], 'holes', x['holes'])
    man['walls'] = dict(sorted(walls.items()))
    json.dump(man, open(MAN, 'w'), indent=1)

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('bake', 'all'): bake()
    if what in ('install', 'all'): install()
