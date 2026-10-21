#!/usr/bin/env python3
"""Stairs: does the flight really climb? Top-surface height map (surface samples binned from above, highest kept), then
  straight / half / grand / wall-hugging: profile along the run (the floor axis the height climbs along), 40 bands:
     low end, high end (share of the mesh height), monotone share, number of treads (plateaus found in a 120-band profile),
     ramp test (share of bands lying on a plateau: steps > 0.5, a ramp near 0), top reach after the per-axis box stretch (in).
  spiral: polar profile round the centre (36 sectors, ring 35-90% of the radius): climb range, monotone share, turn (deg).
  quarter-turn / landing / anything else: the map only + low/high corners.
    tw-trimesh-venv/bin/python tools/qa_stairs.py TYPE_DIR [sku ...]  -> TYPE_DIR/qa-extra/stairs.json, one line per stair + ascii map
verdict: climbs | ramp | block | flat | check (the human reads the map)."""
import json, sys
from pathlib import Path
import numpy as np, trimesh
T = Path(sys.argv[1])
if not T.exists(): T = Path(__file__).resolve().parent.parent / sys.argv[1]
spec = {a["id"]: a for a in json.loads((T / "assets.json").read_text())["assets"]}
want = sys.argv[2:] or [k for k in spec if k.startswith("stair-")]
def load(p):
    m = trimesh.load(p, force="mesh"); lo, hi = m.bounds; pts, _ = trimesh.sample.sample_surface(m, 900000, seed=1)
    return (pts - lo) / (hi - lo), hi - lo           # normalised 0..1 per axis; glTF y up
def hmap(u, a, b, n):
    ia = np.clip((u[:, a] * n).astype(int), 0, n - 1); ib = np.clip((u[:, b] * n).astype(int), 0, n - 1)
    h = np.full(n * n, np.nan); o = np.argsort(u[:, 1]); h[(ib * n + ia)[o]] = u[o, 1]; return h.reshape(n, n)   # [b, a]
def profile(u, ax, n):
    i = np.clip((u[:, ax] * n).astype(int), 0, n - 1); other = 2 - ax
    out = []
    for k in range(n):
        s = u[i == k]
        if len(s) < 50: out.append(np.nan); continue
        # top surface per band = median over the width of the per-column maxima (ignores a rail or a newel on one side)
        j = np.clip((s[:, other] * 12).astype(int), 0, 11); tops = [s[j == q, 1].max() for q in range(12) if (j == q).sum() > 5]
        out.append(float(np.median(tops)))
    return np.array(out)
