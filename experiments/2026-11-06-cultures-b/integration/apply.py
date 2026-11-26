#!/usr/bin/env python3
"""Apply culture packs B to the tree (idempotent: run it again after editing the sources here; a block is replaced whole).
    python3 apply.py nrs [mde rus mes] [--check]
Edits (all below everyone else's code, as the crypt / smithy integrations did):
  once (the shared part, `cb:`): tools/spawn-tuner/js/solver2.js block cb:solver2 (the culture-room skeleton);
    tools/spawn-tuner/build_data.py: import of culture_packs_b.py, its room types, its batch and its exclusive tiers (4 lines)
  per pack (`<code>:`): js/walls.js and js/solver2.js blocks <code>:walls / <code>:solver2, one line in engine/core/height.js
    (the family's roof), lines in js/fx/fire.js (which pieces burn), catalog/rooms-culture-<pack>.md (recipes)
An anchor that no longer matches stops the run before anything is written."""
import argparse, importlib.util, pathlib, re, sys
HERE = pathlib.Path(__file__).resolve().parent; ROOT = HERE.parents[2]; T = ROOT / 'tools/spawn-tuner'
spec = importlib.util.spec_from_file_location('rc', HERE / 'recipes.py'); rc = importlib.util.module_from_spec(spec); spec.loader.exec_module(rc)
PACK = {'nrs': 'norse-steading', 'mde': 'middle-east', 'rus': 'rus-medieval', 'mes': 'mesoamerica'}
ROOF = {'nrs': ("ROOF_BY_FAMILY['norse-stave'] = 'shingle';", 'Norse steading: a steep roof of wood shingles'),
        'mde': ("ROOF_BY_FAMILY['mde-plaster'] = 'plaster';", 'Mamluk Middle East: flat whitewashed roofs'),
        'rus': ("ROOF_BY_FAMILY['rus-log'] = 'shingle';", "medieval Rus': a plank-and-shingle roof"),
        'mes': ("ROOF_BY_FAMILY['mes-stucco'] = 'plaster';", 'Mexica: flat plastered roofs on stone houses')}
FIRE = {'nrs': ["  if (/^nrs-forge$/.test(id)) return 'brazier';   // culture packs B: the Norse forge's charcoal bed (type:nrs)\n"],
        'mde': ["  if (/^mde-coffee-brazier$/.test(id)) return 'brazier'; // culture packs B: the coffee-maker's charcoal (type:mde)\n"],
        'rus': ["  if (/^rus-(stove|tiled-stove|banya-heater)$/.test(id)) return 'oven'; // culture packs B: fires behind a stoke hole (type:rus)\n"],
        'mes': []}
# edge kit a GM places by hand (engine/client/library-index.js HAND_KIT): the court edges the plot code lays
HANDKIT = {'mde': "HAND_KIT.push('mde-arcade', 'mde-arcade-pier', 'mde-khan-gate'); // culture packs B (mde): the khan arcade, its piers, its gate\n",
           'rus': "HAND_KIT.push('rus-palisade', 'rus-yard-gate'); // culture packs B (rus): the stockade palisade and its gate\n",
           'mes': "HAND_KIT.push('door-curtain'); // culture packs B (mes): the woven door curtain (Mexica doorways have no hinged door)\n"}
ap = argparse.ArgumentParser(); ap.add_argument('packs', nargs='+', choices=list(PACK)); ap.add_argument('--check', action='store_true'); ap.add_argument('--root', type=pathlib.Path, help='a sandbox copy of the tree (tools/sandbox.sh)'); a = ap.parse_args()
if a.root: ROOT = a.root.resolve()
texts, log, bad = {}, [], []
def get(f):
    if f not in texts: texts[f] = (ROOT / f).read_text()
    return texts[f]
def tail(f, hid, body, c='//'):
    t = get(f); a0, a1 = f'{c} >>> {hid}', f'{c} <<< {hid}'; block = f'{a0}\n{body.rstrip()}\n{a1}\n'
    if a0 in t: t = re.sub(re.escape(a0) + r'.*?' + re.escape(a1) + r'\n', lambda _: block, t, flags=re.S); log.append(f'tail    {f} {hid} (replaced)')
    else: t = t.rstrip('\n') + '\n\n' + block; log.append(f'tail    {f} {hid} (+{block.count(chr(10))} lines)')
    texts[f] = t
