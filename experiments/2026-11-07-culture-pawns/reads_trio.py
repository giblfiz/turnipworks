#!/usr/bin/env python3
"""Gemini's BLIND reads of the GRID at table scale: each image (stills/trio/<CODE>-<race>.png) is a culture's three
figures of one race side by side (fighter, rogue, caster, in a shuffled order per picture: stills.py keeps it beside it), or its NPCs. Batched N images
to a call, cultures mixed, random names, isolated folder. Gemini must name the culture, the race and each one's role.
-> reads_trio.json, READS.md (with the human-figure reads of reads.py)
    python3 reads_trio.py [CODE-race ...] [--n=12] [--seed=11]"""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE, USB, gemini, last_json
from gate import CULT

arg = lambda k, d=None: next((x.split('=', 1)[1] for x in sys.argv if x.startswith(k + '=')), d)
N = int(arg('--n', 12)); OUTF = HERE / 'reads_trio.json'
RACE_WORDS = {'human': ['human'], 'elf': ['elf', 'elv'], 'dwarf': ['dwar'], 'small': ['halfling', 'gnome', 'small', 'hobbit'], 'orc': ['orc', 'ork', 'half-orc'], 'tiefling': ['tiefling', 'devil', 'demon', 'horned'], 'dragonborn': ['dragon', 'lizard', 'reptil', 'kobold']}
P = """Each image (img1, img2, ...) is a still from a 3D tabletop role-playing game at the distance a player sees the table from: a few painted miniature figures, each on a round grey base, standing in a row on a grid floor. Within one image the figures share one culture and (except in some images) one fantasy race; different images come from different cultures. You are not told what they are. First, for every image, list any text or labels you can read.
Then for EACH image:
- which CULTURE, people and period do the clothes, armour and gear suggest (best guess and second guess);
- which RACE are the figures (human, elf, dwarf, halfling or gnome, orc, tiefling, dragonborn, or mixed);
- for each figure from LEFT to RIGHT: its ROLE for a game master (armoured fighter / rogue / caster (priest, mage, scholar, healer, diviner) / NPC (merchant, noble, commoner, craftsperson)) and what it holds;
- anything malformed, broken or hard to read at this distance;
- does anything look like a caricature or a costume-party stereotype of the human culture (say what), or does it look respectful?
End your reply with ONE JSON object: {"images": [ one object per image, in order: {"image": "img1", "culture": "<best>", "culture2": "<second>", "race": "...", "figures": [{"role": "fighter|rogue|caster|npc", "holds": "..."}, ...left to right], "faults": "<short or none>", "stereotype": "<short or none>"} ] }"""


def main():
    pics = sorted((USB / 'stills/trio').glob('*.png'))
    want = [a for a in sys.argv[1:] if not a.startswith('--')]
    pics = [p for p in pics if not want or p.stem in want]
    D = json.loads(OUTF.read_text()) if OUTF.exists() else {}
    pics = [p for p in pics if p.stem not in D or '--redo' in sys.argv]
    random.Random(int(arg('--seed', 11))).shuffle(pics)
    if arg('--first'): pics.sort(key=lambda p: not p.stem.startswith(arg('--first')))   # (a culture read first: India, 2026-11-07)
    man = {f['id']: f for f in json.loads((HERE / 'set/published/manifest.json').read_text())['figures']}
    ROLE = {'fighter': 0, 'rogue': 1, 'caster': 2}
    (HERE / 'gemini').mkdir(exist_ok=True)
    for k in range(0, len(pics), N):
        ch = pics[k:k + N]
        (HERE / 'gemini').mkdir(exist_ok=True); (HERE / 'gemini' / f'trio-{ch[0].stem}.order').write_text('\n'.join(p.stem for p in ch))   # (so a crash can be re-scored from the saved reply)
        txt = gemini(P, ch, timeout=600)
        (HERE / 'gemini' / f'trio-{ch[0].stem}.txt').write_text(txt)
        rows = (last_json(txt) or {}).get('images') or []; rows += [{}] * (len(ch) - len(rows))
        for p, j in zip(ch, rows):
            code, race = p.stem.split('-', 1)
            order = json.loads(p.with_suffix('.json').read_text())   # left to right, as stills.py placed them
            if any(i not in man for i in order): print(p.stem, 'SKIPPED: a figure not in the manifest read at start; read again next round', flush=True); continue
            figs = [man[i] for i in order]
            meant = [f.get('role') for f in figs]; said = [str((x or {}).get('role', '')).lower() for x in (j.get('figures') or [])]
            cul = str(j.get('culture', '')).lower(); cul2 = cul + ' ' + str(j.get('culture2', '')).lower()
            D[p.stem] = {'read': j, 'meant_roles': meant, 'said_roles': said, 'culture_first': any(w in cul for w in CULT[code]), 'culture_either': any(w in cul2 for w in CULT[code]),
                         'race': race == 'npc' or any(w in str(j.get('race', '')).lower() for w in RACE_WORDS.get(race, [race])), 'roles_right': sum(a == b for a, b in zip(meant, said)), 'roles_n': len(meant)}
            print(p.stem, '|', j.get('culture'), '/', j.get('race'), '|', said, 'meant', meant, '|', j.get('stereotype'), flush=True)
        OUTF.write_text(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
    report(D)


def report(D):
    from collections import defaultdict
    by = defaultdict(list)
    for k, d in D.items(): by[k.split('-')[0]].append((k, d))
    L = ['## The grid, blind at table scale (reads_trio.py: a race\'s fighter / rogue / caster per picture, or the NPCs)', '',
         '| culture | culture named first | in either guess | race named | roles named (of figures) | pictures |', '|---|---|---|---|---|---|']
    T = [0] * 6
    for code in ['IND', 'JPN', 'CHN', 'NRS', 'MDE', 'RUS', 'MES']:
        xs = [d for _, d in by.get(code, [])]
        if not xs: continue
        v = [sum(d['culture_first'] for d in xs), sum(d['culture_either'] for d in xs), sum(d['race'] for d in xs), sum(d['roles_right'] for d in xs), sum(d['roles_n'] for d in xs), len(xs)]
        T = [a + b for a, b in zip(T, v)]
        L.append(f"| {code} | {v[0]}/{v[5]} | {v[1]}/{v[5]} | {v[2]}/{v[5]} | {v[3]}/{v[4]} | {v[5]} |")
    L.append(f"| **all** | **{T[0]}/{T[5]}** | **{T[1]}/{T[5]}** | **{T[2]}/{T[5]}** | **{T[3]}/{T[4]}** | {T[5]} |")
    L += ['', '| picture | read as (culture / race) | roles said (meant) | stereotype? | faults |', '|---|---|---|---|---|']
    for k in sorted(D):
        j = D[k]['read'] or {}
        L.append(f"| {k} | {j.get('culture')} / {j.get('race')} | {', '.join(D[k]['said_roles'])} ({', '.join(D[k]['meant_roles'])}) | {str(j.get('stereotype'))[:90]} | {str(j.get('faults'))[:70]} |")
    (HERE / 'READS_GRID.md').write_text('\n'.join(L) + '\n'); print('\n'.join(L[:13]))


if __name__ == '__main__':
    if '--report' in sys.argv: report(json.loads(OUTF.read_text()))
    else: main()
