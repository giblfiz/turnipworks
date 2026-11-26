#!/usr/bin/env python3
"""The plate gate's semantic half, BATCHED (agy-run is a shared queue): up to 15 plates a call, each a small JPG on grey
under a random name in an empty folder outside the repo; Gemini reports any text FIRST, then names each object unprimed.
Matching the description to the request is done here, by hand, in work/plate-reads.md (no second agy call).
    python3 tools/plate_read.py ID [ID ...]      -> work/plate-reads/<stamp>/{names.json,answer.txt,read.json}"""
import json, random, string, subprocess, sys, tempfile
from datetime import datetime
from pathlib import Path
from PIL import Image
B = Path(__file__).resolve().parent.parent; AGY = '~/fauna-tools/agy-run'
OUT = B / 'work' / 'plate-reads'; OUT.mkdir(parents=True, exist_ok=True)
Q = ('Look at the image files {files} in this folder. Each is ONE small prop or building piece for a tabletop roleplaying game, on a plain grey '
     'background, at about the size it would appear on the table. Work in this order. FIRST, for each image, list every piece of text, letter, '
     'number, logo or watermark you can read or see (or none). THEN describe each plainly, without guessing what anyone wanted: the best name for '
     'the object, one alternative name, its most distinctive visible feature, what era or setting it seems to belong to (medieval, modern, '
     'near-future/cyberpunk, ...), whether it is whole (nothing cut off) and a single object, and anything that looks wrong or unsafe to print '
     'as a game piece (a real brand, a religious symbol, a caricature). Answer ONLY with one JSON object keyed by file name: '
     '{{"x.jpg": {{"text": [], "object": "", "alt": "", "feature": "", "era": "", "whole": true, "single": true, "concerns": ""}}, ...}}')
ids = [i for i in sys.argv[1:] if (B / 'plates' / f'{i}.png').exists()]
for k in range(0, len(ids), 15):
    part = ids[k:k + 15]; d = Path(tempfile.mkdtemp(prefix='agy-cybp-')); names = {}
    for i in part:
        n = ''.join(random.choices(string.ascii_lowercase, k=6)) + '.jpg'
        im = Image.open(B / 'plates' / f'{i}.png').convert('RGBA'); im.thumbnail((256, 256), Image.Resampling.LANCZOS)
        bg = Image.new('RGB', im.size, (128, 128, 128)); bg.paste(im, mask=im.getchannel('A')); bg.save(d / n, quality=92); names[n] = i
    out = subprocess.run(['flock', '/tmp/agy.lock', AGY, '-t', '600', '-C', str(d), Q.format(files=', '.join(names))], capture_output=True, text=True, timeout=3600, stdin=subprocess.DEVNULL).stdout
    st = OUT / datetime.now().strftime('%H%M%S'); st.mkdir()
    (st / 'names.json').write_text(json.dumps(names, indent=1)); (st / 'answer.txt').write_text(out)
    dec = json.JSONDecoder(); r = None
    for j in range(len(out)):
        if out[j] == '{':
            try: r = dec.raw_decode(out[j:])[0]; break
            except json.JSONDecodeError: pass
    read = {names[f]: v for f, v in (r or {}).items() if f in names}
    (st / 'read.json').write_text(json.dumps(read, indent=1))
    for i, v in read.items(): print(i, '|', v.get('text'), '|', v.get('object'), '/', v.get('feature'), '/', v.get('era'), '| whole', v.get('whole'), '|', v.get('concerns'))
    print('missing:', [i for i in part if i not in read])
