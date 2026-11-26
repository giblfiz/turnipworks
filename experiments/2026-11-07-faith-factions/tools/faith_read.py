#!/usr/bin/env python3
"""ONE blind Gemini read (agy-run on the subscription, shared lock, isolated folder, random file names) of a batch of
pictures of the faith factions: flats, emblems, mesh turn sheets or room stills. Unprimed: the reader is told only
that these are pieces for a tabletop game, never which faith each is meant to be. It reports, labels first: any text
or script-like marks, what the thing is, which religion (if any) it belongs to, whether it is accurate, and anything
disrespectful, caricatured or wrong.
    python3 tools/faith_read.py KIND OUT.json PATH [PATH ...]      KIND = flat | sheet | still | mixed (only changes the framing; mixed: files named sheet--* are piece sheets)
OUT.json maps each picture's stem to the reader's answer (and keeps the neutral name it was shown under)."""
import json, random, re, shutil, string, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
kind, out, paths = sys.argv[1], Path(sys.argv[2]), [Path(p) for p in sys.argv[3:]]
d = Path(tempfile.mkdtemp(prefix='agy-ff-')); names = {}
for p in paths:
    n = ('sheet-' if kind == 'mixed' and p.stem.startswith('sheet--') else '') + ''.join(random.choice(string.ascii_lowercase) for _ in range(6)) + '.jpg'
    im = Image.open(p).convert('RGBA'); im.thumbnail((1024, 1024))
    bg = Image.new('RGBA', im.size, (118, 120, 124, 255)); bg.alpha_composite(im); bg.convert('RGB').save(d / n, quality=90); names[n] = p.stem
FRAME = {'flat': 'Each is a flat painted piece (a wall hanging, a wall roundel, a floor design, a floor mat or a small menu icon) shown on grey.',
         'sheet': 'Each is ONE 3D game piece shown from four sides on one sheet, as it looks from a high camera.',
         'still': 'Each is a whole room seen from above at table distance.',
         'mixed': 'Files named sheet-*.jpg are ONE 3D game piece shown from four sides on one sheet; the other files are whole rooms seen from above at table distance.'}[kind]
P = (f"Look at the image files in this folder: {', '.join(names)}. Do NOT create, crop or write any files; do not run commands or open other files. "
     f"These are pieces for a heroic hand-painted fantasy tabletop game in which players can also build historical places of worship. {FRAME} "
     "For EACH file, in this order: (1) text: list every letter, word, number, or script-like mark you can see anywhere (a sacred symbol is not text, but say if a "
     "symbol looks like garbled writing); (2) what: what the object or room is, plainly; (3) faith: which religion it belongs to, if any, and from which region and "
     "period it looks (say 'none' if it is not religious); (4) accurate: is it drawn correctly for that faith (a symbol of the right shape, a figure with the right "
     "pose, number of arms, gesture), yes or no and why; (5) problems: anything disrespectful, caricatured, mocking, gory, malformed (extra or missing limbs, a broken "
     "face), or wrong for that faith; (6) reads: would a player recognise it at a glance, yes or no. Answer ONLY JSON keyed by file name: "
     '{"<file>": {"text": [], "what": "", "faith": "", "accurate": "", "problems": [], "reads": ""}, ...}')
r, txt = None, ''
for _ in range(2):
    ans = out.with_suffix('.answer.txt'); ans.unlink(missing_ok=True)  # (-o: the answer survives a stdout that comes back empty)
    try: txt = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', str(d), '-t', '900', '-o', str(ans), P], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=3600).stdout
    except subprocess.TimeoutExpired: txt = ''
    if ans.exists() and ans.stat().st_size: txt = ans.read_text() + '\n' + (txt or '')
    for m in re.finditer(r'\{', txt):
        try: r = json.JSONDecoder().raw_decode(txt[m.start():])[0]; break
        except json.JSONDecodeError: continue
    if r and any(k in names for k in r): break
shutil.rmtree(d, ignore_errors=True)
res = {names[f].removeprefix('sheet--'): {**v, 'shown_as': f} for f, v in (r or {}).items() if f in names}
prev = json.loads(out.read_text()) if out.exists() else {}
out.write_text(json.dumps({**prev, **res}, indent=1) + '\n')
print(f'{len(res)} of {len(names)} read -> {out}')
for k, v in res.items(): print(f"{k:32s} | text {v.get('text')} | {str(v.get('what'))[:48]:48s} | {str(v.get('faith'))[:30]:30s} | acc {str(v.get('accurate'))[:40]} | {v.get('problems')}")
if not res: print(txt[-1500:]); sys.exit(1)
