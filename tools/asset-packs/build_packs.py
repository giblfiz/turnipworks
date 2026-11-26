#!/usr/bin/env python3
"""Package the Turnip Works asset library as downloadable CC BY 4.0 zip packs, one per pack of the assets page.

    python3 tools/asset-packs/build_packs.py --out /mnt/usb/turnip-works/asset-packs/assets-2026-11-07 --tag 2026-11-07
    python3 tools/asset-packs/build_packs.py --plan          print the pack table, write nothing
    ... --notes        RELEASE_NOTES.md (the GitHub release body) from --out/packs.json
    ... --site-json    docs/site/asset-release.json (the assets page's download links, published: false) from --out/packs.json
Then: a DRAFT release (experiments/2026-11-07-packs/upload.py uploads with retries and checks every asset's size and
GitHub's SHA-256 digest against SHA256SUMS). Publishing is Harry's call; after it, flip `published` and deploy (docs/STATUS.md
"Asset packs on GitHub").

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
# The batches since 2026-10-22 (provenance survey 2026-11-07, from each batch's own records under experiments/: the lab
# notes, briefs and gate manifests). ALPHA: the image tool's own transparent background, no separate mask.
ALPHA = "the image tool's own transparent background"
TEXT = OPENAI + ", text-only prompts"
EITHER = "Microsoft TRELLIS.2 (self-hosted, MIT, or via fal.ai)"
CHAIN.update({
    "bars-01": (TEXT, ALPHA, FAL_TRELLIS), "roof-props-01": (TEXT, ALPHA, FAL_TRELLIS),
    "faction-pillars-01": (TEXT, ALPHA, EITHER),
    "caves-01": (OPENAI, "seamless finish scripts"),
    **{b: (OPENAI, ALPHA, OWN_TRELLIS) for b in ("chn-01", "ind-01", "jpn-01", "croof-01", "cultb-mde-01", "cultb-mes-01",
                                                 "cultb-nrs-01", "cultb-rus-01")},
    **{b: (OPENAI, "chroma key or seamless finish scripts") for b in ("chn-flats-01", "ind-flats-01", "jpn-flats-01",
                                                                      "cultb-mes-flats-01", "cyberpunk-flats-02",
                                                                      "modrooms-flats-03", "sprawl-flats-01")},
    "fth-01": (OPENAI, ALPHA, EITHER), "fth-flats-01": (OPENAI, ALPHA),
    **{b: (TEXT, ALPHA, OWN_TRELLIS) for b in ("cyberpunk-02", "sprawl-01", "modrooms-03", "moddesk-03", "vehicles-03")},
    "openmesh-01": (OPENAI + ", edits of our own renders and plates", ALPHA, EITHER),
    "meshy-01": (TEXT, ALPHA, "Meshy (paid Pro plan: the customer owns the output)"),
})
# NOT SHIPPED (2026-11-07): what the licence audit (docs/LICENSING_AUDIT.md section 4) has not cleared for a CC BY grant.
# Held by name until it is, then delete the line and rebuild the packs that hold them (--only). The page still shows them.
HOLD = {
    # modhalls-01: 10 plates by Gemini through agy-run (the audit flags Antigravity's third-party-access clause and records
    # agy-run as never generating pixels) and 5 by SDXL base 1.0 on our pod (CreativeML Open RAIL++-M, not in the audit)
    "batch:modhalls-01": "plates by Gemini via agy-run and by SDXL 1.0: neither route is in the licence audit yet",
    # the seven new dinosaurs: plates by Qwen-Image-Edit-2511 (Apache-2.0) on our pod, not in the audit yet
    **{f"figure:foe-{d}": "plate by Qwen-Image-Edit-2511 (Apache-2.0): not in the licence audit yet"
       for d in ("ankylosaurus", "brontosaurus", "pterodactyl", "quetzalcoatlus", "spinosaurus", "stegosaurus", "velociraptor")},
    # a beholder-like design: the beholder is a publisher's product identity (the redesign is recorded; Harry's call)
    "figure:foe-eye-tyrant": "a beholder-like design: product-identity question for Harry before a CC BY grant",
}
FIG_BATCHES = [  # (test(figure), batch, chain, style reference): the figure batches after the first 518
    (lambda f: f["group"] in ("runner", "modern", "robot"), "cyberpunk-pawns (2026-11-07)", CHAIN_FIGURES, "our own body-reference plates"),
    (lambda f: f["id"].startswith("cul-"), "culture-pawns (2026-11-07)", CHAIN_FIGURES, "our own body-reference plates"),
]
FLY_CHAIN = (OPENAI + ", an edit of the figure's own standing plate", "BiRefNet mask (MIT)", EITHER)
MADE_WITH = ("pictures by Google Gemini image models or OpenAI image generation, 3D by Microsoft TRELLIS.2 (self-hosted, "
             "or through fal.ai), and three shelving and rack models by Meshy on its paid plan")
CODEX_WALLS = {"wall-doorway--log-cabin", "wall-window-small--log-cabin", "wall-window-small-open--log-cabin",
               "wall-straight--rough-timber--s4"}  # walls-01 rows made by the 10-05 log-cabin / plank-s4 Codex runs


def chain_of(sku, src):
    if src == "walls-01" and sku in CODEX_WALLS:
        return (OPENAI, "BiRefNet mask (MIT)", FAL_TRELLIS)
    return CHAIN.get(src)


STYLE_TEXT_ONLY = {"factions-01", "factions-flats-01", "bars-01", "roof-props-01", "faction-pillars-01", "cyberpunk-02",
                   "sprawl-01", "modrooms-03", "moddesk-03", "vehicles-03", "meshy-01"}  # no house-style plate as input

# ---------------------------------------------------------------- packs
# THE PACKS ARE THE ASSETS PAGE'S (2026-11-07, Harry: "deeplink to the release packs we host on GitHub"): one pack per pack
# card on turnipworks.net/assets (engine/tools/site_assets_data.mjs: a Build-menu type with rooms, the Modern genre as one
# pack, the building kit, the faction pieces, the figures), holding exactly the things that card lists, so the page's
# download link for a pack is that pack's zip. A thing in several packs (a barrel in the tavern and the cellar) is in each
# zip. Also in a pack: the open twin of any thing it holds (`open_of`: chest-plain-open with chest-plain), and every sku
# of a thing, the ones the game keeps out of rooms in models/extras/. A library object the page lists nowhere (a rated-out
# crown, a forklift no room recipe names, the roofing pictures) goes to the pack holding most of its batch, so nothing the
# 2026-10-22 packs shipped is lost. Titles and READMEs take the page's own label and sentence (docs/site/assets-packs.json).
# The figures: ONE game zip (the page's Figures pack) and the HD edition one zip per group (all of it is 2.2 GB, over
# GitHub's 2 GiB a file), each named for its group on the page.
FIG_GROUPS = {"hero": "Heroes", "townsfolk": "Townsfolk", "foe": "Foes & monsters", "large": "Large creatures",
              "beast": "Beasts & mounts", "runner": "Runners", "modern": "Modern people", "robot": "Robots & drones"}
PACKS = {}      # slug -> (title, blurb), filled by plan() from the page
ORDER = []      # the page's order

SRD_NOTICE = ("This work includes material taken from the System Reference Document 5.1 (\"SRD 5.1\") by Wizards of the Coast "
              "LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed "
              "under the Creative Commons Attribution 4.0 International License available at "
              "https://creativecommons.org/licenses/by/4.0/legalcode.")


def page_packs():
    """the assets page's data (the same Node script build_site.py runs) and its packs' sentences"""
    import subprocess
    r = subprocess.run(["node", str(ROOT / "engine/tools/site_assets_data.mjs")], capture_output=True, text=True, check=True)
    metas = json.loads((ROOT / "docs/site/assets-packs.json").read_text())["packs"]
    return json.loads(r.stdout), metas


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
    if any(k in n for n in js["nodes"] for k in ("matrix", "translation", "rotation", "scale")):
        return scene_bounds(js)  # (2026-11-07: roof-chiwen carries a baked quarter turn on a node, which the game draws)
    for m in js["meshes"]:
        for p in m["primitives"]:
            a = js["accessors"][p["attributes"]["POSITION"]]
            lo = [min(x, y) for x, y in zip(lo, a["min"])]
            hi = [max(x, y) for x, y in zip(hi, a["max"])]
    return lo, hi


def scene_bounds(js):
    """AABB of the scene with its node transforms applied (each primitive's POSITION box corners through its node's world
    matrix: exact for the box of a turned box, as three.js's Box3.setFromObject on the accessor bounds)"""
    import numpy as np
    def local(n):
        if "matrix" in n:
            return np.array(n["matrix"], dtype=float).reshape(4, 4).T
        x, y, z, w = n.get("rotation", (0, 0, 0, 1))
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        M = np.eye(4); M[:3, :3] = R * np.array(n.get("scale", (1, 1, 1)))[None, :]; M[:3, 3] = n.get("translation", (0, 0, 0))
        return M
    pts = []
    def walk(i, parent):
        n = js["nodes"][i]; W = parent @ local(n)
        if "mesh" in n:
            for p in js["meshes"][n["mesh"]]["primitives"]:
                a = js["accessors"][p["attributes"]["POSITION"]]
                c = np.array([[x, y, z, 1] for x in (a["min"][0], a["max"][0]) for y in (a["min"][1], a["max"][1]) for z in (a["min"][2], a["max"][2])])
                pts.append((W @ c.T).T[:, :3])
        for ch in n.get("children", ()):
            walk(ch, W)
    for i in js["scenes"][js.get("scene", 0)]["nodes"]:
        walk(i, np.eye(4))
    P = np.vstack(pts)
    return [float(v) for v in P.min(axis=0)], [float(v) for v in P.max(axis=0)]


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
    """rows per pack slug (the page's packs), figures per group, what was excluded, and where the page-less things went"""
    roles, lib, figs = load()
    orient = load_orient(lib)
    D, metas = page_packs()
    PACKS.clear(); ORDER.clear()
    members = {}                                      # pack slug -> object ids, in the page's order
    for p in D["packs"]:
        if p.get("kind") == "figures":
            continue
        blurb = (metas.get(p["slug"]) or {}).get("blurb") or p["label"]
        blurb = blurb.replace("modern-day, near-future and Shadowrun-style games (not an official or licensed product)",
                              "modern-day and near-future games")  # (no third party's mark in the zips)
        PACKS[p["slug"]] = (p["label"], blurb)
        ORDER.append(p["slug"])
        members[p["slug"]] = list(dict.fromkeys(p["things"]))
    twins = defaultdict(list)                         # a thing -> its open twins
    for oid, o in lib["objects"].items():
        if o.get("open_of"):
            twins[o["open_of"]].append(oid)
    for slug, ids in members.items():
        have = set(ids)
        for oid in list(ids):
            for t in sorted(twins.get(oid, ())):
                if t not in have:
                    ids.append(t); have.add(t)
    # a thing the page lists in no pack: the pack holding most of its batch (by sku src)
    placed = {oid for ids in members.values() for oid in ids}
    by_src = defaultdict(Counter)
    for slug, ids in members.items():
        for oid in ids:
            for s in lib["objects"][oid]["skus"]:
                by_src[s["src"]][slug] += 1
    homeless = {}
    for oid in sorted(set(lib["objects"]) - placed):
        votes = Counter()
        for s in lib["objects"][oid]["skus"]:
            votes.update(by_src.get(s["src"], {}))
        slug = votes.most_common(1)[0][0] if votes else ORDER[0]
        members[slug].append(oid); homeless[oid] = slug
    rows, excluded, held = defaultdict(list), [], {}
    for slug, ids in members.items():
        for oid in ids:
            obj, role = lib["objects"][oid], roles[oid]
            for s in obj["skus"]:
                if EXCLUDE.search(s["sku"]) or EXCLUDE.search(s.get("url", "")):
                    excluded.append((s["sku"], "excluded by name (LICENSING.md)"))
                    continue
                why = HOLD.get(f"batch:{s['src']}") or HOLD.get(f"sku:{s['sku']}")
                if why:
                    held.setdefault(s["sku"], why)
                    continue
                m = s.get("model") or {}
                hidden = bool(m.get("masking")) or (m.get("stars") is not None and m["stars"] < 3)
                rows[slug].append({"oid": oid, "obj": obj, "role": role, "sku": s, "yaw": orient.get(s.get("mesh")),
                                   "extra": hidden})
    fig_rows = defaultdict(list)
    for f in figs:
        if EXCLUDE.search(f["id"]):
            excluded.append((f["id"], "excluded by name"))
            continue
        if HOLD.get(f"figure:{f['id']}"):
            held[f["id"]] = HOLD[f"figure:{f['id']}"]
            continue
        fig_rows[f["group"]].append(f)
    unknown = sorted(set(fig_rows) - set(FIG_GROUPS))
    assert not unknown, f"figure groups with no name here (FIG_GROUPS): {unknown}"
    return rows, fig_rows, excluded + [(k, "held: " + v) for k, v in sorted(held.items())], homeless


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
            "CMP": "camp", "LAI": "lair", "GRV": "grove", "CLT": "cult", "ANY": "anywhere",
            "MOD": "modern", "CYB": "cyberpunk", "NRS": "norse", "MDE": "middle-east", "RUS": "rus", "MES": "mexica",
            "JPN": "japan", "CHN": "china", "IND": "india"}


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
    L = [f"# Turnip Works: {title}", "", blurb[:1].upper() + blurb[1:] + ("" if blurb.endswith(".") else "."), "",
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
        L += ["A creature that flies in the game also has its airborne pose, `<id>--flying.glb` (`pose_of` names its figure), "
              "with its lowest point on the origin.",
              "Figures stand on the origin at their own height (`height_ft`); `base_ft` is the base the game puts under them "
              "(5 ft for Medium creatures). Faces +Z."]
    L += ["", "## Made with AI (please read)", "",
          f"Every model and image here was generated with AI: {MADE_WITH}. People chose, corrected, "
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


ZIP_DATE = (2026, 10, 22, 0, 0, 0)   # every entry's timestamp (so a rebuild is byte-identical); main() sets it from --tag


def add(z, name, data):
    zi = zipfile.ZipInfo(name, date_time=ZIP_DATE)
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
                                                  "page": f"https://turnipworks.net/assets#pack/{slug}", "credit": CREDIT, "license": LICENSE_URL, "units": "metres; size_in in inches",
                                                  "grid": "5 ft squares", "entries": recs}, indent=1))
        add(z, f"{top}/catalog.csv", csv_text(recs))
        add(z, f"{top}/LICENSE-ASSETS", licence)
        add(z, f"{top}/ATTRIBUTION.txt", attribution(title))
        add(z, f"{top}/README.md", readme(title, blurb, tier, n_mesh, n_img, has_extras=extras))
    tmp.rename(path)
    return {"zip": path.name, "slug": slug, "title": title, "tier": tier, "models": n_mesh, "images": n_img,
            "bytes": path.stat().st_size, "extras": sum(r["extra"] for r in rows if r["sku"]["kind"] == "mesh")}


