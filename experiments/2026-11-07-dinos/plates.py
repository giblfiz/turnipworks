#!/usr/bin/env python3
"""Dinosaur plates: painted by Qwen-Image-Edit ON THE POD (pod/qwen/gen_qwen.py; open weights, Apache-2.0), several
seeds per figure, conditioned on the set's own tyrannosaur / triceratops plate (a flying pose: on the creature's own
accepted standing plate). Fetched to the USB disk, matted locally with BiRefNet (the set's matte), gated blind by Gemini
through agy-run in BATCHES (the shared queue), the set's two plates shown beside them as the style yardstick.
    python3 plates.py jobs  [--ids=a,b] [--seeds=4] [--round=1] [--steps=40]   write + upload the jobs, start the painter
    python3 plates.py fetch                                                    pod -> USB plates-raw/
    python3 plates.py gate [--ids=a,b] [--batch=10]
Accepted: set/inputs/<id>.jpg, set/masked/<id>.png, set/gate-manifest.json (the set's shape), set/gate-log.json (every
candidate's verdict). The best passing candidate wins (the gate's own 1-5 score: species read, style match, mesh-ability)."""
import json, random, shutil, string, subprocess, sys, time
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]; SET = HERE / "set"; POD = HERE / "pod"
USB = Path("/mnt/usb/turnip-works/lanes-2026-11-07/dinos"); RAW = USB / "plates-raw"; WORK = USB / "work"
arg = lambda k, d=None: next((x.split("=", 1)[1] for x in sys.argv if x.startswith(k + "=")), d)
LOG = SET / "gate-log.json"; MAN = SET / "gate-manifest.json"
A = {a["id"]: a for a in json.loads((SET / "assets.json").read_text())["assets"]}


def pod():
    j = json.loads((POD / "pod.json").read_text()); return j["host"], str(j["port"])


def ssh(cmd, **kw):
    h, p = pod(); return subprocess.run(["ssh", "-o", "BatchMode=yes", "-p", p, f"root@{h}", cmd], capture_output=True, text=True, **kw)


def jobs():
    ids = arg("--ids"); ids = ids.split(",") if ids else [i for i, a in A.items() if not a["id"].endswith("-fly")]
    seeds, rnd = int(arg("--seeds", 4)), int(arg("--round", 1))
    corr = json.loads((SET / "corrections.json").read_text()) if (SET / "corrections.json").exists() else {}
    # a round's OVERRIDES (set/overrides-r<N>.json: id -> {refs, prompt, negative}): round 1 showed the edit model copies its
    # reference's ANATOMY (ankylosaurs with a triceratops head, spinosaurs that were tyrannosaurs), so a later round picks
    # references for the parts they SHARE with the target (a crocodile's snout for the spinosaurus) and names the bleed
    ov = json.loads((SET / f"overrides-r{rnd}.json").read_text()) if (SET / f"overrides-r{rnd}.json").exists() else {}
    h, p = pod(); J, refs = [], {}
    for i in ids:
        a = A[i]
        o = ov.get(i, {})
        if o.get("refs"): rs = [Path(x) for x in o["refs"]]
        elif a.get("standing"):
            rs = [SET / "inputs" / f"{a['standing']}.jpg"]
            if not rs[0].exists(): sys.exit(f"{i}: its standing plate {rs[0]} is not accepted yet")
        else: rs = [Path(a["refs"][0])]
        for r in rs: refs[r.name] = r
        prompt = o.get("prompt") or a["qwen"]
        prompt += (f" Corrections (fix these): {corr[i]}" if corr.get(i) else "")
        J.append({"id": i, "prompt": prompt, "refs": [f"/root/dinos/refs/{r.name}" for r in rs], "seeds": [rnd * 100 + k for k in range(1, seeds + 1)], **({"negative": o["negative"]} if o.get("negative") else {})})
        (SET / "prompts").mkdir(parents=True, exist_ok=True); (SET / "prompts" / f"{i}.r{rnd}.qwen.md").write_text(prompt + "\n")
    jf = HERE / f"pod/qwen/jobs-r{rnd}.json"; jf.write_text(json.dumps(J, indent=1) + "\n")
    subprocess.run(["scp", "-q", "-P", p, *map(str, refs.values()), f"root@{h}:/root/dinos/refs/"], check=True)
    subprocess.run(["scp", "-q", "-P", p, str(jf), str(HERE / "pod/qwen/gen_qwen.py"), f"root@{h}:/root/dinos/"], check=True)
    st = int(arg("--steps", 40))
    # --queue: start when the painter now running exits (one model on the GPU at a time)
    wait = "while test -f gen.pid && kill -0 $(cat gen.pid) 2>/dev/null; do sleep 5; done; " if "--queue" in sys.argv else ""
    run = f"env HF_HOME=/root/hf /root/qenv/bin/python gen_qwen.py {jf.name} out --steps {st} > gen-r{rnd}.log 2>&1"   # (exec env ...: `exec VAR=x cmd` is not bash)
    if wait: r = ssh(f"cd /root/dinos && setsid -f bash -c '{wait}echo $$ > gen.pid; exec {run}' > /dev/null 2>&1 < /dev/null; echo queued")
    else: r = ssh(f"cd /root/dinos && (test -f gen.pid && kill -0 $(cat gen.pid) 2>/dev/null && echo BUSY) || (setsid -f bash -c 'echo $$ > gen.pid; exec {run}' > /dev/null 2>&1 < /dev/null; echo started)")
    print(r.stdout.strip(), r.stderr.strip()[-300:], f"{len(J)} figures x {seeds} seeds, round {rnd}")


