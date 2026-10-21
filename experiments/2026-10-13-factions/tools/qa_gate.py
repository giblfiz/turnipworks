#!/usr/bin/env python3
"""Mesh QA, step 3 of 3: the verdict. Per mesh: (1) rules on the measurements (qa_mesh.py + qa_unpainted.py), (2) a BLIND
Gemini read of the four tiles (it is not told what the thing is), (3) a text-only match of that read with the spec
and the measurements. Props are background pieces: judged at TABLE DISTANCE (tile A); close-up defects are notes.
    python3 tools/qa_gate.py TYPE_DIR [--out QADIR] [--assets FILE] [--redo] [--no-vision] [sku ...]
Writes QADIR/<sku>.verdict.json, QADIR/<sku>.sheet.jpg (the four tiles on one sheet) and QADIR/summary.tsv (one line per
mesh: verdict = accept | reroll-mesh | reroll-plate | reject, and the reason). Vision goes through
~/fauna-tools/gemini-vision.py (model QA_MODEL, default gemini-3.8-flash): two small calls a mesh.

Rules (THRESHOLDS below; the yard's where the yard had one):
  unpainted visible surface > 25%            -> reroll-mesh      floating piece(s) >= 1% of the mesh -> reroll-mesh
  under 5,000 faces                          -> reroll-mesh      base slab (footprint band test)     -> reroll-plate
  footprint squarer than the catalog by 1.45x and at least 24 in more floor on the short side        -> reroll-plate
  height off by 2x and by at least 18 in (trees excepted: they ship at their own size)               -> reroll-plate
  kit wall panel (panel-sized in the catalog: 5 ft wide, 8 ft or more tall; qa_mesh.is_wall): width:height within 25%
    of the catalog's, depth at most 0.25 of the height (or 1.6x the catalog's) and at least 0.04 (or half the catalog's);
    a solid wall (wall-straight, wall-crypt-niches) has no hole over 1.5% of its face; an OPEN window has a clear
    hole at least 20% of the width x 12% of the height that does not reach the floor; a doorway/arch has an opening
    from the floor at least 35% of the width x 50% of the height; a foot 1.6x deeper than the wall is a NOTE (slab cut).
  Gemini match fails -> reroll-mesh if it blames the geometry (broken, floating, melted), reroll-plate if the design.
Ladder (QADIR/history.jsonl, by GLB sha1): a sku that already failed with another mesh turns reroll-mesh into
reroll-plate; one that failed with two other meshes is a reject. QADIR/overrides.json {sku: {"verdict": .., "note": ..}}
is the supervisor's last word.
"""
import concurrent.futures as cf, csv, json, os, re, subprocess, sys, tempfile
from datetime import datetime
from pathlib import Path

GV = "~/fauna-tools/gemini-vision.py"
MODEL = os.environ.get("QA_MODEL", "gemini-3.8-flash")
THRESHOLDS = {"unpainted_visible": 0.25, "floating_share": 0.01, "min_faces": 5000, "footprint_factor": 1.45, "footprint_excess_in": 24,
              "height_factor": 2.0, "height_excess_in": 18, "wall_wh_tolerance": 0.25, "wall_depth_max": 0.25, "wall_depth_min": 0.04,
              "wall_solid_max_hole": 0.015, "wall_window_min": (0.20, 0.12), "wall_door_min": (0.35, 0.50), "wall_foot_note": 1.6}
RANK = {"accept": 0, "reroll-mesh": 1, "reroll-plate": 2, "reject": 3}

BLIND = """These four renders show ONE 3D model from four cameras. You are not told what it is meant to be.
Tile A: seen from high above at a distance, on a grey floor with a 5-ft grid; the plain grey cylinder-and-ball figure is 5 ft 9 in tall and is only a scale marker.
Tile B: close, from low at the side%s. Tile C: from straight above. Tile D: close, from high on the other side.
Ignore the grey scale figure, the floor and the grid lines; describe only the model.
1. From tile A ALONE: what is it (best name and a second guess)? How confident? Does it read clearly at that distance?
2. From B, C, D: its parts; whether surfaces are solid and continuous or broken into shards, spikes, blobs, holes or thin floating flakes; anything hovering unattached; anything melted or fused; whether it stands on its own or on an added slab, disc or plinth; whether the underside sits flat on the floor; colours and materials; any large areas that are plain black or look unpainted; any flame or glow.
3. From tile C alone: what does it look like from straight above?
4. About how tall and wide is it compared with the 5 ft 9 in figure?
Return ONLY JSON: {"table_distance_name": "...", "second_guess": "...", "confidence": 0-1, "reads_clearly_at_distance": true|false, "description": "...", "from_above": "...", "defects": ["..."], "extra_base_or_ground": "none | <what>", "black_or_unpainted_areas": "none | <where>", "height_vs_figure": "..."}"""


