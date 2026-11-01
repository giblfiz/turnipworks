#!/usr/bin/env python3
"""The census table (INVENTORY.md's), from a BEFORE and an AFTER shots.py run, each judged blind by judge.py.
  python3 experiments/2026-10-30-openables/inventory.py BEFORE_DIR AFTER_DIR > table.md
A kind "shows its state" in a run when Gemini read every one of its SKUs right both shut and open."""
import json, os, sys
B, A = sys.argv[1], sys.argv[2]
sb = json.load(open(os.path.join(B, 'score.json')))['per_sku']; sa = json.load(open(os.path.join(A, 'score.json')))['per_sku']
ib = {i['sku']: i for i in json.load(open(os.path.join(B, 'items.json')))}; ia = {i['sku']: i for i in json.load(open(os.path.join(A, 'items.json')))}
cats = {}
for sku, it in ia.items(): cats.setdefault(it['cat'], []).append(sku)
L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools', 'spawn-tuner', 'data', 'library.json')))['objects']
def twin(cat): return f'{cat}-open' in L or any(o.get('open_of') == cat for o in L.values())
def before_how(sku, cat):  # origin/main: the cage door's house hinge, else the first "-open" twin (any variant), else nothing
    return 'swing' if sku == 'door-cell-bars--leaf' else 'swap (any variant)' if twin(cat) else 'none'
def reads(score, sku):
    v = score.get(sku); return bool(v and v['shut']['ok'] and v['open']['ok'])
rows = []; n = {'b_none': 0, 'a_none': 0, 'b_ui': 0, 'a_ui': 0}
for cat in sorted(cats):
    skus = sorted(cats[cat]); a0 = ia[skus[0]]; b0 = ib.get(skus[0], {})
    hb = sorted({before_how(s, cat) for s in skus})
    ha = sorted({{'motion': ia[s].get('rigMode') or 'motion', 'swap': 'swap (own variant)', None: 'none'}[ia[s].get('look')] for s in skus})
    rb = sum(reads(sb, s) for s in skus); ra = sum(reads(sa, s) for s in skus)
    ui_b = bool(b0.get('uiOpens')); ui_a = bool(a0.get('uiOpens'))
    shows_b = ui_b and rb == len(skus); shows_a = ui_a and ra == len(skus)
    n['b_none'] += not shows_b; n['a_none'] += not shows_a; n['b_ui'] += ui_b; n['a_ui'] += ui_a
    rows.append(f"| {cat} | {len(skus)} | {'yes' if ui_b else '**no**'} → {'yes' if ui_a else 'no'} | {'/'.join(hb)} → {'/'.join(ha)} | {rb}/{len(skus)} → {ra}/{len(skus)} | {'yes' if shows_b else '**no**'} → {'yes' if shows_a else '**no**'} |")
print(f"{len(cats)} kinds; opened in the UI before {n['b_ui']}, after {n['a_ui']}; showing no state (not openable, or Gemini could not read both states of every SKU) before {n['b_none']}, after {n['a_none']}\n")
print('| kind | SKUs | Open in the UI | how it opens (before → after) | SKUs Gemini read right shut AND open (before → after) | shows its state |')
print('|---|---|---|---|---|---|')
print('\n'.join(rows))