def fetch():
    RAW.mkdir(parents=True, exist_ok=True); h, p = pod()
    subprocess.run(["rsync", "-a", "-e", f"ssh -o BatchMode=yes -p {p}", f"root@{h}:/root/dinos/out/", str(RAW) + "/"], check=True)
    print(len(list(RAW.glob("*.png"))), "plates on USB;", ssh("tail -2 /root/dinos/gen-r*.log | tail -3").stdout.strip()[-400:])


GATE = """You are the gate of a 3D miniature-figure factory. STYLE_A.jpg and STYLE_B.jpg are two figures ALREADY IN the set
(a tyrannosaur and a triceratops): they are the style yardstick. Every other image is a CUT-OUT of one NEW candidate
figure on a flat magenta background (the magenta is the mask, not part of the figure).

For EACH candidate image, FIRST say plainly what you see as if you were not told: which animal it is (name the species if
you can), its pose, anything odd. THEN check it against what was requested for it.

Fail a candidate (ok=false) only for things that would make the 3D figure wrong:
- not exactly ONE creature, or several views of it;
- any part cut off by the image edge (head, tail tip, wing tip, feet);
- anything UNDER the feet: a base, disc, plinth, rock, ground patch, cast shadow or dark blob;
- an unpainted grey / statue / photo look, or a style clearly unlike STYLE_A/STYLE_B (painted chunky miniature);
- legs fused where gaps are needed, missing or extra limbs, a melted head;
- the wrong animal, or a "must" item missing;
- feathers, visible text or logos.
Ignore small painterly details.

{items}

Answer with ONE JSON object and nothing after it:
{{"images": [{{"image": "<name>", "what_i_see": "<one sentence>", "species_guess": "<one or two words>", "style_match": "same|close|different", "ok": true|false, "score": <1-5, how good a figure it is for the set>, "problems": ["<short, specific, fixable>"]}}, ...]}}"""