def ask(prompt, images=()):
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f: f.write(prompt)
    try:
        for k in range(3):
            r = subprocess.run(["python3", GV, MODEL, f.name, *map(str, images)], capture_output=True, text=True, timeout=300)
            m = re.search(r"\{.*\}", r.stdout, re.S)
            if r.returncode == 0 and m:
                try: return json.loads(m.group(0))
                except json.JSONDecodeError: pass
        raise RuntimeError("gemini-vision gave no JSON: " + (r.stderr or r.stdout)[-300:])
    finally:
        os.unlink(f.name)


def rules(sku, spec, m):
    """-> (reasons [(action, text)], notes [text])"""
    T, R, N = THRESHOLDS, [], []
    if m.get("faces", 0) < T["min_faces"]: R.append(("reroll-mesh", f"only {m.get('faces')} faces"))
    u = m.get("unpainted") or {}
    if "visible" in u:
        if u["visible"] > T["unpainted_visible"]:
            worst = max(("top", "+x", "-x", "+z", "-z"), key=lambda k: u.get(k, 0))
            R.append(("reroll-mesh", f"unpainted {u['visible']:.0%} of the visible surface (worst side {worst} {u[worst]:.0%})"))
        elif u["visible"] > 0.10: N.append(f"unpainted {u['visible']:.0%} of the visible surface")
    else: N.append("unpainted share not measured" + (": " + u["error"] if u.get("error") else ""))
    if m.get("floating_pieces", 0) and m.get("floating_share", 0) >= T["floating_share"]:
        R.append(("reroll-mesh", f"{m['floating_pieces']} floating piece(s), {m['floating_share']:.0%} of the mesh, lowest at {m['floating_lowest_at'][0]:.0%} of the height"))
    if m.get("separate_pieces_on_floor"): N.append(f"{m['separate_pieces_on_floor']} separate piece(s) standing on the floor ({m['separate_on_floor_share']:.0%})")
    if m.get("rule_set") == "wall":
        w = m["wall"]; lo_ = w.get("largest_opening") or {"area_share": 0, "width_share": 0, "height_share": 0, "reaches_floor": False}
        if m.get("catalog_known"):
            f = w["width:height"] / w["catalog_width:height"]
            if abs(f - 1) > T["wall_wh_tolerance"]: R.append(("reroll-plate", f"panel width:height {w['width:height']:.2f}, catalog {w['catalog_width:height']:.2f}"))
        cdh = w["catalog_depth:height"] if m.get("catalog_known") else 0.11
        dmax, dmin = max(T["wall_depth_max"], 1.6 * cdh), min(T["wall_depth_min"], 0.5 * cdh)
        if w["depth:height"] > dmax: R.append(("reroll-plate", f"panel depth {w['depth:height']:.2f} of its height (max {dmax:.2f})"))
        if w["depth:height"] < dmin: R.append(("reroll-mesh", f"panel paper-thin: depth {w['depth:height']:.2f} of its height"))
        kind = ("door" if re.match(r"wall-(doorway|door|arch|gate)", sku) else "window-open" if re.match(r"wall-window.*-open", sku) else "window" if sku.startswith("wall-window")
                else "solid" if re.match(r"wall-(straight|crypt-niches)|ossuary-wall|tomb-door-sealed", sku) else "panel")
        if spec.get("opening") in ("door", "window-open", "window", "solid", "panel"): kind = spec["opening"]
        hole = f"{lo_['width_share']:.0%} x {lo_['height_share']:.0%}"
        if kind == "solid" and lo_["area_share"] > T["wall_solid_max_hole"]: R.append(("reroll-mesh", f"hole in a solid wall ({lo_['area_share']:.1%} of the face)"))
        if kind == "window-open" and not (lo_["width_share"] >= T["wall_window_min"][0] and lo_["height_share"] >= T["wall_window_min"][1] and not lo_["reaches_floor"]):
            R.append(("reroll-plate", f"open window has no clear hole (largest opening {hole}{', reaching the floor' if lo_['reaches_floor'] else ''})"))
        if kind == "door" and not (lo_["reaches_floor"] and lo_["width_share"] >= T["wall_door_min"][0] and lo_["height_share"] >= T["wall_door_min"][1]):
            R.append(("reroll-plate", f"doorway not clear from the floor (largest opening {hole}, reaches floor: {lo_['reaches_floor']})"))
        N.append(f"wall {kind}: w:h {w['width:height']:.2f}, depth:h {w['depth:height']:.2f}, largest opening {hole}, filled {w['filled_share']:.0%}")
        if (w.get("foot_depth_vs_mid") or 0) >= T["wall_foot_note"]: N.append(f"foot {w['foot_depth_vs_mid']}x deeper than the wall: slab cut needed")
    else:
        if m.get("base_slab_suspect"): R.append(("reroll-plate", "base slab: the bottom 3% spans the whole footprint under a much narrower body"))
        if m.get("catalog_known"):
            x, y, z = (v * 12 for v in m["size_ft_at_auto_scale"]); cw, cd, ch = m["catalog_in"]
            ms, ml, cs, cl = min(x, y), max(x, y), min(cw, cd), max(cw, cd)
            if m["prop_factor_footprint"] >= T["footprint_factor"] and ms / ml > cs / cl and ms - cs * (ml / cl) >= T["footprint_excess_in"]:
                R.append(("reroll-plate", f"footprint {ml/12:.1f} x {ms/12:.1f} ft, catalog {cl/12:.1f} x {cs/12:.1f} ft: squarer by {m['prop_factor_footprint']}x"))
            elif m["prop_factor_footprint"] >= T["footprint_factor"]: N.append(f"footprint proportion {m['prop_factor_footprint']}x off the catalog ({ml/12:.1f} x {ms/12:.1f} ft)")
            if m["prop_factor_height"] >= T["height_factor"] and abs(z - ch * (max(x, y, z) / max(cw, cd, ch))) >= T["height_excess_in"] and abs(z - ch) >= T["height_excess_in"]:
                if sku.startswith("tree-") or spec.get("leafy"): N.append(f"height {z/12:.1f} ft against the catalog's {ch/12:.1f} ft: ships at its own size")
                else: R.append(("reroll-plate", f"height {z/12:.1f} ft at auto scale, catalog {ch/12:.1f} ft ({m['prop_factor_height']}x off)"))
            elif m["prop_factor_height"] >= 1.45: N.append(f"height proportion {m['prop_factor_height']}x off the catalog")
        un = m.get("underside", {})
        if not un.get("middle_over_contact", True) and not spec.get("hung"): N.append("underside: the mesh's middle is not over what touches the floor (leaning or cantilevered)")
    return R, N


