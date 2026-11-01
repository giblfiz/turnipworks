#!/usr/bin/env python3
"""Which way a new mesh faces: one sheet per mesh, its partner's render on top (the way the game turns the partner) and
the new mesh turned four ways below (tools/render_views.py, labelled A-D = yaw 0/90/180/270). Gemini (agy-run, an
isolated folder, "Do NOT create, crop or write") says which of A-D faces the same way as the reference. The answer is
the mesh's yaw for data/orient.json; the matching view is copied to mesh-qa/<id>-34.png for the mesh gate.
  python3 tools/orient_read.py [id ...]     -> orient-read.json (merged)"""
import json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
E = Path(__file__).resolve().parent.parent
T = {t['id']: t for t in json.loads((E / 'targets.json').read_text())}
ids = [i for i in (sys.argv[1:] or list(T)) if (E / 'mesh-qa' / f'{i}-y0.png').exists()]
out_p = E / 'orient-read.json'; out = json.loads(out_p.read_text()) if out_p.exists() else {}
YAW = {'A': 0, 'B': 90, 'C': 180, 'D': 270}
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 34)
except Exception: font = ImageFont.load_default()

def tile(p, n=300):
    im = Image.open(p).convert('RGBA'); im = im.crop(im.getbbox() or (0, 0, *im.size)); s = n * 0.88 / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    bg = Image.new('RGBA', (n, n), (150, 150, 155, 255)); bg.alpha_composite(im, ((n - im.width) // 2, (n - im.height) // 2)); return bg.convert('RGB')

def sheet(i):
    S = Image.new('RGB', (4 * 310 + 10, 360 + 360), (255, 255, 255)); d = ImageDraw.Draw(S)
    S.paste(tile(E / 'refs' / f"{T[i]['partner']}-34.png"), (465, 10)); d.text((470, 12), 'REFERENCE', fill=(200, 0, 0), font=font)
    for k, (L, y) in enumerate(YAW.items()):
        S.paste(tile(E / 'mesh-qa' / f'{i}-y{y}.png'), (10 + k * 310, 400)); d.text((18 + k * 310, 402), L, fill=(200, 0, 0), font=font)
    return S

for k in range(0, len(ids), 6):
    part = ids[k:k + 6]; dd = tempfile.mkdtemp(prefix='agy-openmesh-o-'); names = {}
    for j, i in enumerate(part): n = f'sheet-{j + 1}.jpg'; sheet(i).save(Path(dd) / n, quality=90); names[n] = i
    prompt = (f"Each of these {len(part)} pictures ({', '.join(names)}) is a sheet: at the top, a REFERENCE render of a 3D game prop; below it, four renders "
              "labelled A, B, C, D of a second model (the same prop in another state: opened or shut), turned four ways, all from the same camera.\n"
              "Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.\n"
              "For EACH sheet: first report the labels you can see; then say which ONE of A, B, C, D shows the second model facing the SAME way as the "
              "reference (its front, the side with its door, lid opening, lock, face, glazing or window, toward the same side of the picture as the reference's front), "
              "and how sure you are (0-100).\n"
              'Answer with ONLY a JSON array: [{"file": "<name>", "labels": "...", "match": "A" or "B" or "C" or "D", "confidence": <0-100>, "why": "..."}, ...]')
    got = []
    for attempt in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', dd, '-t', '900', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=1500)
        m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
        try: got = json.loads(m.group(0)); break
        except Exception: print('  (retry)', r.stdout[-300:], flush=True)
    for g in got:
        i = names.get(g.get('file')); L = str(g.get('match', '')).strip().upper()[:1]
        if i and L in YAW: out[i] = {'yaw': YAW[L], 'conf': g.get('confidence'), 'why': g.get('why')}; shutil.copy(E / 'mesh-qa' / f'{i}-y{YAW[L]}.png', E / 'mesh-qa' / f'{i}-34.png')
    shutil.rmtree(dd, ignore_errors=True); out_p.write_text(json.dumps(out, indent=1))
    print(f'sheets {k + 1}-{k + len(part)}: {len(got)} answers', flush=True)
for i in ids: print(i, out.get(i))
