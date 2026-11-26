#!/usr/bin/env python3
"""Stills of the published culture figures (render_table.py in Blender, with the engine's numbers) and Harry's contact
sheet. Everything goes to the USB disk as it is made: /mnt/usb/turnip-works/lanes-2026-11-07/culture-pawns/stills/.
    python3 stills.py table [ids...]     stills/table/<id>.png   one figure alone at table distance (the blind reads)
    python3 stills.py line [codes...]    stills/line/<CODE>.png  a culture's seven side by side, fighter / rogue / caster first
    python3 stills.py trio [codes...]    stills/trio/<CODE>-<race>.png  a race's fighter, rogue, caster (and <CODE>-npc) at table distance
    python3 stills.py close [ids...]     stills/close/<id>.png   one figure close, from the front
    python3 stills.py sheet              stills/contact-sheet.png + stills/contact-<CODE>.png (lines, thumbnails, names)
    ... --procs=3"""
import concurrent.futures, json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE, SET, USB

PUB = SET / 'published'; OUT = USB / 'stills'
ORDER = ['JPN', 'CHN', 'IND', 'NRS', 'MDE', 'RUS', 'MES']
ROLE = {'fighter': 0, 'rogue': 1, 'caster': 2}


def figs():
    return {f['id']: f for f in json.loads((PUB / 'manifest.json').read_text())['figures']}


def J(f):
    return {'glb': str(PUB / f['files']['hero']), 'k': f['scale'], 'y0': f['y0'], 'c': f['centre'], 'yaw': f.get('facing_deg') or 0}


def render(mode, out, fs, timeout=1200):
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(['blender', '--background', '--python', str(HERE / 'render_table.py'), '--', mode, str(out), json.dumps({'figs': fs})], capture_output=True, text=True, timeout=timeout)
    if not out.exists(): raise RuntimeError(r.stdout[-1200:] + r.stderr[-600:])
    return out


def culture(code, F):
    return sorted([f for f in F.values() if f.get('setting') == code], key=lambda f: (ROLE.get(f.get('role'), 9), f['name']))


def sheet(F):
    """A contact sheet per culture: a row per race (Human, Elf, ... then Townsfolk), a column per role, the gallery
    thumbnail and the name in each cell; the line still of the culture's humans on top when it exists."""
    from PIL import Image, ImageDraw, ImageFont
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18); big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30); mid = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    except Exception: font = big = mid = ImageFont.load_default()
    R = json.loads((HERE / 'roster.json').read_text()); period = {c['setting']: c['period'] for c in R['cultures']}
    RACES = ['human', 'elf', 'dwarf', 'small', 'orc', 'tiefling', 'dragonborn']; RL = {'small': 'Halfling'}
    cell, lab, made = 230, 170, []
    for code in ORDER:
        fs = culture(code, F)
        if not fs: continue
        rows = [(RL.get(r, r.capitalize()), [f for f in fs if f.get('role') != 'npc' and (f.get('race') or 'human') == r]) for r in RACES]
        rows = [x for x in rows if x[1]] + [('Townsfolk', [f for f in fs if f.get('role') == 'npc'])]
        cols = max(3, max(len(x[1]) for x in rows)); W = lab + cols * cell; H = 60 + len(rows) * (cell + 34)
        im = Image.new('RGB', (W, H), (34, 31, 28)); d = ImageDraw.Draw(im)
        d.text((16, 12), f"{fs[0].get('kin')}  ·  {period.get(code, '')}", fill=(240, 228, 205), font=big)
        for ri, (name, row) in enumerate(rows):
            y = 60 + ri * (cell + 34); d.text((14, y + cell // 2 - 12), name, fill=(240, 228, 205), font=mid)
            if name != 'Townsfolk':   # a column per role, a gap where one is not made yet
                byrole = {f.get('role'): f for f in row}; row = [byrole.get(r) for r in ('fighter', 'rogue', 'caster')]
            for k, f in enumerate(row):
                if f is None: x = lab + k * cell; d.rectangle([x + 7, y, x + cell - 7, y + cell - 14], outline=(90, 80, 70)); d.text((x + 20, y + cell // 2), 'being re-made', fill=(150, 140, 130), font=font); continue
                t = PUB / (f.get('thumb') or '-'); x = lab + k * cell
                if t.exists(): im.paste(Image.open(t).convert('RGB').resize((cell - 14, cell - 14)), (x + 7, y))
                else: d.rectangle([x + 7, y, x + cell - 7, y + cell - 14], outline=(90, 80, 70)); d.text((x + 20, y + cell // 2), 'not made yet', fill=(150, 140, 130), font=font)
                d.text((x + 8, y + cell - 10), (f.get('tile') or f['name'])[:24], fill=(240, 228, 205), font=font)
        p = OUT / f'contact-{code}.png'; im.save(p); made.append(p); print('contact sheet:', p, im.size)
    if made:   # all seven side by side, half size: the one picture to open first
        ims = [Image.open(p) for p in made]; ims = [i.resize((i.width // 2, i.height // 2)) for i in ims]
        A = Image.new('RGB', (sum(i.width for i in ims) + 12 * len(ims), max(i.height for i in ims)), (20, 18, 16)); x = 0
        for i in ims: A.paste(i, (x, 0)); x += i.width + 12
        A.save(OUT / 'contact-all.jpg', quality=88); print('contact sheet, all:', OUT / 'contact-all.jpg', A.size)
    return made


if __name__ == '__main__':
    mode = sys.argv[1]; args = [a for a in sys.argv[2:] if not a.startswith('--')]
    procs = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--procs=')), 3))
    F = figs()
    if mode == 'sheet': sheet(F); sys.exit()
    if mode == 'trio':   # per culture: a trio per race (fighter, rogue, caster), and the NPCs as one more picture
        jobs = []
        for c in (args or ORDER):
            fs = culture(c, F)
            for race in dict.fromkeys(f.get('race') or 'human' for f in fs if f.get('role') != 'npc'):
                t = [f for f in fs if f.get('role') != 'npc' and (f.get('race') or 'human') == race]
                if len(t) == 3: jobs.append((OUT / 'trio' / f'{c}-{race}.png', t))
            n = [f for f in fs if f.get('role') == 'npc']
            if n: jobs.append((OUT / 'trio' / f'{c}-npc.png', n))
        import random   # the roles in a SHUFFLED order per picture (a blind reader must not learn "fighter on the left"); the order is kept beside it
        (OUT / 'trio').mkdir(parents=True, exist_ok=True); jj = []
        for o, t in jobs:
            t = t[:]; random.Random(o.stem).shuffle(t); (o.with_suffix('.json')).write_text(json.dumps([f['id'] for f in t])); jj.append((o, [J(f) for f in t]))
        jobs = jj
    elif mode == 'line': jobs = [(OUT / 'line' / f'{c}.png', [J(f) for f in culture(c, F)]) for c in (args or ORDER) if culture(c, F)]
    else: jobs = [(OUT / mode / f'{i}.png', [J(F[i])]) for i in (args or sorted(F))]
    with concurrent.futures.ThreadPoolExecutor(procs) as pool:
        futs = {pool.submit(render, mode, o, fs): o for o, fs in jobs if '--force' in sys.argv or not o.exists()}
        for fu in concurrent.futures.as_completed(futs):
            try: print('made', fu.result(), flush=True)
            except Exception as e: print('FAILED', futs[fu], repr(e)[:400], flush=True)
