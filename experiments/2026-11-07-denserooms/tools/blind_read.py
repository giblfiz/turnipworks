"""ONE blind agy-run call over the before and after table-distance stills: random names in an empty folder, no room names,
labels first; per image how full or sparse the room reads (0-10), whether anything blocks a doorway or a walkway, whether
anything looks medieval or fantasy, and what is stacked or clipping. Writes OUT/read.json mapping file -> tag.
    python3 blind_read.py SHOTS_ROOT OUT keys..."""
import sys, os, json, random, re, shutil, subprocess, tempfile
root, out, keys = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(out, exist_ok=True)
d = tempfile.mkdtemp(prefix='agy-dense-blind-'); names = {}
for k in keys:
    for side in ('before', 'after'):
        src = f'{root}/{side}/{k}-default-11-table.png'
        if not os.path.exists(src): continue
        n = f'{random.getrandbits(40):010x}.png'; names[n] = f'{side}:{k}'; shutil.copy(src, f'{d}/{n}')
files = sorted(names)
PROMPT = (f"Do NOT create, crop or write any files. Do not run commands or open any other files; only look at the {len(files)} images {', '.join(files)} in this folder. "
          "Each shows ONE room built in a 3D tabletop game, seen from above at about the distance of players round a table. For EACH image separately: "
          "first list any text or labels you can read; then say what KIND of room it is (a few words) and what setting or era; then rate how FULL it reads "
          "from 0 (empty, sparse) to 10 (crammed), and say in a few words why; say whether anything stands in or blocks a DOORWAY or the walking route "
          "through the room (name it and where); list anything that looks medieval or fantasy (wooden barrels, wicker, sacks, candles...) in what otherwise "
          "reads as a modern room; and anything floating, clipping into something else, or stacked through something. Say what you actually see. "
          'Answer ONLY with a JSON array: [{"file": "<name>", "text": [], "room": "...", "setting": "...", "full": 0, "why_full": "...", '
          '"door_blocked": false, "blocked_what": "...", "medieval": ["..."], "clipping": ["..."]}, ...]')
got = None
for _ in range(2):
    r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '1200', '-C', d, PROMPT], capture_output=True, text=True, timeout=7200, stdin=subprocess.DEVNULL)
    m = re.search(r'\[\s*\{.*\}\s*\]', r.stdout, re.S)
    try: got = json.loads(m.group(0)); break
    except Exception: print('(retry)', r.stdout[-400:], flush=True)
shutil.rmtree(d, ignore_errors=True)
res = {names.get(g.get('file'), g.get('file')): g for g in (got or [])}
json.dump({'names': names, 'reads': res}, open(f'{out}/read.json', 'w'), indent=1)
for k in keys:
    b, a = res.get(f'before:{k}', {}), res.get(f'after:{k}', {})
    print(f"{k:15s} full {b.get('full')} -> {a.get('full')} | door blocked {b.get('door_blocked')} -> {a.get('door_blocked')} {a.get('blocked_what') or ''} | medieval after: {a.get('medieval')} | clip after: {a.get('clipping')} | read as: {a.get('room')}")
