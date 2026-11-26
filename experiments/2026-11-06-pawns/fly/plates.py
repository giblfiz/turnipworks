#!/usr/bin/env python3
"""Flying plates: Codex's image tool (`codex exec`, the ChatGPT plan, no API spend) paints each plate from assets.json
with the creature's standing plate attached; BiRefNet mattes it on the local GPU; Gemini through agy-run (subscription,
blind, isolated folder) gates it. Up to --rerolls retries with the gate's problems as corrections.
    python3 plates.py [--ids a,b] [--workers 4] [--rerolls 2] [--redo]
Writes inputs/<id>.jpg, masked/<id>.png, rejected/, gate.json (every attempt)."""
import concurrent.futures, json, os, shutil, subprocess, sys, tempfile, threading
from pathlib import Path
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
sys.path.insert(0, str(ROOT / 'src'))
import plate_gate_batch as pgb   # only its matte (birefnet) and composite; its vision gate calls the API and is not used

LOCK, GPU = threading.Lock(), threading.Lock()
GATE = HERE / 'gate.json'


def codex_plate(a, attempt, extra):
    (HERE / 'prompts').mkdir(exist_ok=True); (HERE / 'work').mkdir(exist_ok=True)
    prompt = a['prompt'] + (f"\n\nCorrections from a rejected previous attempt (fix these): {extra}" if extra else '')
    (HERE / 'prompts' / f"{a['id']}.try{attempt}.md").write_text(prompt)
    out = HERE / 'work' / f"{a['id']}.try{attempt}.jpg"
    wd = tempfile.mkdtemp(prefix=f"fly-{a['id']}-")
    full = ("Use your built-in image generation tool. The attached image is the reference described below.\n\n" + prompt +
            "\nSave the resulting PNG (square, at least 1024 px) into the current directory as plate.png and print its path and pixel size.")
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-C', wd, '-s', 'workspace-write']
    for ref in a.get('refs', []): cmd += ['-i', str(ref)]
    cmd += ['-']
    for k in range(2):
        r = subprocess.run(cmd, input=full, capture_output=True, text=True, timeout=1500)
        with open(HERE / 'work' / f"{a['id']}.codex.log", 'a') as f: f.write(r.stdout[-3000:] + r.stderr[-2000:])
        got = os.path.join(wd, 'plate.png')
        if os.path.exists(got):
            Image.open(got).convert('RGB').save(out, quality=94); shutil.rmtree(wd, ignore_errors=True); return out
    raise RuntimeError('codex image failed: ' + (r.stderr or r.stdout)[-300:])


BLIND = """You are looking at img1, a picture of a painted tabletop miniature figure on a plain background. You are not told what it is meant to be.
First list any text, labels or watermarks you can see in it. Then answer, from img1 alone:
- how many separate figures or objects are in it;
- what creature it is (your best name and a second guess);
- is it FLYING / airborne, or standing, sitting or perched on something? Are its wings spread open or folded?
- what is directly UNDER it: nothing at all, a shadow or dark blob, a disc, a base, a flight stand or rod, a rock, a cloud, a patch of ground;
- is any part of it (a wing tip, the tail, the head) cut off by the image edge?
- is it painted in full colour, or grey / metal / stone-statue unpainted?
- are the wings thick solid shapes, or thin, see-through or full of holes?
- anything malformed, fused or missing (a missing leg, a wing merged into the body, an extra head)?
Then look at img2, which shows a figure from the same set. Is img1 the SAME creature as img2, painted the same way (same colours and markings)? Say what differs.
End your reply with ONE JSON object:
{"what": "<one sentence on img1>", "creature": "<best name>", "flying": true|false, "wings_spread": true|false, "under": "<what is under img1>", "cropped": true|false, "painted": true|false, "wings_solid": true|false, "malformed": "<short or none>", "same_as_img2": true|false, "differs": "<short>"}"""


