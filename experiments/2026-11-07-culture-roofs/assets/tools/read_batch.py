#!/usr/bin/env python3
"""ONE blind Gemini read (agy-run, the subscription; shared lock /tmp/agy.lock) of a mixed batch: the roofing plates (each as a
2 x 2 tiling, so a seam would show), the roof-section previews (3 x 3 tiled, tilted) and the ornament plates (small, on grey).
An isolated folder holding only the pictures under random names; labels and text first, then structured observations.
    python3 tools/read_batch.py plates|meshes  [--name TAG]      -> reads/<TAG>.json (what each picture was, what Gemini said)
`meshes`: the mesh renders (renders/<id>-34.png) in sheets of up to six. Nothing else is read."""
import json, random, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
E = Path(__file__).resolve().parent.parent
T = {t['id']: t for t in json.loads((E / 'targets.json').read_text())}
what = sys.argv[1]; tag = sys.argv[sys.argv.index('--name') + 1] if '--name' in sys.argv else what
(E / 'reads').mkdir(exist_ok=True)

def on_grey(im, size):
    im = im.convert('RGBA'); bb = im.getbbox() or (0, 0, *im.size); im = im.crop(bb)
    s = size * 0.86 / max(im.size); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    bg = Image.new('RGBA', (size, size), (128, 128, 132, 255)); bg.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2)); return bg.convert('RGB')

def tile2(p, size=512):
    im = Image.open(p).convert('RGB').resize((size // 2, size // 2), Image.LANCZOS); out = Image.new('RGB', (size, size))
    for i in range(2):
        for j in range(2): out.paste(im, (i * size // 2, j * size // 2))
    return out

items = []   # (kind, id, PIL image)
if what == 'plates':
    for p in sorted((E / 'seamless').glob('roofing-*.png')): items.append(('roofing', p.stem, tile2(p)))
    for p in sorted((E / 'previews').glob('section-*.png')): items.append(('section', p.stem, Image.open(p).convert('RGB').resize((600, 467), Image.LANCZOS)))
    for i in T:
        p = E / 'plates' / f'{i}.png'
        if p.exists(): items.append(('ornament', i, on_grey(Image.open(p), 256)))
elif what == 'roofing':   # each style as ONE picture: its swatch tiled 2 x 2 (left) beside its tilted 3D patch (right)
    for p in sorted((E / 'seamless').glob('roofing-*.png')):
        s = p.stem.replace('roofing-', ''); pv = Image.open(E / 'previews' / f'section-{s}.png').convert('RGB'); pv.thumbnail((640, 512))
        sh = Image.new('RGB', (512 + 16 + pv.width, max(512, pv.height)), (40, 40, 44)); sh.paste(tile2(p), (0, 0)); sh.paste(pv, (528, 0)); items.append(('roofing', s, sh))
else:                     # each mesh as ONE sheet: front three-quarter (left), table view from high above (right)
    ids = sys.argv[sys.argv.index('--ids') + 1].split(',') if '--ids' in sys.argv else list(T)
    for i in ids:
        a, b = E / 'renders' / f'{i}-34.png', E / 'renders' / f'{i}-top.png'
        if a.exists() and b.exists():
            sh = Image.new('RGB', (496, 248), (128, 128, 132)); sh.paste(on_grey(Image.open(a), 240), (0, 4)); sh.paste(on_grey(Image.open(b), 240), (252, 4)); items.append(('mesh', i, sh))
d = tempfile.mkdtemp(prefix='agy-croof-'); key = {}
for kind, i, im in items:
    n = f'{random.getrandbits(40):010x}.jpg'; key[n] = (kind, i); im.save(Path(d) / n, quality=90)
names = ', '.join(sorted(key))
if what == 'roofing': prompt = (f"These {len(key)} pictures ({', '.join(sorted(key))}) each show ONE roof covering from a 3D tabletop game: on the LEFT a square swatch seen"
          " straight from above, shown tiled 2 x 2 (four copies side by side); on the RIGHT the same covering built as a 3D patch tilted like a roof slope.\n"
          "Do NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.\nFor EACH picture: first report any"
          " visible labels or text (or \"none\"); then the roofing MATERIAL and how it is laid, which culture and period it looks like (or \"none\"), whether the"
          " left and right halves look like the same covering, and any defect (a visible SEAM or grid where the copies meet, a blotch that repeats, holes)."
          ' Answer with ONLY a JSON array: [{"file": "<name>", "text": "...", "what": "...", "culture": "...", "defect": "..."}, ...]')
elif what == 'meshes': prompt = (f"These {len(key)} pictures ({', '.join(sorted(key))}) each show ONE 3D model from a tabletop game, twice: on the LEFT from its front at a"
          " three-quarter angle, on the RIGHT from high above, as a player sees it on the table.\nDo NOT create, crop or write any files. Do not run commands"
          " or open any other files. Only look at the images.\nFor EACH picture: first report any visible labels, letters or text (or \"none\"); then say in a few"
          " plain words WHAT the object is (as a player would name it), which culture and period it looks like (or \"none\"), whether it is SOUND (one solid"
          " piece, no holes, no floating or broken parts, no melted or blobby areas), and which way its FRONT faces in the LEFT view (towards the viewer, away,"
          ' left, right, or no clear front). Answer with ONLY a JSON array: [{"file": "<name>", "text": "...", "what": "...", "culture": "...", "sound": "...", "front": "...", "defect": "..."}, ...]')
else: prompt = (f"These {len(key)} pictures ({names}) come from a 3D tabletop game. Some are SQUARE SWATCHES of a roof covering seen straight from above"
          " (each swatch is shown tiled 2 x 2, four copies side by side); some are a patch of a 3D roof covering tilted like a roof slope; the rest show ONE"
          " roof ornament or roof piece each, on grey.\nDo NOT create, crop or write any files. Do not run commands or open any other files. Only look at the images.\n"
          "For EACH picture: first report any visible labels, letters or text (or \"none\"); then say in a few plain words WHAT it is (as a player would name it:"
          " for a roof covering, the material and how it is laid), which culture and period it looks like (or \"none\"), and any defect (for a swatch or"
          " tiled patch: a visible SEAM, a line or a grid where the copies meet, a blotch that repeats; for an object: cut off, two objects, floating"
          " parts, a floor or base under it, script-like marks, blurry). Answer with ONLY a JSON array:"
          ' [{"file": "<name>", "text": "...", "what": "...", "culture": "...", "defect": "..."}, ...]')
got = []
for _ in range(2):
    r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', d, '-t', '1200', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True)
    m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
    try: got = json.loads(m.group(0)); break
    except Exception: print('  (retry)', r.stdout[-400:], r.stderr[-300:], flush=True)
shutil.rmtree(d, ignore_errors=True)
out = {}
for g in got:
    k = key.get(g.get('file'))
    if k: out[k[1]] = {'kind': k[0], **{x: g.get(x) for x in ('text', 'what', 'culture', 'defect', 'sound', 'front')}}
(E / 'reads' / f'{tag}.json').write_text(json.dumps(out, indent=1))
for kind, i, _ in items:
    v = out.get(i, {}); want = T[i]['see'] if i in T else ''
    print(f"{kind:8s} {i:22s} | text: {v.get('text')} | {v.get('what')} [{v.get('culture')}] | sound: {v.get('sound')} | front: {v.get('front')} | defect: {v.get('defect')}" + (f"\n{'':33s}want: {want}" if want else ''), flush=True)
print(f'{len(out)}/{len(items)} read -> reads/{tag}.json')
