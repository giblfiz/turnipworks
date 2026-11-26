#!/usr/bin/env python3
"""Reuse vetting, step 3: turn the blind reads (reuse_read.py -> reads.json) into reuse-borrow.json.
Rule: accept a sku when Gemini calls it modern or neutral with conf >= 70 (listed old cues are reviewed by hand -> OVERRIDE); a role is
accepted with the skus that pass. Hand overrides live in OVERRIDE (each with its reason) and are reported.
Near-duplicate unread variants (render distance < 0.09 to an accepted read sku of the same role) ride along.
  python3 tools/reuse_decide.py READS.json SELECTION.json RENDERS_DIR OUT.json"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

reads_p, sel_p, rdir, out_p = (Path(a) for a in sys.argv[1:5])
reads = json.loads(reads_p.read_text()); sel = json.loads(sel_p.read_text())
LIB = json.loads((Path(__file__).resolve().parents[3] / 'tools/spawn-tuner/data/library.json').read_text())['objects']

G = {  # group -> (rooms, roles)
 'kitchen food': (['kitchen', 'apartment', 'penthouse'], 'apple apple-green apple-pile bread-basket-cloth ham-whole-glazed bread-loaf bread-long-loaf bread-braided bread-roll bread-round-loaf-cut bread-slice bread-flatbread cabbage-single carrot carrot-pile cheese-wedge cheese-wheel cheese-wheel-cut cheese-board cheese-moldy-blue egg eggs-bowl egg-fried-pan fish fish-cooked-plate garlic-bulb ham-sliced meat-raw-joint meat-roast-joint onion onion-pile potato potato-pile pumpkin-carved sausage-link sausages-pan strawberries-bowl tart-fruit pie-fruit-lattice pastry-tray scones-plate cookies-plate plate-eggs-bacon plate-fish-chips plate-sausage-mash plate-roast-veg plate-pie-slice noodles-bowl rice-bowl dumplings-bowl soup-bowl salad-bowl shrimp-bowl yogurt-bowl turnip jam-jar jar-pickles jars-preserves spice-jars butter-dish chn-steamer-stack'),
 'kitchen tools': (['kitchen', 'apartment', 'penthouse'], 'cutting-board cutting-board-round knife-carving knife-table knife-rack-wall ladle pan-frying saucepan-copper pot-copper cooking-pot pot-lidded roasting-pan stew-pot-full utensil-rack-wall plate plate-ceramic bowl serving-bowl-large serving-tray platter-board-handled tea-service-tray mug-glazed mug-large cup-glass-green washing-bowl-dishes dish-rag-hanging'),
 'dry goods/storage': (['kitchen', 'bar'], 'sack flour-sack-open crate barrel keg-small bottles-empty-crate storage-jar jar-oil shelf-wall shelving-freestanding vegetable-basket-mixed vegetable-crate-mixed fruit-crate-mixed potato-crate apple-crate apple-basket bucket mop broom'),
 'home dressing': (['apartment', 'penthouse'], 'book-stack book-open books-row-bookends bookshelf blankets-folded pillows-cushions basket-laundry candle candle-cluster candlestick clock-mantel vase-flowers statue-bust board-game cat-bed-basket cat-tree key-hook-board notice-board robe-rack'),
 'plants': (['any'], 'fern-potted palm-potted plant-pot plant-stand-tiered herb-pot citrus-tree-tub planter-topiary flowerbox-window flower-buckets'),
 'rugs': (['apartment', 'penthouse'], 'rug-round rug-runner rug-oval rug-small rug-striped-woven rug-braided-round rug-cowhide rug-sheepskin rug-grand rug-round-fine'),
 'bath linen': (['bathroom', 'restroom', 'apartment', 'penthouse'], 'towel-hanging towel-stack perfume-bottles'),
 'bar': (['bar', 'kitchen', 'penthouse'], 'bottle bottle-cluster bottle-of-wine-open bottle-wine-green bottle-squat-spirit mug-of-ale wine-rack'),
}
ROLE_G = {r: g for g, (_, rs) in G.items() for r in rs.split()}
# sku -> (True accept / False reject, reason). Filled after reading reads.json; every entry is a reported override.
OVERRIDE = json.loads((out_p.parent / 'reuse-overrides.json').read_text()) if (out_p.parent / 'reuse-overrides.json').exists() else {}

def vec(s):
    im = Image.open(rdir / f'{s}.png').convert('RGBA'); im = im.crop(im.getbbox()).resize((24, 24))
    return np.asarray(im).astype(float) / 255

def ok(r):
    # Gemini lists 'old cues' even on neutral calls (a cork, a cowhide); those are reviewed by hand, not auto-rejected.
    return r.get('era') in ('modern', 'neutral') and int(r.get('conf', 0)) >= 70

acc, rej, over = {}, {}, []
by_role = {}
for role, sku in sel['selected']: by_role.setdefault(role, []).append(sku)
for role, skus in by_role.items():
    good, notes = [], []
    for s in skus:
        r = reads.get(s)
        if r is None: notes.append(f'{s}: no read'); continue
        v = ok(r); tag = f"{r.get('object')}, {r.get('era')}, {r.get('conf')}"
        if s in OVERRIDE:
            v2, why = OVERRIDE[s]
            if v2 != v: over.append(f'{s}: Gemini "{tag}; cues: {r.get("old_cues")}" -> {"ACCEPT" if v2 else "REJECT"} ({why})')
            v = v2
        (good if v else notes).append(s if v else f"{s}: {tag}; {r.get('reason')}; cues: {r.get('old_cues')}")
    if good:
        allsk = [x['sku'] for x in LIB[role]['skus']]; vs = {s: vec(s) for s in good}
        near = [s for s in allsk if s not in skus and (rdir / f'{s}.png').exists() and min(np.abs(vec(s) - vs[g]).mean() for g in good) < 0.09]
        g = ROLE_G.get(role, 'home dressing')
        acc.setdefault(g, {})[role] = {'skus': good + near, 'rooms': G[g][0],
            'gemini': ' | '.join(f"{s}: {reads[s].get('object')}, {reads[s].get('era')}, {reads[s].get('conf')}" for s in good),
            **({'rejected_skus': notes} if notes else {}), **({'near_duplicates_unread': near} if near else {})}
    else:
        rej[role] = ' || '.join(notes)
for role in sel.get('cut', []): rej[role] = 'not read (agy budget; pruned as redundant with a read sibling) - read before use'
flat_acc = {r: {**v, 'group': g} for g, rs in acc.items() for r, v in rs.items()}
out = {'accepted': {r: {**v, 'group': g} for g in G if g in acc for r, v in acc[g].items()},
       'groups': {g: list(acc[g]) for g in G if g in acc}, 'rejected': rej, 'overrides': over,
       'method': ''}
out_p.write_text(json.dumps(out, indent=1))
print(f'accepted roles {len(flat_acc)}, rejected {len(rej)}, overrides {len(over)}')
for g in G:
    if g in acc: print(f'{g}: ' + ', '.join(f"{r}" + (f"[{len(v['skus'])}]" if len(v['skus']) > 1 else '') for r, v in acc[g].items()))
for o in over: print('OVR', o)
