#!/usr/bin/env python3
"""targets.json: the 24 meshes INVENTORY.md (experiments/2026-10-30-openables) asked for, each with the partner whose
look it must match (rendered by tools/render_ref.py) and, when one exists, the model it replaces.
  kind  new-open     an open twin a kind lacked (a new "-open" SKU)
        new-shut     a shut model for a kind whose shut model already reads open (replaces that SKU's mesh)
        better-open  an open twin that read shut at table distance (replaces that SKU's mesh)"""
import json
from pathlib import Path
E = Path(__file__).resolve().parent.parent; W = E.parents[1]; MAIN = Path('<repo>')
L = json.loads((W / 'tools/spawn-tuner/data/library.json').read_text())['objects']
orient = json.loads((W / 'tools/spawn-tuner/data/orient.json').read_text())
rec = {k['sku']: (oid, k) for oid, o in L.items() for k in o['skus']}

def src_glb(sku):
    own = MAIN / 'tools/spawn-tuner/assets/m' / f'{sku}.glb.owner'
    if own.exists(): return json.loads(own.read_text())['source']
    p = MAIN / 'experiments/2026-10-11-types/clt/models' / f'{sku}.glb'
    assert p.exists(), sku; return str(p)

def plate(sku):
    d = Path(src_glb(sku)).parent.parent
    for p in (d / 'masked' / f'{sku}.png', d / 'inputs' / f'{sku}.png', d / 'inputs' / f'{sku}.jpg'):
        if p.exists(): return str(p)
    return None

