#!/usr/bin/env python3
"""Round 3 Gemini checks through agy-run (subscription; serial under /tmp/agy.lock). Two kinds, never mixed in one call:

  blind   sheets of up to 8 of the new icons, each its exact 31 px export centred on 67 px of the ring's #1c1f24 ground
          (the 10-15 candidate.png, laid side by side), letters in shuffled order, no names or intended meanings. The
          answer for each letter is written to that picture's 10-15 reads/ directory (result.json, raw.txt), the sheet
          and its whole answer kept under checks/.
  match   a contact sheet: existing icons of the set (labelled R1..) above the new ones (A..) at 62 and 31 px; Gemini
          names each first, then says per new icon whether it belongs to the same set (YES / NO and why).

  python3 blind3.py blind <set> [--retry]      python3 blind3.py match <set>
Run package3.py first (it writes every candidate.png and prompt.txt).
"""
import json, random, re, shutil, subprocess, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[1]; BATCH = REPO / 'experiments/2026-10-15-ring-icons'
sys.path.insert(0, str(BATCH / 'tools'))
import process as P  # noqa: E402
from r3common import GROUP_OF, batch_prompt  # noqa: E402  (the exact blind text; package3.py stores it as each picture's blind_prompt)
AGY = str(HERE / 'agy-run-bounded'); F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
mode, s = sys.argv[1], sys.argv[2]; retry = '--retry' in sys.argv
CHECKS = HERE / 'checks'; CHECKS.mkdir(exist_ok=True)
only = [a for a in sys.argv[3:] if not a.startswith('--')]
pics = [p for p in json.loads((HERE / 'plan-round3.json').read_text())['pictures'] if p['set'] == s and not p['id'].endswith('.r3') and (REPO / p['source']).is_file()]
import os
if os.environ.get('IDS'): pics = [p for p in pics if p['id'] in os.environ['IDS'].split(',')]
for p in pics: p['blind_prompt'] = batch_prompt(GROUP_OF[p['category']])
GROUPS = {'cond': ['cond'], 'roof': ['roof'], 'misc': ['pawn', 'object', 'ground']}
def agy(folder, prompt, out):
    for model in ('gemini-4-argon-high', 'gemini-3.8-flash-high'):
        stamp = datetime.now(timezone.utc).isoformat()
        r = subprocess.run(['flock', '/tmp/agy.lock', 'timeout', '1500', AGY, '-m', model, '-C', str(folder), '-t', '600', '-o', str(out), prompt], capture_output=True, text=True, timeout=7200, stdin=subprocess.DEVNULL)
        text = out.read_text().strip() if out.exists() else ''
        if r.returncode == 0 and text: return text, f'{model} via agy-run (subscription)', stamp, r.stderr.strip()[-2000:]
    return '', f'{model} via agy-run (subscription)', stamp, r.stderr.strip()[-2000:]

