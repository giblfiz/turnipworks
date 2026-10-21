#!/usr/bin/env python3
"""QA for the default set: every harvested mesh in set/models/ is measured (measure.py, the pilot's measurements),
judged by rule, and cut down to the two shipping tiers. Skips meshes already done (by file sha1).
    ~/.local/share/tw-trimesh-venv/bin/python set_qa.py [--ids a,b] [--procs 6] [--redo]
Writes set/qa/<id>.json (measurements + verdict), set/tiers/<id>--20k1024.glb and --8k512.glb, set/qa/summary.tsv.
Verdicts: accept | reroll-mesh (same plate, new seed) | reroll-plate | reject (second failure; set/retries.json counts).
Rules (THRESHOLDS): unpainted share of what can be seen; a floating piece; a base or ground slab in the mesh; a broken
thin part; reaching far outside its square. Everything else is a note, not a verdict."""
import hashlib, json, subprocess, sys, time
from multiprocessing import Pool
from pathlib import Path
HERE = Path(__file__).resolve().parent; SET = HERE / "set"; ROOT = HERE.parents[1]
T = {"unpainted_seen": 0.03, "floating_size_ft": 0.15, "floating_area": 0.002, "floating_gap_ft": 0.1, "slab_share": 0.65, "slab_share_robe": 0.85, "broken": 0.08, "reach_over_ft": 1.5, "reach_note_ft": 0.6, "off_ground_note_ft": 0.12}
TIERS = {"20k1024": (20000, 1024), "8k512": (8000, 512)}
def sha1(p): return hashlib.sha1(Path(p).read_bytes()).hexdigest()
def one(args):
    pid, glb, redo = args
    import measure as M
    M.SPEC = {a["id"]: a for a in json.loads((SET / "assets.json").read_text())["assets"]}; M.PLATES = SET / "masked"
    q = SET / "qa" / f"{pid}.json"; h = sha1(glb)
    if q.exists() and not redo and json.loads(q.read_text()).get("sha1") == h: return pid, "cached"
    spec = M.SPEC[pid]; t0 = time.time()
    # a new mesh for this id: its old picture and blind read are stale
    (SET / "published/thumbs" / f"{pid}.webp").unlink(missing_ok=True); (SET / "blind-stale").mkdir(exist_ok=True); (SET / "blind-stale" / pid).write_text(h)
    try: _, o = M.measure(glb, pid)
    except Exception as e: q.write_text(json.dumps({"id": pid, "sha1": h, "verdict": "reroll-mesh", "fail": [f"could not be measured: {e!r}"[:200]], "notes": []}, indent=1)); return pid, "unmeasurable"
    fail, notes = [], []
    up = (o.get("unpainted") or {}).get("seen")
    if up is not None and up > T["unpainted_seen"]: fail.append(("reroll-mesh", f"{up:.0%} of the visible surface is unpainted"))
    # floating = hovering visibly clear of the figure (a tenth of a foot or more). A separate shell lying within half an inch
    # of the body (a pouch, a lock of hair, a buckle) is how this generator builds things and is only noted.
    big = [f for f in o["pieces"]["floating"] if f["size_ft"] > T["floating_size_ft"] and f["area_share"] > T["floating_area"] and f["gap_ft"] >= T["floating_gap_ft"]]
    near = [f for f in o["pieces"]["floating"] if f["size_ft"] > T["floating_size_ft"] and f["gap_ft"] < T["floating_gap_ft"]]
    if big: fail.append(("reroll-mesh", f"{len(big)} floating piece(s), the largest {big[0]['size_ft']} ft, {big[0]['gap_ft']} ft clear of the figure"))
    if near: notes.append(f"{len(near)} separate part(s) lying within {max(f['gap_ft'] for f in near)} ft of the body (not joined to it)")
    kind = spec.get("kind", "hum"); g = o["ground"]
    lim = T["slab_share_robe"] if kind in ("robe", "odd") else T["slab_share"]
    if kind != "odd" and g["lowest_slab_share_of_plan"] > lim and g["contact_count"] <= 1: fail.append(("reroll-plate", f"a base or ground slab: the lowest slab covers {g['lowest_slab_share_of_plan']:.0%} of the plan in one piece"))
    if (g["max_off_ground_ft"] or 0) > T["off_ground_note_ft"]: notes.append(f"one foot is {g['max_off_ground_ft']:.2f} ft off the ground")
    sh = o.get("shaft")
    if spec.get("shaft"):
        if not sh: notes.append(f"the {spec['shaft']} could not be tracked as a thin straight part")
        elif sh["broken_share"] > T["broken"]: fail.append(("reroll-mesh", f"the {spec['shaft']} is broken along {sh['broken_share']:.0%} of its length"))
    half = spec.get("base_ft", 5) / 2; over = o["plan"]["reach_radius_ft"] - half
    if over > T["reach_over_ft"]: notes.append(f"REACH: {over:.1f} ft outside its {spec.get('base_ft', 5)}-ft square")
    elif over > T["reach_note_ft"]: notes.append(f"reaches {over:.1f} ft outside its square")
    if o["plan"]["contacts_radius_ft"] > half: notes.append(f"its feet need a base {o['plan']['contacts_radius_ft'] * 2:.1f} ft across")
    if o.get("silhouette", {}).get("iou", 1) < 0.6: notes.append(f"outline matches its painting only {o['silhouette']['iou']:.0%}")
    tiers = {"full": {"tris": o["tris"], "tex": (o.get("texture_px") or [0])[0], "kb": o["kb"]}}
    (SET / "tiers").mkdir(exist_ok=True)
    for key, (faces, tex) in TIERS.items():
        out = SET / "tiers" / f"{pid}--{key}.glb"
        r = subprocess.run(["blender", "--background", "--python", str(ROOT / "src/optimize_glb_blender.py"), "--", str(glb), str(out), "--faces", str(faces), "--texture-size", str(tex)], capture_output=True, text=True)
        m = next((l for l in r.stdout.splitlines() if l.startswith("TW_OPTIMIZE=")), None)
        if m and out.exists(): tiers[key] = {"tris": json.loads(m[12:])["faces_after"], "tex": tex, "kb": round(out.stat().st_size / 1024)}
        else: notes.append(f"tier {key} could not be made")
    verdict = "accept" if not fail else ("reroll-plate" if any(f[0] == "reroll-plate" for f in fail) else "reroll-mesh")
    # a second mesh that fails only on small loose bits is let through with a note Harry can see (set/retries.json counts the tries)
    tries = (json.loads((SET / "retries.json").read_text()) if (SET / "retries.json").exists() else {}).get(pid, {}).get("mesh", 0)
    if verdict == "reroll-mesh" and tries >= 1 and all("floating" in f[1] for f in fail) and o["pieces"]["floating_area_share"] < 0.02:
        verdict = "accept"; notes.append(f"LOOSE BITS after two meshes: {fail[0][1]} ({o['pieces']['floating_area_share']:.1%} of the surface)"); fail = []
    elif verdict != "accept" and tries >= 1: verdict = "reject"
    o.pop("columns", None)
    o.update(id=pid, sha1=h, verdict=verdict, fail=[f[1] for f in fail], notes=notes, tiers=tiers, qa_seconds=round(time.time() - t0, 1))
    q.write_text(json.dumps(o, indent=1) + "\n"); return pid, verdict
if __name__ == "__main__":
    ids = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--ids=")), None); procs = int(next((a.split("=")[1] for a in sys.argv if a.startswith("--procs=")), 6))
    (SET / "qa").mkdir(exist_ok=True)
    jobs = [(g.stem, g, "--redo" in sys.argv) for g in sorted((SET / "models").glob("*.glb")) if "--" not in g.name and (ids is None or g.stem in ids)]
    with Pool(procs) as pool:
        for pid, v in pool.imap_unordered(one, jobs):
            if v != "cached": print(pid, v, flush=True)
    rows = [json.loads(p.read_text()) for p in sorted((SET / "qa").glob("*.json"))]
    (SET / "qa" / "summary.tsv").write_text("id\tverdict\tfail\tnotes\n" + "".join(f"{r['id']}\t{r['verdict']}\t{'; '.join(r.get('fail', []))}\t{'; '.join(r.get('notes', []))}\n" for r in rows))
    from collections import Counter
    print(len(rows), "judged:", dict(Counter(r["verdict"] for r in rows)))