def insert(f, hid, anchor, text, where='before'):
    t = get(f)
    if text in t: log.append(f'insert  {f} {hid} (already there)'); return
    if t.count(anchor) != 1: bad.append(f'{hid}: anchor occurs {t.count(anchor)} times in {f}: {anchor[:90]!r}'); return
    texts[f] = t.replace(anchor, text + anchor if where == 'before' else anchor + text); log.append(f'insert  {f} {hid}')
S2, WJ, BD = 'tools/spawn-tuner/js/solver2.js', 'tools/spawn-tuner/js/walls.js', 'tools/spawn-tuner/build_data.py'
# ---- once
tail(S2, 'cb:solver2', (HERE / 'cb.solver2.js').read_text())
insert(BD, 'cb:import', 'from factions import faction_data, add_faction_assets\n', 'import culture_packs_b  # culture packs B (2026-11-06): Norse, Mamluk Middle East, medieval Rus\', Mexica\n', where='after')
insert(BD, 'cb:rooms', 'SHELL = "any-shell"\n', 'ROOM_TYPES += culture_packs_b.room_types(ROOT)  # culture packs B: the room types of every pack that has landed\n')
insert(BD, 'cb:batch', '    add_openmesh(skus)\n', '    culture_packs_b.add_cultures_b(skus, ROOT)  # culture packs B: each pack\'s run manifest (catalog/runs/cultb-<code>-01)\n')
insert(BD, 'cb:exclusive', '    for obj in objects.values():\n        tiers = {s["tier"] for s in obj["skus"]}\n', '    EXCLUSIVE |= culture_packs_b.TIERS  # culture packs B: every mesh is its pack\'s tier\n')
# ---- docs (tools/spawn-tuner/ROOMS.md): the skeleton once, a section per pack, before the shaped-rooms chapter
RM, ANCH = 'tools/spawn-tuner/ROOMS.md', '## Rooms that are not rectangles (the game, 2026-10-05)\n'
def doc(hid, body):
    t = get(RM); a0, a1 = f'<!-- >>> {hid} -->', f'<!-- <<< {hid} -->'; block = f'{a0}\n{body.rstrip()}\n{a1}\n\n'
    if a0 in t: texts[RM] = re.sub(re.escape(a0) + r'.*?' + re.escape(a1) + r'\n\n', lambda _: block, t, flags=re.S); log.append(f'doc     {hid} (replaced)')
    elif t.count(ANCH) == 1: texts[RM] = t.replace(ANCH, block + ANCH); log.append(f'doc     {hid}')
    else: bad.append(f'doc {hid}: anchor not found once in ROOMS.md')
doc('cb:rooms', (HERE / 'cb.rooms.md').read_text())
# ---- per pack
for code in a.packs:
    if (HERE / f'{code}.rooms.md').exists(): doc(f'{code}:rooms', (HERE / f'{code}.rooms.md').read_text())
    tail(WJ, f'{code}:walls', (HERE / f'{code}.walls.js').read_text())
    tail(S2, f'{code}:solver2', (HERE / f'{code}.solver2.js').read_text())
    line, why = ROOF[code]
    insert('engine/core/height.js', f'{code}:roof', "export const ROOF_DEFAULT = 'thatch';\n", f'{line} // {why} (culture packs B, 2026-11-06)\n', where='after')
    if code in HANDKIT: insert('engine/client/library-index.js', f'{code}:handkit', '// ROOF OBJECTS (2026-10-27, Harry:', HANDKIT[code])
    for l in FIRE[code]: insert('tools/spawn-tuner/js/fx/fire.js', f'{code}:fire', '  return null;\n}\n// small-flame offsets', l)
    out = [f'# {PACK[code]} rooms — recipes of the culture pack (culture packs B, 2026-11-06)', '',
           f'The programs are data on the culture-room skeleton (tools/spawn-tuner/js/solver2.js blocks cb:solver2 and {code}:solver2); these slots are what the classic engine and the library shelves read.', '']
    for rid, slots in rc.R[code].items():
        out.append(f'### {rid} P2'); out += [f'- {k}: {v}' for k, v in slots.items()]; out.append('')
    f = f'catalog/rooms-culture-{PACK[code]}.md'; texts[f] = '\n'.join(out); log.append(f'write   {f} ({len(rc.R[code])} recipes)')
for l in log: print(l)
if bad: print('\nNOT APPLIED:'); [print('  ', b) for b in bad]; sys.exit(1)
if a.check: print('check only'); sys.exit(0)
for f, t in texts.items(): (ROOT / f).write_text(t)
print('applied', ' '.join(a.packs))