def fig_provenance(f):
    """(batch, generator chain, style reference) of one figure (FIG_BATCHES: the batches after the first 518)"""
    for test, batch, chain, style in FIG_BATCHES:
        if test(f):
            return batch, chain, style
    return "figures-518 (2026-10-06)", CHAIN_FIGURES, "house style plate D + our own pilot and body-reference plates"


def write_fig_pack(out, slug, title, blurb, figs, tier, tag, licence):
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
                         "provenance": dict(zip(("batch", "generators", "style_reference"), fig_provenance(f)), ai_generated=True)})
            recs[-1]["provenance"]["generators"] = list(recs[-1]["provenance"]["generators"])
            if f.get("fly"):  # A FLYING POSE (2026-11-06): the game's second, airborne mesh, placed by its own k, c and yaw
                F = {**f, **f["fly"], "id": f"{f['id']}--flying", "name": f"{f['name']}, flying"}
                data, faces, height_m, nfix = build_figure(F, tier)
                file = f"models/{F['id']}.glb"
                add(z, f"{top}/{file}", data)
                recs.append({**recs[-1], "file": file, "id": F["id"], "name": F["name"], "pose": "flying", "pose_of": f["id"],
                             "height_ft": F.get("h"), "faces": faces, "measured_height_m": round(height_m, 4),
                             "applied_scale": round(F["k"] * FT, 6), "applied_yaw_deg": F.get("yaw") or 0,
                             "provenance": {**recs[-1]["provenance"], "generators": list(FLY_CHAIN)}})
                recs[-1].pop("normals_renormalised", None)
                if nfix:
                    recs[-1]["normals_renormalised"] = nfix
        add(z, f"{top}/catalog.json", json.dumps({"pack": slug, "title": title, "tier": tier, "release": tag,
                                                  "page": "https://turnipworks.net/assets#pack/figures", "credit": CREDIT,
                                                  "license": LICENSE_URL, "units": "metres", "entries": recs}, indent=1))
        add(z, f"{top}/catalog.csv", fig_csv(recs))
        add(z, f"{top}/LICENSE-ASSETS", licence)
        add(z, f"{top}/ATTRIBUTION.txt", attribution(title, figures=True))
        add(z, f"{top}/README.md", readme(title, blurb, tier, len(recs), 0, figures=True))
    tmp.rename(path)
    return {"zip": path.name, "slug": slug, "title": title, "tier": tier, "models": len(recs), "images": 0,
            "figures": len(figs), "bytes": path.stat().st_size, "extras": 0}


