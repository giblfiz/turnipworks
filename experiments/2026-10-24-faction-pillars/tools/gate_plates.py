#!/usr/bin/env python3
"""Plate gate for the faction-pillars batch, on the Gemini SUBSCRIPTION (agy-run), never a paid API.

    python3 tools/gate_plates.py ID [ID ...]        (plates/<id>.png from the Codex image worker)

The factions-01 gate (../2026-10-13-factions/tools/ingest_plate.py) called gemini-vision.py, which is the paid Gemini API
and is blocked since 2026-10-20. Same three stages, same order:
  1. MEASURE (beats vision): native alpha present, corners clear, the object's alpha box keeps a margin on every side.
  2. BLIND READ: up to three plates per agy call, each a small JPG on neutral grey with a neutral name (a.jpg, b.jpg ...),
     sized as a background prop at table distance; Gemini reads any text first, then names object and motif, unprimed.
  3. MATCH: one text-only agy call compares each blind description with the requested object and motif.
Accepted plates are copied to masked/<id>.png (what the mesh routes read). Evidence: plate-qa/<id>.json.
"""
import hashlib, json, re, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

B = Path(__file__).resolve().parent.parent
AGY = '~/fauna-tools/agy-run'
A = {a['id']: a for a in json.loads((B / 'assets.json').read_text())['assets']}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def first_json(out):
    dec = json.JSONDecoder()
    for m in re.finditer(r'\{', out):
        try: return dec.raw_decode(out[m.start():])[0]
        except json.JSONDecodeError: continue
    return None


def agy(cwd, prompt, tries=2):
    for _ in range(tries):
        try: out = subprocess.run([AGY, '-t', '300', '-C', str(cwd), prompt], capture_output=True, text=True, timeout=400).stdout
        except subprocess.TimeoutExpired: out = ''
        r = first_json(out)
        if r: return r, out
    return None, out


def measure(png):
    im = Image.open(png)
    if im.mode != 'RGBA': return dict(ok=False, problems=['no alpha channel'])
    a = im.getchannel('A'); w, h = im.size
    corners = [a.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    box = a.point(lambda v: 255 if v > 127 else 0).getbbox()
    if not box: return dict(ok=False, problems=['empty alpha'])
    margin = min(box[0], box[1], w - box[2], h - box[3])
    semi = sum(1 for v in a.getdata() if 16 < v < 240) / (w * h)
    probs = ([] if max(corners) == 0 else ['corners not transparent']) + ([] if margin >= 8 else [f'object touches the frame (margin {margin}px)'])
    return dict(ok=not probs, problems=probs, size=[w, h], alpha_box=list(box), margin_px=margin, semi_alpha_fraction=round(semi, 4))


def small(png, dst, side=128):
    im = Image.open(png).convert('RGBA'); im.thumbnail((side, side), Image.Resampling.LANCZOS)
    bg = Image.new('RGB', im.size, (128, 128, 128)); bg.paste(im, mask=im.getchannel('A')); bg.save(dst, quality=92)


BLIND = ('Look at the image files {files} in this folder. Each one is a single small prop from a fantasy tabletop game, shown at the size it '
         'would appear on the table in the background of play, seen from an elevated camera, on a plain grey background. Work in this order. '
         'First, for each image, list every piece of text, label or watermark you can read (or none). Then describe each image plainly, '
         'without guessing what anyone wanted: the best name for the object, one alternative name, the bold symbol, creature or motif '
         'it is carved or shaped with, whether it is whole (nothing cut off) and one single object. Do not judge tiny detail. '
         'Answer ONLY with one JSON object keyed by file name: {{"a.jpg": {{"text": [], "object": "", "alt": "", "motif": "", "whole": true, "single": true}}, ...}}')
MATCH = ('An unprimed observer looked at small pictures of tabletop props and described each one. For each item, decide whether the '
         'description identifies BOTH the requested object kind AND the requested motif, as it would read at table distance. '
         'Ignore small decorative details and colour words. Items:\n{items}\nAnswer ONLY with one JSON object keyed by item id: '
         '{{"<id>": {{"ok": true, "problems": []}}, ...}}')


def main(ids):
    ids = [i for i in ids if (B / 'plates' / f'{i}.png').exists()]
    for d in ['inputs', 'prompts', 'masked', 'plate-qa', 'work']: (B / d).mkdir(exist_ok=True)
    recs = {}
    for i in ids:
        src = B / 'plates' / f'{i}.png'; dst = B / 'inputs' / f'{i}.png'
        if dst.exists() and sha(dst) != sha(src): shutil.copy2(dst, B / 'inputs' / f'{i}.{sha(dst)[:12]}.png')
        shutil.copy2(src, dst); (B / 'prompts' / f'{i}.md').write_text(A[i]['prompt'] + '\n')
        recs[i] = dict(id=i, time=datetime.now(timezone.utc).isoformat(), generator='Codex built-in image_gen (ChatGPT plan)', prompt=A[i]['prompt'],
                       plate=str(dst.relative_to(B)), sha256=sha(dst), refs=[], measure=measure(dst), status='rejected')
    for n in range(0, len(ids), 3):
        chunk = ids[n:n + 3]; d = B / 'work' / f'blind-{datetime.now():%H%M%S}-{n}'; d.mkdir(parents=True)
        names = {}
        for k, i in zip('abc', chunk): small(B / 'inputs' / f'{i}.png', d / f'{k}.jpg'); names[f'{k}.jpg'] = i
        r, raw = agy(d, BLIND.format(files=', '.join(names)))
        (d / 'answer.txt').write_text(raw); (d / 'names.json').write_text(json.dumps(names))
        for f, i in names.items(): recs[i]['blind'] = (r or {}).get(f) or {'error': 'no answer', 'raw': raw[-400:]}
    items = '\n'.join(f"- {i}: requested: {A[i]['gate']['desc']}. Observer said: {json.dumps(recs[i].get('blind'))}" for i in ids)
    m, raw = agy(B / 'work', MATCH.format(items=items))
    for i in ids:
        rec = recs[i]; rec['match'] = (m or {}).get(i) or {'ok': False, 'problems': ['no match answer'], 'raw': raw[-300:]}
        b = rec.get('blind') or {}
        rec['status'] = 'accepted' if rec['measure']['ok'] and rec['match'].get('ok') and b.get('whole', False) and b.get('single', False) else 'rejected'
        if rec['status'] == 'accepted': shutil.copy2(B / 'inputs' / f'{i}.png', B / 'masked' / f'{i}.png')
        else: (B / 'masked' / f'{i}.png').unlink(missing_ok=True)
        (B / 'plate-qa' / f'{i}.json').write_text(json.dumps(rec, indent=1) + '\n')
        gm = B / 'gate-manifest.json'; st = json.loads(gm.read_text()) if gm.exists() else {'assets': {}}
        st['assets'][i] = rec; gm.write_text(json.dumps(st, indent=1) + '\n')
        print(i, rec['status'], '|', b.get('object'), '/', b.get('motif'), '|', rec['measure']['problems'], rec['match'].get('problems'))


if __name__ == '__main__':
    main(sys.argv[1:])
