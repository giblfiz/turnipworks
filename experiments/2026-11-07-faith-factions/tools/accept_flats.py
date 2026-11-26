#!/usr/bin/env python3
"""The faiths' flat pieces -> fth/accepted-flats.json (read by tools/spawn-tuner/factions.py add_faction_assets) and the
four picker emblems -> tools/spawn-tuner/assets/emblems/<faith>.webp (256 px, as the thirteen).
Accepted = a painted plate in fth/flats/ whose blind read (fth/reads-flats.json, tools/faith_read.py) shows no text (the
Om roundel and emblem may show the Om sign and nothing else) and no problem, unless fth/flat-overrides.json says
otherwise with a reason. Alpha is cleaned first (gate_plates.clean_alpha: haze < 48 to 0, specks dropped).
    python3 tools/accept_flats.py [--emblems] [--provisional]"""
import importlib.util, json, sys
from pathlib import Path
from PIL import Image
E = Path(__file__).resolve().parent.parent; F = E / 'fth'; ROOT = E.parents[1]
spec = importlib.util.spec_from_file_location('g', E / 'tools/gate_plates.py'); sys.argv = [sys.argv[0], 'fth'] + sys.argv[1:]; g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
A = {a['id']: a for a in json.loads((F / 'flats.json').read_text())['assets']}
reads = json.loads((F / 'reads-flats.json').read_text()) if (F / 'reads-flats.json').exists() else {}
over = json.loads((F / 'flat-overrides.json').read_text()) if (F / 'flat-overrides.json').exists() else {}
OM = lambda t: all('om' in str(x).lower() or 'ॐ' in str(x) for x in t)
(F / 'flats-clean').mkdir(exist_ok=True)
rows, emblems = [], []
for i, a in A.items():
    p = F / 'flats' / f'{i}.png'
    if not p.exists(): print(f'{i}: no plate'); continue
    r = reads.get(i)
    text_ok = r is not None and (not r.get('text') or (a['shape'] == 'hindu' and OM(r['text'])))
    verdict = over.get(i, {}).get('verdict') or ('accept' if r and text_ok and not r.get('problems') else 'accept' if '--provisional' in sys.argv else 'hold')  # (--provisional: for test stills only, before the reads; never committed)
    if verdict != 'accept': print(f'{i}: HELD (read: {r and {k: r.get(k) for k in ("text", "problems")}})'); continue
    out = F / 'flats-clean' / f'{i}.png'; g.clean_alpha(p, out)
    if a['kind'] == 'emblem':
        if '--emblems' in sys.argv:
            im = Image.open(out).convert('RGBA'); bb = im.getbbox(); im = im.crop(bb); side = max(im.size); sq = Image.new('RGBA', (side, side)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
            dst = ROOT / 'tools/spawn-tuner/assets/emblems' / f"{a['shape']}.webp"; sq.resize((256, 256), Image.LANCZOS).save(dst, 'WEBP', lossless=True); emblems.append(str(dst.relative_to(ROOT)))
        continue
    rows.append(dict(sku=i, object=a['object'], shape=a['shape'], path=f'flats-clean/{i}.png', size=a['size']))
(F / 'accepted-flats.json').write_text(json.dumps(rows, indent=1) + '\n')
print(f'{len(rows)} flats accepted -> fth/accepted-flats.json; emblems: {emblems}')