# ---------------------------------------------------------------- release notes (GitHub release body)
def release_notes(done, tag, rtag):
    dl = f"https://github.com/giblfiz/turnipworks/releases/download/{rtag}"
    def mb(b):
        return f"{b / 1e9:.1f} GB" if b >= 1e9 else f"{b / 1e6:,.0f} MB" if b >= 10e6 else f"{b / 1e6:.1f} MB"
    game = {d["slug"]: d for d in done if d["tier"] in ("runtime", "figures")}
    hd = defaultdict(list)
    for d in done:
        if d["tier"] in ("hd", "figures-full"):
            hd[d["pack"]].append(d)
    rows = plan()[0]  # (the distinct skus shipped: a thing in several packs counts once; held ones not at all)
    shipped = {(r["sku"]["sku"], r["sku"]["kind"]) for rs in rows.values() for r in rs}
    n_props = sum(1 for _, k in shipped if k == "mesh")
    n_img = sum(1 for _, k in shipped if k != "mesh")
    n_fig = sum(d.get("figures", d["models"]) for d in done if d["tier"] == "figures")
    L = [f"Turnip Works asset library, {tag}: **{n_props:,} 3D props and building pieces, {n_fig} figures and {n_img} flat "
         "images** (floor tiles, rugs, decals, banners, emblems) in the packs of [the assets page](https://turnipworks.net/assets), "
         "as downloadable zips. Free to use, change and sell, commercially too, under **CC BY 4.0**. Other virtual tabletops "
         "and games are very welcome to use them.", "",
         "## Credit line", "", "```", CREDIT, "```", "",
         "Add the asset names if you like, and say if you changed them (\"modified: recoloured\"). Every zip carries "
         "`ATTRIBUTION.txt` with longer forms, the licence text (`LICENSE-ASSETS`), a README and a `catalog.csv` / "
         "`catalog.json`. The licence: https://creativecommons.org/licenses/by/4.0/", "",
         "## Made with AI", "",
         f"Every model and image was generated with AI: {MADE_WITH}. People chose, corrected, rejected and arranged them; "
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
         "One pack per pack on the assets page, holding what that page lists (so a barrel used in the tavern and the "
         "cellar is in both). Each comes in two editions. The **game** edition is what Turnip Works itself draws (3,000 to "
         "5,000 faces with a 128 to 256 px colour map for props; figures 8,000 to 20,000 faces): small and fast, good for "
         "a VTT. The **HD** edition is the full generated mesh with a 2048 px colour map, for close-ups, renders and "
         "printing. The figures' HD edition comes one zip per group.", "",
         "| pack | models | images | game zip | HD zip |", "|---|--:|--:|--:|--:|"]
    for slug in [*ORDER, "figures"]:
        d = game.get(slug)
        if not d:
            continue
        hs = sorted(hd.get(slug, []), key=lambda h: list(FIG_GROUPS).index(h["group"]) if h.get("group") else 0)
        cell = "<br>".join(f"[{(FIG_GROUPS[h['group']] + ' ') if h.get('group') else ''}{mb(h['bytes'])}]({dl}/{h['zip']})" for h in hs) or "-"
        L.append(f"| [**{d['title']}**](https://turnipworks.net/assets#pack/{slug}) | {d['models'] or '-'} | {d['images'] or '-'} | "
                 f"[{mb(d['bytes'])}]({dl}/{d['zip']}) | {cell} |")
    tm = sum(d["bytes"] for d in game.values())
    th = sum(h["bytes"] for hs in hd.values() for h in hs)
    L += [f"| **all** | | | {mb(tm)} | {mb(th)} |", "",
          "A few models the game keeps out of its own rooms (low review score or a known flaw) sit in `models/extras/`. "
          "`SHA256SUMS` lists every zip's checksum; `packs.json` indexes the packs.", "",
          "## Not included", "",
          "The Turnip Works name, turnip mark and logos (not licensed; you may say truthfully that you use Turnip Works "
          "assets). Third-party test files the project uses and does not own. The game's code is AGPL-3.0, in this repository.", ""]
    return "\n".join(L)


