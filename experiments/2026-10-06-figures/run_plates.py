#!/usr/bin/env python3
"""The plate queue for the default set: runs for hours, a few Codex painters at a time, always the most useful plate
next. Reads set/assets.json again whenever it changes (the list grows while this runs), paints only plates whose
reference plate already exists (a hero waits for its people's body plate, a horde variant for its family's first
plate), goes through the figure gate and the matte (gen.py), and writes set/gate-manifest.json.
    python3 run_plates.py [--workers 5] [--rerolls 1] [--max-prio 9]
Stop: touch set/STOP (running plates finish). Quota: a Codex usage/rate-limit message pauses the queue 15 minutes,
then one plate probes; set/QUOTA holds the message while paused. Only ONE of these may run (set/plates.pid)."""
import argparse, concurrent.futures, json, os, re, sys, threading, time
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parents[1] / "src"))
import gen                      # patches plate_gate_batch with the Codex painter and the figure gate
import plate_gate_batch as pgb
ap = argparse.ArgumentParser(); ap.add_argument("--workers", type=int, default=5); ap.add_argument("--rerolls", type=int, default=1); ap.add_argument("--max-prio", type=float, default=99); a = ap.parse_args()
ROOT = HERE / "set"; MAN = ROOT / "gate-manifest.json"; PID = ROOT / "plates.pid"; LOG = ROOT / "plates.log"
if PID.exists():
    try: os.kill(int(PID.read_text()), 0); sys.exit(f"already running (pid {PID.read_text().strip()})")
    except (ProcessLookupError, ValueError): pass
PID.write_text(str(os.getpid()))
def log(*x):
    line = time.strftime("%H:%M:%S ") + " ".join(str(v) for v in x); print(line, flush=True)
    with LOG.open("a") as f: f.write(line + "\n")
state = json.loads(MAN.read_text()) if MAN.exists() else {"gate_model": pgb.GATE_MODEL, "assets": {}}
QUOTA_RE = re.compile(r"usage limit|rate limit|quota|too many requests|\b429\b|try again (in|at)", re.I)
errors = {}; pause_until = 0; lock = threading.Lock()
def load():
    spec = json.loads((ROOT / "assets.json").read_text())["assets"]
    return sorted(spec, key=lambda s: (s.get("prio", 5), s["id"]))
def ready(s): return all(Path(r).exists() for r in s.get("refs", []))
def done(s):
    r = state["assets"].get(s["id"]);  return bool(r) and r.get("status") in ("accepted", "rejected") or errors.get(s["id"], 0) >= 3
def work(s):
    global pause_until
    try:
        r = pgb.run_asset(ROOT, s, a.rerolls, state); return s["id"], r.get("status"), len(r.get("attempts", []))
    except Exception as e:
        msg = str(e)[-400:]
        with lock:
            if QUOTA_RE.search(msg):
                pause_until = time.time() + 900; (ROOT / "QUOTA").write_text(json.dumps({"at": time.strftime("%F %T"), "text": msg}) + "\n"); return s["id"], "QUOTA", 0
            errors[s["id"]] = errors.get(s["id"], 0) + 1
            if errors[s["id"]] >= 3: state["assets"][s["id"]] = {"id": s["id"], "status": "error", "error": msg}; MAN.write_text(json.dumps(state, indent=1) + "\n")
        return s["id"], "error: " + msg[-160:].replace("\n", " "), 0
log(f"queue start, {a.workers} workers")
running = {}; t_last = 0; n_ok = 0; t0 = time.time(); idle_note = 0
def workers():   # set/WORKERS overrides --workers while the queue runs (the concurrency test)
    try: return max(1, min(16, int((ROOT / 'WORKERS').read_text())))
    except Exception: return a.workers
with concurrent.futures.ThreadPoolExecutor(16) as pool:
    while True:
        for f in [f for f in running if f.done()]:
            sid = running.pop(f); i, st, tries = f.result(); n_ok += st == "accepted"
            acc = sum(1 for r in state["assets"].values() if r.get("status") == "accepted")
            log(f"{i}: {st} ({tries} tries)   w={workers()} running={len(running)}   accepted so far {acc}   {n_ok / max(1e-9, (time.time() - t0) / 3600):.0f}/h this run")
            if st == "accepted" and (ROOT / "QUOTA").exists(): (ROOT / "QUOTA").unlink()
        if (ROOT / "RETRY").exists():      # ids (one per line) to paint again from the current spec: a rejected plate whose prompt or gate was corrected
            with lock:
                for i in (ROOT / "RETRY").read_text().split():
                    if i in state["assets"] and i not in running.values():
                        (ROOT / "rejected").mkdir(exist_ok=True); (ROOT / "rejected" / f"{i}.earlier-gate.json").write_text(json.dumps(state["assets"].pop(i), indent=1)); errors.pop(i, None); log(f"{i}: queued again")
                MAN.write_text(json.dumps(state, indent=1) + "\n"); (ROOT / "RETRY").unlink()
        if (ROOT / "STOP").exists():
            if not running: log("STOP file: queue ends"); break
            time.sleep(3); continue
        spec = load(); todo = [s for s in spec if s.get("prio", 5) <= a.max_prio and not done(s) and s["id"] not in running.values()]
        can = [s for s in todo if ready(s)]
        paused = time.time() < pause_until
        slots = (1 if paused and not running and time.time() > pause_until - 890 else 0) if paused else workers() - len(running)
        if paused and not running and slots == 0: time.sleep(20); continue
        if can and slots > 0 and time.time() - t_last > 4:      # one launch every four seconds at most
            s = can[0]; running[pool.submit(work, s)] = s["id"]; t_last = time.time(); continue
        if not running and not can:
            if time.time() - idle_note > 600: log(f"nothing to paint ({len(todo)} waiting for a reference plate or none left); watching assets.json"); idle_note = time.time()
            time.sleep(20); continue
        time.sleep(2)
PID.unlink(missing_ok=True)
