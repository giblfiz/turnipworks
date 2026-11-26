#!/usr/bin/env python3
"""Cyberpunk plates: Codex's built-in image tool (`codex exec`, the ChatGPT plan: no API spend) paints each plate of
set/assets.json with its reference attached; BiRefNet mattes it on the local GPU; Gemini through agy-run (subscription,
isolated folder, neutral names) gates them IN BATCHES (agy-run is a shared queue: up to --batch plates a call).
Up to --rerolls repaints with the gate's problems as corrections.
    python3 plates.py [--ids=a,b] [--group=body] [--workers=6] [--rerolls=2] [--batch=5] [--redo]
Writes set/inputs/<id>.jpg, set/masked/<id>.png, set/gate-manifest.json (the set's shape: assets.<id>.status) and
set/gate-log.json (every attempt). Work files (every try, rejected plates) go to the USB disk (set/work is a link there)."""
import concurrent.futures, json, os, queue, random, shutil, string, subprocess, sys, tempfile, threading, time
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]; SET = HERE / "set"
sys.path.insert(0, str(ROOT / "src"))
import plate_gate_batch as pgb   # only its matte (birefnet) and composite; its vision gate calls the API and is not used
sys.path.insert(0, str(HERE)); from agy import gemini, last_json

arg = lambda k, d=None: next((x.split("=", 1)[1] for x in sys.argv if x.startswith(k + "=")), d)
LOCK, GPU = threading.Lock(), threading.Lock()
LOG = SET / "gate-log.json"; MAN = SET / "gate-manifest.json"
for d in ("inputs", "masked", "prompts"): (SET / d).mkdir(parents=True, exist_ok=True)
WORK = SET / "work"; WORK.mkdir(exist_ok=True); (WORK / "rejected").mkdir(exist_ok=True)


def codex_plate(a, attempt, extra):
    prompt = a["prompt"] + (f"\n\nCorrections from a rejected previous attempt (fix these): {extra}" if extra else "")
    (SET / "prompts" / f"{a['id']}.try{attempt}.md").write_text(prompt)
    out = WORK / f"{a['id']}.try{attempt}.jpg"
    wd = tempfile.mkdtemp(prefix=f"cyp-{a['id']}-")
    full = ("Use your built-in image generation tool. The attached image is the reference described below.\n\n" + prompt +
            "\nSave the resulting PNG (square, at least 1024 px) into the current directory as plate.png and print its path and pixel size.")
    cmd = ["codex", "exec", "--skip-git-repo-check", "-C", wd, "-s", "workspace-write"]
    for ref in a.get("refs", []): cmd += ["-i", str(ref)]
    cmd += ["-"]
    r = None
    for k in range(2):
        r = subprocess.run(cmd, input=full, capture_output=True, text=True, timeout=1500)
        with open(WORK / f"{a['id']}.codex.log", "a") as f: f.write(r.stdout[-3000:] + r.stderr[-2000:])
        got = os.path.join(wd, "plate.png")
        if os.path.exists(got):
            Image.open(got).convert("RGB").save(out, quality=94); shutil.rmtree(wd, ignore_errors=True); return out
    raise RuntimeError("codex image failed: " + ((r.stderr or r.stdout)[-300:] if r else ""))


GATE = """You are the gate of a 3D miniature-figure factory. Each image below is a CUT-OUT of one painted tabletop
miniature figure on a flat magenta background (the magenta is the mask, not part of the figure). For EACH image, first
say plainly what you see as if you were not told (what the figure is; what it holds and in which hand), THEN check it
against what was requested for it. Every figure in this set is a stout, chunky, big-headed miniature: never fail one for
looking short or stocky.

Fail an image (ok=false) only for things that would make the 3D figure wrong:
- not exactly ONE figure, or several views of it;
- any part cut off by the image edge (head, horns, hat, weapon tip, feet, tracks);
- anything UNDER the feet: a base, disc, plinth, rock, ground patch, cast shadow or dark blob;
- unpainted grey / statue look;
- limbs fused where a gap is needed, a missing or broken held thing, an extra limb, a melted face;
- the wrong kind of figure (not the requested people or role), or a "must" item missing;
- visible TEXT, letters, numbers, logos or insignia anywhere on it.
Ignore small painterly details.

{items}

Answer with ONE JSON object and nothing after it:
{{"images": [{{"image": "img1.jpg", "what_i_see": "<one sentence>", "people_guess": "<human / elf / dwarf / ork or orc / troll / robot / other>", "role_guess": "<one or two words>", "ok": true|false, "problems": ["<short, specific, fixable>"]}}, ...]}}"""


