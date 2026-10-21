"""Spec helpers for the smithy & workshop type: copied from the mansion batch (experiments/2026-10-05-castle-crypt-mansion/mansion/build_spec.py), paths changed. Imported by build_spec.py."""
import json, sys
from pathlib import Path
from collections import Counter
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MAIN = Path("<repo>")  # git-ignored binaries (style reference, older plates) live in the main tree only
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct
STYLE = (ROOT / "style/heroic-handpainted.object.md").read_text()
STYLE_REF = str(MAIN / "style-references/heroic-handpainted-tavern-v1.png")
INTRO = "Using the supplied image only as a visual style guide for the Turnip Works house style (heroic hand-painted), create a new, distinct single asset:"
assert INTRO in STYLE
roles = {}
for p in sorted((ROOT / "catalog").glob("*.catalog.md")):
    roles.update(ct.parse_catalog(p)[0])

NOBLUE = " The background is flat chroma blue, so the object itself has NO blue anywhere (no blue cloth, flowers, china or glass)."
NOBASE = " It stands on nothing: NO floor, NO rug or carpet, NO ground, NO base slab, platform or plinth under it that the real object would not have." + NOBLUE
LEAFY = (" Foliage is painted as a FEW big solid masses with broad leaf shapes on their surface, never as separate thin leaves, fronds or twigs;"
         " no gaps in the foliage that you can see the background through, no stray leaves or petals floating free.")
UNLIT = " It is UNLIT: the candles are plain cream wax with dark wicks, NO flames, NO glow, NO smoke."
DRY = " It is DRY and EMPTY: NO water painted anywhere, the basin is a clean, clearly hollow stone bowl (the game adds the water)."
MATCH = {
 "suite": ("The supplied image is the first piece of a matching set of furniture ({what}). The new piece belongs to the SAME set: the SAME wood and wood colour,"
           " the same carving motifs and leg shape, the same fabric, colours, fittings, painting style and camera angle. It is a DIFFERENT piece of furniture,"
           " described below: do not copy the shape of the piece in the supplied image.\n\n"),
 "same": ("The supplied image is the first version of this kind of object ({what}). Make a SECOND, clearly different design of the same kind of object that would"
          " stand in the same room: the SAME materials, colours, level of ornament, painting style and camera angle, but a different shape as described below.\n\n"),
 "kit": ("The supplied image is an existing straight section of this same {what}. The new piece must look built from the same {what}: the SAME materials, colours,"
         " thicknesses, height, painting style and camera angle. Change ONLY what is described below.\n\n"),
}
assets = []


def base_record(sku, obj, group, prio, rooms, subject, size, prompt, refs, gate_refs, desc, must, must_not, extra):
    rec = {"id": sku, "object": obj, "group": group, "source": "generate", "lane": "3d", "subject": subject, "size": [float(v) for v in size],
           "prompt": prompt, "refs": refs, "gate_refs": gate_refs,
           "gate": {"desc": desc, "must": list(must), "must_not": list(must_not)},
           "prio": prio, "rooms": list(rooms), "bench": list(extra.pop("bench", [])), "route": extra.pop("route", "trellis")}
    rec.update(extra)
    assets.append(rec)


def add(sku, obj, group, prio, rooms, subject, design, desc, must=(), must_not=(), size=None, parent=None, what="", match="suite",
        base=True, leafy=False, parent_path=None, **extra):
    role = roles[obj]
    w, d, h = size or role["size"]
    detail = (f"{design} Real-world size about {w:g} in wide x {d:g} in deep x {h:g} in tall: keep these proportions."
              + (LEAFY if leafy else "") + (NOBASE if base else NOBLUE)
              + " Show exactly this one object and nothing else, whole and well inside the frame. Prioritize a clean silhouette readable from an elevated game camera.")
    prompt = STYLE.format(subject=subject, detail=detail)
    refs, gate_refs = [STYLE_REF], []
    must, must_not = list(must), list(must_not)
    if parent:
        assert group.startswith("sib"), sku
        pp = parent_path or str(HERE / "inputs" / f"{parent}.jpg")
        prompt = prompt.replace(INTRO, MATCH[match].format(what=what) + "Create a single asset in the Turnip Works house style (heroic hand-painted):")
        refs, gate_refs = [pp], [pp]
        must.append({"suite": f"wood, fabric and colours match the REFERENCE piece of the {what} (it is a different piece of furniture: the shape is the intended difference)",
                     "same": f"materials and colours match the REFERENCE {what} (a different shape is the intended difference)",
                     "kit": f"materials, colours and height match the REFERENCE {what} section (the described change is the intended difference)"}[match])
        extra["parent"] = parent
    if base:
        must_not.append("a floor, rug, ground patch or base slab under the object")
    base_record(sku, obj, group, prio, rooms, subject, (w, d, h), prompt, refs, gate_refs, desc, must, must_not, extra)


def twin(sku, obj, closed, prio, rooms, opened, desc, must=(), must_not=(), size=None, group="sib2", **extra):
    """The OPEN state of an accepted closed piece: an edit of that piece's own plate (catalog/objects-open-states.catalog.md)."""
    role = roles[obj]
    w, d, h = size or role["size"]
    pp = str(HERE / "inputs" / f"{closed}.jpg")
    prompt = ("Edit task. The supplied image shows one object in the Turnip Works hand-painted house style. Show the SAME object: identical materials, colours, carving,"
              " fittings, proportions and painting style. Do not redesign it.\n\n" + opened +
              " Thick, chunky doors and flaps so the open shape reconstructs cleanly in 3D. Camera: the same three-quarter view from slightly above as in the supplied image."
              " Exactly one object, centred, whole and well inside the frame, on a perfectly uniform solid chroma-blue background: no floor, no shadow, no other objects."
              " The object itself has NO blue anywhere.\n")
    base_record(sku, obj, group, prio, rooms, f"the open state of {closed}", (w, d, h), prompt, [pp], [pp], desc,
                list(must) + ["it is the SAME object as the REFERENCE (same materials, colours, proportions), only opened"], list(must_not),
                {**extra, "twin_of": closed, "parent": closed, "bench": ["hinge"]})