def gate(a, comp):
    txt = gemini(BLIND, [comp, a['refs'][0]])
    j = last_json(txt) or {}
    probs = []
    if not j: probs.append('the gate could not read the picture')
    else:
        if not j.get('flying'): probs.append('it must be clearly FLYING in mid-air, not standing or perched')
        if not j.get('wings_spread'): probs.append('both wings must be SPREAD wide open')
        u = str(j.get('under', '')).lower()
        if u and not any(w in u for w in ('nothing', 'none', 'background', 'empty', 'no ')): probs.append(f'nothing may be under it (seen: {u[:80]})')
        if j.get('cropped'): probs.append('the whole creature must be inside the frame with space round it, wing tips and tail included')
        if j.get('painted') is False: probs.append('fully painted in full colour')
        if j.get('wings_solid') is False: probs.append('the wings must be thick solid opaque shapes, no holes, not see-through')
        m = str(j.get('malformed', 'none')).lower()
        if m and m not in ('none', 'no', 'n/a', '') and not m.startswith('none') and not m.startswith('no '): probs.append(f'fix: {m[:120]}')
        if j.get('same_as_img2') is False: probs.append(f"it must be the same creature with the same paint as the reference ({str(j.get('differs', ''))[:120]})")
    return {'ok': not probs, 'problems': probs, 'read': j, 'raw': txt[-2500:]}


def run(a, rerolls, state):
    aid = a['id']; rec = {'id': aid, 'attempts': []}; extra = ''
    (HERE / 'rejected').mkdir(exist_ok=True); (HERE / 'inputs').mkdir(exist_ok=True); (HERE / 'masked').mkdir(exist_ok=True)
    for attempt in range(1, rerolls + 2):
        plate = codex_plate(a, attempt, extra)
        rgba = HERE / 'work' / f'{aid}.try{attempt}.png'
        with GPU: m = pgb.birefnet(plate, rgba)
        comp = pgb.composite(rgba, HERE / 'work' / f'{aid}.try{attempt}.comp.jpg')
        g = gate(a, comp); g['matte'] = m
        rec['attempts'].append({'try': attempt, **g})
        if m.get('verdict') == 'fail': g['ok'] = False; g['problems'].append('the background must be one uniform flat chroma-blue with clear space all round')
        if g['ok']:
            shutil.copy2(plate, HERE / 'inputs' / f'{aid}.jpg'); shutil.copy2(rgba, HERE / 'masked' / f'{aid}.png')
            shutil.copy2(HERE / 'prompts' / f'{aid}.try{attempt}.md', HERE / 'prompts' / f'{aid}.md'); rec['status'] = 'accepted'; break
        shutil.copy2(plate, HERE / 'rejected' / f'{aid}.try{attempt}.jpg'); extra = '; '.join(g['problems'])[:700]
    else:
        rec['status'] = 'rejected'
    with LOCK:
        state[aid] = rec; GATE.write_text(json.dumps(state, indent=1) + '\n')
    print(aid, rec['status'], [x['problems'] for x in rec['attempts']], flush=True)


if __name__ == '__main__':
    arg = lambda k, d=None: next((x.split('=', 1)[1] for x in sys.argv if x.startswith(k + '=')), d)
    ids = arg('--ids'); ids = ids.split(',') if ids else None
    A = [a for a in json.loads((HERE / 'assets.json').read_text())['assets'] if ids is None or a['id'] in ids]
    state = json.loads(GATE.read_text()) if GATE.exists() else {}
    todo = [a for a in A if '--redo' in sys.argv or state.get(a['id'], {}).get('status') != 'accepted']
    print(len(todo), 'plates to make', flush=True)
    with concurrent.futures.ThreadPoolExecutor(int(arg('--workers', 4))) as pool:
        futs = {pool.submit(run, a, int(arg('--rerolls', 2)), state): a['id'] for a in todo}
        for f in concurrent.futures.as_completed(futs):
            try: f.result()
            except Exception as e: print(futs[f], 'ERROR', repr(e)[:300], flush=True)