def gate():
    sys.path.insert(0, str(ROOT / "src")); sys.path.insert(0, str(HERE))
    import plate_gate_batch as pgb
    from agy import gemini, last_json
    from PIL import Image
    WORK.mkdir(parents=True, exist_ok=True)
    for d in ("inputs", "masked"): (SET / d).mkdir(parents=True, exist_ok=True)
    log = json.loads(LOG.read_text()) if LOG.exists() else {}
    man = json.loads(MAN.read_text()) if MAN.exists() else {"gate_model": "gemini via agy-run (subscription)", "painter": "Qwen-Image-Edit on RunPod (open weights)", "assets": {}}
    ids = arg("--ids"); ids = ids.split(",") if ids else None
    seen = {c["cand"] for v in log.values() for c in v}
    todo = []
    for png in sorted(RAW.glob("*.s*.png")):
        i, cand = png.name.split(".s")[0], png.stem
        if i not in A or cand in seen or (ids and i not in ids) or man["assets"].get(i, {}).get("status") == "accepted" and "--more" not in sys.argv: continue
        jpg = WORK / f"{cand}.jpg"; Image.open(png).convert("RGB").save(jpg, quality=94)
        rgba = WORK / f"{cand}.png"; m = pgb.birefnet(jpg, rgba); comp = pgb.composite(rgba, WORK / f"{cand}.comp.jpg")
        todo.append((i, cand, jpg, rgba, comp, m))
    print(len(todo), "candidates to gate", flush=True)
    styleA = WORK / "STYLE_A.jpg"; styleB = WORK / "STYLE_B.jpg"
    if not styleA.exists():
        M = Path("experiments/2026-10-06-figures/set/work")
        shutil.copy2(M / "foe-tyrannosaur.try1.comp.jpg", styleA); shutil.copy2(M / "foe-triceratops.try1.comp.jpg", styleB)
    B = int(arg("--batch", 10))
    for k in range(0, len(todo), B):
        batch = todo[k:k + B]; tag = "".join(random.choice(string.ascii_lowercase) for _ in range(3))
        names, items, imgs = {}, [], [(styleA, "STYLE_A.jpg"), (styleB, "STYLE_B.jpg")]
        order = list(batch); random.shuffle(order)
        for n_, (i, cand, jpg, rgba, comp, m) in enumerate(order, 1):
            n = f"cand{n_}{tag}.jpg"; names[n] = cand; imgs.append((comp, n))
            a = A[i]; items.append(f"{n}: requested = {a['gate']['desc']}. Must have: {'; '.join(a['gate']['must'])}.")
        t0 = time.time(); txt = gemini(GATE.format(items="\n".join(items)), imgs, timeout=600); j = last_json(txt) or {}
        V = {names.get(str(v.get("image", "")).strip()): v for v in j.get("images", []) if names.get(str(v.get("image", "")).strip())}
        print(f"batch {k // B + 1}: {len(V)}/{len(batch)} read in {time.time() - t0:.0f}s", flush=True)
        for (i, cand, jpg, rgba, comp, m) in batch:
            v = V.get(cand) or {"ok": False, "unread": True, "problems": ["the gate could not read the picture"]}
            if m.get("verdict") == "fail": v["ok"] = False; v.setdefault("problems", []).append("matte failed: the background must be one flat chroma-blue with clear space all round")
            log.setdefault(i, []).append({"cand": cand, "matte": m, **{x: v.get(x) for x in ("ok", "score", "style_match", "species_guess", "what_i_see", "problems", "unread")}})
            print(f"  {cand}: ok={v.get('ok')} score={v.get('score')} style={v.get('style_match')} species={v.get('species_guess')} | {v.get('what_i_see')} | {v.get('problems')}", flush=True)
        LOG.write_text(json.dumps(log, indent=1) + "\n")
    # the winner per figure: the best-scored passing candidate ("same" style before "close")
    for i, cands in log.items():
        if man["assets"].get(i, {}).get("status") == "accepted" and "--more" not in sys.argv: continue
        good = [c for c in cands if c.get("ok") and c.get("style_match") in ("same", "close")]
        if not good: man["assets"][i] = {"status": "pending", "tried": len(cands), "problems": sorted({p for c in cands for p in (c.get("problems") or [])})[:8]}; continue
        best = max(good, key=lambda c: (c.get("score") or 0, c.get("style_match") == "same"))
        shutil.copy2(WORK / f"{best['cand']}.jpg", SET / "inputs" / f"{i}.jpg"); shutil.copy2(WORK / f"{best['cand']}.png", SET / "masked" / f"{i}.png")
        man["assets"][i] = {"status": "accepted", "cand": best["cand"], "score": best.get("score"), "what_i_see": best.get("what_i_see"), "species_guess": best.get("species_guess")}
        print(f"{i} ACCEPTED {best['cand']} (score {best.get('score')}, {best.get('species_guess')})", flush=True)
    MAN.write_text(json.dumps(man, indent=1) + "\n")
    print({i: r["status"] for i, r in man["assets"].items()})


if __name__ == "__main__":
    {"jobs": jobs, "fetch": fetch, "gate": gate}[sys.argv[1]]()