def gate_batch(batch):
    """batch: [(asset, comp_path)] -> {id: verdict}. One agy call; random neutral file names."""
    tag = "".join(random.choice(string.ascii_lowercase) for _ in range(4))
    names, items, imgs = {}, [], []
    for k, (a, comp) in enumerate(batch, 1):
        n = f"img{k}{tag}.jpg"; names[n] = a["id"]; imgs.append((comp, n))
        must = "; ".join(a["gate"]["must"])
        items.append(f"{n}: requested = {a['gate']['desc']}. Must have: {must}.")
    txt = gemini(GATE.format(items="\n".join(items)), imgs)
    j = last_json(txt) or {}
    out = {}
    for v in j.get("images", []):
        i = names.get(str(v.get("image", "")).strip())
        if i: out[i] = v
    for n, i in names.items():
        if i not in out: out[i] = {"ok": False, "problems": ["the gate could not read the picture"], "unread": True, "raw": txt[-600:]}
    return out


def main():
    ids = arg("--ids"); ids = ids.split(",") if ids else None; grp = arg("--group")
    A = [a for a in json.loads((SET / "assets.json").read_text())["assets"] if (ids is None or a["id"] in ids) and (grp is None or a["group"] == grp)]
    log = json.loads(LOG.read_text()) if LOG.exists() else {}
    man = json.loads(MAN.read_text()) if MAN.exists() else {"gate_model": "gemini via agy-run (subscription)", "assets": {}}
    todo = [a for a in A if "--redo" in sys.argv or man["assets"].get(a["id"], {}).get("status") != "accepted"]
    missing = [a["id"] for a in todo if not all(Path(r).exists() for r in a["refs"])]
    if missing: sys.exit(f"references not painted yet for: {missing} (paint --group=body first)")
    rer, W, B = int(arg("--rerolls", 2)), int(arg("--workers", 6)), int(arg("--batch", 5))
    print(len(todo), "plates to make", flush=True)
    paintq, gateq = queue.Queue(), queue.Queue()
    state = {a["id"]: {"try": 0, "extra": "", "a": a} for a in todo}
    left = [len(todo)]; done = threading.Event(); unread = {}
    # RESUME (2026-11-07: the shared agy lock had five lanes queued and painted plates waited for their gate): a plate
    # already painted and matted whose try has no verdict yet goes straight to the gate, not back to the painter
    for a in todo:
        i = a["id"]; done_tries = {e["try"] for e in log.get(i, [])}
        tries = sorted(int(p.name.split(".try")[1].split(".")[0]) for p in WORK.glob(f"{i}.try*.comp.jpg"))
        t = max(tries) if tries else 0
        if t and t not in done_tries and (WORK / f"{i}.try{t}.png").exists():
            state[i]["try"] = t; gateq.put((i, t, WORK / f"{i}.try{t}.jpg", WORK / f"{i}.try{t}.png", WORK / f"{i}.try{t}.comp.jpg", {"resumed": True}))
        else:
            state[i]["try"] = max(done_tries) if done_tries else 0
            last = log.get(i, [])[-1:] or [{}]
            state[i]["extra"] = "; ".join(last[0].get("problems") or [])[:700]
            paintq.put(i)
    print(gateq.qsize(), "painted plates go straight to the gate", flush=True)

    def painter():
        while not done.is_set():
            try: i = paintq.get(timeout=2)
            except queue.Empty: continue
            s = state[i]; s["try"] += 1; t = s["try"]
            try:
                plate = codex_plate(s["a"], t, s["extra"])
                rgba = WORK / f"{i}.try{t}.png"
                with GPU: m = pgb.birefnet(plate, rgba)
                comp = pgb.composite(rgba, WORK / f"{i}.try{t}.comp.jpg")
                gateq.put((i, t, plate, rgba, comp, m))
            except Exception as e:  # noqa: BLE001
                print(i, "paint ERROR", repr(e)[:200], flush=True)
                finish(i, t, None, None, {"ok": False, "problems": [f"paint failed: {e!r}"[:200]]}, {})

    def finish(i, t, plate, rgba, v, m):
        s = state[i]
        with LOCK:
            log.setdefault(i, []).append({"try": t, "matte": m, **{k: v.get(k) for k in ("ok", "problems", "what_i_see", "people_guess", "role_guess", "unread")}})
            if v.get("ok"):
                shutil.copy2(plate, SET / "inputs" / f"{i}.jpg"); shutil.copy2(rgba, SET / "masked" / f"{i}.png")
                shutil.copy2(SET / "prompts" / f"{i}.try{t}.md", SET / "prompts" / f"{i}.md")
                man["assets"][i] = {"status": "accepted", "try": t, "what_i_see": v.get("what_i_see")}
                left[0] -= 1; print(f"{i} ACCEPTED try {t}: {v.get('people_guess')} / {v.get('role_guess')}: {v.get('what_i_see')}", flush=True)
            else:
                if plate: shutil.copy2(plate, WORK / "rejected" / f"{i}.try{t}.jpg")
                if t <= rer and not v.get("unread"):
                    s["extra"] = "; ".join(v.get("problems") or [])[:700]; paintq.put(i)
                    print(f"{i} refused try {t}: {v.get('problems')}", flush=True)
                elif v.get("unread") and unread.setdefault((i, t), [0]) and unread[(i, t)][0] < 2 and plate:
                    unread[(i, t)][0] += 1
                    gateq.put((i, t, plate, rgba, WORK / f"{i}.try{t}.comp.jpg", m)); print(f"{i} gate unread, again", flush=True)
                    LOG.write_text(json.dumps(log, indent=1) + "\n"); return
                else:
                    man["assets"][i] = {"status": "rejected", "try": t, "problems": v.get("problems")}; left[0] -= 1
                    print(f"{i} REJECTED after try {t}: {v.get('problems')}", flush=True)
            LOG.write_text(json.dumps(log, indent=1) + "\n"); MAN.write_text(json.dumps(man, indent=1) + "\n")
            if left[0] <= 0: done.set()

    def gater():
        while not done.is_set():
            try: first = gateq.get(timeout=2)
            except queue.Empty: continue
            batch = [first]; t0 = time.time()
            while len(batch) < B and time.time() - t0 < 90:     # wait a little for company: one agy call for several plates
                try: batch.append(gateq.get(timeout=5))
                except queue.Empty:
                    if paintq.empty() and gateq.empty() and time.time() - t0 > 20: break
            V = gate_batch([(state[x[0]]["a"], x[4]) for x in batch])
            for (i, t, plate, rgba, comp, m) in batch:
                v = dict(V[i])
                if m.get("verdict") == "fail": v["ok"] = False; v["problems"] = (v.get("problems") or []) + ["the background must be one uniform flat chroma-blue with clear space all round"]; v.pop("unread", None)
                finish(i, t, plate, rgba, v, m)

    th = [threading.Thread(target=painter, daemon=True) for _ in range(W)] + [threading.Thread(target=gater, daemon=True)]
    for x in th: x.start()
    while not done.is_set(): time.sleep(3)
    from collections import Counter
    print("done:", dict(Counter(v["status"] for k, v in man["assets"].items() if k in state)), flush=True)


if __name__ == "__main__":
    main()
