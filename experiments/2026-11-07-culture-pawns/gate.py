#!/usr/bin/env python3
"""The plate gate, BATCHED: up to N painted plates per Gemini call (agy-run, the subscription; blind first, isolated
folder, random file names). A plate passes when it is one whole painted figure, nothing under its feet, nothing cut off,
no writing, nothing malformed, no caricature, the things it should hold are there, and its dress reads as its culture.
    python3 gate.py [--ids=a,b] [--n=6]
Accepted: set/inputs/<id>.jpg, set/masked/<id>.png (status 'accepted'). Refused: status 'refused' and `extra`, the
corrections plates.py paints the next try with. After MAX_TRIES refusals: 'rejected' (reported, not meshed)."""
import json, shutil, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import *

MAX_TRIES = 3
STATE = SET / 'plates.json'   # plates.py's (read only here)
GATE = SET / 'gate.json'      # this script's verdicts: {id: {status, judged (the try judged), extra, reads: [...]}}
arg = lambda k, d=None: next((x.split('=', 1)[1] for x in sys.argv if x.startswith(k + '=')), d)
N = int(arg('--n', 6))
A = {a['id']: a for a in json.loads((SET / 'assets.json').read_text())['assets']}
R = {r['id']: r for r in roster()}
CULT = {'JPN': ['japan', 'edo'], 'CHN': ['chin', 'qing', 'manchu'], 'IND': ['india', 'rajput', 'rajasthan', 'mughal', 'south asia'],
        'NRS': ['norse', 'viking', 'scandinav', 'nordic'], 'MDE': ['mamluk', 'arab', 'egypt', 'middle east', 'islamic', 'syria', 'persian', 'ottoman', 'levant', 'saracen', 'near east'],
        'RUS': ['rus', 'slav', 'kiev', 'novgorod', 'byzantine'], 'MES': ['mexica', 'aztec', 'mesoamerica', 'nahua', 'maya']}

BLIND = """Each image (img1, img2, ...) shows ONE painted tabletop miniature figure, cut out and laid on a flat magenta background (the magenta is only a mask colour). You are not told what any of them is meant to be. First, for every image, list any text, letters, script, numbers, labels or watermarks you can see.
Then answer for EACH image, from that image alone:
- who is this, in one sentence;
- what culture, people and period do the dress, hair and gear suggest (best guess and second guess);
- what role: warrior / rogue, thief or spy / priest, magic-user or scholar / merchant / noble or official / commoner or worker / craftsperson;
- what it holds, and in which hand;
- how many separate figures or objects are in the image;
- what is under the feet: nothing, a base, a disc, a shadow or a patch of ground;
- is any part cut off by the image edge or missing (a hand, a foot, a weapon tip, the top of the head or hat), or are there holes cut into it;
- is it painted in full colour (not grey, metal or stone);
- anything malformed, fused or broken (fused hands, an extra limb, a weapon merged into the body);
- does anything about it look like a caricature, a comic or exaggerated face, or a costume-party stereotype of a culture?"""
CHECK = """
AFTER you have answered all of that, here is what each image is MEANT to show; for each image say whether each listed thing is clearly there:
{lists}
End your reply with ONE JSON object: {{"images": [ one object per image, in order: {{"image": "img1", "what": "...", "culture": "<best guess>", "culture2": "<second guess>", "role": "...", "holds": "...", "figures": 1, "under": "nothing|base|disc|shadow|ground", "cut_off": "<what, or none>", "painted": true|false, "malformed": "<short, or none>", "text": "<text seen, or none>", "caricature": "<short, or none>", "has": {{"<listed thing>": true|false, ...}} }} ] }}"""


def none(v):
    v = str(v or '').strip().lower()
    return v in ('', 'none', 'no', 'n/a', 'nothing', 'false', 'null') or v.startswith('none') or v.startswith('no ') or v.startswith('nothing')


