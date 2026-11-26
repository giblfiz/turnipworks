#!/usr/bin/env python3
"""Which way a mesh faces, and what it is, in one blind read: a sheet per mesh with the mesh turned four ways (A-D = yaw
0/90/180/270, as data/orient.json turns it; tools/render_views.py, the camera in front at 30 degrees up), 8 sheets per
agy call (the shared lock is the bottleneck). Gemini reads the labels first, names the object, and says which of A-D shows
its FRONT toward the camera (the side you use or face). The answer is the mesh's yaw.
    python3 tools/orient_read.py [sku ...]        -> qa-extra/orient-read.json (merged)"""
import json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
B = Path(__file__).resolve().parent.parent; V = B / 'qa-extra' / 'views'; V.mkdir(parents=True, exist_ok=True)
ids = sys.argv[1:]
out_p = B / 'qa-extra' / 'orient-read.json'; out = json.loads(out_p.read_text()) if out_p.exists() else {}
YAW = {'A': 0, 'B': 90, 'C': 180, 'D': 270}
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 34)
except Exception: font = ImageFont.load_default()
for i in ids:
    if not (V / f'{i}-y270.png').exists():
        subprocess.run(['blender', '--background', '--python', str(B / 'tools/render_views.py'), '--', str(B / 'models' / f'{i}.glb'), str(V / i)], capture_output=True, timeout=600)
def tile(p, n=300):
    im = Image.open(p).convert('RGBA'); im = im.crop(im.getbbox() or (0, 0, *im.size)); s = n * 0.88 / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    bg = Image.new('RGBA', (n, n), (150, 150, 155, 255)); bg.alpha_composite(im, ((n - im.width) // 2, (n - im.height) // 2)); return bg.convert('RGB')
def sheet(i):
    S = Image.new('RGB', (4 * 310 + 10, 370), (255, 255, 255)); d = ImageDraw.Draw(S)
    for k, (L, y) in enumerate(YAW.items()): S.paste(tile(V / f'{i}-y{y}.png'), (10 + k * 310, 60)); d.text((18 + k * 310, 10), L, fill=(200, 0, 0), font=font)
    return S
ids = [i for i in ids if (V / f'{i}-y270.png').exists()]
for k in range(0, len(ids), 8):
    part = ids[k:k + 8]; dd = tempfile.mkdtemp(prefix='agy-sprawl-o-'); names = {}
    for j, i in enumerate(part): n = f'sheet-{j + 1}.jpg'; sheet(i).save(Path(dd) / n, quality=90); names[n] = i
    prompt = (f"Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the {len(part)} images ({', '.join(names)}) in this folder.\n"
              "Each picture is a sheet of four renders labelled A, B, C, D of ONE 3D tabletop-game prop, turned four ways, all from the same camera (in front, a little above).\n"
              "For EACH sheet: first report the labels you can see; then say what the object is (a few words) and what era it belongs to; then which ONE of A, B, C, D "
              "shows the object's FRONT toward the camera: the side a person uses or faces (a sofa's or chair's seat, a screen's face, a cabinet's or fridge's doors, "
              "a counter's customer side, a machine's controls, a bed's foot end with the headboard at the back, a sign's face, a lamp head's side), and how sure you are (0-100). "
              "If it looks the same from every side, say so (symmetric).\n"
              'Answer with ONLY a JSON array: [{"file": "<name>", "labels": "...", "object": "...", "era": "...", "front": "A" or "B" or "C" or "D", "symmetric": false, "confidence": <0-100>}, ...]')
    got = []
    for attempt in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', dd, '-t', '900', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=3600)
        m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
        try: got = json.loads(m.group(0)); break
        except Exception: print('  (retry)', r.stdout[-300:], flush=True)
    for g in got:
        i = names.get(g.get('file')); L = str(g.get('front', '')).strip().upper()[:1]
        if i: out[i] = {'yaw': YAW.get(L), 'object': g.get('object'), 'era': g.get('era'), 'symmetric': g.get('symmetric'), 'conf': g.get('confidence')}
    shutil.rmtree(dd, ignore_errors=True); out_p.write_text(json.dumps(out, indent=1))
    print(f'sheets {k + 1}-{k + len(part)}: {len(got)} answers', flush=True)
for i in ids: print(i, out.get(i))
