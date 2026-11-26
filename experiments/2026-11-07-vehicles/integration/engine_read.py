#!/usr/bin/env python3
"""The game's own stills (engine/test/browser_cyberpunk.py --stills DIR), read blind in ONE agy call: random names, an
empty folder, labels first. Asks about the things this wave changed: what the place is, any "capsules on the floor",
whether the rooftop reads as a roof on a building, whether the glass and the chain-link read as see-through.
    python3 integration/engine_read.py DIR      -> DIR/read.json"""
import json, random, re, shutil, subprocess, sys, tempfile, os
D = sys.argv[1]; names = {}
d = tempfile.mkdtemp(prefix='agy-cybr-eng-')
for f in sorted(os.listdir(D)):
    if f.endswith('.png'): n = f'{random.getrandbits(32):08x}.png'; names[n] = f[:-4]; shutil.copy(f'{D}/{f}', f'{d}/{n}')
P = ("Do NOT create, crop or write any files. Do not run commands or open any other files; only look at the {n} images {files} in this folder. "
     "Each is a DIFFERENT scene from a 3D tabletop game, seen from above at about the distance of players round a table. For EACH image separately: "
     "first list any text or labels you can read; then say what SETTING or era it is, what KIND of place it is (a few words), how sure you are (0-100), "
     "its main things, and anything that looks wrong (floating, clipping, out of scale, things that seem to lie on the floor but should not). "
     "Also say, where you can tell: is any area a ROOF on top of a building (yes/no/unclear), do any walls or fences look SEE-THROUGH (glass, wire mesh), "
     "and are there odd rectangular capsule-like objects lying on the floor (yes/no). Say what you actually see. "
     'Answer ONLY with a JSON array: [{{"file": "<name>", "text": [], "setting": "...", "place": "...", "confidence": 0, "main_things": ["..."], "wrong": ["..."], "roof": "...", "see_through": "...", "floor_capsules": "..."}}, ...]')
prompt = P.format(n=len(names), files=', '.join(sorted(names)))
got = None
for _ in range(2):
    r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '900', '-C', d, prompt], capture_output=True, text=True, timeout=7200, stdin=subprocess.DEVNULL)
    m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
    try: got = json.loads(m.group(0)); break
    except Exception: print('(retry)', r.stdout[-300:], flush=True)
shutil.rmtree(d, ignore_errors=True)
res = {names.get(g.get('file'), g.get('file')): g for g in got or []}
json.dump(res, open(f'{D}/read.json', 'w'), indent=1)
for k, v in res.items(): print(f"{k:22s} {v.get('setting')} | {v.get('place')} | conf {v.get('confidence')} | roof {v.get('roof')} | see-through {v.get('see_through')} | capsules {v.get('floor_capsules')} | wrong {v.get('wrong')}")
