#!/usr/bin/env python3
"""Plates for one type folder through the project's gates (src/plate_gate_batch.py: blind describe -> match ->
BiRefNet matte -> mask gate). The plate itself is painted by Codex's built-in image tool (`codex exec`, ChatGPT login:
no API spend). There is NO paid fallback in this file: if Codex cannot paint, the run stops and says so.

    PY=python3
    $PY tools/gen.py crypt --group p1 [--workers 2] [--prio 1] [--ids a,b,c] [--rerolls 1] [--gap 20]
    $PY tools/gen.py crypt --group p1 --probe      # ONE image request (the next waiting plate); used by queue.sh
    $PY tools/gen.py crypt --group p1 --dry-run    # what would run, nothing generated

Resumable: an id whose plate is accepted is skipped; `rejected` ids are skipped unless --retry-rejected; ids that ended in
an error (or were never reached) run again. A sibling whose reference plate (inputs/<parent>.jpg) does not exist yet is
left waiting, not failed.

Quota: when `codex exec` reports a usage / rate limit (or the image tool is refused twice running) nothing is retried.
The exact text Codex printed goes to B/QUOTA_STOP with a timestamp and the plate counts of all type folders, the ids
still to do go to TYPE_DIR/plates-waiting.txt, and the exit code is 75. While B/QUOTA_STOP exists gen.py refuses to
start (exit 75) unless --probe; the first successful image removes the file.
Exit codes: 0 finished the selection, 75 stopped for quota, 3 --probe had no plate to try in this step, 2 usage.
    python3 tools/gen.py --status                  # one line: plates done / waiting, the quota error text, last probe
"""
import argparse, concurrent.futures as cf, json, os, re, subprocess, sys, tempfile, threading, time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
B = Path(os.environ["TW_B"]) if os.environ.get("TW_B") else HERE.parent     # TW_B: a scratch copy of the batch folder (tests)
ROOT = HERE.parents[3]
QUOTA_FILE = B / "QUOTA_STOP"
TYPES = ("batch",)
EXIT_QUOTA = 75

# What `codex exec` (0.160) prints when the account is out of allowance or throttled. Strings taken from the CLI binary:
# "You've hit your usage limit.", "Usage limit reached. You've reached your usage limit.", "You're out of credits",
# "Codex is currently experiencing high load.", error codes usage_limit_reached / quota_exceeded / usage_not_included /
# rate_limit_exceeded / server_overloaded, and HTTP 429 from the stream.
QUOTA_HARD = re.compile(
    r"hit your usage limit|usage limit reached|reached your usage limit|usage_limit_reached|out of credits|credits_depleted"
    r"|quota[ _]exceeded|insufficient_quota|usage_not_included|rate[ _]limit(?:ed|[ _]exceeded|[ _]reached)?\b|too many requests"
    r"|(?:status|http|error)[^\n]{0,30}\b429\b|\b429 too many|try again (?:at|in) |server[ _]overloaded|experiencing high load", re.I)
# The model answering without an image because the image tool was withheld from it.
REFUSED_SOFT = re.compile(
    r"(image[ _-]?gen\w*|image generation|generate (?:an? |the )?images?|image tool|imagegen)[^\n]{0,160}"
    r"(limit|quota|unavailable|not available|isn.t available|disabled|can.t|cannot|unable|don.t have|do not have|try again)", re.I)


class QuotaStop(Exception):
    pass


STOP = threading.Event()
PACE = threading.Lock()
STATE = {"last_launch": 0.0, "refused_run": 0, "quota_text": "", "images_ok": 0, "gap": 20.0, "probe": False}


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


ERRLINE = re.compile(r"^\s*(\[?error\]?[: ]|stream error|fatal[: ]|unexpected status)", re.I)
BLOCK = {"user", "codex", "exec", "thinking", "tokens used"}