def jobs(rows, fig_rows, tiers, only):
    """(kind, slug, tier, ...) for every zip to write: the page's packs, the figures' game zip and their HD zips by group"""
    out = []
    for tier in tiers:
        if tier in ("runtime", "hd"):
            out += [("pack", slug, tier) for slug in ORDER if slug in rows and (not only or slug in only)]
        elif tier == "figures" and (not only or "figures" in only):
            out.append(("fig", "figures", tier, None))
        elif tier == "figures-full":
            out += [("fig", f"figures-{g}", tier, g) for g in FIG_GROUPS if g in fig_rows and (not only or "figures" in only or f"figures-{g}" in only)]
    return out


_W = {}


def _init(rows, fig_rows, packs, order, out, tag, licence, extra):
    PACKS.update(packs); ORDER[:] = order
    _W.update(rows=rows, fig_rows=fig_rows, out=out, tag=tag, licence=licence, extra=extra)


def run(job):
    w = _W
    if job[0] == "pack":
        _, slug, tier = job
        r = write_pack(w["out"], slug, w["rows"][slug], tier, w["tag"], w["licence"], w["extra"].get(slug, ()))
        if r:
            r["pack"] = slug
        return r
    _, slug, tier, g = job
    figs = [f for grp, fs in w["fig_rows"].items() if g in (None, grp) for f in fs]
    title = "Figures" if g is None else f"Figures: {FIG_GROUPS[g]}"
    blurb = (PAGE_FIG_BLURB if g is None else f"the {FIG_GROUPS[g].lower()} of the Turnip Works figures, full detail")
    r = write_fig_pack(w["out"], slug, title, blurb, figs, tier, w["tag"], w["licence"])
    r.update(pack="figures", **({"group": g} if g else {}))
    return r


