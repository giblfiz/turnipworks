#!/usr/bin/env python3
"""One screen of where the default set stands: plates, meshes, QA, published, pods, dollars.   python3 status.py"""
import json, glob, os, subprocess, time
from collections import Counter
H = os.path.dirname(os.path.abspath(__file__)); S = H + "/set"
spec = [a for a in json.load(open(S + "/assets.json"))["assets"] if a["group"] != "body"]
m = json.load(open(S + "/gate-manifest.json"))["assets"]
acc = {k for k, v in m.items() if v.get("status") == "accepted"}; rej = sorted(k for k, v in m.items() if v.get("status") == "rejected"); err = sorted(k for k, v in m.items() if v.get("status") == "error")
glb = {os.path.basename(p)[:-4] for p in glob.glob(S + "/models/*.glb")}
qa = {os.path.basename(p)[:-5]: json.load(open(p)) for p in glob.glob(S + "/qa/*.json") if not p.endswith("overrides.json")}
pub = json.load(open(S + "/published/manifest.json")) if os.path.exists(S + "/published/manifest.json") else {"figures": []}
g = Counter(a["group"] for a in spec); gp = Counter(f["group"] for f in pub["figures"]); ga = Counter(a["group"] for a in spec if a["id"] in acc)
print(time.strftime("%H:%M:%S"), f"figures {len(spec)} | plates accepted {len([a for a in spec if a['id'] in acc])} rejected {len(rej)} error {len(err)} | meshes home {len(glb)} | judged {len(qa)} {dict(Counter(v['verdict'] for v in qa.values()))} | published {len(pub['figures'])}")
print("   by group published/plates/total:", {k: f"{gp.get(k, 0)}/{ga.get(k, 0)}/{g[k]}" for k in g})
if rej: print("   rejected plates:", rej)
bad = {k: (v["verdict"], v.get("fail")) for k, v in qa.items() if v["verdict"] != "accept"}
if bad: print("   not accepted meshes:", bad)
try:
    acct = json.loads(subprocess.run(["bash", "-c", f"source {H}/tools/pod_lib.sh; rp_account"], capture_output=True, text=True, timeout=40).stdout)
    print(f"   RunPod balance ${acct['clientBalance']:.2f} (start 69.69, spent ${69.6934 - acct['clientBalance']:.2f}), ${acct['currentSpendPerHr']}/h, pods {[p['name'] for p in acct['pods']]}")
except Exception as e: print("   account:", e)
for f in ("QUOTA", "STOP", "LOOP_STOP"):
    if os.path.exists(f"{S}/{f}"): print(f"   !! set/{f} exists:", open(f"{S}/{f}").read()[:200])
print("   last plate:", open(S + "/plates.log").read().strip().splitlines()[-1][:150])
