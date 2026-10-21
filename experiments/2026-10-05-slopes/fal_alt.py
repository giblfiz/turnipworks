#!/usr/bin/env python3
"""Other image-to-3D models on fal for the pieces TRELLIS.2 could not texture (single image in, GLB out).
    python3 fal_alt.py trellis1 slope-outcrop slope-ledges-2      # fal-ai/trellis (v1), $0.02 each
    python3 fal_alt.py hunyuan slope-outcrop                      # fal-ai/hunyuan-3d/v3.1/pro/image-to-3d, $0.375 each
Writes fal-<model>/models/<id>.glb and fal-<model>/manifests/<id>.json. No retries.
"""
import base64, concurrent.futures, json, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path
HERE = Path(__file__).resolve().parent
KEY = Path("~/.config/fauna/secrets/fal-api-key.txt").read_text().strip()   # the path src/fal_trellis.py uses
MODELS = {"trellis1": ("fal-ai/trellis", 0.02, "image_url", {"texture_size": 1024}),
          "hunyuan": ("fal-ai/hunyuan-3d/v3.1/pro/image-to-3d", 0.375, "input_image_url", {})}
def req(url, payload=None):
    r = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None)
    r.add_header("Authorization", f"Key {KEY}")
    if payload is not None: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=180) as resp: return json.load(resp)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:400]}") from e
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
def run(model, aid):
    endpoint, price, field, extra = MODELS[model]
    root = HERE / f"fal-{model}"; (root / "models").mkdir(parents=True, exist_ok=True); (root / "manifests").mkdir(exist_ok=True)
    if (root / "manifests" / f"{aid}.json").exists(): return aid, "skip"
    img = HERE / "masked" / f"{aid}.png"
    t0 = datetime.now(timezone.utc)
    base = f"https://queue.fal.run/{endpoint}"
    sub = req(base, {field: "data:image/png;base64," + base64.b64encode(img.read_bytes()).decode(), **extra})
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
    (root / "manifests" / f"{aid}.json").write_text(json.dumps(man, indent=1) + "\n")
    return aid, man["output_bytes"]
if __name__ == "__main__":
    model, ids = sys.argv[1], sys.argv[2:]
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        futs = {pool.submit(run, model, i): i for i in ids}
        for f in concurrent.futures.as_completed(futs):
            try: print(f.result(), flush=True)
            except Exception as e: print(futs[f], "FAILED", str(e)[:300], flush=True)
