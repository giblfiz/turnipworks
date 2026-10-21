#!/usr/bin/env python3
"""Multi-view fal runs for the open/close pilot (one call per invocation; no retries: a balance error stops the run).
usage: fal_multi.py JOB   where JOB is one of the keys in JOBS."""
from __future__ import annotations
import base64, hashlib, json, mimetypes, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
KEY = Path("~/.config/fauna/secrets/fal-api-key.txt").read_text().strip()
V = lambda n: HERE / "views" / f"{n}.jpg"
TRELLIS = "fal-ai/trellis/multi"
HUNYUAN = "fal-ai/hunyuan-3d/v3.1/pro/image-to-3d"
JOBS = {
    "trellis-body": (TRELLIS, 0.02, {"image_urls": ["body-front34", "body-top", "body-back", "body-left", "body-front"],
                                     "multiimage_algo": "stochastic", "texture_size": 1024}),
    "trellis-lid": (TRELLIS, 0.02, {"image_urls": ["lid-front", "lid-top", "lid-under"],
                                    "multiimage_algo": "stochastic", "texture_size": 1024}),
    # $0.375 base + $0.15 multi-view (fal page, 2026-10-02); default face count (custom face count adds $0.15)
    "hunyuan-body": (HUNYUAN, 0.525, {"input_image_url": "body-front", "back_image_url": "body-back",
                                      "left_image_url": "body-left", "top_image_url": "body-top",
                                      "left_front_image_url": "body-front34"}),
    "hunyuan-lid": (HUNYUAN, 0.525, {"input_image_url": "lid-front", "top_image_url": "lid-top",
                                     "bottom_image_url": "lid-under"}),
}


def uri(name):
    p = V(name)
    return f"data:{mimetypes.guess_type(p.name)[0]};base64,{base64.b64encode(p.read_bytes()).decode()}"


def req(url, payload=None):
    r = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None)
    r.add_header("Authorization", f"Key {KEY}")
    if payload is not None:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:500]}") from e


def find_glb(obj):
    if isinstance(obj, dict):
        u = obj.get("url")
        if isinstance(u, str) and (".glb" in u or obj.get("content_type", "").startswith("model/gltf")):
            return u
        for v in obj.values():
            g = find_glb(v)
            if g:
                return g
    if isinstance(obj, list):
        for v in obj:
            g = find_glb(v)
            if g:
                return g
    return None


def main():
    job = sys.argv[1]
    endpoint, price, spec = JOBS[job]
    payload = {}
    for k, v in spec.items():
        if k == "image_urls":
            payload[k] = [uri(n) for n in v]
        elif k.endswith("image_url"):
            payload[k] = uri(v)
        else:
            payload[k] = v
    t0 = datetime.now(timezone.utc)
    base = f"https://queue.fal.run/{endpoint}"
    sub = req(base, payload)
    rid = sub["request_id"]
    print(job, "submitted", rid, flush=True)
    status_url = sub.get("status_url", f"{base}/requests/{rid}/status")
    resp_url = sub.get("response_url", f"{base}/requests/{rid}")
    while True:
        st = req(status_url)
        if st.get("status") == "COMPLETED":
            break
        if st.get("status") in ("FAILED", "CANCELLED"):
            raise RuntimeError(json.dumps(st)[:500])
        time.sleep(4)
    res = req(resp_url)
    (HERE / "manifests" / f"{job}.response.json").write_text(json.dumps(res, indent=1))
    url = find_glb(res)
    out = HERE / "models" / f"{job}.glb"
    for a in range(4):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                out.write_bytes(r.read())
            break
        except urllib.error.URLError:
            if a == 3:
                raise
            time.sleep(5 * (a + 1))
    t1 = datetime.now(timezone.utc)
    man = {"job": job, "endpoint": endpoint, "request_id": rid, "started_at": t0.isoformat(), "finished_at": t1.isoformat(),
           "inputs": {k: (v if isinstance(v, str) and not k.endswith("url") and k != "image_urls" else v) for k, v in spec.items()},
           "input_sha256": {n: hashlib.sha256(V(n).read_bytes()).hexdigest()[:16] for n in
                            (spec.get("image_urls") or [v for k, v in spec.items() if k.endswith("image_url")])},
           "output": str(out.relative_to(HERE)), "output_bytes": out.stat().st_size, "estimated_cost_usd": price}
    (HERE / "manifests" / f"{job}.json").write_text(json.dumps(man, indent=1) + "\n")
    print(json.dumps(man), flush=True)


if __name__ == "__main__":
    main()