def match_prompt(sku, spec, m, seen, R, N):
    w, d, h = spec["size"]
    keys = ("size_ft_at_auto_scale", "ratio_mesh_long:short:height", "ratio_catalog", "floating_pieces", "floating_share", "separate_pieces_on_floor", "base_slab_suspect", "bands_span_xy")
    meas = {k: m[k] for k in keys if k in m}
    if "unpainted" in m: meas["unpainted_share_of_visible_surface"] = m["unpainted"].get("visible")
    if "wall" in m: meas["wall_panel_front_silhouette"] = {k: v for k, v in m["wall"].items() if k != "ascii"}
    extra = []
    if spec.get("hung"): extra.append("It is a WALL-HUNG piece: it was rendered resting on the floor, so ignore how it sits.")
    if spec.get("light"): extra.append(f"It is a light source ({spec['light']}) and must be UNLIT: no flame, no glow.")
    if m.get("rule_set") == "wall": extra.append("It is a KIT WALL PANEL about 5 ft wide and 9 ft tall, seen from its broad side in tile B; it is meant to be a thin upright slab.")
    return f"""You are the mesh gate of a 3D asset factory for a tabletop game. Props are BACKGROUND pieces seen from a high three-quarter camera at table distance: judge them at that distance. Close-up roughness, soft detail and small artefacts are NOTES, not reasons to fail.
An observer who was NOT told what to expect described the 3D model as follows:
{json.dumps(seen, ensure_ascii=False)}

Measurements of the mesh (trust these over the observer where they disagree): {json.dumps(meas)}
(bands_span_xy: for each height band from the bottom, the fraction of the full footprint that band spans in x and y.)
Rule findings from the measurements: {'; '.join(t for _, t in R) or 'none'}. Notes: {'; '.join(N) or 'none'}.

It was requested as: {spec['gate']['desc']}. Intended real size about {w/12:.1f} ft x {d/12:.1f} ft footprint, {h/12:.1f} ft tall.
{' '.join(extra)}
Requirements: {'; '.join(spec['gate'].get('must', [])) or '-'}
Must not: {'; '.join(spec['gate'].get('must_not', [])) or '-'}

FAIL (ok=false) only if, at table distance: it does not read as the requested thing; OR it is visibly broken (surfaces shattered into shards or spikes, big holes, large parts floating free, a melted lump); OR it carries an extra base slab / disc / plinth it would not really have; OR its proportions are badly off (a long piece that came out square, a tall piece that came out squat); OR a must / must-not above is plainly violated.
If it fails, say what would fix it: "mesh" if another 3D attempt from the SAME picture would plausibly fix it (broken, floating, melted or half-painted geometry), "plate" if the picture itself must change (wrong object, wrong design or proportions, an added base, a must / must-not violated).
Return ONLY JSON: {{"ok": true|false, "reads_as": "<what the observer called it>", "cause": "none|mesh|plate", "problems": ["<short>"], "notes": ["<close-up defects that do not fail it>"]}}"""