def judge(i, j):
    a, r = A[i], R[i]; p = []
    if not j: return ['the gate could not read the picture']
    if int(j.get('figures') or 1) != 1: p.append('exactly ONE figure, nothing else in the picture')
    if str(j.get('under', 'nothing')).lower() not in ('nothing', 'none', ''): p.append(f"nothing under the feet: no base, disc, shadow or ground (seen: {j.get('under')})")
    if not none(j.get('cut_off')): p.append(f"the whole figure inside the frame, nothing cut off or missing ({str(j['cut_off'])[:100]})")
    if j.get('painted') is False: p.append('fully painted in full colour')
    if not none(j.get('malformed')): p.append(f"fix: {str(j['malformed'])[:140]}")
    if not none(j.get('text')): p.append(f"NO writing, letters or symbols anywhere (seen: {str(j['text'])[:80]})")
    if not none(j.get('caricature')): p.append(f"plain, dignified, natural features and dress, no caricature ({str(j['caricature'])[:120]})")
    has = j.get('has') or {}
    miss = [k for k in a['gate']['must'] if k in has and has[k] is False]
    if miss: p.append('it must clearly show: ' + '; '.join(miss))
    cul = (str(j.get('culture', '')) + ' ' + str(j.get('culture2', ''))).lower()
    if not any(w in cul for w in CULT[r['setting']]): p.append(f"the dress, hair and gear must read clearly as {r['period']} (it was read as: {str(j.get('culture'))[:60]})")
    return p


def main():
    st = json.loads(STATE.read_text()); G = json.loads(GATE.read_text()) if GATE.exists() else {}
    ids = arg('--ids'); ids = ids.split(',') if ids else [i for i, x in st.items() if x.get('tries') and G.get(i, {}).get('judged') != len(x['tries'])]
    (SET / 'inputs').mkdir(exist_ok=True); (SET / 'masked').mkdir(exist_ok=True); (HERE / 'gemini').mkdir(exist_ok=True)
    print(len(ids), 'plates to judge', flush=True)
    for k in range(0, len(ids), N):
        ch = ids[k:k + N]
        lists = '\n'.join(f"img{n}: {R[i]['short'].lower()} ({'woman' if R[i]['gender'] == 'f' else 'man'}); listed things: " + '; '.join(A[i]['gate']['must']) for n, i in enumerate(ch, 1))
        txt = gemini(BLIND + CHECK.format(lists=lists), [st[i]['tries'][-1]['comp'] for i in ch])
        (HERE / 'gemini' / f"gate-{ch[0]}-try{len(st[ch[0]]['tries'])}.txt").write_text(txt)
        rows = ((last_json(txt) or {}).get('images') or [])
        rows += [{}] * (len(ch) - len(rows))
        for i, j in zip(ch, rows):
            t = st[i]['tries'][-1]; g = G.setdefault(i, {'reads': []}); probs = judge(i, j)
            if (t.get('matte') or {}).get('verdict') == 'fail': probs.append('one uniform flat chroma-blue background with clear space all round')
            g['reads'].append({'try': t['try'], 'ok': not probs, 'problems': probs, 'read': j}); g['judged'] = t['try']
            if not probs:
                g['status'] = 'accepted'; g['accepted_try'] = t['try']; g.pop('extra', None)
                shutil.copy2(t['plate'], SET / 'inputs' / f'{i}.jpg'); shutil.copy2(t['rgba'], SET / 'masked' / f'{i}.png')
                shutil.copy2(HERE / 'prompts' / f"{i}.try{t['try']}.md", HERE / 'prompts' / f'{i}.md')
            elif t['try'] >= MAX_TRIES: g['status'] = 'rejected'
            else: g['status'] = 'refused'; g['extra'] = '; '.join(probs)[:700]
            print(i, g['status'], '|', j.get('culture'), '/', j.get('role'), '|', probs, flush=True)
        GATE.write_text(json.dumps(G, indent=1) + '\n')


if __name__ == '__main__':
    main()