res = {}
for s in want:
    p = T / "models" / f"{s}.glb"
    if not p.exists(): print(s, "no GLB"); continue
    u, ext = load(p); sz = spec[s]["size"]; r = {"mesh_extent_xzy": [round(float(v), 3) for v in (ext[0], ext[2], ext[1])], "spec_size": sz}
    H = hmap(u, 0, 2, 24); r["ascii_top_view"] = ["".join("." if np.isnan(v) else str(min(9, int(v * 10))) for v in row) for row in H]
    if "spiral" in s:
        x, z = u[:, 0] - .5, u[:, 2] - .5; rad = np.hypot(x, z) / .5; ang = (np.degrees(np.arctan2(z, x)) + 360) % 360
        ring = (rad > .35) & (rad < .9); sec = (ang[ring] / 10).astype(int); y = u[ring, 1]
        # the top turn of a helix hides the lower one: take, per sector, the highest surface AND the lowest tread seen from above is not available,
        # so use the highest surface per sector: one full turn shows as a saw-tooth that climbs through ~360 deg with one drop.
        top = np.array([np.percentile(y[sec == k], 97) if (sec == k).sum() > 50 else np.nan for k in range(36)])
        d = np.diff(np.r_[top, top[0]]); drop = int(np.nanargmin(d)); seq = np.roll(top, -(drop + 1)); dd = np.diff(seq)
        up, dn = float((dd > 0.004).mean()), float((dd < -0.004).mean()); direction = "ccw-from-above" if up >= dn else "cw-from-above"
        if dn > up: seq = seq[::-1]; dd = np.diff(seq)
        r.update(kind="spiral", sector_top=[round(float(v), 2) for v in top], climb=[round(float(np.nanmin(top)), 2), round(float(np.nanmax(top)), 2)],
                 monotone_share=round(float((dd > -0.01).mean()), 2), biggest_drop=round(float(-np.nanmin(d)), 2), direction=direction,
                 centre_height=round(float(np.nanmax(u[(rad < .2), 1])) if (rad < .2).sum() else 0, 2))
        rng = r["climb"][1] - r["climb"][0]
        r["verdict"] = "climbs" if rng > 0.5 and r["monotone_share"] >= 0.8 and r["biggest_drop"] > 0.4 else "check"
    else:
        best = None
        for ax in (0, 2):
            pr = profile(u, ax, 40); ok = ~np.isnan(pr); 
            if ok.sum() < 20: continue
            slope = np.polyfit(np.arange(40)[ok], pr[ok], 1)[0]
            if best is None or abs(slope) > abs(best[1]): best = (ax, slope, pr)
        ax, slope, pr = best
        if slope < 0: pr = pr[::-1]
        fine = profile(u, ax, 120); fine = fine[::-1] if slope < 0 else fine; f = fine[~np.isnan(fine)]
        d = np.diff(f); flat = float((np.abs(d) < 0.004).mean()); jumps = d > 0.02
        treads = int(((jumps[1:] & ~jumps[:-1]).sum()) + (1 if jumps[0] else 0))
        lo_, hi_ = float(np.nanmean(pr[:3])), float(np.nanmax(pr[-6:])); mono = float((np.diff(pr[~np.isnan(pr)]) > -0.02).mean())     # hi: the last band can be the end face's edge; mono = float((np.diff(pr[~np.isnan(pr)]) > -0.02).mean())
        run_in, w_in, h_in = (sz[1], sz[0], sz[2]) if len(sz) == 3 else (0, 0, 0)
        r.update(kind="flight", run_axis="x" if ax == 0 else "z", low_end=round(lo_, 2), high_end=round(hi_, 2), monotone_share=round(mono, 2),
                 plateau_share=round(flat, 2), risers_counted=treads, profile40=[round(float(v), 2) for v in pr],
                 top_tread_in_after_box_stretch=round(hi_ * h_in, 1), first_riser_in=round(lo_ * h_in, 1),
                 run_to_rise_mesh=round(float(ext[ax] / ext[1]), 2), width_to_rise_mesh=round(float(ext[2 - ax] / ext[1]), 2))
        if any(k in s for k in ("quarter-turn", "landing")): r["verdict"] = "check"
        elif lo_ > 0.5: r["verdict"] = "block"
        elif hi_ - lo_ < 0.4: r["verdict"] = "flat"
        elif flat < 0.3 or treads < 3: r["verdict"] = "ramp"
        elif mono < 0.9 or hi_ < 0.85: r["verdict"] = "check"
        else: r["verdict"] = "climbs"
    res[s] = r
    print(s, {k: v for k, v in r.items() if k not in ("ascii_top_view", "profile40", "sector_top")})
    if "profile40" in r: print("  profile", " ".join(f"{int(v*100):d}" if v == v else "--" for v in r["profile40"]))
    if "sector_top" in r: print("  sectors", " ".join(f"{int(v*100):d}" if v == v else "--" for v in r["sector_top"]))
    print("\n".join("  " + l for l in r["ascii_top_view"]))
(T / "qa-extra").mkdir(exist_ok=True); f = T / "qa-extra" / "stairs.json"
old = json.loads(f.read_text()) if f.exists() else {}; old.update(res); f.write_text(json.dumps(old, indent=1))