def site_release(done, rtag):
    """docs/site/asset-release.json: the release the assets page links, each page pack's zips (engine/tools/site_assets.py).
    A new release always starts unpublished: the page shows no link until the flag is flipped (after Harry publishes)."""
    packs = defaultdict(list)
    for d in sorted(done, key=lambda d: (d["tier"] in ("hd", "figures-full"), list(FIG_GROUPS).index(d["group"]) if d.get("group") else 0)):
        z = {"edition": "hd" if d["tier"] in ("hd", "figures-full") else "game", "file": d["zip"], "bytes": d["bytes"],
             "sha256": d["sha256"], "models": d["models"], "images": d["images"]}
        if d.get("group"):
            z.update(group=d["group"], label=FIG_GROUPS[d["group"]])
        packs[d["pack"]].append(z)
    order = [*ORDER, "figures"]
    return {"_about": "The assets page's pack downloads (engine/tools/site_assets.py): a GitHub release of giblfiz/turnipworks "
                      "and each page pack's zips on it, written by tools/asset-packs/build_packs.py --site-json from the build's "
                      "packs.json. `published` gates every link: flip it to true ONLY after the release is published (it is a "
                      "draft until Harry says so; engine/test/asset_release_test.py checks with gh), then deploy.",
            "repo": "giblfiz/turnipworks", "tag": rtag, "published": False,
            "packs": {k: packs[k] for k in sorted(packs, key=lambda k: order.index(k) if k in order else len(order))}}