def sheet(qa, sku):
    try:
        from PIL import Image, ImageDraw
        tiles = [Image.open(qa / f"{sku}.{t}.png").convert("RGB") for t in "ABCD"]
        s = tiles[0].size[0]; im = Image.new("RGB", (2 * s, 2 * s))
        for i, t in enumerate(tiles):
            im.paste(t, ((i % 2) * s, (i // 2) * s)); ImageDraw.Draw(im).text(((i % 2) * s + 8, (i // 2) * s + 6), "ABCD"[i] + ("  table distance" if i == 0 else ""), fill=(255, 255, 255))
        im.save(qa / f"{sku}.sheet.jpg", quality=86)
    except Exception as e:
        print("sheet failed", sku, e)


def gate(qa, sku, spec, vision, hist):
    m = json.loads((qa / f"{sku}.json").read_text())
    R, N = rules(sku, spec, m)
    v = {"sku": sku, "glb_sha1": m.get("glb_sha1"), "time": datetime.now().astimezone().isoformat(timespec="seconds"), "model": MODEL if vision else None}
    if vision and spec.get("gate"):
        tiles = [qa / f"{sku}.{t}.png" for t in "ABCD"]
        seen = ask(BLIND % (" (for this one: straight on at its broad face)" if m.get("rule_set") == "wall" else ""), tiles)
        g = ask(match_prompt(sku, spec, m, seen, R, N))
        v.update({"blind": seen, "match": g})
        if not g.get("ok"):
            R.append(("reroll-mesh" if g.get("cause") == "mesh" else "reroll-plate", "gemini: " + "; ".join(g.get("problems", []))[:240]))
        N += [f"gemini note: {n}" for n in g.get("notes", [])[:3]]
    elif vision: N.append("no spec for this sku: blind read skipped")
    verdict = max((a for a, _ in R), key=RANK.get, default="accept")
    prior = {h["glb_sha1"] for h in hist if h["sku"] == sku and h["verdict"] != "accept" and h["glb_sha1"] != m.get("glb_sha1")}
    if verdict != "accept" and len(prior) >= 2: verdict = "reject"; R.append(("reject", f"{len(prior)} earlier meshes of this sku also failed"))
    elif verdict == "reroll-mesh" and len(prior) >= 1: verdict = "reroll-plate"; R.append(("reroll-plate", "an earlier mesh of this sku also failed: change the plate"))
    v.update({"verdict": verdict, "reasons": [t for _, t in R], "notes": N, "vision": bool(vision)})
    (qa / f"{sku}.verdict.json").write_text(json.dumps(v, indent=1, ensure_ascii=False))
    sheet(qa, sku)
    return v


def main():
    argv = sys.argv[1:]
    def opt(name):
        if name in argv:
            i = argv.index(name); val = argv[i + 1]; del argv[i:i + 2]; return val
    out, assets = opt("--out"), opt("--assets")
    redo, vision = "--redo" in argv, "--no-vision" not in argv
    argv = [a for a in argv if a not in ("--redo", "--no-vision")]
    T = Path(argv[0]).resolve(); qa = Path(out) if out else T / "qa"
    assets = Path(assets) if assets else T / "assets.json"
    SPEC = {a["id"]: a for a in json.loads(assets.read_text())["assets"]} if assets.exists() else {}
    spec_of = lambda s: SPEC.get(s) or SPEC.get(s.replace("--chunky", "")) or {}
    skus = sorted(p.stem for p in qa.glob("*.json") if not p.stem.endswith(".verdict") and p.stem != "overrides")
    if argv[1:]: skus = [s for s in skus if s in argv[1:]]
    hp = qa / "history.jsonl"
    hist = [json.loads(l) for l in hp.read_text().splitlines() if l.strip()] if hp.exists() else []
    def need(s):
        vp = qa / f"{s}.verdict.json"
        if redo or not vp.exists(): return True
        old = json.loads(vp.read_text()); cur = json.loads((qa / f"{s}.json").read_text())
        return old.get("glb_sha1") != cur.get("glb_sha1") or (vision and not old.get("vision"))
    todo = [s for s in skus if need(s)]
    print(f"{len(todo)} to gate ({len(skus) - len(todo)} have a verdict for the same mesh)", flush=True)
    def run(s):
        try: return gate(qa, s, spec_of(s), vision, hist)
        except Exception as e:
            return {"sku": s, "verdict": "error", "reasons": [repr(e)[:200]], "notes": [], "glb_sha1": None}
    with cf.ThreadPoolExecutor(6) as ex:
        for v in ex.map(run, todo):
            if v["verdict"] != "error" and not any(h["sku"] == v["sku"] and h["glb_sha1"] == v["glb_sha1"] and h["verdict"] == v["verdict"] for h in hist):
                with hp.open("a") as f: f.write(json.dumps({"sku": v["sku"], "glb_sha1": v["glb_sha1"], "verdict": v["verdict"], "time": v.get("time")}) + "\n")
            print(f"{v['verdict']:13s}{v['sku']} | {(v.get('blind') or {}).get('table_distance_name', '-')} | {'; '.join(v['reasons'])}"[:260], flush=True)
    # ---- summary.tsv over EVERYTHING in the qa folder + plates that never got a mesh
    over = json.loads((qa / "overrides.json").read_text()) if (qa / "overrides.json").exists() else {}
    rows = []
    for s in sorted(p.stem for p in qa.glob("*.json") if not p.stem.endswith(".verdict") and p.stem != "overrides"):
        m = json.loads((qa / f"{s}.json").read_text()); vp = qa / f"{s}.verdict.json"
        v = json.loads(vp.read_text()) if vp.exists() else {"verdict": "", "reasons": ["not gated yet"], "notes": []}
        verdict, reason = v["verdict"], "; ".join(v["reasons"])
        if s in over: verdict, reason = over[s]["verdict"], f"override: {over[s].get('note', '')} (was {v['verdict']}: {reason})"
        b = v.get("blind") or {}
        rows.append({"sku": s, "verdict": verdict, "reason": reason or "-", "reads_as": b.get("table_distance_name", ""), "confidence": b.get("confidence", ""),
                     "unpainted_visible": (m.get("unpainted") or {}).get("visible", ""), "floating_share": m.get("floating_share", ""), "slab": int(bool(m.get("base_slab_suspect"))),
                     "size_ft": "x".join(f"{x:g}" for x in m.get("size_ft_at_auto_scale", [])), "catalog_in": "x".join(f"{x:g}" for x in m.get("catalog_in", [])),
                     "fp_factor": m.get("prop_factor_footprint", ""), "h_factor": m.get("prop_factor_height", ""), "rules": m.get("rule_set", ""),
                     "vision": int(bool(v.get("vision"))), "notes": " | ".join(v.get("notes", []))})
    have = {r["sku"] for r in rows}
    for s, a in SPEC.items():
        if s not in have and (T / "masked" / f"{s}.png").exists() and a.get("route", "trellis") == "trellis":
            rows.append({"sku": s, "verdict": "reroll-mesh", "reason": "plate accepted but no GLB measured (worker failed, not run, or QA not run)"})
    cols = ["sku", "verdict", "reason", "reads_as", "confidence", "unpainted_visible", "floating_share", "slab", "size_ft", "catalog_in", "fp_factor", "h_factor", "rules", "vision", "notes"]
    with (qa / "summary.tsv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, delimiter="\t", lineterminator="\n", restval=""); w.writeheader()
        for r in rows: w.writerow({k: str(v).replace("\t", " ").replace("\n", " ") for k, v in r.items()})
    from collections import Counter
    print("summary.tsv:", dict(Counter(r["verdict"] for r in rows)), "->", qa / "summary.tsv")


if __name__ == "__main__":
    main()
