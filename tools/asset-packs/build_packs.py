#!/usr/bin/env python3
"""Package the Turnip Works asset library as downloadable CC BY 4.0 zip packs.

    python3 tools/asset-packs/build_packs.py --out /mnt/usb/turnip-works/asset-packs/2026-10-22 [--tier runtime,hd,figures,figures-full]
    python3 tools/asset-packs/build_packs.py --plan          print the pack table, write nothing

READS (never writes) the library as the game serves it:
    tools/spawn-tuner/data/library.json, data/figures.json, data/orient.json, catalog/*.catalog.md (via src/catalog_tool.py),
    the orientation corrections (TW_REVIEWS_DIR, default /var/lib/tw-ratings, tuner/orient.jsonl),
    tools/spawn-tuner/assets/{m,lod/ffull,tex/t2048,flat,figures,figures/full,wallkit,emblems}/ (git-ignored binaries)
WRITES only under --out: one zip per pack per tier, plus packs.json (what went where) and a sha256 list.

What is in a pack, and why:
  * Only what data/library.json and data/figures.json list (what the game serves). Files on disk the library does not list
    (3 orphan meshes, 8 unlisted floor tiles) stay out. The third-party and excluded pilot files (import-lab samples, the
    Hunyuan chest) are not in the library at all; EXCLUDE below refuses them anyway, by name, in case that ever changes.
  * runtime tier = assets/m/<sku>.glb, the game's own self-contained shipping GLB (3,000 to 5,000 faces, colour map
    embedded as WebP). NOT the content-hashed assets/d/ copies: those require EXT_meshopt_compression, which Blender and
    many viewers cannot open.
  * hd tier = assets/lod/ffull/<sku>.glb (full TRELLIS detail, no material) + assets/tex/t2048/<sku>.webp, joined here into
    one GLB with the same matte material the game gives it (roughness 0.85, metalness 0).
  * Every model is wrapped in ONE new root node that puts it at real-world size in metres (glTF's unit), front facing +Z,
    standing on the origin. The mesh data is byte-for-byte the game's; only that node is added. Props scale uniformly
    (largest catalog dimension to largest mesh dimension, as js/solver.js does), kit pieces stretch per axis to their
    catalog box (solver.js kitScale), figures use their own feet-per-unit `k`, ground centre and facing (engine/client/figures.js).
    catalog.csv records the scale and yaw applied, so the raw mesh can be recovered.
"""
from __future__ import annotations

import argparse, csv, hashlib, io, json, math, os, re, struct, sys, zipfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools/spawn-tuner"
# binaries are git-ignored and live in the MAIN checkout's tuner folder (one assets/ shared by every worktree)
ASSETS = Path(os.environ.get("TW_ASSETS", "tools/spawn-tuner/assets"))
DATA = Path(os.environ.get("TW_DATA", str(TOOL / "data")))
REVIEWS = Path(os.environ.get("TW_REVIEWS_DIR", "/var/lib/tw-ratings"))
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct  # noqa: E402

IN = 0.0254   # metres per inch
FT = 0.3048   # metres per foot
CREDIT = "Turnip Works assets (https://turnipworks.net), CC BY 4.0"   # LICENSING.md "Attribution for CC BY reuse"
COPYRIGHT = "(c) 2026 Implausible Enterprises LLC. Made by Harry and Fauna. Licensed CC BY 4.0: https://creativecommons.org/licenses/by/4.0/"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"

# Refused by name even if a future library lists them (LICENSING.md "Not covered" / "Not distributed"; docs/LICENSING_AUDIT.md
# needs-attention and must-not-ship rows).
EXCLUDE = re.compile(r"garden-gnome|stanford-dragon|hunyuan", re.I)

# ---------------------------------------------------------------- provenance, per batch (`src` in library.json)
# The generator chain each batch went through, as recorded in the batch's own records and summarised in the 2026-10-21
# licence audit's provenance survey (private repo: experiments/2026-10-21-licence-audit/provenance-survey.md, section 1).
G_FLASH = "Google Gemini 3.1 Flash Image"
OPENAI = "OpenAI image generation (via Codex; model version not recorded)"
OWN_TRELLIS = "Microsoft TRELLIS.2 (self-hosted, MIT)"
FAL_TRELLIS = "Microsoft TRELLIS.2 via fal.ai (fal-ai/trellis-2)"
CHAIN = {
    "inn-01": (G_FLASH, "chroma-key mask", OWN_TRELLIS),
    "inn-01b": (G_FLASH, FAL_TRELLIS),
    "inn-02": (G_FLASH + " (+ Gemini 3 Pro Image for open-state edits)", "BiRefNet mask (MIT) or chroma key", OWN_TRELLIS),
    "doors-01": (G_FLASH, FAL_TRELLIS), "walls-01": (G_FLASH, FAL_TRELLIS), "stable-01": (G_FLASH, FAL_TRELLIS),
    "railings-01": (OPENAI, "BiRefNet mask (MIT)", FAL_TRELLIS), "cat-tree-01": (OPENAI, "BiRefNet mask (MIT)", FAL_TRELLIS),
    "floors-01": (G_FLASH, "seamless/compose scripts"), "floors-02": (G_FLASH, "seamless/compose scripts"),
    "rugs-01": (G_FLASH, "finish scripts"),
    "outdoors-01": (OPENAI, "seamless/normalize scripts"),
    "outdoors-02": (OPENAI, "BiRefNet mask (MIT)", OWN_TRELLIS),
    "ccm-flats-01": (OPENAI, "chroma key", "finish scripts"),
    "factions-01": (OPENAI + ", text-only prompts", "Gemini quality gate", "BiRefNet mask (MIT)", OWN_TRELLIS),
    "factions-flats-01": (OPENAI + ", text-only prompts", "Gemini quality gate", "finish scripts"),
}
for b in ("castle-01", "crypt-01", "mansion-01", "vertical-01", "dun-01", "mkt-01", "min-01", "tem-01", "smi-01", "hut-01",
          "lai-01", "cult-01", "wizard-01"):
    CHAIN[b] = (OPENAI, "Gemini quality gate", "BiRefNet mask (MIT)", OWN_TRELLIS)
for b in ("dun-flats-01", "min-flats-01", "tem-flats-01", "hut-flats-01", "lai-flats-01", "cult-flats-01", "wizard-flats-01"):
    CHAIN[b] = (OPENAI, "chroma key", "finish scripts")
