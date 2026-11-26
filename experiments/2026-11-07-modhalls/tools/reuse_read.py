#!/usr/bin/env python3
"""Reuse vetting, step 2: tile the reuse_render.py renders into numbered contact sheets and get ONE blind Gemini read
per sheet (agy-run is a shared queue: few calls, many tiles). Gemini is told nothing about rooms or expectations; it
reads the cell numbers, names each object and judges its era from the picture alone.
  python3 tools/reuse_read.py SELECTION.json RENDERS_DIR OUT_DIR [--per 30] [--sheets-only]
SELECTION.json: {"selected": [[role, sku], ...]}. Tiles are shuffled (fixed seed) so neighbours do not prime a theme.
Table distance: each render is down-sampled to an effective size that scales with the prop's real size
(clamp(10 px per inch of its longest side, 110, 256)), then scaled back up, so small props show only the detail a
table camera would see. Writes OUT_DIR/sheet-NN.jpg, OUT_DIR/sheet-NN.key.json and OUT_DIR/reads.json."""
import json, random, re, secrets, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sel_p, rdir, odir = (Path(a) for a in sys.argv[1:4])
per = int(sys.argv[sys.argv.index('--per') + 1]) if '--per' in sys.argv else 30
LIB = json.loads((Path(__file__).resolve().parents[3] / 'tools/spawn-tuner/data/library.json').read_text())['objects']
sel = [tuple(x) for x in json.loads(sel_p.read_text())['selected']]
random.Random(1107).shuffle(sel)
odir.mkdir(parents=True, exist_ok=True)
reads_p = odir / 'reads.json'; reads = json.loads(reads_p.read_text()) if reads_p.exists() else {}
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
C, COLS = 256, 6

def tile(role, sku):
    t = Image.open(rdir / f'{sku}.png').convert('RGBA')
    eff = int(min(256, max(110, 10 * max(LIB[role]['size']))))
    if eff < 256: t = t.resize((eff, eff), Image.LANCZOS).resize((256, 256), Image.BICUBIC)
    bb = t.getbbox() or (0, 0, *t.size); t = t.crop(bb); t.thumbnail((C - 40, C - 50))
    cell = Image.new('RGBA', (C, C), (128, 128, 132, 255)); cell.alpha_composite(t, ((C - t.width) // 2, 40 + (C - 40 - t.height) // 2))
    return cell.convert('RGB')

def agy(d, prompt):
    for _ in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '600', '-C', str(d), prompt],
                           capture_output=True, text=True, timeout=3600, stdin=subprocess.DEVNULL)
        (odir / 'agy-raw.log').open('a').write(f'--- {d}\n{r.stdout}\n{r.stderr[-2000:]}\n')
        for m in re.finditer(r'\[', r.stdout):
            try: return json.JSONDecoder().raw_decode(r.stdout[m.start():])[0]
            except json.JSONDecodeError: continue
    return None

for k in range(0, len(sel), per):
    n = k // per + 1; part = sel[k:k + per]
    rows = (len(part) + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS * C, rows * C), (128, 128, 132)); dr = ImageDraw.Draw(sheet)
    for j, (role, sku) in enumerate(part):
        x, y = (j % COLS) * C, (j // COLS) * C
        sheet.paste(tile(role, sku), (x, y)); dr.text((x + 8, y + 4), str(j + 1), fill=(255, 255, 255), font=font)
        dr.rectangle([x, y, x + C - 1, y + C - 1], outline=(90, 90, 96), width=2)
    sheet.save(odir / f'sheet-{n:02d}.jpg', quality=92)
    (odir / f'sheet-{n:02d}.key.json').write_text(json.dumps([{'cell': j + 1, 'role': r, 'sku': s} for j, (r, s) in enumerate(part)], indent=0))
    if '--sheets-only' in sys.argv or all(s in reads for _, s in part): continue
    d = Path(tempfile.mkdtemp(prefix='agy-reuse-')); name = secrets.token_hex(5) + '.jpg'
    shutil.copy(odir / f'sheet-{n:02d}.jpg', d / name)
    got = agy(d, f"Do NOT create, crop or write any files. Do not run commands or open other files; only look at {name} in this folder. "
              f"It is a grid of {len(part)} numbered cells (1 to {len(part)}, number in each cell's top-left corner, {COLS} per row, read left to right, top to bottom). "
              "Each cell shows ONE small prop from a 3D tabletop game, rendered small, as it would look from across a table. "
              "First read the cell numbers and any visible labels. Then for EACH cell: name the object (best name and one alternative), and judge from the picture alone "
              "which era it reads as: \"modern\" (clearly present-day), \"neutral\" (could belong to any era, including today), or \"historical\" "
              "(reads as medieval, fantasy, rustic-antique or otherwise clearly not present-day). Give a confidence 0-100 in that era call, a short reason, "
              "and list any specific cue that looks old-fashioned or fantasy (e.g. material, construction, shape), or \"none\". "
              'Answer ONLY with a JSON array: [{"cell": 1, "object": "...", "alt": "...", "era": "modern|neutral|historical", "conf": 0, "reason": "...", "old_cues": "none | ..."}, ...]')
    for g in got or []:
        try: role, sku = part[int(g.get('cell')) - 1]
        except Exception: continue
        reads[sku] = {'role': role, 'sheet': n, **g}
    shutil.rmtree(d, ignore_errors=True); reads_p.write_text(json.dumps(reads, indent=1))
    print(f'sheet {n}: {len(got or [])} of {len(part)} read', flush=True)
