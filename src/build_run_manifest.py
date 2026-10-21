#!/usr/bin/env python3
"""Select a generation run from room recipes and expand it into concrete SKUs.

Usage: python3 src/build_run_manifest.py --run inn-01
Writes catalog/runs/<run>/manifest.tsv and summary.txt. Selection is by room, so a run is always
"everything these rooms need", never a hand-picked list that drifts from the recipes.
"""
import argparse
import collections
import csv
import itertools
import re
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import catalog_tool as ct  # noqa: E402

ROOT = ct.ROOT

RUNS = {
    # inn-01b: reroll of inn-01 after Harry's first review (fixed handles clause, per-piece kit SKUs,
    # corrected descriptions, wine bottles in the room recipes). Same rooms and variant policy.
    "inn-01b": None,
    "inn-01": {
        "rooms": [
            "any-shell", "tav-common-room", "tav-bar-service", "tav-place-setting", "tav-adventurers-table",
            "tav-bard-corner", "tav-front-desk", "tav-hallway", "tav-kitchen", "tav-kitchen-tools",
            "tav-kitchen-larder", "tav-supper-service", "tav-common-fare", "tav-cellar", "tav-pantry-cellar",
            "tav-storeroom", "tav-guest-room", "tav-guest-room-full", "tav-guest-room-fine", "tav-privy",
            "tav-stable", "tav-stable-yard", "tav-stable-row", "tav-barn", "tav-inn-exterior",
        ],
        # rooms whose wealth-tiered objects are generated at the fine tier
        "fine_rooms": {"tav-guest-room-fine"},
        # structure families for kit pieces in this run
        "kit_families": ["rough-timber", "dressed-stone"],
        # also generate every member of P1 render sets tagged with these settings
        "set_settings": {"TAV"},
        # distinct silhouettes for objects that carry the `shape` variant (high repeaters)
        "shape_count": 3,
    },
}
# "serving counter segment (straight, corner, end, flap)" -> one SKU per listed piece for kit/flat roles, so a
# plate never shows a grid of variants (Harry's inn-01 review, 2026-09-30). Family lists ("per family: …") are
# already expanded by kit_families and are just stripped from the prompt text.
PIECES = re.compile(r"\s*\(([^)]*,[^)]*)\)\s*$")


def pieces(r):
    m = PIECES.search(r["desc"])
    if not m:
        return r["desc"], [""]
    base = r["desc"][: m.start()].strip()
    if r["gen"] not in ("kit", "flat") or m.group(1).startswith("per family"):
        return base if m.group(1).startswith("per family") else r["desc"], [""]
    return base, [x.strip() for x in m.group(1).split(",")]


RUNS["inn-01b"] = RUNS["inn-01"]

LANE = {"mesh": "3d", "thin": "3d", "kit": "3d", "flat": "2d", "fx": "none"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="inn-01")
    args = ap.parse_args()
    spec = RUNS[args.run]

    roles = {}
    for path in sorted((ROOT / "catalog").glob("*.catalog.md")):
        more, errs = ct.parse_catalog(path)
        if errs:
            sys.exit(f"catalog errors in {path.name}; run catalog_tool.py first")
        roles.update(more)
    rooms = []
    for path in [ROOT / "catalog/room-recipes.md"] + sorted((ROOT / "catalog").glob("rooms-*.md")):
        rooms += ct.parse_recipes(path)[0]
    sets, _ = ct.parse_sets(ROOT / "catalog/sets.md")
    by_id = {r["id"]: r for r in rooms}
    missing = [r for r in spec["rooms"] if r not in by_id]
    if missing:
        sys.exit(f"unknown rooms: {missing}")

    uses = collections.defaultdict(set)  # object id -> rooms
    used_sets = set()
    for rid in spec["rooms"]:
        for ids in by_id[rid]["slots"].values():
            for oid in ids:
                if oid in sets:
                    used_sets.add(oid)
                    for mid, _ in sets[oid]["members"]:
                        uses[mid].add(rid)
                elif oid in roles:
                    uses[oid].add(rid)

    for sid, st in sets.items():
        if st["pri"] == "P1" and st["set"] & spec.get("set_settings", set()):
            used_sets.add(sid)
            for mid, _ in st["members"]:
                uses[mid].add(f"set:{sid}")

    skus = []
    for oid, where in sorted(uses.items()):
        r = roles[oid]
        lane = LANE[r["gen"]]
        if lane == "none":
            continue
        tiers = [""]
        if "wealth" in r["var"]:
            fine = where & spec["fine_rooms"]
            common = where - spec["fine_rooms"]
            tiers = (["common"] if common else []) + (["fine"] if fine else [])
        fams = spec["kit_families"] if (r["place"] == "kit" or r["gen"] == "kit") else [""]
        shapes = [""]
        if "shape" in r["var"] and lane == "3d":
            shapes = [f"s{i}" for i in range(1, spec.get("shape_count", 1) + 1)]
        base_desc, piece_list = pieces(r)
        for tier, fam, shp, pc in itertools.product(tiers, fams, shapes, piece_list):
            sku = "--".join(x for x in (oid, re.sub(r"[^a-z0-9]+", "-", pc.lower()).strip("-"), fam, tier, shp) if x)
            desc = f"{base_desc} — {pc} piece only" if pc else base_desc
            skus.append({
                "sku": sku, "object": oid, "lane": lane, "gen": r["gen"], "family": fam, "tier": tier, "shape": shp,
                "place": r["place"], "fp": r["fp"], "mat": r["mat"], "pri": r["pri"],
                "piece": pc, "desc": desc, "hint": r["hint"], "rooms": ",".join(sorted(where)),
            })

    out = ROOT / "catalog/runs" / args.run
    out.mkdir(parents=True, exist_ok=True)
    with (out / "manifest.tsv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(skus[0]), delimiter="\t")
        w.writeheader()
        w.writerows(skus)
    lanes = collections.Counter(s["lane"] for s in skus)
    gens = collections.Counter(s["gen"] for s in skus)
    mats = collections.Counter(s["mat"] for s in skus if s["lane"] == "3d")
    pris = collections.Counter(s["pri"] for s in skus if s["lane"] == "3d")
    lines = [
        f"run {args.run}: {len(spec['rooms'])} rooms, {len(uses)} distinct objects, {len(skus)} SKUs",
        f"lanes: {dict(lanes)}   gen: {dict(gens)}",
        f"3d by priority: {dict(pris)}",
        f"3d by material board: {dict(mats.most_common())}",
        f"render sets placed by these rooms: {len(used_sets)} ({', '.join(sorted(used_sets))})",
    ]
    (out / "summary.txt").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
