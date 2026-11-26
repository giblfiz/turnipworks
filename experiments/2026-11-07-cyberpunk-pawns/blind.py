#!/usr/bin/env python3
"""Blind reads of the pack IN THE GAME (shots/<id>-<mode>.png from table_shots.py): Gemini through agy-run, BATCHED
(up to --batch crops a call, random neutral file names, never told what any figure is meant to be). For each: the people
(human, elf, dwarf, ork/orc, troll, robot, other) and the role, a closed list of nine runner archetypes plus "not a
runner: <a word or two>". Scored against the spec: archetype and metatype for runners; people + role for NPCs and robots.
    python3 blind.py [table|lean] [--batch=8] [--ids=a,b]      -> blind-<mode>.json, a score line per group"""
import json, random, string, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE)); from agy import gemini, last_json
mode = next((a for a in sys.argv[1:] if not a.startswith('--')), 'lean')
arg = lambda k, d=None: next((x.split('=', 1)[1] for x in sys.argv if x.startswith(k + '=')), d)
B = int(arg('--batch', 8)); ids = arg('--ids'); ids = ids.split(',') if ids else None
spec = {a['id']: a for a in json.loads((HERE / 'set/assets.json').read_text())['assets'] if a['group'] != 'body'}
todo = [i for i in spec if (HERE / 'shots' / f'{i}-{mode}.png').exists() and (ids is None or i in ids)]
OUT = HERE / f'blind-{mode}.json'; res = json.loads(OUT.read_text()) if OUT.exists() else {}
if ids is None: todo = [i for i in todo if i not in res]
random.seed(7); random.shuffle(todo)
ARCH = ['street samurai (a cybered sword fighter)', 'decker (a hacker with a computer deck)', 'rigger (a drone or vehicle pilot)', 'mage (a scholarly spellcaster)',
        'shaman (a spirit-talking caster)', 'physical adept (an unarmed martial artist)', 'face (a smooth talker or negotiator)', 'technomancer (a hacker without a computer)', 'mercenary (a heavy-weapons soldier)']
P = """Each image is a crop from a 3D tabletop game, seen from the players' camera: one painted miniature figure standing
on a round grey base (other figures may show at the edges; judge only the one in the MIDDLE). The game is a gritty
near-future city where magic has returned; its peoples are human, elf, dwarf, ork (orc), troll, and robots.
You are not told what any figure is meant to be. For EACH image, list first any text or labels you can read, then say:
- people: one of human, elf, dwarf, ork, troll, robot, other (and how sure, 0-1);
- archetype: if it is a player-character runner, ONE of: """ + '; '.join(ARCH) + """; otherwise "not a runner";
- role: in one to three words what it is (for anyone: "police officer", "combat robot", "street samurai", ...);
- what it holds, in a few words; anything that looks broken, melted or missing.
Answer with ONE JSON object and nothing after it:
{"images": [{"image": "<file name>", "labels": "<text seen or none>", "people": "...", "people_conf": 0.0, "archetype": "...", "role": "...", "holds": "...", "faults": "<short or none>"}, ...]}"""
for s in range(0, len(todo), B):
    chunk = todo[s:s + B]; tag = ''.join(random.choice(string.ascii_lowercase) for _ in range(4))
    names = {f'fig{k + 1}{tag}.png': i for k, i in enumerate(chunk)}
    txt = gemini(P, [(HERE / 'shots' / f'{i}-{mode}.png', n) for n, i in names.items()])
    j = last_json(txt) or {}
    for v in j.get('images', []):
        i = names.get(str(v.get('image', '')).strip())
        if i: res[i] = v
    OUT.write_text(json.dumps(res, indent=1) + '\n'); print(f'{len(res)} read ({mode})', flush=True)
# score
ARCHKEY = {'street-samurai': 'street samurai', 'decker': 'decker', 'rigger': 'rigger', 'mage': 'mage', 'shaman': 'shaman', 'adept': 'physical adept', 'face': 'face', 'technomancer': 'technomancer', 'merc': 'mercenary'}
PEOPLE = lambda r: {'ork': ('ork', 'orc')}.get(r, (r,))
rows = []
for i, a in spec.items():
    v = res.get(i)
    if not v: continue
    pe = str(v.get('people', '')).lower(); ar = str(v.get('archetype', '')).lower()
    p_ok = any(w in pe for w in PEOPLE(a.get('race') or ''))
    a_ok = ARCHKEY[a['cls']] in ar if a['group'] == 'runner' else None
    rows.append((a['group'], i, p_ok, a_ok, v.get('people'), v.get('archetype'), v.get('role'), v.get('faults')))
for g in ('runner', 'modern', 'robot'):
    R = [r for r in rows if r[0] == g]
    if not R: continue
    msg = f"{g}: people right {sum(r[2] for r in R)}/{len(R)}"
    if g == 'runner': msg += f", archetype right {sum(bool(r[3]) for r in R)}/{len(R)}, both {sum(r[2] and bool(r[3]) for r in R)}/{len(R)}"
    print(msg)
for r in rows:
    if not r[2] or r[3] is False: print('  MISS', r[1], '| people:', r[4], '| archetype:', r[5], '| role:', r[6])
