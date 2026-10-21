"""The blind read alone, many at a time: "what kind of room is this?" for pictures room_shots.py already took.

  python3 tests/room_reads.py OUTDIR [--keys a,b] [--repeat 1] [--par 8] [--ask things]
Same judge and prompt as room_shots.py (gemini-2.5-pro, the three pictures sent as view-1/2/3, no room or type name
anywhere), without its second call. One read is a coin (PLAN.md 15): --repeat reads every room again.
--ask things: instead, "list every distinct kind of thing you see ... and what a player would take it for" (PLAN.md 16).
Writes OUTDIR/reads.json { tag: [answer, ...] } (reads-things.json for --ask things) and prints the answer to (1) per read.
"""
import sys, os, json, base64, re, urllib.request, concurrent.futures as cf
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
outdir = sys.argv[1]; keys = [k for k in opt('--keys', '').split(',') if k]; REP = int(opt('--repeat', '1')); PAR = int(opt('--par', '8')); ASK = opt('--ask', 'room')
BLIND = ("Three pictures of ONE room in a fantasy tabletop game, seen from above at about the distance of players round a table: two high three-quarter views and a top view. "
         "Describe what you see. Then answer: (1) what kind of room is this, in a few words, and how sure are you; (2) what are its main things and where do they stand; "
         "(3) is there one thing the room is built around; (4) what looks wrong, if anything: floating, clipping into a wall or each other, doubled, out of scale, unreadable at this distance. "
         "Say what you actually see, not what a room like this usually has.")
THINGS = ("Three pictures of ONE place in a fantasy tabletop game, seen from above at about the distance of players round a table: two high three-quarter views and a top view. "
          "List every distinct kind of thing you see, one line each: what it looks like from here, how many, and what a player would take it for. Then one last line: what a player would call this place.")
def gemini(parts, model='gemini-2.5-pro'):
    body = {'contents': [{'role': 'user', 'parts': parts}], 'generationConfig': {'temperature': 0.1}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']})
    for attempt in range(4):
        try:
            r = json.loads(urllib.request.urlopen(req, timeout=240).read()); return r['candidates'][0]['content']['parts'][0]['text']
        except Exception as e: err = e
    return f'ERROR {err}'
def one(tag):
    imgs = []
    for i, name in enumerate(('table', 'table-sw', 'top')):
        imgs += [{'inline_data': {'mime_type': 'image/png', 'data': base64.b64encode(open(f'{outdir}/{tag}-{name}.png', 'rb').read()).decode()}}, {'text': f'[above: view-{i + 1}]'}]
    return tag, gemini(imgs + [{'text': THINGS if ASK == 'things' else BLIND}])
def first(txt):  # the answer to (1), on one line
    m = re.search(r'\(1\)(.*?)(?:\(2\)|\n\s*\*?\*?\(?2[\).])', txt, re.S) or re.search(r'(?:^|\n)\s*\*?\*?1[\).](.*?)(?:\n\s*\*?\*?2[\).])', txt, re.S)
    return re.sub(r'\s+', ' ', (m.group(1) if m else txt[-300:])).strip(' *:')[:230]
tags = sorted({f[:-len('-top.png')] for f in os.listdir(outdir) if f.endswith('-top.png')})
tags = [t for t in tags if not keys or any(t.startswith(k + '-default-') or t.startswith(k + '-big-') for k in keys)]
out = f'{outdir}/reads-things.json' if ASK == 'things' else f'{outdir}/reads.json'
res = json.load(open(out)) if os.path.exists(out) and '--fresh' not in sys.argv else {}
for t in tags: res[t] = [] if '--fresh' in sys.argv or t not in res else res[t]
with cf.ThreadPoolExecutor(PAR) as ex:
    for tag, txt in ex.map(one, [t for t in tags for _ in range(REP)]):
        res[tag].append(txt); json.dump(res, open(out, 'w'), indent=1)
for t in tags:
    for txt in res[t][-REP:]: print(f"{t:36s} {txt[-400:].replace(chr(10), ' ') if ASK == 'things' else first(txt)}", flush=True)
