"""Spec helpers for the culture packs (cultures-a, 2026-11-06). Each culture's spec_<code>.py calls add()/kit()/flat()
and then write(); write() emits <code>/assets.json (the plate route's input), <code>/prompts/ and the culture's catalog
file catalog/objects-<culture>.catalog.md (one role line per NEW role; kit pieces use the existing kit roles).

Route (as the faction-pillars and openmesh batches did it): Codex's built-in image_gen (ChatGPT plan, no API key) paints
each plate with a TRANSPARENT background from the house-style template (style/heroic-handpainted.object.md, with the
presentation paragraph changed from chroma blue to transparency), the house style plate attached as the style anchor;
a sibling (a second wall of a family, a doorway) is painted as an EDIT of its parent's accepted plate."""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MAIN = Path("<repo>")
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = "style-anchor.png"  # copied into each culture folder: style-references/heroic-handpainted-tavern-v1.png
OLD_PRES = STYLE[STYLE.index("Presentation for image-to-3D"):STYLE.index("Specific design:")]
NEW_PRES = ("Presentation for image-to-3D: exactly one complete asset, centered, three-quarter view from slightly above, clear space around every edge, "
            "a genuinely TRANSPARENT background (PNG alpha), no horizon, no floor plane, no cast shadow, neutral even lighting with no colored light "
            "casts, no environment, no people, no additional loose objects. Keep supports and important sides unoccluded.\n\n")
TEMPLATE = STYLE.replace(OLD_PRES, NEW_PRES)
assert "{subject}" in TEMPLATE and "{detail}" in TEMPLATE and "chroma" not in TEMPLATE

STOUT = (" Built CHUNKY for a tabletop miniature: every post, leg, rail, handle and bar is THICK; nothing thin, no wire, no string,"
         " no dangling loose parts.")
NOBASE = " It stands on nothing: NO floor, NO rug, NO ground, NO base slab, platform or plinth under it that the real object would not have."
LEAFY = (" Foliage is painted as a FEW big solid masses with broad leaf shapes on their surface, never as separate thin leaves or twigs;"
         " no gaps in the foliage you can see through, nothing floating free.")
UNLIT = " It is UNLIT: no flames, no glow, no smoke (the game adds the light)."
NOTEXT = " NO writing, letters, characters, calligraphy or symbols that look like script anywhere on it."
KIT_SLAB = (" It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end)."
            " It must NOT be square and must NOT be wider than it is tall. Real-world size about 60 in wide x 12 in deep x 108 in tall:"
            " keep these proportions. Nothing else: NO floor, NO ground, NO base slab under it, NO roof, NO corner return, NO lamp,"
            " banner, furniture or decoration attached. Both side edges are clean flat vertical cuts so that copies butt together"
            " into a longer wall. Seen from its broad side, three-quarter view from slightly above. Keep the WHOLE object well inside"
            " the frame with a generous margin.")
EDIT = ("Edit task. The supplied image is an accepted piece of this same set ({what}). The new piece must look built by the same"
        " hands from the same materials: the SAME colours, timber, plaster or stone, thicknesses, painting style and camera angle."
        " Change ONLY what is described below. Keep the transparent background.\n\n")

assets, roles = [], []


def role(rid, desc, place, fp, size, mat, sets, gen, pri, hint, var="var:-", aff="aff:-", mount=None):
    """A NEW catalog role line (catalog/objects-<culture>.catalog.md). sets like 'JPN!' (signature) or 'JPN'."""
    w, d, h = size
    m = f" · mount:{mount}" if mount is not None else ""
    roles.append(f"- **{rid}** — {desc} · {place} · {fp} · size:{w:g}x{d:g}x{h:g} · {mat} · set:{sets} · {var} · {aff} · {gen} · {pri} · {hint}{m}")