CHAIN_FIGURES = (OPENAI, "BiRefNet mask (MIT)", OWN_TRELLIS)
CODEX_WALLS = {"wall-doorway--log-cabin", "wall-window-small--log-cabin", "wall-window-small-open--log-cabin",
               "wall-straight--rough-timber--s4"}  # walls-01 rows made by the 10-05 log-cabin / plank-s4 Codex runs


def chain_of(sku, src):
    if src == "walls-01" and sku in CODEX_WALLS:
        return (OPENAI, "BiRefNet mask (MIT)", FAL_TRELLIS)
    return CHAIN.get(src)


STYLE_TEXT_ONLY = {"factions-01", "factions-flats-01"}  # the only batches with no house-style plate as input

# ---------------------------------------------------------------- packs
SETTING = {  # catalog `set` code -> pack (the 16 room types of data/types.json, CMP and GRV folded into outdoors)
    "TAV": "tavern-inn", "NOB": "manor-mansion", "CAS": "castle-keep", "TEM": "temple-chapel", "SMI": "smithy-workshop",
    "MKT": "market-village", "HUT": "farmstead", "DUN": "dungeon-prison", "CRY": "crypt-tomb", "ARC": "wizard-alchemist",
    "CLT": "cult-sanctum", "MIN": "mine", "RUI": "dungeon-prison", "LAI": "monster-lair", "CMP": "outdoors-camp", "GRV": "outdoors-camp",
}
BATCH_SETTING = {"castle-01": "CAS", "crypt-01": "CRY", "mansion-01": "NOB", "dun-01": "DUN", "dun-flats-01": "DUN",
                 "mkt-01": "MKT", "wizard-01": "ARC", "wizard-flats-01": "ARC", "min-01": "MIN", "min-flats-01": "MIN",
                 "tem-01": "TEM", "tem-flats-01": "TEM", "smi-01": "SMI", "hut-01": "HUT", "hut-flats-01": "HUT",
                 "lai-01": "LAI", "lai-flats-01": "LAI", "cult-01": "CLT", "cult-flats-01": "CLT", "stable-01": "HUT"}
SIG_ORDER = ["TAV", "DUN", "CRY", "CAS", "NOB", "TEM", "CLT", "ARC", "SMI", "MKT", "HUT", "MIN", "LAI", "RUI", "CMP", "GRV"]
DOMAIN = {"A": "structure-kit", "B": "fixtures-hearths", "C": "furniture", "D": "containers", "E": "lighting",
          "F": "tableware-kitchen", "V": "tableware-kitchen", "G": "food-provisions", "W": "food-provisions",
          "H": "trades-tools", "Y": "trades-tools", "S": "trades-tools", "I": "arms-armor-loot", "T": "arms-armor-loot",
          "X": "arms-armor-loot", "J": "dungeon-prison", "K": "temple-chapel", "L": "manor-mansion", "M": "outdoors-camp",
          "N": "outdoors-camp", "U": "outdoors-camp", "O": "dungeon-prison", "Q": "floors-rugs-decals", "R": "wizard-alchemist"}
PACKS = {  # slug -> (title, one line for the README and the release notes)
    "tavern-inn": ("Tavern & Inn", "bar counters, taps, kegs, inn fittings and the props that say 'tavern'"),
    "manor-mansion": ("Manor & Mansion", "noble furniture, decor, panelling and the mansion's own structure"),
    "castle-keep": ("Castle & Keep", "thrones, banners, barracks, castle structure and fixtures"),
    "temple-chapel": ("Temple & Chapel", "altars, pews, shrines and religious fittings"),
    "smithy-workshop": ("Smithy & Workshop", "forges, anvils, quench troughs, shop fronts"),
    "market-village": ("Market & Village", "stalls, shop stock, signs and street furniture"),
    "farmstead": ("Farmstead & Stable", "peasant hut, farmyard and stable pieces"),
    "dungeon-prison": ("Dungeon, Prison & Ruins", "cells, shackles, traps, guard-room pieces, rubble and broken columns"),
    "crypt-tomb": ("Crypt & Tomb", "sarcophagi, ossuaries, funerary pieces and crypt structure"),
    "wizard-alchemist": ("Wizard's Tower & Alchemist", "alchemy benches, stills, arcane devices, books and magic"),
    "cult-sanctum": ("Cult Sanctum", "ritual altars, idols, braziers and sanctum structure"),
    "mine": ("Mine", "mine carts, timbering, ore and mining tools"),
    "monster-lair": ("Monster Lair", "hoards, bones, nests and lair dressing"),
    "outdoors-camp": ("Outdoors, Yard & Camp", "trees, rocks, yard furniture, gardens, camp and wilderness"),
    "structure-kit": ("Structure Kit", "walls, doors, windows, stairs, posts and roofs in several style families"),
    "fixtures-hearths": ("Fixtures & Hearths", "hearths, ovens, counters, wells and other room anchors"),
    "furniture": ("Furniture", "seating, tables, beds, wardrobes and shelving"),
    "containers": ("Containers", "chests, barrels, crates, sacks and baskets"),
    "lighting": ("Lighting", "candles, lanterns, sconces, chandeliers and braziers"),
    "tableware-kitchen": ("Tableware & Kitchen", "plates, cups, jugs, pots, pans and kitchen tools"),
    "food-provisions": ("Food & Provisions", "bread, fruit, meat, cheese, dishes and stores"),
    "trades-tools": ("Trades & Tools", "craft, farm, textile, scholarly and shop tools"),
    "arms-armor-loot": ("Arms, Armour, Loot & Small Things", "weapons, armour, treasure, gear and hand-sized objects"),
    "factions": ("Faction Flavour", "banners, idols, altarpieces and emblems for 13 factions"),
    "floors-rugs-decals": ("Floors, Rugs & Decals", "seamless 5-ft floor tiles, rugs and floor decals (WebP images)"),
}
FIG_PACKS = {"hero": ("Figures: Heroes", "player-character figures"), "foe": ("Figures: Foes", "monsters and enemies"),
             "townsfolk": ("Figures: Townsfolk", "commoners, merchants, guards and other NPCs"),
             "large": ("Figures: Large Creatures", "large and huge creatures"), "beast": ("Figures: Beasts", "animals and beasts")}

