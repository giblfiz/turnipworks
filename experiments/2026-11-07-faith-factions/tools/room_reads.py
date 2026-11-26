#!/usr/bin/env python3
"""The blind room read at table distance (agy-run, the Gemini subscription; isolated folder; neutral names): for each
room shot by tools/room_shots.py, its high three-quarter view and its top view, and the question the lane was asked to
answer: "what culture and what room is this?". Gemini is told nothing about the room; the match against the intended
room is a second, text-only judgement written by the caller (ROOM_READS.md).
    python3 tools/room_reads.py SHOTDIR [tag ...]     -> SHOTDIR/read.json (merged); one line per room"""
import json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
D = Path(sys.argv[1]); out_p = D / 'read.json'; out = json.loads(out_p.read_text()) if out_p.exists() else {}
tags = sys.argv[2:] or sorted({p.name[:-len('-top.png')] for p in D.glob('*-top.png')} - set(out))
P = ("view-1.jpg and view-2.jpg show ONE room (or one walled or open piece of ground) in a fantasy tabletop game, seen from above at about the distance of "
     "players round a table: a high three-quarter view and a top view. Do NOT create, crop or write any files; do not run commands or open other files. "
     "First list any text or labels you can read (or none). Then, saying only what you actually see and not what such a room usually has: (1) which culture, "
     "region or period does it look like, and how sure are you (0-100); (2) what kind of room or place is this, in a few words, and how sure (0-100); (3) its "
     "main things and where they stand; (4) the one thing it is built around, if any; (5) anything that looks wrong or disrespectful: floating, clipping, "
     "doubled, out of scale, unreadable, a sacred object misused. Answer ONLY JSON: "
     '{"text": [], "culture": "", "culture_conf": 0, "room": "", "room_conf": 0, "things": "", "focal": "", "problems": []}')
for tag in tags:
    d = Path(tempfile.mkdtemp(prefix='agy-ca-room-'))
    for k, v in (('view-1', 'table'), ('view-2', 'top')): Image.open(D / f'{tag}-{v}.png').convert('RGB').save(d / f'{k}.jpg', quality=90)
    r = None
    for _ in range(2):
        try: txt = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-C', str(d), '-t', '600', P], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=2400).stdout
        except subprocess.TimeoutExpired: txt = ''
        for m in re.finditer(r'\{', txt):
            try: r = json.JSONDecoder().raw_decode(txt[m.start():])[0]; break
            except json.JSONDecodeError: continue
        if r: break
    shutil.rmtree(d, ignore_errors=True)
    out[tag] = r or {'error': 'no answer'}; out_p.write_text(json.dumps(out, indent=1))
    print(f"{tag:34s} culture: {str((r or {}).get('culture'))[:30]:30s} ({(r or {}).get('culture_conf')}) | room: {str((r or {}).get('room'))[:44]:44s} ({(r or {}).get('room_conf')}) | problems {len((r or {}).get('problems') or [])}", flush=True)
