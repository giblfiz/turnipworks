#!/usr/bin/env python3
"""masked/<id>.png -> fal-ai/trellis-2 (the settings of src/fal_trellis.py; the cave pilot's runner, which saves the
request id so a lost poll does not lose a paid mesh) -> fal-trellis2<tag>/models/<id>.glb. Skips what exists; appends
every paid call to spend.log; refuses to go past the pilot's hard cap of $2.20.
    python3 mesh_fal.py trellis2 fig-goblin [--tag=-r2]      # $0.30 each; --tag makes a re-roll folder
"""
import base64, concurrent.futures, json, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path
HERE = Path(__file__).resolve().parent
KEY = Path("~/.config/fauna/secrets/fal-api-key.txt").read_text().strip()   # the path src/fal_trellis.py uses
MODELS = {"trellis2": ("fal-ai/trellis-2", 0.30, "image_url", {"resolution": "1024", "decimation_target": 50000, "texture_size": "2048", "remesh": True}),
          "trellis1": ("fal-ai/trellis", 0.02, "image_url", {"texture_size": 1024}),
          "hunyuan": ("fal-ai/hunyuan-3d/v3.1/pro/image-to-3d", 0.375, "input_image_url", {})}
def req(url, payload=None):
    r = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None)
    r.add_header("Authorization", f"Key {KEY}")
    if payload is not None: r.add_header("Content-Type", "application/json")
    for attempt in range(5):   # polling must survive a network blip: a lost poll loses a paid mesh (it happened once, $0.30)
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
CAP = 2.20
def spent():
    f = HERE / "spend.log"
    return sum(float(l.rsplit("$", 1)[1]) for l in f.read_text().splitlines() if "$" in l and not l.startswith("#")) if f.exists() else 0.0
import threading
GATE = threading.Lock()
def run(model, aid, tag=""):
    endpoint, price, field, extra = MODELS[model]
    root = HERE / f"fal-{model}{tag}"; (root / "models").mkdir(parents=True, exist_ok=True); (root / "manifests").mkdir(exist_ok=True)
    if (root / "manifests" / f"{aid}.json").exists(): return aid, "skip"
    img = HERE / "masked" / f"{aid}.png"
    t0 = datetime.now(timezone.utc)
    base = f"https://queue.fal.run/{endpoint}"
    pend = root / "manifests" / f"{aid}.pending.json"
    if pend.exists(): sub = json.loads(pend.read_text())          # a paid request whose result was not fetched: pick it up
    else:
      with GATE:
        if spent() + price > CAP + 1e-9: raise RuntimeError(f"cap: ${spent():.2f} spent, ${price} more would pass ${CAP}")
        sub = req(base, {field: "data:image/png;base64," + base64.b64encode(img.read_bytes()).decode(), **extra})
        pend.write_text(json.dumps(sub))
        with open(HERE / "spend.log", "a") as f: f.write(f"{t0.isoformat(timespec='seconds')} fal {endpoint} {aid} ${price}\n")
    rid = sub["request_id"]
    while True:
        st = req(sub.get("status_url", f"{base}/requests/{rid}/status"))
        if st.get("status") == "COMPLETED": break
        if st.get("status") in ("FAILED", "CANCELLED"): raise RuntimeError(json.dumps(st)[:400])
        time.sleep(4)
    res = req(sub.get("response_url", f"{base}/requests/{rid}"))
    out = root / "models" / f"{aid}.glb"
    with urllib.request.urlopen(find_glb(res), timeout=300) as r: out.write_bytes(r.read())
    man = {"asset": aid, "provider": "fal.ai", "model": endpoint, "request_id": rid, "started_at": t0.isoformat(),
           "finished_at": datetime.now(timezone.utc).isoformat(), "input": f"masked/{aid}.png", "output_bytes": out.stat().st_size, "settings": extra, "estimated_cost_usd": price}
    (root / "manifests" / f"{aid}.json").write_text(json.dumps(man, indent=1) + "\n"); pend.unlink()
    return aid, man["output_bytes"]
if __name__ == "__main__":
    tag = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--tag=")), "")
    model, ids = sys.argv[1], [a for a in sys.argv[2:] if not a.startswith("--")]
    print("fal balance before:", balance(), flush=True)
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        futs = {pool.submit(run, model, i, tag): i for i in ids}
        for f in concurrent.futures.as_completed(futs):
            try: print(f.result(), flush=True)
            except Exception as e: print(futs[f], "FAILED", str(e)[:300], flush=True)
    print("fal balance after:", balance(), flush=True)