PAGE_FIG_BLURB = "every figure in the game: heroes, townsfolk, foes and monsters, large creatures, beasts and mounts, runners, modern people and robots"


def main():
    global ZIP_DATE
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/mnt/usb/turnip-works/asset-packs/out")
    ap.add_argument("--tag", default="2026-11-07")
    ap.add_argument("--tier", default="runtime,hd,figures,figures-full")
    ap.add_argument("--only", default="", help="comma list of pack slugs (figures, or figures-<group> for one HD zip)")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2) - 2))
    ap.add_argument("--release-tag", default=None, help="default assets-<tag>")
    ap.add_argument("--notes", action="store_true", help="write RELEASE_NOTES.md from --out/packs.json and stop")
    ap.add_argument("--site-json", action="store_true",
                    help="write docs/site/asset-release.json (the assets page's download links) from --out/packs.json and stop")
    a = ap.parse_args()
    rtag = a.release_tag or f"assets-{a.tag}"
    ZIP_DATE = tuple(int(x) for x in a.tag.split("-")) + (0, 0, 0)
    rows, fig_rows, excluded, homeless = plan()
    only = set(filter(None, a.only.split(",")))
    if a.plan:
        for slug in ORDER:
            rs = rows[slug]
            c = Counter(r["sku"]["kind"] for r in rs)
            print(f"{slug:26s} things {len({r['oid'] for r in rs}):4d}  mesh {c['mesh']:4d}  flat {c['flat']:4d}  extras {sum(r['extra'] for r in rs)}")
        for g, fs in fig_rows.items():
            print(f"figures-{g:18s} {len(fs)}")
        print("not on the page, placed by batch:", homeless)
        print("excluded:", excluded)
        return
    out = Path(a.out)
    if a.notes:
        (out / "RELEASE_NOTES.md").write_text(release_notes(json.loads((out / "packs.json").read_text()), a.tag, rtag))
        return
    if a.site_json:
        p = ROOT / "docs/site/asset-release.json"
        p.write_text(json.dumps(site_release(json.loads((out / "packs.json").read_text()), rtag), indent=1) + "\n")
        print("wrote", p, "(published: false)")
        return
    out.mkdir(parents=True, exist_ok=True)
    licence = (ROOT / "LICENSE-ASSETS").read_bytes()
    extra = {"building-kit": [(f"images/wallkit/{p.name}", str(p), "wall kit texture: " + p.name.split(".")[0])
                              for p in sorted((ASSETS / "wallkit").glob("*.webp"))],
             "faction-pieces": [(f"images/emblems/{p.name}", str(p), "faction emblem: " + p.stem) for p in sorted((ASSETS / "emblems").glob("*.webp"))]}
    done = []
    manifest = out / "packs.json"
    if manifest.exists():
        done = [d for d in json.loads(manifest.read_text()) if (out / d["zip"]).exists()]
    have = {d["zip"] for d in done}
    todo = [j for j in jobs(rows, fig_rows, a.tier.split(","), only)
            if zipname(j[1], j[2], a.tag) not in have]
    # biggest first, so the long HD zips start early
    todo.sort(key=lambda j: (j[2] not in ("hd", "figures-full"), -len(rows.get(j[1], ())) if j[0] == "pack" else 0))
    import multiprocessing as mp
    with mp.get_context("fork").Pool(a.jobs, initializer=_init,
                                      initargs=(rows, fig_rows, dict(PACKS), list(ORDER), out, a.tag, licence, extra)) as pool:
        for r in pool.imap_unordered(run, todo):
            if not r:
                continue
            done.append(r)
            print(f"{r['zip']:62s} {r['models']:4d} models {r['images']:4d} images {r['bytes'] / 1e6:8.1f} MB", flush=True)
            manifest.write_text(json.dumps(sorted(done, key=lambda d: d["zip"]), indent=1))
    with open(out / "SHA256SUMS", "w") as fh:
        for d in sorted(done, key=lambda d: d["zip"]):
            h = hashlib.sha256()
            with open(out / d["zip"], "rb") as zf:
                for blk in iter(lambda: zf.read(1 << 20), b""):
                    h.update(blk)
            d["sha256"] = h.hexdigest()
            fh.write(f"{h.hexdigest()}  {d['zip']}\n")
    manifest.write_text(json.dumps(sorted(done, key=lambda d: d["zip"]), indent=1))
    (out / "RELEASE_NOTES.md").write_text(release_notes(done, a.tag, rtag))
    print("not on the page, placed by batch:", homeless)
    print("excluded:", excluded)


if __name__ == "__main__":
    main()
