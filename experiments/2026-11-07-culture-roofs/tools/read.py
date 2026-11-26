#!/usr/bin/env python3
"""A blind Gemini read through agy-run (the subscription; the shared queue: flock /tmp/agy.lock), many pictures in ONE call.
    python3 read.py OUT.txt PROMPT_FILE img1 img2 ...   -> OUT.txt (the answer) and OUT.map.json (random name -> picture)
Pictures are copied under random names into a fresh isolated folder, so neither names nor paths say what they show."""
import json, os, random, shutil, string, subprocess, sys, tempfile
out, pf, imgs = sys.argv[1], sys.argv[2], sys.argv[3:]
d = tempfile.mkdtemp(prefix='agy-cr-', dir='/tmp/scratch')
names = {}
for p in imgs:
    n = ''.join(random.choices(string.ascii_lowercase, k=6)) + os.path.splitext(p)[1]; shutil.copy(p, os.path.join(d, n)); names[n] = p
order = sorted(names)
prompt = open(pf).read().replace('{FILES}', ', '.join(order))
r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', d, '-t', '1200', prompt], stdin=subprocess.DEVNULL, capture_output=True, text=True)
open(out, 'w').write(r.stdout + ('\n--- stderr ---\n' + r.stderr[-2000:] if r.returncode else ''))
json.dump({n: names[n] for n in order}, open(out + '.map.json', 'w'), indent=1)
print(r.returncode, out)
