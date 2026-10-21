#!/usr/bin/env python3
"""Send newly accepted plates of the default set to the pods, and bring finished meshes home.
    python3 dispatch.py [--min 6] [--max 45] [--harvest-only] [--force]
Pods: the first one's pod.json is in this folder (queue dir qa/); further pods live in pods/<name>/ (pod.json there,
queue dir pods/<name>/q<name>/). A plate is given to exactly one pod: the one with the fewest plates still to mesh,
and only to a pod with no wave running (tools/launch_wave.sh refuses otherwise). Meshes come home to set/models/
(the USB disk). A mesh whose QA verdict is reroll-mesh is sent again once, with a new seed (set/retries.json);
a second failure stays failed. Settings: 1024_cascade, 2048 px, 50k faces (the fal pilot's)."""
import json, os, random, shutil, subprocess, sys, time
from pathlib import Path
HERE = Path(__file__).resolve().parent; SET = HERE / "set"
MIN = int(next((a.split("=")[1] for a in sys.argv if a.startswith("--min=")), 6)); MAX = int(next((a.split("=")[1] for a in sys.argv if a.startswith("--max=")), 45))
ENV = dict(os.environ, PIPE="1024_cascade", TEX="2048")
def pods():
    out = []
    if (HERE / "pod.json").exists(): out.append(("a", HERE, HERE / "qa"))
    for d in sorted((HERE / "pods").glob("*")) if (HERE / "pods").exists() else []:
        if (d / "pod.json").exists(): out.append((d.name, d, d / f"q{d.name}"))
    return out
def tool(name, B, *args, env=ENV, timeout=900):
    return subprocess.run([str(HERE / "tools" / name), *map(str, args)], env=dict(env, TW_B=str(B)), capture_output=True, text=True, timeout=timeout)
spec = {a["id"]: a for a in json.loads((SET / "assets.json").read_text())["assets"]}
retries = json.loads((SET / "retries.json").read_text()) if (SET / "retries.json").exists() else {}
P = pods()
# ---- harvest: every pod's finished GLBs -> set/models
got = 0
for name, B, q in P + ([("legacy", HERE, SET)] if (HERE / "pod.json").exists() else []):
    if not (q / "masked").exists(): continue
    r = tool("harvest.sh", B, q, "auto", "auto")
# every queue dir is read, also a deleted pod's (its pod.json is gone, its last meshes may not have been copied yet)
for q in [HERE / "qa"] + sorted((HERE / "pods").glob("*/q*")):
    if not (q / "models").exists(): continue
    for g in sorted((q / "models").glob("*.glb")):
        dst = SET / "models" / g.name
        if not (q / "masked" / f"{g.stem}.png").exists(): continue      # not this pod's figure any more (it was sent again elsewhere)
        if not dst.exists() or dst.stat().st_size != g.stat().st_size or g.stat().st_mtime > dst.stat().st_mtime: shutil.copy2(g, dst); got += 1
print(time.strftime("%H:%M:%S"), f"harvested {got} new mesh(es) from the queue dirs; set/models has {len(list((SET / 'models').glob('*.glb')))}")
if "--harvest-only" in sys.argv: sys.exit(0)
# ---- what needs a mesh
legacy = set((SET / "assigned-legacy.txt").read_text().split()) if (SET / "assigned-legacy.txt").exists() else set()
assigned = set(legacy)
for name, B, q in P: assigned |= {p.stem for p in (q / "masked").glob("*.png")}
have = {g.stem for g in (SET / "models").glob("*.glb")}
new = [p.stem for p in sorted((SET / "masked").glob("*.png")) if spec.get(p.stem, {}).get("route", "trellis") == "trellis" and p.stem not in assigned and p.stem not in have]
new.sort(key=lambda i: (spec[i].get("prio", 5), i))
# ---- re-mesh once: QA said reroll-mesh
again = []
for qf in (SET / "qa").glob("*.json") if (SET / "qa").exists() else []:
    if qf.name == "overrides.json": continue
    r = json.loads(qf.read_text())
    if r.get("verdict") == "reroll-mesh" and retries.get(r["id"], {}).get("mesh", 0) < 1 and r.get("sha1") != retries.get(r["id"], {}).get("sent_sha1"): again.append(r["id"])
# ---- repainted plates (set/REMESH: one id per line): once the new plate is in, its old mesh is replaced
# An id leaves set/REMESH only when a pod has actually taken it (2026-10-06: it used to leave as soon as it was seen, and
# was lost when every pod was busy that round).
rm = SET / "REMESH"; sent_remesh = []
manifest = json.loads((SET / "gate-manifest.json").read_text())["assets"]
for i in (rm.read_text().split() if rm.exists() else []):
    png, glbf = SET / "masked" / f"{i}.png", SET / "models" / f"{i}.glb"
    if manifest.get(i, {}).get("status") == "accepted" and png.exists() and (not glbf.exists() or png.stat().st_mtime > glbf.stat().st_mtime) and i not in again: again.append(i)