def classify(stdout: str, stderr: str, prompt: str):
    """-> ('quota', exact text) | ('refused', text) | ('fail', text).
    `codex exec` writes the whole transcript to stderr, INCLUDING the output of every shell command the agent ran (it
    reads wiki pages, and those mention rate limits and quotas), and only the final message to stdout. So the limit
    patterns are looked for only where the CLI or the model itself speaks: stderr lines that START like an error
    ("ERROR: You've hit your usage limit ...", "stream error: ... 429 Too Many Requests"), and the model's last
    message (the last `codex` block of stderr, and stdout). The prompt echo is removed first."""
    def strip(t):
        return t.replace(prompt, "[prompt]") if prompt else t
    out, err = strip(stdout or ""), strip(stderr or "")
    el = err.splitlines()
    last = max((i for i, ln in enumerate(el) if ln.strip() == "codex"), default=None)
    final = [] if last is None else [ln for ln in el[last + 1:] if ln.strip() not in BLOCK]
    if last is not None and any(ln.strip() == "exec" for ln in el[last + 1:]): final = []      # ended inside a tool call
    final = final[:40] + out.splitlines()
    hits = [ln.strip() for ln in el if ERRLINE.search(ln) and QUOTA_HARD.search(ln)]
    if not hits: hits = [ln.strip() for ln in final if QUOTA_HARD.search(ln)]
    if hits:
        return "quota", "\n".join(dict.fromkeys(hits))[:1500]
    said = [ln.strip() for ln in final if REFUSED_SOFT.search(ln)]
    if said:
        return "refused", "\n".join(dict.fromkeys(said))[:800]
    return "fail", ("\n".join(el[-6:]) or out)[-400:]


def plate_counts():
    """accepted / waiting plates in every type folder of the batch."""
    rows = {}
    for t in TYPES:
        d = B / t
        if not (d / "assets.json").exists():
            continue
        assets = json.loads((d / "assets.json").read_text())["assets"]
        st = json.loads((d / "gate-manifest.json").read_text())["assets"] if (d / "gate-manifest.json").exists() else {}
        acc = sum(1 for a in assets if st.get(a["id"], {}).get("status") == "accepted")
        rej = sum(1 for a in assets if st.get(a["id"], {}).get("status") == "rejected")
        rows[t] = {"assets": len(assets), "accepted": acc, "rejected": rej, "waiting": len(assets) - acc - rej}
    return rows


def write_quota_stop(text, where):
    rows = plate_counts()
    rec = {"time": now(), "where": where, "error_text": text, "plates": rows,
           "accepted_total": sum(r["accepted"] for r in rows.values()), "waiting_total": sum(r["waiting"] for r in rows.values()),
           "last_probe": now() if STATE["probe"] else (json.loads(QUOTA_FILE.read_text()).get("last_probe") if QUOTA_FILE.exists() else None),
           "first_stop": json.loads(QUOTA_FILE.read_text()).get("first_stop", now()) if QUOTA_FILE.exists() else now()}
    QUOTA_FILE.write_text(json.dumps(rec, indent=1, ensure_ascii=False) + "\n")


