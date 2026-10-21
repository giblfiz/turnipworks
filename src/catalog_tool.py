#!/usr/bin/env python3
"""Parse, validate and render the Turnip Works role catalog.

Usage: python3 src/catalog_tool.py [--catalog catalog/fantasy-core.catalog.md]
Writes catalog/out/ and prints a validation report; exits 1 on errors.
"""
import argparse
import collections
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLACES = {"kit", "floor", "wall", "ceiling", "surface", "ground", "attach"}
FOOTPRINTS = {"tiny", "sub", "1", "1x2", "1x3", "2x2", "2x3", "3x3", "big", "edge"}
MATS = {"wood", "metal", "stone", "ceramic", "cloth", "glass", "food", "organic", "paper", "mixed"}
SETTINGS = {
    "TAV": "tavern-inn", "DUN": "dungeon-prison", "MIN": "mine", "CAS": "castle-keep",
    "NOB": "aristocrat-manor", "RUI": "ruins", "HUT": "peasant-hut-farm", "SMI": "blacksmith-workshop",
    "TEM": "temple-chapel", "CRY": "crypt-tomb", "MKT": "market-village", "ARC": "wizard-alchemist-library",
    "CMP": "camp-wilderness", "LAI": "monster-lair", "GRV": "grove-fey", "CLT": "cult-sanctum",
}
CORE = list(SETTINGS)  # Harry 2026-09-30: adjacent settings are first-class
VARS = {"shape": 3, "wealth": 3, "ruin": 2, "open": 1, "lit": 1, "fill": 1, "size": 3, "pile": 2}
# open/lit/fill are states of one mesh (or a cheap swap), so they don't multiply generation count.
AFFS = {"sit", "sleep", "open", "lit", "block", "los", "cover", "climb", "hide", "loot",
        "carry", "use", "hazard", "trap", "pass"}
GENS = {"mesh", "kit", "thin", "flat", "fx", "compound"}
P1_SLOT_MIN = 3
KIT_FAMILIES = {"P1": 3, "P2": 7, "P3": 7}  # P1: rough-timber, dressed-stone, cave-rock (Harry 2026-09-30)

SIZE = re.compile(r"^size:(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?:~(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?))?$")
# size:WxDxH[~MIN-MAX] — nominal real-world bounding box in inches (width x depth x height) plus an optional
# proportional scale range the placement engine may use (Harry 2026-09-30: "a barrel could be anything from
# 2 ft to 10 ft"). No range = rigid, human-scaled (±10%). Size is independent of `fp`: fp is grid occupancy
# (a turnip occupies no square; its table does), so the two are deliberately not cross-checked.
RIGID = (0.9, 1.1)
LINE = re.compile(r"^- \*\*([a-z0-9-]+)\*\* — (.+)$")
# Optional tagged fields (2026-10-02, inn-02). They may sit anywhere after the description and don't count
# toward the 10/11 positional fields:
#   open_of:<id>  this object is the OPEN state of <id> (same mesh family, swapped at runtime: two-state swap)
#   mount:<in>    wall-mounted objects: inches from the floor to the object's bottom edge (wall lights need it)
EXT = re.compile(r"^(open_of|mount):(\S+)$")


