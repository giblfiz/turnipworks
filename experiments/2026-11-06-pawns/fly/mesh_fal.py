#!/usr/bin/env python3
"""masked/<id>.png -> fal-ai/trellis-2 (the figure set's settings: 1024, 50k faces, 2048 px, remesh) -> models/<id>-fly.glb.
A copy of experiments/2026-10-06-figures/mesh_fal.py: it saves the request id so a lost poll does not lose a paid mesh,
appends every paid call to fal-spend.log, and refuses to pass this run's cap.
    python3 mesh_fal.py foe-wyvern beast-hawk ...       # $0.30 each; --again re-meshes (the old one goes to models/rerolled/)"""
import base64, concurrent.futures, json, shutil, sys, threading, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path
HERE = Path(__file__).resolve().parent
KEY = Path("~/.config/fauna/secrets/fal-api-key.txt").read_text().strip()   # the path src/fal_trellis.py uses
ENDPOINT, PRICE, EXTRA = "fal-ai/trellis-2", 0.30, {"resolution": "1024", "decimation_target": 50000, "texture_size": "2048", "remesh": True}
CAP = 2.40   # the small batch (4 x $0.30) and up to 4 re-rolls on fal; the rest goes to one RunPod pod
GATE = threading.Lock()


def req(url, payload=None):
    r = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None)
    r.add_header("Authorization", f"Key {KEY}")
    if payload is not None: r.add_header("Content-Type", "application/json")
    for attempt in range(5):
        try:
            with urllib.request.urlopen(r, timeout=180) as resp: return json.load(resp)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:400]}") from e
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt == 4 or payload is not None: raise     # never re-send a paid submit
            time.sleep(5 * (attempt + 1))


def find_glb(o):
    if isinstance(o, dict):
        u = o.get("url")
        if isinstance(u, str) and (".glb" in u or o.get("content_type", "").startswith("model/gltf")): return u
        o = list(o.values())
    if isinstance(o, list):
        for v in o:
            g = find_glb(v)
            if g: return g
    return None


def balance():
    r = urllib.request.Request("https://rest.alpha.fal.ai/billing/user_balance", headers={"Authorization": f"Key {KEY}"})
    return float(urllib.request.urlopen(r, timeout=30).read())


def spent():
    f = HERE / "fal-spend.log"
    return sum(float(l.rsplit("$", 1)[1]) for l in f.read_text().splitlines() if "$" in l and not l.startswith("#")) if f.exists() else 0.0


def run(aid, again=False):
    (HERE / "models").mkdir(exist_ok=True); man_d = HERE / "mesh-manifests"; man_d.mkdir(exist_ok=True)
    out = HERE / "models" / f"{aid}-fly.glb"; man = man_d / f"{aid}.json"; pend = man_d / f"{aid}.pending.json"
    if out.exists() and not again and not pend.exists(): return aid, "skip"
    if again and out.exists() and not pend.exists():
        (HERE / "models/rerolled").mkdir(exist_ok=True); n = len(list((HERE / "models/rerolled").glob(f"{aid}-fly.*.glb")))
        shutil.move(out, HERE / "models/rerolled" / f"{aid}-fly.{n + 1}.glb")
    img = HERE / "masked" / f"{aid}.png"; t0 = datetime.now(timezone.utc); base = f"https://queue.fal.run/{ENDPOINT}"
    if pend.exists(): sub = json.loads(pend.read_text())
    else:
        with GATE:
            if spent() + PRICE > CAP + 1e-9: raise RuntimeError(f"cap: ${spent():.2f} spent, ${PRICE} more would pass ${CAP}")
            sub = req(base, {"image_url": "data:image/png;base64," + base64.b64encode(img.read_bytes()).decode(), **EXTRA})
            pend.write_text(json.dumps(sub))
            with open(HERE / "fal-spend.log", "a") as f: f.write(f"{t0.isoformat(timespec='seconds')} fal {ENDPOINT} {aid}-fly ${PRICE}\n")
    rid = sub["request_id"]
    while True:
        st = req(sub.get("status_url", f"{base}/requests/{rid}/status"))
        if st.get("status") == "COMPLETED": break
        if st.get("status") in ("FAILED", "CANCELLED"): raise RuntimeError(json.dumps(st)[:400])
        time.sleep(4)
    res = req(sub.get("response_url", f"{base}/requests/{rid}"))
    with urllib.request.urlopen(find_glb(res), timeout=300) as r: out.write_bytes(r.read())
    man.write_text(json.dumps({"asset": aid, "provider": "fal.ai", "model": ENDPOINT, "request_id": rid, "started_at": t0.isoformat(),
                               "finished_at": datetime.now(timezone.utc).isoformat(), "input": f"masked/{aid}.png", "output_bytes": out.stat().st_size,
                               "settings": EXTRA, "estimated_cost_usd": PRICE}, indent=1) + "\n")
    pend.unlink()
    return aid, out.stat().st_size


if __name__ == "__main__":
    ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    print("fal balance before:", balance(), flush=True)
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        futs = {pool.submit(run, i, "--again" in sys.argv): i for i in ids}
        for f in concurrent.futures.as_completed(futs):
            try: print(f.result(), flush=True)
            except Exception as e: print(futs[f], "FAILED", str(e)[:300], flush=True)
    print("fal balance after:", balance(), flush=True)