print(f"{len(new)} new plate(s) to mesh, {len(again)} to mesh again; pods: {[n for n, _, _ in P]}")
small = len(new) + len(again) < MIN and "--force" not in sys.argv
if not P: sys.exit(0)
if small: new, again = [], []      # too few to be worth a model load; but a pod with plates of its own left over is still restarted
# ---- give them to idle pods
def pending(q): return sum(1 for p in (q / "masked").glob("*.png") if not (q / "models" / f"{p.stem}.glb").exists()) if (q / "masked").exists() else 0
def disown(i, keep):
    """A figure belongs to ONE pod: the one it was last sent to. Its plate and mesh are removed from every other pod's
    queue, here and on the pod (2026-10-06: an old mesh left on the first pod came home again at the next harvest and
    replaced the second try)."""
    live = {qq: BB for _, BB, qq in P}
    for qq in [HERE / "qa"] + sorted((HERE / "pods").glob("*/q*")):      # deleted pods' folders too
        if qq == keep or not ((qq / "masked" / f"{i}.png").exists() or (qq / "models" / f"{i}.glb").exists()): continue
        (qq / "masked" / f"{i}.png").unlink(missing_ok=True); (qq / "models" / f"{i}.glb").unlink(missing_ok=True)
        if qq not in live: continue
        BB = live[qq]
        subprocess.run(["bash", "-c", f"source {HERE}/tools/pod_lib.sh; resolve_host_port auto auto; ssh_ 'rm -f /workspace/tw-runs/figs-{qq.name}/models/{i}.glb /workspace/tw-runs/figs-{qq.name}/masked/{i}.png'"], env=dict(ENV, TW_B=str(BB)), capture_output=True, text=True, timeout=60)
for name, B, q in sorted(P, key=lambda x: pending(x[2])):
    (q / "masked").mkdir(parents=True, exist_ok=True); (q / "models").mkdir(exist_ok=True)
    if not any("SETUP OK" in f.read_text() for f in (B / "pod-up.log", B / "pod-setup.log") if f.exists()): print(f"pod {name}: still setting up; nothing sent"); continue
    if not new and not again and pending(q) <= 0: continue
    redo = again[:8]; chunk = new[:MAX - len(redo)]      # second tries ride along with the new plates (a new seed for the whole wave)
    dry = tool("launch_wave.sh", B, q, "auto", "auto", env=dict(ENV, DRY="1"))
    live = subprocess.run(["bash", "-c", f"source {HERE}/tools/pod_lib.sh; resolve_host_port auto auto; ssh_ 'for p in /workspace/tw-runs/figs-*/worker-*.pid; do test -f $p && kill -0 $(cat $p) 2>/dev/null && echo live; done; true'"], env=dict(ENV, TW_B=str(B)), capture_output=True, text=True, timeout=60).stdout
    if "live" in live: print(f"pod {name}: a wave is running, {pending(q)} pending there; nothing sent"); continue
    for i in chunk: shutil.copy2(SET / "masked" / f"{i}.png", q / "masked" / f"{i}.png")
    for i in redo:
        shutil.copy2(SET / "masked" / f"{i}.png", q / "masked" / f"{i}.png")
        old = SET / "models" / f"{i}.glb"; (SET / "rerolled").mkdir(exist_ok=True)
        qf = SET / "qa" / f"{i}.json"; qa = json.loads(qf.read_text()) if qf.exists() else {}
        if qa.get("verdict") == "reroll-mesh": retries.setdefault(i, {})["mesh"] = retries.get(i, {}).get("mesh", 0) + 1; retries[i]["why"] = qa.get("fail")
        if rm.exists() and i in rm.read_text().split(): sent_remesh.append(i); retries.setdefault(i, {})["repainted"] = retries.get(i, {}).get("repainted", 0) + 1; retries[i].pop("mesh", None)      # a new plate gets its own two mesh tries
        retries.setdefault(i, {})["sent_sha1"] = qa.get("sha1"); n = len(list((SET / "rerolled").glob(f"{i}.*.glb")))
        if old.exists(): shutil.move(old, SET / "rerolled" / f"{i}.{n + 1}.glb")
        (q / "models" / f"{i}.glb").unlink(missing_ok=True); disown(i, q)
        if qf.exists(): qf.rename(SET / "rerolled" / f"{i}.{n + 1}-qa.json")
    env = dict(ENV, SEED=str(random.randint(100, 999999))) if redo else ENV
    r = tool("launch_wave.sh", B, q, "auto", "auto", *redo, env=env)
    print(f"pod {name}: sent {len(chunk)} new + {len(redo)} again:", (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1])
    new = new[len(chunk):]; again = again[len(redo):]
if rm.exists():
    left = [w for w in rm.read_text().split() if w not in sent_remesh]
    rm.write_text("".join(w + "\n" for w in left)) if left else rm.unlink()
(SET / "retries.json").write_text(json.dumps(retries, indent=1) + "\n")