def parse_catalog(path):
    roles, errors = {}, []
    domain = sub = None
    for n, raw in enumerate(path.read_text().splitlines(), 1):
        if raw.startswith("## "):
            domain, sub = raw[3:].strip(), None
            continue
        if raw.startswith("### "):
            sub = raw[4:].strip()
            continue
        m = LINE.match(raw)
        if not m:
            if raw.startswith("- "):
                errors.append(f"{path.name}:{n}: unparsed line")
            continue
        rid, rest = m.groups()
        f = [x.strip() for x in rest.split(" · ")]
        ext = {}  # optional tagged extension fields (inn-02, 2026-10-02), anywhere after the description
        for x in list(f[1:]):
            em = EXT.match(x)
            if em:
                ext[em.group(1)] = em.group(2)
                f.remove(x)
        size = None
        if len(f) == 11 and f[3].startswith("size:"):
            size = f.pop(3)
        if len(f) != 10:
            errors.append(f"{path.name}:{n}: {rid}: expected 11 fields after id (10 before sizes), got {len(f)}")
            continue
        desc, place, fp, mat, st, var, aff, gen, pri, hint = f
        r = {"id": rid, "desc": desc, "place": place, "fp": fp, "domain": domain, "sub": sub or domain,
             "hint": hint, "line": n, "size": None, "scale": RIGID, "file": path.name,
             "open_of": ext.get("open_of"), "mount": None}
        if "mount" in ext:
            try:
                r["mount"] = float(ext["mount"])
            except ValueError:
                errors.append(f"{path.name}:{n}: {rid}: bad mount {ext['mount']!r} (inches from floor to the object's bottom)")
        if size is not None:
            m = SIZE.match(size)
            if not m:
                errors.append(f"{path.name}:{n}: {rid}: bad size {size!r} (want size:WxDxH[~MIN-MAX] in inches)")
            else:
                r["size"] = tuple(float(x) for x in m.groups()[:3])
                r["scale"] = (float(m.group(4)), float(m.group(5))) if m.group(4) else RIGID
                if not r["scale"][0] <= 1 <= r["scale"][1]:
                    errors.append(f"{path.name}:{n}: {rid}: scale range {r['scale']} must include 1")

        def need(cond, msg):
            if not cond:
                errors.append(f"{path.name}:{n}: {rid}: {msg}")

        need(place in PLACES, f"bad place {place!r}")
        need(fp in FOOTPRINTS, f"bad fp {fp!r}")
        need(mat.startswith("mat:") is False and mat in MATS, f"bad mat {mat!r}")
        r["mat"] = mat
        need(st.startswith("set:"), "set field missing")
        r["sig"], r["set"] = set(), set()
        for tok in st[4:].split(","):
            code = tok.rstrip("!")
            need(code in SETTINGS or code == "ANY", f"bad setting {tok!r}")
            r["set"].add(code)
            if tok.endswith("!"):
                r["sig"].add(code)
        need(var.startswith("var:"), "var field missing")
        r["var"] = [] if var == "var:-" else var[4:].split(",")
        for v in r["var"]:
            need(v in VARS, f"bad var {v!r}")
        if "ruin" in r["var"]:
            r["set"].add("RUI")  # a ruined variant makes any role usable in ruins
        need(aff.startswith("aff:"), "aff field missing")
        r["aff"] = [] if aff == "aff:-" else aff[4:].split(",")
        for a in r["aff"]:
            need(a in AFFS, f"bad aff {a!r}")
        need(gen in GENS, f"bad gen {gen!r}")
        r["gen"] = gen
        need(pri in {"P1", "P2", "P3"}, f"bad priority {pri!r}")
        r["pri"] = pri
        need(rid not in roles, "duplicate id")
        roles[rid] = r
    return roles, errors


def parse_recipes(path):
    rooms, cur, errors = [], None, []
    for n, raw in enumerate(path.read_text().splitlines(), 1):
        m = re.match(r"^### ([a-z0-9-]+) (P[123])$", raw)
        if m:
            cur = {"id": m.group(1), "pri": m.group(2), "slots": {}, "line": n}
            rooms.append(cur)
            continue
        m = re.match(r"^- ([a-z]+): (.+)$", raw)
        if m and cur:
            cur["slots"][m.group(1)] = [x.strip() for x in m.group(2).split(",")]
    return rooms, errors


def parse_sets(path):
    """Render-time sets: pre-assembled groups baked locally from library objects to cut draw calls.
    They add library entries; they never replace their members."""
    sets, cur, errors = {}, None, []
    if not path.exists():
        return sets, errors
    for n, raw in enumerate(path.read_text().splitlines(), 1):
        m = re.match(r"^### ([a-z0-9-]+) · (P[123]) · (\S+) · (\S+) · set:(\S+) · (.+)$", raw)
        if m:
            sid, pri, place, fp, st, hint = m.groups()
            cur = {"id": sid, "pri": pri, "place": place, "fp": fp, "set": set(st.replace("!", "").split(",")),
                   "hint": hint, "members": [], "line": n}
            if sid in sets:
                errors.append(f"sets:{n}: duplicate set {sid}")
            sets[sid] = cur
            continue
        if raw.startswith("### "):
            errors.append(f"sets:{n}: unparsed set header")
            continue
        m = re.match(r"^- ([a-z0-9-]+)(?: ×(\d+))?$", raw)
        if m and cur:
            cur["members"].append((m.group(1), int(m.group(2) or 1)))
        elif raw.startswith("- "):
            errors.append(f"sets:{n}: unparsed member line")
    return sets, errors