def _rec(sku, obj, group, subject, size, prompt, refs, desc, must, must_not, aspect, extra):
    rec = {"id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d", "route": "trellis", "subject": subject,
           "size": [float(v) for v in size], "aspect": aspect, "prompt": prompt, "refs": refs,
           "gate": {"desc": desc, "must": list(must), "must_not": list(must_not)}}
    rec.update(extra)
    assets.append(rec)


def add(sku, obj, size, subject, design, desc, must=(), must_not=(), group="p1", base=True, leafy=False, aspect="square", text=False, **extra):
    w, d, h = size
    detail = (design + f" Real-world size about {w:g} in wide x {d:g} in deep x {h:g} in tall: keep these proportions."
              + (LEAFY if leafy else "") + (NOBASE if base else "") + ("" if text else NOTEXT)
              + " Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.")
    prompt = TEMPLATE.format(subject=subject, detail=detail)
    mn = list(must_not) + (["a floor, rug, ground patch or base slab under the object"] if base else []) + ([] if text else ["writing or letters"])
    _rec(sku, obj, group, subject, size, prompt, [STYLE_REF], desc, must, mn, aspect, extra)


def kit(sku, obj, subject, design, desc, must=(), must_not=(), parent=None, what="", group=None, **extra):
    """A wall-kit piece (wall-straight / wall-doorway / wall-window-small, 60x12x108). With `parent`: an EDIT of the parent's plate."""
    detail = design + KIT_SLAB + NOTEXT
    prompt = TEMPLATE.format(subject=subject, detail=detail)
    refs = [STYLE_REF]
    if parent:
        prompt = EDIT.format(what=what) + prompt.replace("Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:", "Create a single asset in the Turnip Works house style (heroic hand-painted):")
        refs = [f"plates/{parent}.png"]
        extra["parent"] = parent
    _rec(sku, obj, group or ("sib1" if parent else "p1"), subject, (60, 12, 108), prompt, refs, desc, must,
         list(must_not) + ["a floor or base slab under it", "a square or wide outline (it must be tall and narrow)"], "portrait", {**extra, "kit": True})


def leaf(sku, obj, subject, design, desc, must=(), must_not=(), **extra):
    """A door LEAF (stretched to fill a doorway: about 52 in x 4 in x 108 in), seen face-on from slightly above."""
    detail = (design + " It is ONE flat door leaf, a slab about 4 ft wide, 4 in thick and 8 ft tall, standing upright on its bottom edge,"
              " seen from the front, a little from one side and slightly above, so its face and one edge show. No frame, no wall, no"
              " hinges sticking out, no floor." + NOTEXT + " Keep the WHOLE leaf well inside the frame with a generous margin.")
    prompt = TEMPLATE.format(subject=subject, detail=detail)
    _rec(sku, obj, "p1", subject, (48, 4, 96), prompt, [STYLE_REF], desc, must, list(must_not) + ["a door frame or wall around it"], "portrait", {**extra, "kit": True, "leaf": True})


def write(code, culture, intro):
    out = HERE / code
    (out / "prompts").mkdir(parents=True, exist_ok=True)
    ids = [a["id"] for a in assets]
    dup = {i for i in ids if ids.count(i) > 1}
    assert not dup, dup
    for a in assets:
        assert re.fullmatch(r"[a-z0-9-]+", a["id"]), a["id"]
        (out / "prompts" / f"{a['id']}.md").write_text(a["prompt"] + "\n")
    (out / "assets.json").write_text(json.dumps({"batch": f"{code}-01", "note": f"see spec_{code}.py", "assets": assets}, indent=1) + "\n")
    # the catalog file goes into catalog/ only with --catalog (when the culture is integrated: its setting code must be in
    # src/catalog_tool.py SETTINGS first); before that, a copy beside the batch
    cat = (ROOT / "catalog" if "--catalog" in sys.argv else out) / f"objects-{culture}.catalog.md"
    cat.write_text(intro.rstrip() + "\n\n" + "\n".join(roles) + "\n")
    print(f"{code}: {len(assets)} plates ({sum(1 for a in assets if a.get('parent'))} edits), {len(roles)} new roles -> {cat.relative_to(ROOT)}")
