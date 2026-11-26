#!/usr/bin/env python3
"""Gemini's BLIND reads of the stills at table scale (stills/table/<id>.png), batched N to a call, the cultures mixed in
each batch (so a neighbour never gives a culture away), random file names, an isolated folder. Gemini must NAME THE
CULTURE AND THE ROLE; scored here against the roster. -> reads.json, READS.md
    python3 reads.py [ids...] [--n=7] [--seed=7]"""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE, USB, gemini, last_json, roster
from gate import CULT

arg = lambda k, d=None: next((x.split('=', 1)[1] for x in sys.argv if x.startswith(k + '=')), d)
N = int(arg('--n', 10)); OUTF = HERE / 'reads.json'
R = {r['id']: r for r in roster()}
ROLE_WORDS = {'fighter': ['warrior', 'soldier', 'fighter', 'knight', 'guard', 'samurai', 'bannerman', 'cavalry', 'mamluk'],
              'rogue': ['rogue', 'thief', 'spy', 'scout', 'assassin', 'bandit', 'outlaw', 'ninja', 'shinobi', 'raider', 'brigand', 'cutpurse', 'agent', 'infiltrator'],
              'caster': ['caster', 'priest', 'mage', 'wizard', 'cleric', 'scholar', 'diviner', 'shaman', 'healer', 'druid', 'seer', 'astrolog', 'astronom', 'alchemist', 'sage', 'mystic', 'witch', 'monk', 'magic', 'sorcer', 'onmyoji', 'daoist', 'taoist', 'herbalist', 'oracle']}
P = """Each image (img1, img2, ...) is a still from a 3D tabletop role-playing game, at the distance a player sees the table from: ONE painted miniature figure on a round grey base on a grid floor. Each image shows a different figure; they come from several different cultures. You are not told what any of them is. First, for every image, list any text, letters or labels you can read in it.
Then for EACH image, from that image alone:
- what is the figure, in one sentence;
- which CULTURE or people, and roughly which period, does it come from (best guess, and a second guess);
- what ROLE would a game master use it for: an armoured fighter / a rogue (thief, spy, scout) / a caster (priest, mage, scholar, healer, diviner) / an NPC (and then which: merchant, noble or official, commoner or worker, craftsperson);
- what is it holding;
- man or woman;
- is it facing the camera, turned to the side, or facing away;
- anything malformed, broken or hard to read at this distance;
- does anything about it look like a caricature or a costume-party stereotype of a culture (say what), or does it look respectful?
End your reply with ONE JSON object: {"images": [ one object per image, in order: {"image": "img1", "what": "...", "culture": "<best>", "culture2": "<second>", "period": "...", "role": "fighter|rogue|caster|npc", "npc_kind": "<merchant / noble or official / commoner or worker / craftsperson, or null>", "holds": "...", "gender": "man|woman|unclear", "facing": "camera|side|away", "faults": "<short or none>", "stereotype": "<short or none>"} ] }"""


def score(i, j):
    r = R[i]; cul = (str(j.get('culture', '')) + ' ' + str(j.get('culture2', ''))).lower()
    c1 = any(w in str(j.get('culture', '')).lower() for w in CULT[r['setting']]); c2 = any(w in cul for w in CULT[r['setting']])
    role = str(j.get('role', '')).lower(); what = str(j.get('what', '')).lower()
    role_ok = role == r['role'] or (r['role'] != 'npc' and role != 'npc' and any(w in role + ' ' + what for w in ROLE_WORDS[r['role']]) and role == r['role'])
    return {'culture_first': c1, 'culture_either': c2, 'role': role == r['role'], 'role_said': role, 'role_near': role_ok}


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or sorted(p.stem for p in (USB / 'stills/table').glob('*.png'))
    random.Random(int(arg('--seed', 7))).shuffle(ids)
    D = json.loads(OUTF.read_text()) if OUTF.exists() else {}
    ids = [i for i in ids if i not in D or '--redo' in sys.argv]
    (HERE / 'gemini').mkdir(exist_ok=True)
    for k in range(0, len(ids), N):
        ch = ids[k:k + N]
        txt = gemini(P, [USB / 'stills/table' / f'{i}.png' for i in ch])
        (HERE / 'gemini' / f'reads-{k // N}.txt').write_text(txt)
        rows = (last_json(txt) or {}).get('images') or []; rows += [{}] * (len(ch) - len(rows))
        for i, j in zip(ch, rows):
            D[i] = {'read': j, **score(i, j) if j else {'error': 'no read'}}
            print(i, '|', j.get('culture'), '/', j.get('role'), j.get('npc_kind') or '', '|', D[i].get('culture_first'), D[i].get('role'), '|', j.get('stereotype'), flush=True)
        OUTF.write_text(json.dumps(D, indent=1, ensure_ascii=False) + '\n')
    report(D)


def report(D):
    from collections import defaultdict
    by = defaultdict(list)
    for i, d in D.items(): by[R[i]['setting']].append((i, d))
    L = ['# Blind reads at table scale (Gemini via agy-run; batched, cultures mixed, neutral names)', '',
         '| culture | culture named (first guess) | culture in either guess | role named | figures |', '|---|---|---|---|---|']
    tot = [0, 0, 0, 0]
    for code in ['JPN', 'CHN', 'IND', 'NRS', 'MDE', 'RUS', 'MES']:
        xs = [d for _, d in by.get(code, []) if 'error' not in d]
        if not xs: continue
        a, b, c = sum(d['culture_first'] for d in xs), sum(d['culture_either'] for d in xs), sum(d['role'] for d in xs)
        tot = [tot[0] + a, tot[1] + b, tot[2] + c, tot[3] + len(xs)]
        L.append(f"| {R[by[code][0][0]]['kin']} | {a}/{len(xs)} | {b}/{len(xs)} | {c}/{len(xs)} | {len(xs)} |")
    L.append(f"| **all** | **{tot[0]}/{tot[3]}** | **{tot[1]}/{tot[3]}** | **{tot[2]}/{tot[3]}** | {tot[3]} |")
    L += ['', '| figure | meant | read as (culture / role) | holds | stereotype? | faults |', '|---|---|---|---|---|---|']
    for i in sorted(D, key=lambda x: (['JPN', 'CHN', 'IND', 'NRS', 'MDE', 'RUS', 'MES'].index(R[x]['setting']), x)):
        j = D[i].get('read') or {}
        L.append(f"| {i} | {R[i]['short']} ({R[i]['role']}) | {j.get('culture')} / {j.get('role')}{' ' + str(j.get('npc_kind')) if j.get('npc_kind') else ''} | {str(j.get('holds'))[:60]} | {str(j.get('stereotype'))[:80]} | {str(j.get('faults'))[:60]} |")
    (HERE / 'READS.md').write_text('\n'.join(L) + '\n'); print('\n'.join(L[:14]))


if __name__ == '__main__':
    if '--report' in sys.argv: report(json.loads(OUTF.read_text()))
    else: main()