SRD_NOTICE = ("This work includes material taken from the System Reference Document 5.1 (\"SRD 5.1\") by Wizards of the Coast "
              "LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed "
              "under the Creative Commons Attribution 4.0 International License available at "
              "https://creativecommons.org/licenses/by/4.0/legalcode.")


def domain_letter(d):
    m = re.match(r"([A-Z])", d or "")
    return m.group(1) if m else ""


def pack_of(oid, sku, role):
    """Per SKU, not per object: one catalog object can hold variants from several batches (a castle-batch chair)."""
    src = sku["src"]
    if src.startswith("factions") or oid.endswith("-fct") or sku["sku"].endswith("-fct"):
        return "factions"
    if src in ("floors-01", "floors-02", "rugs-01"):
        return "floors-rugs-decals"
    if src in ("outdoors-01", "outdoors-02"):
        return "outdoors-camp"
    sig = set(role["sig"])
    sets = set(role["set"]) - {"ANY"}
    if "ruin" in role["var"] and "RUI" not in sig:
        sets.discard("RUI")  # catalog_tool adds RUI to anything with a ruined variant; that is not where a human looks
    letter = domain_letter(role["domain"])
    if sig:
        b = BATCH_SETTING.get(src)
        return SETTING[b if b in sig else sorted(sig, key=SIG_ORDER.index)[0]]
    if letter == "A" or src == "vertical-01":
        return "structure-kit"  # the kit (walls, doors, stairs, roofs) is one system across settings, by style family
    if src in BATCH_SETTING:
        return SETTING[BATCH_SETTING[src]]
    if len(sets) == 1:
        return SETTING[next(iter(sets))]
    return DOMAIN.get(letter, "arms-armor-loot")


# ---------------------------------------------------------------- GLB
def read_glb(b):
    magic, ver, length = struct.unpack("<4sII", b[:12])
    assert magic == b"glTF" and ver == 2, "not a glTF 2 binary"
    off, js, bin_ = 12, None, b""
    while off < length:
        clen, ctype = struct.unpack("<II", b[off:off + 8])
        chunk = b[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk)
        elif ctype == 0x004E4942:
            bin_ = bytes(chunk)
        off += 8 + clen
    return js, bin_