def sku_count(r, fams=7):
    if r["gen"] in {"fx", "compound"}:
        return 0  # fx isn't generated as a mesh; compounds are baked from members
    n = 1
    for v in r["var"]:
        if VARS[v] > 1:
            n *= VARS[v]
    if r["place"] == "kit" or r["gen"] == "kit":
        n *= fams
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", nargs="*", default=sorted(str(p) for p in (ROOT / "catalog").glob("*.catalog.md")))
    ap.add_argument("--sets", default=str(ROOT / "catalog/sets.md"))
    ap.add_argument("--require-size", action="store_true", help="error on objects without size:WxDxH")
    ap.add_argument("--fix-tags", action="store_true", help="add setting tags that room recipes imply, in place")
    ap.add_argument("--promote", action="store_true", help="promote every object named in a P1 room to P1, in place")
    ap.add_argument("--recipes", nargs="*", default=[str(ROOT / "catalog/room-recipes.md")] + sorted(str(p) for p in (ROOT / "catalog").glob("rooms-*.md")))
    args = ap.parse_args()
    roles, errors = {}, []
    for path in args.catalog:
        more, errs = parse_catalog(pathlib.Path(path))
        errors += errs + [f"{path}: duplicate id {rid}" for rid in more if rid in roles]
        roles.update(more)
    rooms, rerr = [], []
    for path in args.recipes:
        more, errs = parse_recipes(pathlib.Path(path))
        rooms += more
        rerr += errs
    errors += rerr
    warnings = []
    sets, serr = parse_sets(pathlib.Path(args.sets))
    errors += serr
    for sid, st in sets.items():
        if sid in roles:
            errors.append(f"sets: {sid} collides with an object id")
        if not st["members"]:
            errors.append(f"sets: {sid} has no members")
        for mid, _ in st["members"]:
            if mid not in roles:
                errors.append(f"sets: {sid}: unknown member {mid!r}")
            elif st["pri"] == "P1" and roles[mid]["pri"] != "P1":
                errors.append(f"sets: P1 set {sid} uses non-P1 member {mid}")
    for r in roles.values():
        if r["open_of"]:
            base = roles.get(r["open_of"])
            if base is None:
                errors.append(f"{r['id']}: open_of {r['open_of']!r} is not an object")
            elif "open" not in base["var"]:
                errors.append(f"{r['id']}: open_of {r['open_of']} lacks var:open")
            elif base["place"] != r["place"]:
                errors.append(f"{r['id']}: place {r['place']} differs from {r['open_of']} ({base['place']})")
        if r["place"] == "wall" and "lit" in r["aff"] and r["fp"] == "tiny" and r["mount"] is None:
            errors.append(f"{r['id']}: wall-mounted light needs mount:<inches from floor>")
        if r["gen"] == "compound":
            errors.append(f"{r['id']}: gen:compound belongs in sets.md with explicit members")
    missing_size = [r["id"] for r in roles.values() if r["size"] is None]
    if missing_size:  # required since 2026-09-30 (all 2,784 sized)
        errors.append(f"{len(missing_size)} objects lack size:WxDxH: " + ", ".join(missing_size[:10]))
    room_ids = collections.Counter(room["id"] for room in rooms)
    errors += [f"recipes: duplicate room id {k}" for k, v in room_ids.items() if v > 1]
    need_p1 = set()

    used = collections.Counter()
    for room in rooms:
        code = room["id"].split("-")[0].upper()
        for slot, ids in room["slots"].items():
            for rid in ids:
                used[rid] += 1
                if rid in sets:
                    continue
                if rid not in roles:
                    errors.append(f"recipes:{room['id']}.{slot}: unknown role {rid!r}")
                    continue
                r = roles[rid]
                if code in SETTINGS and code not in r["set"] and "ANY" not in r["set"]:
                    warnings.append(f"{room['id']}: {rid} lacks set:{code}")
            if room["pri"] == "P1":
                # Harry 2026-09-30: a P1 room must be *real* (a kitchen needs a few veggies), so each slot
                # needs at least min(3, n) P1 options; --promote lifts the earliest-listed ones.
                objs = [i for i in ids if i in roles]
                p1_sets = [i for i in ids if i in sets and sets[i]["pri"] == "P1"]
                want = min(P1_SLOT_MIN, len(objs) + len(p1_sets))
                have = [i for i in objs if roles[i]["pri"] == "P1"] + p1_sets
                if len(have) < want:
                    need_p1.update([i for i in objs if roles[i]["pri"] != "P1"][: want - len(have)])
    for st in sets.values():
        for mid, _ in st["members"]:
            used[mid] += 0  # set membership doesn't rescue an orphan: rooms must place the object itself
    if args.fix_tags and warnings:
        want = collections.defaultdict(set)
        for w in warnings:
            m = re.match(r"[a-z0-9-]+: ([a-z0-9-]+) lacks set:([A-Z]+)$", w)
            if m:
                want[m.group(1)].add(m.group(2))
        done = set()
        for path in args.catalog:
            p = pathlib.Path(path)
            txt = p.read_text()
            for rid, codes in want.items():
                # any number of fields before set: (the line grew size: and mount: fields after this was written; a
                # fixed count of four matched nothing and the tool reported tags it had not added)
                txt, n = re.subn(r"(^- \*\*" + re.escape(rid) + r"\*\* — (?:[^·\n]+· )+?set:)([A-Z!,]+)",
                                 lambda m: m.group(1) + m.group(2) + "," + ",".join(sorted(codes)), txt, flags=re.M)
                if n:
                    done.add(rid)
            p.write_text(txt)
        print(f"added implied setting tags to {len(done)} of {len(want)} objects; re-run to validate")
        if len(done) < len(want):
            print("NOT changed (no catalog line matched): " + ", ".join(sorted(set(want) - done)))
            return 1
        return 0
    if need_p1 and args.promote:
        for path in args.catalog:
            p = pathlib.Path(path)
            txt = p.read_text()
            for rid in need_p1:
                txt = re.sub(r"(^- \*\*" + re.escape(rid) + r"\*\* — .*?) · P[23] · ", lambda m: m.group(1) + " · P1 · ",
                             txt, flags=re.M)
            p.write_text(txt)
        print(f"promoted {len(need_p1)} objects to P1 (slot variety in P1 rooms); re-run to validate")
        return 0
    if need_p1:
        errors.append(f"{len(need_p1)} objects needed for P1 slot variety aren't P1 (run --promote): "
                      + ", ".join(sorted(need_p1)[:12]) + (" …" if len(need_p1) > 12 else ""))
    orphans = [rid for rid in roles if used[rid] == 0 and not roles[rid]["open_of"]]  # open states ride their closed object

    out = ROOT / "catalog/out"
    (out / "by-setting").mkdir(parents=True, exist_ok=True)
    by_domain = collections.defaultdict(list)
    for r in roles.values():
        by_domain[r["domain"]].append(r)
    lines = ["Turnip Works — fantasy core role list (generated; edit fantasy-core.catalog.md)", ""]
    for d, rs in by_domain.items():
        lines.append(d)
        for r in rs:
            lines.append(f"  {r['pri']}  {r['id']:<26} {r['desc']}")
        lines.append("")
    (out / "simple-list.txt").write_text("\n".join(lines))
    for code, name in SETTINGS.items():
        rs = [r for r in roles.values() if code in r["set"]]
        rs.sort(key=lambda r: (code not in r["sig"], r["pri"], r["domain"], r["id"]))
        body = [f"{code} — {name}: {len(rs)} roles (+ ANY-tagged roles) — ! = signature", ""]
        body += [f"{'!' if code in r['sig'] else ' '} {r['pri']}  {r['id']:<26} [{r['place']}/{r['fp']}] {r['hint']}"
                 for r in rs]
        (out / "by-setting" / f"{code.lower()}-{name}.txt").write_text("\n".join(body) + "\n")

    # report
    pri = collections.Counter(r["pri"] for r in roles.values())
    gen = collections.Counter(r["gen"] for r in roles.values())
    skus = {p: sum(sku_count(r, KIT_FAMILIES[p]) for r in roles.values() if r["pri"] <= p) for p in ("P1", "P2", "P3")}
    print(f"DISTINCT OBJECTS: {len(roles)}  (P1 {pri['P1']}, P2 {pri['P2']}, P3 {pri['P3']})  <- the headline count")
    print("gen:", dict(gen), f"  <- 2D (flat): {gen['flat']}")
    print(f"render sets: {len(sets)}  (P1 {sum(s['pri'] == 'P1' for s in sets.values())}), "
          f"avg members {sum(sum(c for _, c in s['members']) for s in sets.values()) / max(len(sets), 1):.1f}")
    print("secondary: variant-expanded SKU estimate (shape×3, wealth×3, ruin×2, size×3, pile×2, kit×3 families at P1, ×7 after):", skus)
    print("per-setting role counts (tagged / signature):")
    for code in SETTINGS:
        tagged = sum(code in r["set"] for r in roles.values())
        sig = sum(code in r["sig"] for r in roles.values())
        print(f"  {code}{'*' if code in CORE else ' '} {tagged:>4} / {sig:>3}")
    print(f"sized: {len(roles) - len(missing_size)} / {len(roles)}  (scalable: {sum(r['scale'] != RIGID for r in roles.values())})")
    print(f"ANY-tagged: {sum('ANY' in r['set'] for r in roles.values())}")
    print(f"rooms: {len(rooms)}  orphans (in no recipe): {len(orphans)}  by priority:",
          dict(collections.Counter(roles[o]["pri"] for o in orphans)))
    print("P1 orphans:", [o for o in orphans if roles[o]["pri"] == "P1"])
    for w in warnings:
        print("WARN", w)
    for e in errors:
        print("ERROR", e)
    # the Build tray's types are derived from out/by-setting (engine/client/data/types.json): rebuilt here, in the same step
    # as their source, so the two are committed together and a later deploy finds nothing to change (2026-10-12)
    bt = ROOT / "engine" / "tools" / "build_types.py"
    if bt.exists():
        import subprocess
        subprocess.run([sys.executable, str(bt)], check=False)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
