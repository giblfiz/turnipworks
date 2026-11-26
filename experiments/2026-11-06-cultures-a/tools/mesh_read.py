#!/usr/bin/env python3
"""ONE blind Gemini read per three meshes (agy-run is shared by every lane on the box; the faction-pillars gate spent two
calls a mesh and the orientation read one more): each mesh rendered turned four ways (tools/render_views.py: yaw
0/90/180/270 from the elevated three-quarter camera), the four on one sheet labelled A-D, three sheets a call. Gemini
reports the labels first, then names the thing unprimed, its culture, whether it is whole and sound, and which view
shows its FRONT. The text match against the spec is done by the caller (the lane agent reads mesh-read.json beside
assets.json); the geometric rules are qa_mesh.py / qa_unpainted.py (tools/qa.sh with NOVISION=1).
    python3 tools/mesh_read.py CODE [id ...]        -> CODE/mesh-read.json (merged), CODE/mesh-qa/<id>-y*.png
Yaw for data/orient.json: the front in A -> 0, B -> 90, C -> 180, D -> 270 (render_views.py turns the mesh by +yaw)."""
import hashlib, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
E = Path(__file__).resolve().parent.parent
B = E / sys.argv[1]
A = {a['id']: a for a in json.loads((B / 'assets.json').read_text())['assets']}
ids = sys.argv[2:] or sorted(p.stem for p in (B / 'models').glob('*.glb'))
out_p = B / 'mesh-read.json'; out = json.loads(out_p.read_text()) if out_p.exists() else {}
sha = lambda p: hashlib.sha1(p.read_bytes()).hexdigest()[:12]
ids = [i for i in ids if (B / 'models' / f'{i}.glb').exists() and out.get(i, {}).get('sha') != sha(B / 'models' / f'{i}.glb')]
YAW = {'A': 0, 'B': 90, 'C': 180, 'D': 270}
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except Exception: font = ImageFont.load_default()
(B / 'mesh-qa').mkdir(exist_ok=True)
for i in ids:
    pre = B / 'mesh-qa' / i
    if not (B / 'mesh-qa' / f'{i}-y270.png').exists():
        subprocess.run(['blender', '--background', '--python', str(E / 'tools/render_views.py'), '--', str(B / 'models' / f'{i}.glb'), str(pre)], capture_output=True, timeout=600)
def tile(p, n=300):
    im = Image.open(p).convert('RGBA'); im = im.crop(im.getbbox() or (0, 0, *im.size)); s = n * 0.9 / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    bg = Image.new('RGBA', (n, n), (150, 150, 155, 255)); bg.alpha_composite(im, ((n - im.width) // 2, (n - im.height) // 2)); return bg.convert('RGB')
def sheet(i):
    S = Image.new('RGB', (2 * 310 + 10, 2 * 310 + 10), (255, 255, 255)); d = ImageDraw.Draw(S)
    for k, (L, y) in enumerate(YAW.items()):
        x0, y0 = 10 + (k % 2) * 310, 10 + (k // 2) * 310; S.paste(tile(B / 'mesh-qa' / f'{i}-y{y}.png'), (x0, y0)); d.text((x0 + 6, y0 + 4), L, fill=(200, 0, 0), font=font)
    return S
P = ("Each of these {n} pictures ({files}) is a sheet of FOUR renders, labelled A, B, C, D, of ONE 3D prop from a heroic hand-painted fantasy tabletop "
     "game, the same prop turned a quarter turn between views, seen from an elevated three-quarter camera on a grey background.\n"
     "Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.\n"
     "For EACH sheet, in this order: (1) the labels you can read; (2) WITHOUT guessing what anyone wanted, the best plain name for the object and one "
     "alternative; (3) the culture or region and period it looks like it comes from (or 'generic'); (4) is it whole and sound (no missing chunks, no melted "
     "or blobby areas, no parts floating free, no thin broken bits)? list any defects; (5) which ONE of A, B, C, D shows its FRONT (the side you would "
     "face to use it: the open side of an alcove or shelf, the face of a statue or creature, the drawer fronts of a chest, the seat of a chair) facing the "
     "camera, or 'none' if it looks the same from every side; and your confidence 0-100.\n"
     'Answer ONLY with a JSON array: [{{"file": "<name>", "labels": "", "object": "", "alt": "", "culture": "", "sound": true, "defects": [], "front": "A|B|C|D|none", "confidence": 0}}, ...]')
dec = json.JSONDecoder()
def first_json(txt):
    for m in re.finditer(r'\[', txt):
        try: return dec.raw_decode(txt[m.start():])[0]
        except json.JSONDecodeError: continue
    return None
ready = [i for i in ids if (B / 'mesh-qa' / f'{i}-y270.png').exists()]
import os
CH = int(os.environ.get("CHUNK", "3"))  # sheets a call (6 when the shared agy queue is long)
for k in range(0, len(ready), CH):
    part = ready[k:k + CH]; dd = Path(tempfile.mkdtemp(prefix='agy-ca-mesh-')); names = {}
    for j, i in enumerate(part): n = f'sheet-{j + 1}.jpg'; sheet(i).save(dd / n, quality=90); names[n] = i
    r = None
    for _ in range(2):
        try: txt = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', str(dd), '-t', '600', P.format(n=len(part), files=', '.join(names))], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=2400).stdout
        except subprocess.TimeoutExpired: txt = ''
        r = first_json(txt)
        if isinstance(r, list) and r: break
    shutil.rmtree(dd, ignore_errors=True)
    by = {x.get('file'): x for x in (r or []) if isinstance(x, dict)}
    for n, i in names.items():
        x = by.get(n) or {'error': 'no answer'}
        out[i] = {**x, 'sha': sha(B / 'models' / f'{i}.glb'), 'yaw': YAW.get(x.get('front'), 0), 'wanted': A.get(i, {}).get('gate', {}).get('desc', '')}
        print(f"{i:34s} {x.get('object', '?')!s:40.40s} | {x.get('culture', '')!s:24.24s} | sound {x.get('sound')} {x.get('defects', '')} | front {x.get('front')} {x.get('confidence')}", flush=True)
    cur = json.loads(out_p.read_text()) if out_p.exists() else {}; cur.update({i: out[i] for i in names.values()}); out_p.write_text(json.dumps(cur, indent=1))  # (merged: two reads may run at once)