def chunks(xs, n):
    k = max(1, -(-len(xs) // n)); size = -(-len(xs) // k); return [xs[i:i + size] for i in range(0, len(xs), size)]

if mode == 'blind':
    for g, cats in GROUPS.items():
        if only and g not in only: continue
        todo = [p for p in pics if p['category'] in cats and (retry or not (P.read_directory(p) / 'result.json').exists() or json.loads((P.read_directory(p) / 'result.json').read_text()).get('returncode') != 0)]
        for n, part in enumerate(chunks(todo, 8) if todo else []):
            random.Random(f'{s}{g}{n}').shuffle(part)
            letters = 'ABCDEFGH'[:len(part)]
            sheet = Image.new('RGB', (len(part) * 67 + (len(part) - 1) * 12 + 24, 67 + 40), '#111316'); d = ImageDraw.Draw(sheet)
            for i, p in enumerate(part):
                x = 12 + i * 79; sheet.paste(Image.open(P.read_directory(p) / 'candidate.png'), (x, 8)); d.text((x + 28, 80), letters[i], fill='#e8e2d4', font=F)
            name = f'blind-{s}-{g}-{n}'; tmpd = Path(tempfile.mkdtemp(prefix='b3-')); sheet.save(tmpd / 'sheet.png'); sheet.save(CHECKS / f'{name}.png')
            prompt = f"Look at the image file {tmpd}/sheet.png. Do NOT create, crop or write any files.\n\n" + batch_prompt(g)
            text, model, stamp, err = agy(tmpd, prompt, tmpd / 'out.txt'); shutil.rmtree(tmpd, ignore_errors=True)
            (CHECKS / f'{name}.txt').write_text(prompt + '\n\n=====\n' + text + '\n')
            (CHECKS / f'{name}.key.json').write_text(json.dumps({l: p['id'] for l, p in zip(letters, part)}, indent=1))
            for l, p in zip(letters, part):
                m = re.findall(rf'^\W*{l}\W*:\s*(.+)$', text, re.M); line = m[-1].strip() if m else ''
                read = f"{line}\n\n(Batched blind sheet {name}.png, letter {l}; full answer: experiments/2026-10-29-ring-attack-target/checks/{name}.txt)" if line else ''
                res = {'timestamp': stamp, 'model': model, 'returncode': 0 if read else 1, 'read': read, 'error': err, 'status': 'needs-review' if read else 'gate-error'}
                rd = P.read_directory(p); P.atomic_json(rd / 'result.json', res); (rd / 'raw.txt').write_text(res['read'] + '\n' + res['error'])
                print(s, p['id'], '->', line or '(no line)', flush=True)
elif mode == 'match':
    A = P.ASSETS / s
    EXIST = {'cond': ['pawn.cond.stunned', 'pawn.cond.unconscious', 'pawn.cond.poisoned', 'pawn.cond.charmed'],
             'roof': ['roof.style.thatch', 'roof.style.flat', 'roof.style.slate', 'roof.style.tile'],
             'misc': ['pawn.sheet', 'pawn.damage', 'edit.lift', 'room.height.taller']}
    for g, cats in GROUPS.items():
        if only and g not in only: continue
        part_all = [p for p in pics if p['category'] in cats]
        for n, part in enumerate(chunks(part_all, 10) if part_all else []):
            refs = [Image.open(A / f'{r}.webp').convert('RGBA') for r in EXIST[g]]; new = [Image.open(A / f'{P.stem(p)}.webp').convert('RGBA') for p in part]
            cols = max(len(refs), min(len(new), 5)); rows_new = -(-len(new) // 5); cw = 110
            sheet = Image.new('RGB', (cols * cw + 40, (1 + rows_new) * 150 + 30), '#1c1f24'); d = ImageDraw.Draw(sheet)
            def cell(im, x, y, lab):
                a, b = im.resize((62, 62), Image.LANCZOS), im.resize((31, 31), Image.LANCZOS)
                sheet.paste(a, (x + 24, y + 26), a); sheet.paste(b, (x + 39, y + 98), b); d.text((x + 40, y + 2), lab, fill='#eee8da', font=F)
            for i, im in enumerate(refs): cell(im, 20 + i * cw, 10, f'R{i + 1}')
            letters = 'ABCDEFGHIJ'
            for i, im in enumerate(new): cell(im, 20 + (i % 5) * cw, 160 + (i // 5) * 150, letters[i])
            name = f'match-{s}-{g}-{n}' + ('-' + os.environ['IDS'].replace(',', '+') if os.environ.get('IDS') else ''); tmpd = Path(tempfile.mkdtemp(prefix='m3-')); sheet.save(tmpd / 'sheet.png'); sheet.save(CHECKS / f'{name}.png')
            prompt = (f"Look at the image file {tmpd}/sheet.png. Do NOT create, crop or write any files.\n\nIt is a contact sheet of round painted UI "
                      f"icons for the ring menu of a fantasy 3D tabletop game, each at 62 px and again at 31 px on the menu's dark ground. First read "
                      f"every label on the sheet (R1-R{len(refs)} on the top row, then the letters). Then name in a few words what each icon depicts. "
                      f"R1-R{len(refs)} are existing members of ONE painted icon set. The lettered icons are new. For EACH lettered icon: does it belong "
                      f"to the same set, as if by the same artist (ground, rim, disc size, painting style, brushwork, palette, lighting)? Answer YES or "
                      f"NO with the reason, then say if it is legible at 31 px. End with one line per letter exactly in the form `X: YES|NO - <reason>`.")
            text, model, stamp, err = agy(tmpd, prompt, tmpd / 'out.txt'); shutil.rmtree(tmpd, ignore_errors=True)
            (CHECKS / f'{name}.txt').write_text(prompt + '\n\n=====\n' + text + '\n')
            (CHECKS / f'{name}.key.json').write_text(json.dumps({l: p['id'] for l, p in zip(letters, part)}, indent=1))
            for l, p in zip(letters, part):
                m = re.findall(rf'^\W*{l}\W*:\s*(.+)$', text, re.M); print(s, 'match', p['id'], '->', m[-1].strip() if m else '(no line)', flush=True)