def codex_generate(root, asset, attempt, extra):
    """Replacement for plate_gate_batch.generate: one plate from Codex's image tool, or an exception."""
    from PIL import Image
    if STOP.is_set():
        raise QuotaStop(STATE["quota_text"])
    (root / "prompts").mkdir(exist_ok=True); (root / "work").mkdir(exist_ok=True)
    prompt = asset["prompt"] + (f"\n\nCorrections from a rejected previous attempt (fix these): {extra}" if extra else "")
    (root / "prompts" / f"{asset['id']}.try{attempt}.md").write_text(prompt)
    out = root / "work" / f"{asset['id']}.try{attempt}.jpg"
    full = ("Use your built-in image generation tool. The attached image is the reference described below.\n\n" + prompt +
            "\nSave the resulting PNG (square, at least 1024 px) into the current directory as plate.png and print its path and pixel size.")
    last = ""
    for k in range(2):                                    # one retry for an ORDINARY failure only
        with PACE:                                        # polite: one launch at a time, a gap between launches
            wait = STATE["last_launch"] + STATE["gap"] - time.time()
            if wait > 0: time.sleep(wait)
            STATE["last_launch"] = time.time()
        if STOP.is_set():
            raise QuotaStop(STATE["quota_text"])
        wd = tempfile.mkdtemp(prefix=f"tw-{root.name}-{asset['id']}-")
        cmd = ["codex", "exec", "--skip-git-repo-check", "-C", wd, "-s", "workspace-write"]
        for ref in asset.get("refs", []): cmd += ["-i", str(ref)]
        cmd += ["-"]
        t0 = time.time()
        try:
            r = subprocess.run(cmd, input=full, capture_output=True, text=True, timeout=1200)
            so, se = r.stdout, r.stderr
        except subprocess.TimeoutExpired as e:
            so, se = (e.stdout or b"").decode("utf8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or ""), "TIMEOUT after 1200 s"
        with open(root / "work" / f"{asset['id']}.codex.log", "a") as f:
            f.write(f"\n===== {now()} try{attempt}.{k} {time.time() - t0:.0f}s\n" + so[-3000:] + "\n--- stderr\n" + se.replace(full, "[prompt]")[-3000:])
        got = os.path.join(wd, "plate.png")
        if os.path.exists(got):
            Image.open(got).convert("RGB").save(out, quality=94)
            STATE["refused_run"] = 0; STATE["images_ok"] += 1
            if QUOTA_FILE.exists():
                QUOTA_FILE.unlink()
                print(f"QUOTA_STOP removed: Codex painted {asset['id']}", flush=True)
            return out
        kind, text = classify(so, se, full)
        last = text
        if kind == "quota":
            STATE["quota_text"] = text; STOP.set()
            write_quota_stop(text, f"{root.name}/{asset['id']}")
            raise QuotaStop(text)
        if kind == "refused":
            STATE["refused_run"] += 1
            if STATE["refused_run"] >= 2 or (STATE["probe"] and STATE["images_ok"] == 0):
                STATE["quota_text"] = "image tool refused: " + text; STOP.set()
                write_quota_stop(STATE["quota_text"], f"{root.name}/{asset['id']}")
                raise QuotaStop(STATE["quota_text"])
            raise RuntimeError("codex image tool refused (not retried): " + text[:300])
        time.sleep(15)
    raise RuntimeError("codex image failed twice: " + last[-300:])


def select(assets, state, a):
    ids = set(a.ids.split(",")) if a.ids else None
    prios = {int(p) for p in a.prio.split(",")} if a.prio else None
    todo, skipped, blocked = [], [], []
    for x in assets:
        if ids is not None and x["id"] not in ids: continue
        if a.group and x.get("group") != a.group: continue
        if prios is not None and int(x.get("prio", 0) or 0) not in prios: continue
        st = state["assets"].get(x["id"], {}).get("status")
        if st == "accepted" and not a.redo: skipped.append(x["id"]); continue
        if st == "rejected" and not (a.redo or a.retry_rejected): skipped.append(x["id"]); continue
        missing = [r for r in list(x.get("refs", [])) + list(x.get("gate_refs", [])) if not Path(r).exists()]
        if missing: blocked.append((x["id"], missing[0])); continue
        todo.append(x)
    todo.sort(key=lambda x: int(x.get("prio", 9) or 9))     # stable: file order inside a priority
    return todo, skipped, blocked


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("type_dir", type=Path, nargs="?")
    ap.add_argument("--status", action="store_true", help="one line: plates done / waiting, the quota error, last probe")
    ap.add_argument("--group"); ap.add_argument("--ids"); ap.add_argument("--prio", help="e.g. 1 or 1,2")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--rerolls", type=int, default=1, help="extra plates after a gate reject (yard used 1-2)")
    ap.add_argument("--gap", type=float, default=20.0, help="minimum seconds between two Codex launches")
    ap.add_argument("--limit", type=int, help="at most N assets this run")
    ap.add_argument("--redo", action="store_true"); ap.add_argument("--retry-rejected", action="store_true")
    ap.add_argument("--probe", action="store_true", help="ONE asset, ONE image request, ignore an existing QUOTA_STOP")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.status:
        rows = plate_counts(); q = json.loads(QUOTA_FILE.read_text()) if QUOTA_FILE.exists() else None
        per = " ".join(f"{t} {r['accepted']}/{r['assets']}" for t, r in rows.items()) or "no assets.json yet"
        line = f"plates done {sum(r['accepted'] for r in rows.values())}, waiting {sum(r['waiting'] for r in rows.values())}, rejected {sum(r['rejected'] for r in rows.values())} ({per})"
        if q: line += f" | QUOTA_STOP since {q.get('first_stop')}: {' / '.join(q.get('error_text', '').splitlines())[:300]} | last probe {q.get('last_probe') or 'none yet'}"
        else: line += " | Codex route: no quota stop"
        print(line); return
    if not a.type_dir: ap.error("TYPE_DIR is required")
    root = a.type_dir.resolve() if a.type_dir.exists() else (B / a.type_dir).resolve()
    if not (root / "assets.json").exists():
        print(f"no assets.json in {root}"); sys.exit(2)
    assets = json.loads((root / "assets.json").read_text())["assets"]
    man = root / "gate-manifest.json"
    state = json.loads(man.read_text()) if man.exists() else {"gate_model": None, "assets": {}}
    todo, skipped, blocked = select(assets, state, a)
    if a.probe: todo, a.workers = todo[:1], 1
    if a.limit: todo = todo[:a.limit]
    waiting_file = root / "plates-waiting.txt"
    print(f"{root.name}: {len(todo)} to run, {len(skipped)} already done, {len(blocked)} waiting for a parent plate", flush=True)
    for i, m in blocked: print(f"  blocked {i}: no {m}", flush=True)
    if a.dry_run:
        for x in todo: print("  would run", x["id"], f"(group {x.get('group')}, prio {x.get('prio', '-')}, {len(x.get('refs', []))} refs)")
        return
    if QUOTA_FILE.exists() and not a.probe:
        print(f"{QUOTA_FILE} exists: Codex is out of allowance. Not starting (queue.sh probes every 15 min; or run --probe)."); sys.exit(EXIT_QUOTA)
    if not todo:
        waiting_file.write_text("".join(f"{i}\tblocked: parent plate missing\n" for i, _ in blocked))
        sys.exit(3 if a.probe else 0)                     # 3: nothing in this step to probe with

    sys.path.insert(0, str(ROOT / "src"))
    import plate_gate_batch as pgb
    pgb.generate = codex_generate                         # the ONLY image source
    pgb.IMAGE_COST = 0.0; pgb.IMAGE_MODEL = None
    state.setdefault("gate_model", pgb.GATE_MODEL); state["gate_model"] = state["gate_model"] or pgb.GATE_MODEL
    STATE["gap"], STATE["probe"] = a.gap, a.probe
    t0 = time.time(); done = {}

    def one(x):
        if STOP.is_set(): return x["id"], "waiting"
        try:
            return x["id"], pgb.run_asset(root, x, a.rerolls, state).get("status")
        except QuotaStop:
            return x["id"], "waiting"
        except Exception as exc:                          # keep the batch going
            with pgb.LOCK:
                state["assets"][x["id"]] = {"id": x["id"], "group": x.get("group"), "status": "error", "error": repr(exc)[:500], "time": now()}
                man.write_text(json.dumps(state, indent=1) + "\n")
            print(f"{x['id']}: ERROR {exc!r}"[:300], flush=True)
            return x["id"], "error"

    with cf.ThreadPoolExecutor(a.workers) as pool:
        for i, st in pool.map(one, todo): done[i] = st
    left = [i for i, st in done.items() if st in ("waiting", "error")]
    waiting_file.write_text("".join(f"{i}\t{done[i]}\n" for i in left) + "".join(f"{i}\tblocked: parent plate missing\n" for i, _ in blocked))
    summary = {"type": root.name, "group": a.group, "ran": len(todo), "accepted": sum(v == "accepted" for v in done.values()),
               "rejected": sum(v == "rejected" for v in done.values()), "errors": sum(v == "error" for v in done.values()),
               "waiting": sum(v == "waiting" for v in done.values()), "blocked": len(blocked), "images": STATE["images_ok"],
               "minutes": round((time.time() - t0) / 60, 1), "quota_stop": STOP.is_set()}
    print(json.dumps(summary), flush=True)
    if STOP.is_set():
        write_quota_stop(STATE["quota_text"], f"{root.name} group {a.group}")
        print("QUOTA_STOP: " + STATE["quota_text"][:400], flush=True)
        sys.exit(EXIT_QUOTA)


if __name__ == "__main__":
    main()