def write_glb(js, bin_):
    j = json.dumps(js, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    bin_ = bin_ + b"\0" * (-len(bin_) % 4)
    total = 12 + 8 + len(j) + (8 + len(bin_) if bin_ else 0)
    out = struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<II", len(j), 0x4E4F534A) + j
    if bin_:
        out += struct.pack("<II", len(bin_), 0x004E4942) + bin_
    return out


def mesh_bounds(js):
    """AABB of every POSITION accessor (the library's GLBs carry no node transforms: checked over every file)."""
    lo, hi = [math.inf] * 3, [-math.inf] * 3
    for n in js["nodes"]:
        assert not any(k in n for k in ("matrix", "translation", "rotation", "scale")), "unexpected node transform"
    for m in js["meshes"]:
        for p in m["primitives"]:
            a = js["accessors"][p["attributes"]["POSITION"]]
            lo = [min(x, y) for x, y in zip(lo, a["min"])]
            hi = [max(x, y) for x, y in zip(hi, a["max"])]
    return lo, hi


def fix_normals(js, bin_):
    """Renormalise float NORMAL vectors that are not unit length (some original TRELLIS exports carry a few, which the
    Khronos validator rejects). Directions are kept; a zero vector becomes +Y. Returns (bin, vectors changed)."""
    import numpy as np
    buf, changed = bytearray(bin_), 0
    seen = set()
    for m in js["meshes"]:
        for p in m["primitives"]:
            ai = p["attributes"].get("NORMAL")
            if ai is None or ai in seen:
                continue
            seen.add(ai)
            a = js["accessors"][ai]
            if a.get("componentType") != 5126 or a.get("sparse") or "bufferView" not in a:
                continue
            bv = js["bufferViews"][a["bufferView"]]
            stride = bv.get("byteStride", 12)
            off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
            raw = np.ndarray((a["count"], 3), dtype="<f4", buffer=buf, offset=off, strides=(stride, 4))
            ln = np.linalg.norm(raw.astype(np.float64), axis=1)
            bad = np.abs(ln - 1) > 1e-4
            if bad.any():
                zero = ln < 1e-12
                fixed = raw.astype(np.float64)
                fixed[~zero] /= ln[~zero, None]
                fixed[zero] = (0.0, 1.0, 0.0)
                raw[bad] = fixed[bad].astype("<f4")
                changed += int(bad.sum())
                if "min" in a or "max" in a:  # keep the declared bounds true (the validator checks them)
                    a["min"] = [float(v) for v in raw.min(axis=0)]
                    a["max"] = [float(v) for v in raw.max(axis=0)]
    return bytes(buf), changed


def wrap(js, name, scale, yaw_deg=0.0, translation=(0.0, 0.0, 0.0), extras=None):
    """Add ONE root node carrying the placement (T * R(yaw about +Y) * S, as three.js and glTF both compose it)."""
    sc = js["scenes"][js.get("scene", 0)]
    t = math.radians(yaw_deg or 0.0)
    node = {"name": name, "children": list(sc["nodes"])}
    if yaw_deg:
        node["rotation"] = [0.0, round(math.sin(t / 2), 9), 0.0, round(math.cos(t / 2), 9)]
    node["scale"] = [round(float(v), 9) for v in scale]
    if any(translation):
        node["translation"] = [round(float(v), 9) for v in translation]
    js["nodes"].append(node)
    sc["nodes"] = [len(js["nodes"]) - 1]
    js["asset"]["copyright"] = COPYRIGHT
    js["asset"].setdefault("extras", {}).update({"credit": CREDIT, "license": LICENSE_URL, **(extras or {})})
    return js


def embed_texture(js, bin_, webp):
    """Give a material-less ladder mesh its colour map: the game's own matte material (roughness 0.85, metalness 0)."""
    off = len(bin_) + (-len(bin_) % 4)
    bin_ = bin_ + b"\0" * (off - len(bin_)) + webp
    js["buffers"][0]["byteLength"] = len(bin_)
    js.setdefault("bufferViews", []).append({"buffer": 0, "byteOffset": off, "byteLength": len(webp)})
    js.setdefault("images", []).append({"bufferView": len(js["bufferViews"]) - 1, "mimeType": "image/webp"})
    js.setdefault("samplers", []).append({"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497})
    js.setdefault("textures", []).append({"sampler": len(js["samplers"]) - 1,
                                          "extensions": {"EXT_texture_webp": {"source": len(js["images"]) - 1}}})
    js.setdefault("materials", []).append({"name": "matte", "pbrMetallicRoughness": {
        "baseColorTexture": {"index": len(js["textures"]) - 1}, "metallicFactor": 0.0, "roughnessFactor": 0.85}})
    for m in js["meshes"]:
        for p in m["primitives"]:
            p["material"] = len(js["materials"]) - 1
    for k in ("extensionsUsed", "extensionsRequired"):
        js[k] = sorted(set(js.get(k, [])) | {"EXT_texture_webp"})
    return js, bin_


# ---------------------------------------------------------------- orientation (port of js/orient.js)
def iso(t):
    return datetime.fromisoformat(re.sub(r"([+-]\d\d)(\d\d)$", r"\1:\2", str(t)))


def load_orient(lib):
    out = {k: float(v) for k, v in json.loads((DATA / "orient.json").read_text()).items() if v is not None}
    skurec = {s["sku"]: s for o in lib["objects"].values() for s in o["skus"]}

    def mesh_at(sku, at):
        s = skurec.get(sku)
        if not s or not s.get("mesh"):
            return None
        if at is None:
            return (s.get("was") or [{}])[0].get("mesh") or s["mesh"]
        t = iso(at)
        for w in reversed(s.get("was") or []):
            if not t >= iso(w["until"]):
                return w["mesh"]
        return s["mesh"]

    p = REVIEWS / "tuner/orient.jsonl"
    latest = {}
    if p.exists():
        for line in p.read_text().splitlines():
            if line.strip():
                rec = json.loads(line)
                latest[(rec.get("data") or {}).get("mesh") or rec["name"]] = rec
    for k, rec in latest.items():
        v = (rec.get("data") or {}).get("yaw_deg", rec.get("yaw_deg"))
        m = (rec.get("data") or {}).get("mesh") or (k if "@" in k else mesh_at((rec.get("data") or {}).get("sku") or k, rec.get("at")))
        if v is not None and m:
            out[m] = float(v)
    return out


def kit_scale(cw, cd, ch, b, yaw):
    q = ((round(yaw or 0) % 180) + 180) % 180
    return [cd / b[0], ch / b[1], cw / b[2]] if q == 90 else [cw / b[0], ch / b[1], cd / b[2]]


# ---------------------------------------------------------------- the plan
def load():
    roles = {}
    for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
        r, _ = ct.parse_catalog(p)
        roles.update(r)
    lib = json.loads((DATA / "library.json").read_text())
    figs = json.loads((DATA / "figures.json").read_text())["figures"]
    return roles, lib, figs


def plan():
    roles, lib, figs = load()
    orient = load_orient(lib)
    rows, excluded = defaultdict(list), []
    for oid, obj in sorted(lib["objects"].items()):
        role = roles[oid]
        for s in obj["skus"]:
            pk = pack_of(oid, s, role)
            if EXCLUDE.search(s["sku"]) or EXCLUDE.search(s.get("url", "")):
                excluded.append((s["sku"], "excluded by name (LICENSING.md)"))
                continue
            m = s.get("model") or {}
            hidden = bool(m.get("masking")) or (m.get("stars") is not None and m["stars"] < 3)
            rows[pk].append({"oid": oid, "obj": obj, "role": role, "sku": s, "yaw": orient.get(s.get("mesh")),
                             "extra": hidden})
    fig_rows = defaultdict(list)
    for f in figs:
        if EXCLUDE.search(f["id"]):
            excluded.append((f["id"], "excluded by name"))
            continue
        fig_rows[f["group"]].append(f)
    return rows, fig_rows, excluded


# ---------------------------------------------------------------- pack contents
def size_of(row):
    return row["sku"].get("size") or row["obj"]["size"]


def place_mesh(row, b, yaw):
    """scale (metres per mesh unit, per axis) for this sku's mesh with bounds b = [x, up, z] extents."""
    w, d, h = [v * IN for v in size_of(row)]
    if row["obj"]["place"] == "kit" or row["sku"].get("fit") == "box":
        return kit_scale(w, d, h, b, yaw), "per-axis (kit piece stretched to its catalog box)"
    s = max(w, d, h) / max(b)
    return [s, s, s], "uniform (largest catalog dimension)"


SET_WORD = {"TAV": "tavern", "DUN": "dungeon", "MIN": "mine", "CAS": "castle", "NOB": "manor", "RUI": "ruins",
            "HUT": "farmstead", "SMI": "smithy", "TEM": "temple", "CRY": "crypt", "MKT": "market", "ARC": "wizard",
            "CMP": "camp", "LAI": "lair", "GRV": "grove", "CLT": "cult", "ANY": "anywhere"}


def tags_of(row):
    r, o = row["role"], row["obj"]
    t = [o["mat"], o["place"], *o.get("aff", []), *(SET_WORD[c] for c in sorted(r["set"] - {"ANY"}))]
    return sorted(set(x for x in t if x))


def catalog_rec(row, file, kind, applied=None, yaw=None, faces=None):
    s, o, r = row["sku"], row["obj"], row["role"]
    w, d, h = size_of(row)
    chain = chain_of(s["sku"], s["src"])
    rec = {
        "file": file, "sku": s["sku"], "object": row["oid"], "name": o["desc"][:1].upper() + o["desc"][1:],
        "kind": kind, "category": r["domain"], "subcategory": r["sub"], "settings": sorted(SET_WORD[c] for c in r["set"]),
        "signature_of": sorted(SET_WORD[c] for c in r["sig"]), "tags": tags_of(row), "material": o["mat"], "placement": o["place"],
        "footprint_5ft": o["fp"], "size_in": [w, d, h], "size_m": [round(w * IN, 4), round(d * IN, 4), round(h * IN, 4)],
        "scale_range": o.get("scale"), "variants": o.get("var", []), "family": s.get("family", ""), "tier": s.get("tier", ""),
        "usage_hint": o.get("hint", ""), "priority": o.get("pri"),
        "provenance": {
            "batch": s["src"], "mesh_id": s.get("mesh"), "replaced": s.get("was", []),
            "generators": list(chain) if chain else None,
            "style_reference": "text-only prompts" if s["src"] in STYLE_TEXT_ONLY else "house style plate D (see README)",
            "ai_generated": True,
        },
        "in_game": not row["extra"],
    }
    if (s.get("model") or {}).get("stars") is not None:
        rec["review_stars"] = s["model"]["stars"]
    if kind == "mesh":
        rec.update(faces=faces, applied_scale=[round(v, 6) for v in applied], applied_yaw_deg=yaw or 0,
                   front_verified=yaw is not None or row["obj"]["place"] == "kit")
        if o.get("mount") is not None:
            rec["wall_mount_height_in"] = o["mount"]
        if o.get("open_of"):
            rec["open_state_of"] = o["open_of"]
    else:
        rec["pixels"] = s.get("px")
    return rec


def build_mesh(row, tier):
    sku = row["sku"]["sku"]
    if tier == "runtime":
        js, bin_ = read_glb((ASSETS / "m" / f"{sku}.glb").read_bytes())
    else:
        js, bin_ = read_glb((ASSETS / "lod/ffull" / f"{sku}.glb").read_bytes())
        js, bin_ = embed_texture(js, bin_, (ASSETS / "tex/t2048" / f"{sku}.webp").read_bytes())
    lo, hi = mesh_bounds(js)
    b = [hi[i] - lo[i] for i in range(3)]
    yaw = row["yaw"]
    scale, how = place_mesh(row, b, yaw)
    faces = sum(js["accessors"][p["indices"]]["count"] // 3 for m in js["meshes"] for p in m["primitives"] if "indices" in p)
    lift = -lo[1] * scale[1]  # stand it ON the origin (a few game meshes float a few mm; rotation about Y keeps y)
    bin_, nfix = fix_normals(js, bin_)
    wrap(js, sku, scale, yaw or 0.0, (0.0, lift, 0.0), extras={"sku": sku, "name": row["obj"]["desc"]})
    return write_glb(js, bin_), scale, yaw, faces, (how, round(lift, 6), nfix)


def build_figure(f, tier):
    path = ASSETS / (f["url"] if tier == "figures" else f["full"]).removeprefix("assets/")
    js, bin_ = read_glb(path.read_bytes())
    lo, hi = mesh_bounds(js)
    k = f["k"] * FT
    c = f.get("c") or [0, 0]
    bin_, nfix = fix_normals(js, bin_)
    wrap(js, f["id"], [k, k, k], f.get("yaw") or 0.0, (-c[0] * FT, -lo[1] * k, -c[1] * FT),
         extras={"figure": f["id"], "name": f["name"]})
    faces = sum(js["accessors"][p["indices"]]["count"] // 3 for m in js["meshes"] for p in m["primitives"] if "indices" in p)
    return write_glb(js, bin_), faces, (hi[1] - lo[1]) * k, nfix


# ---------------------------------------------------------------- text files
def readme(title, blurb, tier, n_models, n_images, figures=False, has_extras=False):
    tiername = {"runtime": "game tier (3,000 to 5,000 faces, 128 to 256 px colour map embedded)",
                "hd": "full-detail tier (the full TRELLIS mesh, typically 40,000 to 150,000 faces, 2048 px colour map embedded)",
                "figures": "game tier (about 8,000 faces with a 512 px picture for horde and townsfolk figures, about 20,000 with 1024 px for heroes and large creatures)",
                "figures-full": "full-detail tier (about 50,000 faces, 2048 px)"}[tier]
    L = [f"# Turnip Works: {title}", "", f"{blurb[:1].upper() + blurb[1:]}.", "",
         (f"{n_images} images (WebP)." if not n_models else
          f"{n_models} 3D models" + (f" and {n_images} images" if n_images else "") + f", {tiername}."),
         "Part of the Turnip Works asset library: free to use, change and sell under CC BY 4.0, including in commercial "
         "games and virtual tabletops. Credit us and you're done.", "",
         "## Credit line (copy and paste)", "", f"    {CREDIT}", "",
         "Add the asset names if you like, and say if you changed them (for example \"modified: recoloured\"). "
         "ATTRIBUTION.txt has longer forms. The licence is in LICENSE-ASSETS.", "",
         "## What's inside", "",
         *([] if not n_models else ["- `models/`: one self-contained `.glb` (glTF 2.0 binary) per model. Each colour map is embedded as WebP "
         "(`EXT_texture_webp`), so no other file is needed. Opens in Blender 3.x and later, three.js, Babylon.js, Godot 4, "
         "Unity (glTFast), Unreal (glTF importer) and most web viewers."]),
         ]
    if tier == "hd":
        L.append("- This is the full-detail edition. The game-tier edition of the same pack (smaller files, plus any flat "
                 "pictures such as floor tiles and decals) is the zip without `-hd` in its name.")
    if n_images:
        L.append("- `images/`: flat pieces as WebP pictures: floor tiles, rugs, decals, wall hangings and cards. "
                 "Lay them on a plane at the size `catalog.csv` gives.")
    if has_extras:
        L.append("- `models/extras/`: models the game itself keeps out of rooms (a low review score, or a known flaw such as "
                 "a mask artefact). Included for completeness; `in_game` is false for them in the catalog.")
    L += ["- `catalog.csv` and `catalog.json`: every file with its name, SKU, real-world size, 5-ft-grid footprint, "
          "tags, placement and provenance.",
          "- `LICENSE-ASSETS`: the CC BY 4.0 legal code. `ATTRIBUTION.txt`: credit lines.", "",
          "## Scale and orientation", "",
          "Models are in **metres** (glTF's unit), at real-world size, standing on the origin with their front facing **+Z** "
          "and +Y up. Sizes in the catalog are given in inches (`size_in`, width x depth x height) and metres (`size_m`).",
          "The grid is the tabletop's **5-foot square** (1.524 m). `footprint_5ft` says how many squares a model claims: "
          "`tiny` and `sub` claim none (they sit on a table or share a square), `1`, `1x2`, `2x2` and so on, `edge` is a wall-edge piece.",
          "Each file's mesh data is exactly what the game uses; the only change is one root node that carries the scale and "
          "turn (`applied_scale`, `applied_yaw_deg`, `applied_translation_m` in the catalog). Delete that node's transform to get "
          "the raw mesh back. (Where the catalog says `normals_renormalised`, that many normal vectors were rescaled to unit "
          "length so the file passes the Khronos glTF validator.)",
          "Where `front_verified` is false, nobody has checked which way that model faces; most face +Z, some don't. "
          "Some small props (a dagger, a book) lie flat, the way they would rest on a table.",
          "`scale_range` is how far the game lets a piece vary from its nominal size (a barrel runs 0.7x to 3.5x); "
          "`[0.9, 1.1]` means a rigid, human-scaled object such as a chair or a door.",
          ]
    if figures:
        L += ["Figures stand on the origin at their own height (`height_ft`); `base_ft` is the base the game puts under them "
              "(5 ft for Medium creatures). Faces +Z."]
    L += ["", "## Made with AI (please read)", "",
          "Every model and image here was generated with AI. Pictures were made with Google Gemini image models or OpenAI image "
          "generation, and turned into 3D with Microsoft TRELLIS.2 (self-hosted, or through fal.ai). People chose, corrected, "
          "rejected and arranged the results; they did not sculpt or paint them by hand. Each entry's `provenance` field names "
          "its batch and generator chain. Most batches used one of our own house-style plates as a style reference; the plate's "
          "lineage includes a third-party screenshot used only for proportions and finish, and no third-party content was copied "
          "(LICENSING.md in the Turnip Works repository has the full account).", "",
          "**If you ship these in a game or product, you may have to say so.** Steam, for example, requires developers to "
          "disclose AI-generated content in their game; these assets are pre-generated AI content. Do not present them as "
          "hand-made. Where a picture carries an embedded provenance mark (such as Google's SynthID), it has not been removed; "
          "please don't remove it either.", "",
          "Purely machine-generated material may not be protected by copyright in some countries. The CC BY licence applies to "
          "the extent that rights exist, including in the selection and arrangement of the library and in human edits.", "",
          "## Not included", "",
          "The Turnip Works name, turnip mark and logos are not licensed (you may say truthfully that you use Turnip Works "
          "assets). The game's code is a separate AGPL-3.0 project: https://github.com/giblfiz/turnipworks", ""]
    if figures:
        L += ["## SRD 5.1", "", "Some figure names and the `srd` field come from the SRD 5.1:", "", SRD_NOTICE, ""]
    return "\n".join(L)


def attribution(title, figures=False):
    s = ["Turnip Works asset pack: " + title, "",
         "Ready-to-paste credit line:", "", "    " + CREDIT, "",
         "Longer form (for a credits screen or a README):", "",
         f"    {title} from Turnip Works (https://turnipworks.net) by Implausible Enterprises LLC (made by Harry and Fauna),",
         "    licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Generated with AI image and 3D models.", "",
         "Per-asset form (when you use a few models):", "",
         "    \"<name>\" (Turnip Works SKU <sku>), Turnip Works assets (https://turnipworks.net), CC BY 4.0[, modified: <what you changed>]", "",
         "If you changed an asset, say so. A link to the licence satisfies the licence's link requirement.",
         "Copyright (c) 2026 Implausible Enterprises LLC.", ""]
    if figures:
        s += ["Figures also carry SRD 5.1 names. Keep this notice with them:", "", SRD_NOTICE, ""]
    return "\n".join(s)


CSV_COLS = ["file", "sku", "name", "kind", "category", "subcategory", "settings", "tags", "placement", "footprint_5ft",
            "width_in", "depth_in", "height_in", "faces", "applied_yaw_deg", "front_verified", "in_game", "batch", "mesh_id",
            "generators"]


def csv_text(recs):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_COLS)
    for r in recs:
        w.writerow([r["file"], r["sku"], r["name"], r["kind"], r["category"], r["subcategory"], " ".join(r["settings"]),
                    " ".join(r["tags"]), r["placement"], r["footprint_5ft"], *r["size_in"], r.get("faces", ""),
                    r.get("applied_yaw_deg", ""), r.get("front_verified", ""), r["in_game"], r["provenance"]["batch"],
                    r["provenance"]["mesh_id"] or "", " > ".join(r["provenance"]["generators"] or [])])
    return buf.getvalue()


def fig_csv(recs):
    cols = ["file", "id", "name", "group", "class", "race", "gender", "tags", "srd", "height_ft", "base_ft", "faces", "applied_yaw_deg"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    for r in recs:
        w.writerow([r["file"], r["id"], r["name"], r["group"], r.get("class", ""), r.get("race", ""), r.get("gender", ""),
                    " ".join(r["tags"]), " ".join(r.get("srd", [])), r["height_ft"], r["base_ft"], r["faces"], r["applied_yaw_deg"]])
    return buf.getvalue()


# ---------------------------------------------------------------- write
def zipname(slug, tier, tag):
    suffix = {"runtime": "", "hd": "-hd", "figures": "", "figures-full": "-hd"}[tier]
    return f"turnipworks-{slug}{suffix}-{tag}.zip"


def add(z, name, data):
    zi = zipfile.ZipInfo(name, date_time=(2026, 10, 22, 0, 0, 0))
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.external_attr = 0o644 << 16
    z.writestr(zi, data, compresslevel=6)


def write_pack(out, slug, rows, tier, tag, licence, extra_files=()):
    title, blurb = PACKS[slug]
    top = zipname(slug, tier, tag)[:-4]
    path = out / zipname(slug, tier, tag)
    recs, n_img, n_mesh, extras = [], 0, 0, False
    tmp = path.with_suffix(".zip.part")
    with open(tmp, "wb", buffering=32 << 20) as fh, zipfile.ZipFile(fh, "w") as z:
        for row in sorted(rows, key=lambda r: r["sku"]["sku"]):
            s = row["sku"]
            if s["kind"] == "mesh":
                data, scale, yaw, faces, (_, lift, nfix) = build_mesh(row, tier)
                file = f"models/{'extras/' if row['extra'] else ''}{s['sku']}.glb"
                extras |= row["extra"]
                add(z, f"{top}/{file}", data)
                recs.append(catalog_rec(row, file, "mesh", scale, yaw, faces))
                recs[-1]["applied_translation_m"] = [0.0, lift, 0.0]
                if nfix:
                    recs[-1]["normals_renormalised"] = nfix
                n_mesh += 1
            elif tier == "runtime":  # flats are pictures: one size, shipped in the main packs only
                file = f"images/{s['sku']}.webp"
                add(z, f"{top}/{file}", (ASSETS / "flat" / f"{s['sku']}.webp").read_bytes())
                recs.append(catalog_rec(row, file, "image"))
                n_img += 1
        for arc, src, desc in (extra_files if tier == "runtime" else ()):
            add(z, f"{top}/{arc}", Path(src).read_bytes())
            n_img += 1
            recs.append({"file": arc, "sku": Path(arc).stem, "name": desc, "kind": "image", "category": "", "subcategory": "",
                         "settings": [], "tags": [], "placement": "", "footprint_5ft": "", "size_in": ["", "", ""],
                         "in_game": True, "provenance": {"batch": "wallkit" if "wallkit" in arc else "factions-01", "mesh_id": None,
                                                          "generators": [G_FLASH, "seamless + normal-map scripts"] if "wallkit" in arc else [OPENAI + ", text-only prompts"]}})
        if not recs:
            z.close(); fh.close(); tmp.unlink(); return None
        add(z, f"{top}/catalog.json", json.dumps({"pack": slug, "title": title, "tier": tier, "release": tag,
                                                  "credit": CREDIT, "license": LICENSE_URL, "units": "metres; size_in in inches",
                                                  "grid": "5 ft squares", "entries": recs}, indent=1))
        add(z, f"{top}/catalog.csv", csv_text(recs))
        add(z, f"{top}/LICENSE-ASSETS", licence)
        add(z, f"{top}/ATTRIBUTION.txt", attribution(title))
        add(z, f"{top}/README.md", readme(title, blurb, tier, n_mesh, n_img, has_extras=extras))
    tmp.rename(path)
    return {"zip": path.name, "slug": slug, "title": title, "tier": tier, "models": n_mesh, "images": n_img,
            "bytes": path.stat().st_size, "extras": sum(r["extra"] for r in rows if r["sku"]["kind"] == "mesh")}


def write_fig_pack(out, group, figs, tier, tag, licence):
    title, blurb = FIG_PACKS[group]
    slug = f"figures-{group}"
    top = zipname(slug, tier, tag)[:-4]
    path = out / zipname(slug, tier, tag)
    recs = []
    tmp = path.with_suffix(".zip.part")
    with open(tmp, "wb", buffering=32 << 20) as fh, zipfile.ZipFile(fh, "w") as z:
        for f in sorted(figs, key=lambda f: f["id"]):
            data, faces, height_m, nfix = build_figure(f, tier)
            file = f"models/{f['id']}.glb"
            add(z, f"{top}/{file}", data)
            recs.append({"file": file, "id": f["id"], "name": f["name"], "group": f["group"], "class": f.get("cls", ""),
                         "race": f.get("race", ""), "gender": f.get("gender", ""), "tags": f.get("tags", []),
                         "srd": f.get("srd", []), "height_ft": f.get("h"), "base_ft": f.get("base"),
                         "size_category": f.get("size"), "faces": faces, "measured_height_m": round(height_m, 4),
                         "applied_scale": round(f["k"] * FT, 6), "applied_yaw_deg": f.get("yaw") or 0,
                         **({"normals_renormalised": nfix} if nfix else {}),
                         "provenance": {"batch": "figures-518 (2026-10-06)", "generators": list(CHAIN_FIGURES),
                                        "style_reference": "house style plate D + our own pilot and body-reference plates",
                                        "ai_generated": True}})
        add(z, f"{top}/catalog.json", json.dumps({"pack": slug, "title": title, "tier": tier, "release": tag, "credit": CREDIT,
                                                  "license": LICENSE_URL, "units": "metres", "entries": recs}, indent=1))
        add(z, f"{top}/catalog.csv", fig_csv(recs))
        add(z, f"{top}/LICENSE-ASSETS", licence)
        add(z, f"{top}/ATTRIBUTION.txt", attribution(title, figures=True))
        add(z, f"{top}/README.md", readme(title, blurb, tier, len(recs), 0, figures=True))
    tmp.rename(path)
    return {"zip": path.name, "slug": slug, "title": title, "tier": tier, "models": len(recs), "images": 0,
            "bytes": path.stat().st_size, "extras": 0}


# ---------------------------------------------------------------- release notes (GitHub release body)
def release_notes(done, tag, rtag):
    dl = f"https://github.com/giblfiz/turnipworks/releases/download/{rtag}"
    def mb(b):
        return f"{b / 1e6:,.0f} MB" if b >= 10e6 else f"{b / 1e6:.1f} MB"
    main = {d["slug"]: d for d in done if d["tier"] in ("runtime", "figures")}
    hd = {d["slug"]: d for d in done if d["tier"] in ("hd", "figures-full")}
    titles = {**{k: v[0] for k, v in PACKS.items()}, **{f"figures-{k}": v[0] for k, v in FIG_PACKS.items()}}
    blurbs = {**{k: v[1] for k, v in PACKS.items()}, **{f"figures-{k}": v[1] for k, v in FIG_PACKS.items()}}
    n_props = sum(d["models"] for d in main.values() if not d["slug"].startswith("figures"))
    n_img = sum(d["images"] for d in main.values())
    n_fig = sum(d["models"] for d in main.values() if d["slug"].startswith("figures"))
    L = [f"Turnip Works asset library, {tag}: **{n_props:,} props and building pieces, {n_fig} figures and {n_img} flat "
         "images** (floor tiles, rugs, decals, banners, emblems), as downloadable zips. Free to use, change and sell, "
         "commercially too, under **CC BY 4.0**. Other virtual tabletops and games are very welcome to use them.", "",
         "## Credit line", "", "```", CREDIT, "```", "",
         "Add the asset names if you like, and say if you changed them (\"modified: recoloured\"). Every zip carries "
         "`ATTRIBUTION.txt` with longer forms, the licence text (`LICENSE-ASSETS`), a README and a `catalog.csv` / "
         "`catalog.json`. The licence: https://creativecommons.org/licenses/by/4.0/", "",
         "## Made with AI", "",
         "Every model and image was generated with AI: pictures by Google Gemini image models or OpenAI image generation, "
         "3D by Microsoft TRELLIS.2 (self-hosted, or through fal.ai). People chose, corrected, rejected and arranged them; "
         "nobody sculpted or painted them by hand. **If you ship them, you may have to disclose that**: Steam, for example, "
         "requires developers to disclose AI-generated content, and these are pre-generated AI content. Each catalog entry "
         "names its batch and generator chain. Purely machine-generated material may not be protected by copyright in some "
         "countries; the licence applies to the extent that rights exist. The full account is in "
         "[LICENSING.md](https://github.com/giblfiz/turnipworks/blob/main/LICENSING.md).", "",
         "## Loading the models", "",
         "- Each `.glb` is a self-contained glTF 2.0 binary with its colour map embedded as WebP (`EXT_texture_webp`). It "
         "opens in Blender 3.x and later (File > Import > glTF 2.0), three.js `GLTFLoader`, Babylon.js, Godot 4, Unity "
         "(glTFast) and most web viewers. No meshopt or Draco decoder needed.",
         "- **Scale: metres, real-world size**, standing on the origin, +Y up, front facing **+Z**. A tabletop grid square "
         "is 5 ft (1.524 m); `footprint_5ft` in the catalog says how many squares a piece claims, `size_in` gives its "
         "nominal box in inches.",
         "- The mesh data is exactly what the game draws; the scale and turn sit on one added root node "
         "(`applied_scale`, `applied_yaw_deg` in the catalog).", "",
         "```js",
         "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
         "new GLTFLoader().load('models/anvil.glb', (gltf) => scene.add(gltf.scene)); // already at real size, in metres",
         "```", "",
         "## Packs", "",
         "Each pack comes in two editions. The **game** edition is what Turnip Works itself draws (3,000 to 5,000 faces "
         "with a 128 to 256 px colour map for props; figures 8,000 to 20,000 faces): small and fast, good for a VTT. The "
         "**HD** edition is the full generated mesh with a 2048 px colour map, for close-ups, renders and printing.", "",
         "| pack | what | models | images | game zip | HD zip |", "|---|---|--:|--:|--:|--:|"]
    order = list(PACKS) + [f"figures-{g}" for g in FIG_PACKS]
    for slug in order:
        d = main.get(slug)
        if not d:
            continue
        h = hd.get(slug)
        L.append(f"| **{titles[slug]}** | {blurbs[slug]} | {d['models'] or '-'} | {d['images'] or '-'} | "
                 f"[{mb(d['bytes'])}]({dl}/{d['zip']}) | "
                 + (f"[{mb(h['bytes'])}]({dl}/{h['zip']})" if h else "-") + " |")
    tm, th = sum(d["bytes"] for d in main.values()), sum(d["bytes"] for d in hd.values())
    L += [f"| **all** | | {n_props + n_fig:,} | {n_img} | {mb(tm)} | {mb(th)} |", "",
          "Packs are grouped the way you'd furnish a room: one per room type (tavern, crypt, smithy ...), then the "
          "everyday things that turn up everywhere (furniture, lighting, food ...), then the structure kit and the figures. "
          "A few models the game keeps out of its own rooms (low review score or a known flaw) sit in `models/extras/`. "
          "`SHA256SUMS` lists every zip's checksum; `packs.json` indexes the packs.", "",
          "## Not included", "",
          "The Turnip Works name, turnip mark and logos (not licensed; you may say truthfully that you use Turnip Works "
          "assets). Third-party test files the project uses and does not own. The game's code is AGPL-3.0, in this repository.", ""]
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/mnt/usb/turnip-works/asset-packs/out")
    ap.add_argument("--tag", default="2026-10-22")
    ap.add_argument("--tier", default="runtime,hd,figures,figures-full")
    ap.add_argument("--only", default="", help="comma list of pack slugs")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--release-tag", default="assets-2026-10-22")
    ap.add_argument("--notes", action="store_true", help="write RELEASE_NOTES.md from --out/packs.json and stop")
    a = ap.parse_args()
    rows, fig_rows, excluded = plan()
    only = set(filter(None, a.only.split(",")))
    if a.plan:
        for slug, rs in sorted(rows.items(), key=lambda kv: -len(kv[1])):
            c = Counter(r["sku"]["kind"] for r in rs)
            print(f"{slug:22s} mesh {c['mesh']:4d}  flat {c['flat']:4d}  extras {sum(r['extra'] for r in rs)}")
        for g, fs in fig_rows.items():
            print(f"figures-{g:14s} {len(fs)}")
        print("excluded:", excluded)
        missing = [s for s in rows if s not in PACKS]
        assert not missing, missing
        return
    out = Path(a.out)
    if a.notes:
        (out / "RELEASE_NOTES.md").write_text(release_notes(json.loads((out / "packs.json").read_text()), a.tag, a.release_tag))
        return
    out.mkdir(parents=True, exist_ok=True)
    licence = (ROOT / "LICENSE-ASSETS").read_bytes()
    extra = {"structure-kit": [(f"images/wallkit/{p.name}", p, "wall kit texture: " + p.name.split(".")[0])
                               for p in sorted((ASSETS / "wallkit").glob("*.webp"))],
             "factions": [(f"images/emblems/{p.name}", p, "faction emblem: " + p.stem) for p in sorted((ASSETS / "emblems").glob("*.webp"))]}
    done = []
    manifest = out / "packs.json"
    if manifest.exists():
        done = [d for d in json.loads(manifest.read_text()) if (out / d["zip"]).exists()]
    have = {(d["slug"], d["tier"]) for d in done}
    for tier in a.tier.split(","):
        if tier in ("runtime", "hd"):
            for slug in PACKS:
                if (only and slug not in only) or (slug, tier) in have or slug not in rows:
                    continue
                r = write_pack(out, slug, rows[slug], tier, a.tag, licence, extra.get(slug, ()))
                if r:
                    done.append(r); print(f"{r['zip']:60s} {r['models']:4d} models {r['images']:4d} images {r['bytes'] / 1e6:8.1f} MB", flush=True)
                    manifest.write_text(json.dumps(done, indent=1))
        else:
            for g, fs in fig_rows.items():
                if (only and f"figures-{g}" not in only) or (f"figures-{g}", tier) in have:
                    continue
                r = write_fig_pack(out, g, fs, tier, a.tag, licence)
                done.append(r); print(f"{r['zip']:60s} {r['models']:4d} models {r['bytes'] / 1e6:8.1f} MB", flush=True)
                manifest.write_text(json.dumps(done, indent=1))
    with open(out / "SHA256SUMS", "w") as fh:
        for d in sorted(done, key=lambda d: d["zip"]):
            h = hashlib.sha256()
            with open(out / d["zip"], "rb") as zf:
                for blk in iter(lambda: zf.read(1 << 20), b""):
                    h.update(blk)
            fh.write(f"{h.hexdigest()}  {d['zip']}\n")
    print("excluded:", excluded)


if __name__ == "__main__":
    main()