OPEN_LID = 'its lid thrown fully back and standing upright on its hinges, so the open top and the EMPTY interior are plainly visible from above (the inside darker than the outside)'
T = [
 # id, object, kind, partner (the look to match), replaces, what changes
 ('cage-sacrifice-open', 'cage-sacrifice-open', 'new-open', 'cage-sacrifice', None, 'a narrow door in its front (about a third as wide as the front, a panel of bars hinged on one upright edge) swung wide open, so the doorway gapes and the EMPTY cage floor inside is plainly visible; nobody inside'),
 ('casket-ornate-open', 'casket-ornate-open', 'new-open', 'casket-ornate', None, f'{OPEN_LID}; the inside is lined with deep red velvet'),
 ('rural-tack-trunk-open', 'rural-tack-trunk-open', 'new-open', 'rural-tack-trunk', None, OPEN_LID),
 ('trunk-travel-open--s1', 'trunk-travel-open', 'new-open', 'trunk-travel--s1', None, OPEN_LID),
 ('trunk-travel-open--s2', 'trunk-travel-open', 'new-open', 'trunk-travel--s2', None, OPEN_LID),
 ('floor-trapdoor-open--dressed-stone', 'floor-trapdoor-open', 'new-open', 'floor-trapdoor--dressed-stone', None, 'the same square floor tile and frame, but its hatch lid is swung up on its back hinges and stands upright (vertical) along the back edge, and where the lid was there is now a deep BLACK square hole going down into darkness, with the top rungs of a wooden ladder just visible inside it; the tile stays flat and low, the raised lid is the only tall part'),
 ('floor-trapdoor-open--rough-timber', 'floor-trapdoor-open', 'new-open', 'floor-trapdoor--rough-timber', None, 'the same square floor tile and frame, but its hatch lid is swung up on its back hinges and stands upright (vertical) along the back edge, and where the lid was there is now a deep BLACK square hole going down into darkness, with the top rungs of a wooden ladder just visible inside it; the tile stays flat and low, the raised lid is the only tall part'),
 ('oubliette-hatch-open', 'oubliette-hatch-open', 'new-open', 'oubliette-hatch', None, 'the same stone frame set in the floor, but its slatted hatch is swung up on its back hinges and stands upright (vertical) along the back edge, and where it was there is now a deep BLACK shaft going straight down into darkness; the frame stays flat and low, the raised hatch is the only tall part'),
 ('wall-window-small-open--temple-stone', 'wall-window-small-open', 'new-open', 'wall-window-small--temple-stone', None, 'the same wall section and the same arched window, but the window\'s glazed casement leaves are swung fully open on their side hinges and folded back FLAT against the face of the wall on either side of the window, so the arched opening itself is an EMPTY dark see-through gap with nothing filling it and nothing sticking out from the wall'),
 ('wall-window-small-open--tower-stone', 'wall-window-small-open', 'new-open', 'wall-window-small--tower-stone', None, 'the same wall section and the same arched window, but the window\'s glazed casement leaves are swung fully open on their side hinges and folded back FLAT against the face of the wall on either side of the window, so the arched opening itself is an EMPTY dark see-through gap with nothing filling it and nothing sticking out from the wall'),
 # castle-rough (2026-10-30, after the plate gate): the piece is a bare cruciform arrow slit, already an opening (the census
 # read its shut crop "open window aperture" at 55%), and shutters folded beside it are a different design (Gemini: "entirely
 # different"). Treated like the four windows whose shut model reads open: a NEW SHUT model (the same slit closed by a
 # shutter), and the existing slit itself becomes the open twin (kind reuse-open: the partner's own mesh, not generated).
 ('wall-window-small--castle-rough', 'wall-window-small', 'new-shut', 'wall-window-small--castle-rough', 'wall-window-small--castle-rough', 'its arrow slit CLOSED: the cruciform (cross-shaped) arrow slit keeps EXACTLY its outline, size and splayed stone reveals as in the references, but dark iron-studded wooden planks now fill the cross-shaped slit flush, set just inside it, so the cross shows solid dark wood instead of a see-through gap; no rectangular window, no wider opening, the stone wall is unchanged and nothing sticks out from the wall'),
 ('wall-window-small-open--castle-rough', 'wall-window-small-open', 'reuse-open', 'wall-window-small--castle-rough', None, 'the existing castle-rough slit, unchanged: the open state'),
 ('wall-window-small--fieldstone', 'wall-window-small', 'new-shut', 'wall-window-small-open--fieldstone', 'wall-window-small--fieldstone', 'its wooden shutters CLOSED: both shutter leaves swung shut, lying flat in the window opening flush with the wall, meeting in the middle, so the window opening is completely filled by closed wooden shutters and nothing sticks out from the wall'),
 ('wall-window-small--noble-panel', 'wall-window-small', 'new-shut', 'wall-window-small-open--noble-panel', 'wall-window-small--noble-panel', 'its window CLOSED: the casement and its shutters swung shut, lying flat in the window opening flush with the wall, so the window opening is completely filled and nothing sticks out from the wall'),
 ('wall-window-small--rough-timber', 'wall-window-small', 'new-shut', 'wall-window-small-open--rough-timber', 'wall-window-small--rough-timber', 'its wooden shutters CLOSED: both shutter leaves swung shut, lying flat in the window opening flush with the wall, meeting in the middle, so the window opening is completely filled by closed wooden shutters and nothing sticks out from the wall'),
 ('wall-window-small--rough-timber--s2', 'wall-window-small', 'new-shut', 'wall-window-small-open--rough-timber--s2', 'wall-window-small--rough-timber--s2', 'its wooden shutters CLOSED: both shutter leaves swung shut, lying flat in the window opening flush with the wall, meeting in the middle, so the window opening is completely filled by closed wooden shutters and nothing sticks out from the wall'),
 ('chest-treasure', 'chest-treasure', 'new-shut', 'chest-treasure-open', 'chest-treasure', 'its lid SHUT and latched with a heavy lock plate on the front; no treasure, coins or gold showing anywhere, the closed curved lid sits flush on the box'),
 ('iron-maiden', 'iron-maiden', 'new-shut', 'iron-maiden-open', 'iron-maiden', 'its two front doors SHUT, closed together at the front, so it stands as one closed upright figure-shaped iron casket with the face carved on the closed doors; no spikes or interior visible'),
 ('bread-oven', 'bread-oven', 'new-shut', 'bread-oven-open', 'bread-oven', 'its iron oven door SHUT, closed flat over the oven mouth, so no chamber, no fire, no coals and no bread are visible; unlit and cold'),
 ('smith-farrier-box', 'smith-farrier-box', 'new-shut', 'smith-farrier-box-open', 'smith-farrier-box', 'its lid SHUT, lying flat and closed on top, so no tools or contents are visible; a plain closed box with its carrying handle, NO drawers or compartments open anywhere (any drawer is pushed fully shut, flush with the box), nothing pulled out, nothing hanging open'),
 ('rural-grooming-box', 'rural-grooming-box', 'new-shut', 'rural-grooming-box-open', 'rural-grooming-box', 'its lid SHUT, lying flat and closed on top, so no brushes or contents are visible; a plain closed box'),
 ('salt-box-open', 'salt-box-open', 'better-open', 'salt-box', 'salt-box-open', 'its hinged lid thrown wide open, swung right up and back past upright so it leans back behind the box, and the whole open top of the box is filled with a big bright WHITE heap of salt mounded up above the rim, the white plainly the brightest thing in the picture; the box itself unchanged'),
 ('sideboard-open', 'sideboard-open', 'better-open', 'sideboard', 'sideboard-open', 'every cupboard door of the lower front swung WIDE open toward the viewer at a right angle on its hinges, standing out from the front, so the dark interior shelves are plainly visible behind them, with a few white plates and bottles on the shelves'),
 ('door-plank-open--dressed-stone--common', 'door-plank-open', 'better-open', 'door-plank--dressed-stone--common', 'door-plank-open--dressed-stone--common', 'the same stone door frame, but the wooden plank door leaf is swung wide open toward the viewer at a right angle on its side hinges, standing out from the frame, so the doorway itself is an EMPTY dark see-through gap with nothing filling it'),
 ('door-reinforced-open--rough-timber', 'door-reinforced-open', 'better-open', 'door-reinforced--rough-timber', 'door-reinforced-open--rough-timber', 'the same timber door frame, but the iron-banded door leaf is swung open on its side hinges to a right angle, so the leaf stands PERPENDICULAR to the frame, edge-on to the doorway, pointing straight out toward the viewer from one side post (it does NOT stick out sideways past the frame, and the whole piece stays as wide as the frame and as tall as the frame), so the doorway itself is an EMPTY dark see-through gap with nothing filling it'),
]
out = []
for i, obj, kind, partner, repl, change in T:
    pobj, pk = rec[partner]
    t = {'id': i, 'object': obj, 'kind': kind, 'want': 'shut' if kind == 'new-shut' else 'open', 'partner': partner, 'partner_object': pobj,
         'partner_glb': src_glb(partner), 'partner_yaw': orient.get(pk['mesh'], 0) or 0, 'partner_plate': plate(partner),
         'partner_bounds': pk.get('bounds'), 'partner_size_in': L[pobj]['size'], 'partner_place': L[pobj]['place'], 'change': change}
    if repl:
        ro, rk = rec[repl]; t.update(replaces=repl, replaces_glb=src_glb(repl), replaces_mesh=rk['mesh'], replaces_bounds=rk.get('bounds'))
    out.append(t)
(E / 'targets.json').write_text(json.dumps(out, indent=1))
print(len(out), 'targets;', sum(1 for t in out if not t['partner_plate']), 'without a partner plate')
