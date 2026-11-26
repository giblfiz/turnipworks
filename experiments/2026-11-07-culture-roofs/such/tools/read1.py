import json, os, random, re, subprocess, tempfile, sys
from PIL import Image
U = '/mnt/usb/turnip-works/lanes-2026-11-07/culture-roofs/such/'
SRC = {'ballcourt-table-before': U + 'before/ballcourt-table-before.png', 'ballcourt-top-before': U + 'before/ballcourt-top-before.png',
 'ballcourt-table-after': U + 'after/ballcourt-table-after.png', 'ballcourt-top-after': U + 'after/ballcourt-top-after.png',
 'stepwell-table-before': U + 'before/stepwell-table-before.png', 'stepwell-low-before': U + 'before/stepwell-low-before.png',
 'stepwell-table-after': U + 'after/stepwell-table-after.png', 'stepwell-low-after': U + 'after/stepwell-low-after.png',
 'mexhouse-table': U + 'before/mexhouse-table-before.png', 'mexhouse-wall': U + 'before/mexhouse-wall-before.png', 'walls-pair': U + 'before/walls-pair-before.png',
 'koshido-open': U + 'slide/koshido-open.png', 'koshido-shut': U + 'slide/koshido-shut.png',
 'plate-endwall': 'plates-for-assets/mes-court-endwall.png', 'plate-ball': 'plates-for-assets/mes-court-ball.png', 'plate-hipguard': 'plates-for-assets/mes-court-hip-guard.png', 'decal-line': 'flats/decal-mes-court-line.png'}
d = tempfile.mkdtemp(prefix='agy-such-'); key = {}
for k, p in SRC.items():
    n = f'{random.getrandbits(40):010x}.jpg'; key[n] = k
    im = Image.open(p)
    if im.mode == 'RGBA': bg = Image.new('RGBA', im.size, (128, 128, 132, 255)); bg.alpha_composite(im); im = bg
    im = im.convert('RGB'); im.thumbnail((1400, 1400)); im.save(os.path.join(d, n), quality=90)
json.dump(key, open('reads/read1-key.json', 'w'), indent=1)
names = sorted(key)
prompt = (f"These {len(names)} pictures ({', '.join(names)}) are from a 3D tabletop role-playing game: most are views of a room or place on the table seen from the players' camera, a few are single game pieces or flat floor decals on a grey background.\n"
 "Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.\n"
 "For EACH picture, in this order: (1) labels: any visible text, labels, UI or overlays (say 'none'); (2) see: what you literally see, one sentence; "
 "(3) what: what this place or object IS, as a player would name it (a room type, or an object); (4) culture: which real-world culture and period it suggests, or 'none'; "
 "(5) door: if a door or doorway is prominent, is it open or shut, and if open, did the door SWING on a hinge or SLIDE sideways (else 'n/a'); "
 "(6) modern: anything that looks modern or out of place for its setting (e.g. a phone, a sign, a machine), else 'none'; (7) wrong: anything that looks broken or wrong (floating, gaps, holes showing void, clipping).\n"
 "Answer ONLY a JSON list, one object per picture: [{\"file\": ..., \"labels\": ..., \"see\": ..., \"what\": ..., \"culture\": ..., \"door\": ..., \"modern\": ..., \"wrong\": ...}]")
for _ in range(2):
    r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', d, '-t', '1500', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True)
    m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
    try: out = json.loads(m.group(0)); break
    except Exception: print('retry', r.stdout[-500:], r.stderr[-300:], flush=True); out = None
res = {key.get(o.get('file'), o.get('file')): o for o in (out or [])}
json.dump(res, open('reads/read1.json', 'w'), indent=1); print(json.dumps(res, indent=1))
