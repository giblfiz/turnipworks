#!/usr/bin/env python3
"""Blind name read of many meshes in few agy calls (agy-run is shared by seven lanes; one call a mesh would take hours).
Each sheet: up to 12 meshes, tile A of the mesh gate's render (qa/<sku>.A.png, the table-distance view), each in a numbered
cell, on neutral grey. Gemini reads the numbers first, then names each object, its era and anything broken. The answer is
compared, as text, with the spec's gate description by a second (text-only) call.
    python3 tools/sheet_read.py [sku ...]          -> qa-extra/sheet-read.json   (default: every mesh with a qa/<sku>.A.png)"""
import json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
B = Path(__file__).resolve().parent.parent
A = {a['id']: a for a in json.loads((B / 'assets.json').read_text())['assets']}
ids = sys.argv[1:] or sorted(p.name[:-6] for p in (B / 'qa').glob('*.A.png'))
ids = [i for i in ids if (B / 'qa' / f'{i}.A.png').exists()]
out_p = B / 'qa-extra' / 'sheet-read.json'; out_p.parent.mkdir(exist_ok=True)
out = json.loads(out_p.read_text()) if out_p.exists() else {}
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 34)
except Exception: font = ImageFont.load_default()

def agy(d, prompt):
    for _ in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '600', '-C', str(d), prompt], capture_output=True, text=True, timeout=3600, stdin=subprocess.DEVNULL)
        for m in re.finditer(r'[\[{]', r.stdout):
            try: return json.JSONDecoder().raw_decode(r.stdout[m.start():])[0]
            except json.JSONDecodeError: continue
    return None

C = 300
for k in range(0, len(ids), 12):
    part = ids[k:k + 12]; d = Path(tempfile.mkdtemp(prefix='agy-sprawl-sheet-'))
    sheet = Image.new('RGB', (4 * C, 3 * C), (128, 128, 132)); dr = ImageDraw.Draw(sheet)
    for j, i in enumerate(part):
        t = Image.open(B / 'qa' / f'{i}.A.png').convert('RGBA'); bb = t.getbbox() or (0, 0, *t.size); t = t.crop(bb); t.thumbnail((C - 50, C - 50))
        x, y = (j % 4) * C, (j // 4) * C; cell = Image.new('RGBA', t.size, (128, 128, 132, 255)); cell.alpha_composite(t)
        sheet.paste(cell.convert('RGB'), (x + (C - t.width) // 2, y + 40 + (C - 40 - t.height) // 2)); dr.text((x + 8, y + 4), str(j + 1), fill=(255, 255, 255), font=font)
        dr.rectangle([x, y, x + C - 1, y + C - 1], outline=(90, 90, 96), width=2)
    sheet.save(d / 'sheet.jpg', quality=92)
    got = agy(d, f"Do NOT create, crop or write any files. Do not run commands or open other files; only look at sheet.jpg in this folder. It is a grid of {len(part)} numbered cells (1 to {len(part)}, the number in each cell's top-left corner), "
              "each showing ONE prop or building piece from a 3D tabletop game, small, as seen from across the table. First read the cell numbers. For EACH cell say what the object is (best name and one alternative), what era it belongs to "
              "(medieval/fantasy, modern, futuristic), and anything broken (melted, holes, floating bits, missing parts, unreadable). Answer ONLY with a JSON array: "
              '[{"cell": 1, "object": "...", "alt": "...", "era": "...", "broken": "none | ..."}, ...]')
    for g in got or []:
        try: i = part[int(g.get('cell')) - 1]
        except Exception: continue
        out[i] = {'read': g}
    shutil.rmtree(d, ignore_errors=True); out_p.write_text(json.dumps(out, indent=1))
    print(f'sheet {k // 12 + 1}: {len(got or [])} of {len(part)} read', flush=True)
todo = [i for i in ids if 'read' in out.get(i, {})]
items = '\n'.join(f"- {i}: wanted: {A[i]['gate']['desc']} (a modern-day object). Observer said: {json.dumps(out[i]['read'])}" for i in todo)
m = agy(B / 'qa-extra', "Do NOT create or write any files. An unprimed observer looked at small renders of tabletop props and named each one. For each item decide whether the observer's name (or the alternative) is the wanted kind of object, as it reads at table distance, and whether it reads as modern-day. A close synonym counts. Items:\n" + items +
        '\nAnswer ONLY with one JSON object keyed by item id: {"<id>": {"match": true, "modern": true, "note": "..."}, ...}') or {}
for i in todo: out[i]['match'] = m.get(i, {'match': None, 'note': 'no answer'})
out_p.write_text(json.dumps(out, indent=1))
for i in todo:
    v = out[i]; print(f"{'OK ' if v['match'].get('match') else 'BAD'} {i}: {v['read'].get('object')} / {v['read'].get('alt')} ({v['read'].get('era')}) broken: {v['read'].get('broken')} | {v['match'].get('note', '')[:80]}")
