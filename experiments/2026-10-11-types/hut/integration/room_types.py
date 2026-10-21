#!/usr/bin/env python3
"""The Farmstead's ROOM_TYPES block for tools/spawn-tuner/build_data.py: replaces the `# >>> type:hut` ... `# <<< type:hut` lines
(or inserts them before `]\\nSHELL`).   python3 room_types.py [tuner dir]"""
import pathlib, re, sys
HERE = pathlib.Path(__file__).resolve().parent
T = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parents[3] / "tools/spawn-tuner"
EARTH = ['floor-earth-packed', 'floor-earth-bare']
ROOMS = [
 ('hut-cottage', 'Cottage (one room)', 'generic', 'wattle-daub', [4, 4], ['floor-earth-packed', 'floor-planks-rushes', 'floor-flagstone-rushes', 'floor-boards-rough', 'floor-earth-straw'], ['hut-farm-cottage', 'hut-cottage', 'hut-peasant-supper', 'hut-supper'], '#b08a4f', {'wealth': 'poor'}),
 ('hut-kitchen', 'Farmhouse kitchen', 'generic', 'half-timber', [5, 4], ['floor-flagstone-irregular', 'floor-flagstone-rushes', 'floor-planks-worn', 'floor-brick-herringbone', 'floor-boards-rough', 'floor-terracotta'], ['hut-farm-kitchen', 'hut-kitchen-lived-in', 'hut-kitchen-shelf', 'hut-supper'], '#d38b3a', {}),
 ('hut-bedroom', 'Farmhouse bedroom', 'generic', 'wattle-daub', [3, 3], ['floor-planks-worn', 'floor-boards-rough', 'floor-planks-rushes', 'floor-planks-dark'], ['hut-farm-bedroom'], '#8fb35a', {}),
 ('hut-loft', 'Sleeping loft', 'generic', 'rough-timber', [4, 3], ['floor-boards-rough', 'floor-planks-worn', 'floor-planks-rushes'], ['hut-farm-loft'], '#a8a05a', {'wealth': 'poor'}),
 ('hut-passage', 'Cross-passage', 'generic', 'wattle-daub', [6, 2], ['floor-flagstone-irregular', 'floor-cobble', 'floor-earth-packed', 'floor-boards-rough', 'floor-flagstone-rushes'], ['hut-farm-passage'], '#c8b89a', {}),
 ('hut-cellar', 'Root cellar', 'generic', 'fieldstone', [3, 3], ['floor-earth-packed', 'floor-earth-bare', 'floor-flagstone-damp', 'floor-cobble'], ['hut-farm-root-cellar'], '#7d8a99', {}),
 ('hut-byre', 'Byre (cowshed)', 'generic', 'rough-timber', [5, 4], ['floor-earth-straw', 'floor-cobble', 'floor-earth-bare', 'floor-flagstone-broken', 'floor-boards-rough'], ['hut-farm-byre', 'hut-byre'], '#a8834f', {}),
 ('hut-coop', 'Chicken coop', 'generic', 'rough-timber', [3, 2], ['floor-earth-straw', 'floor-earth-bare', 'floor-boards-rough'], ['hut-farm-coop', 'hut-dairy-and-apiary'], '#c9a640', {}),
 ('hut-pigsty', 'Pigsty', 'outdoors', 'rough-timber', [4, 3], ['floor-earth-bare', 'floor-earth-packed', 'floor-earth-straw'], ['hut-farm-pigsty', 'hut-farmyard-pens'], '#9a7a6a', {'outdoor': True}),
 ('hut-barn', 'Hay barn', 'generic', 'rough-timber', [6, 5], ['floor-earth-straw', 'floor-earth-bare', 'floor-boards-rough', 'floor-cobble', 'floor-flagstone-large'], ['hut-farm-hay-barn', 'hut-barn-tools'], '#8a5a3a', {}),
 ('hut-granary', 'Granary & threshing floor', 'generic', 'rough-timber', [4, 4], ['floor-boards-rough', 'floor-planks-worn', 'floor-earth-packed', 'floor-flagstone-large'], ['hut-farm-granary', 'hut-barn-tools'], '#c7a35a', {}),
 ('hut-dairy', 'Dairy', 'generic', 'fieldstone', [3, 3], ['floor-flagstone-damp', 'floor-flagstone-square', 'floor-flagstone-irregular', 'floor-brick-herringbone', 'floor-tile-kitchen-small'], ['hut-farm-dairy', 'hut-dairy'], '#cfd6c4', {}),
 ('hut-garden', 'Vegetable garden', 'outdoors', 'half-timber', [5, 4], ['floor-earth-packed', 'floor-earth-bare', 'floor-grass-worn'], ['hut-farm-garden', 'hut-farmyard-tools'], '#7fb04f', {'outdoor': True}),
 ('hut-field', 'Field edge', 'outdoors', 'rough-timber', [8, 5], ['floor-field-furrows', 'floor-earth-bare'], ['hut-farm-field', 'hut-harvest-field', 'hut-fields'], '#b5894b', {'outdoor': True}),
 ('hut-orchard', 'Orchard corner', 'outdoors', 'rough-timber', [6, 5], ['floor-grass-meadow', 'floor-grass', 'floor-grass-worn'], ['hut-farm-orchard', 'hut-orchard-farmland'], '#5f9e55', {'outdoor': True}),
 ('hut-farmyard', 'Farmyard', 'outdoors', 'rough-timber', [6, 5], ['floor-earth-packed', 'floor-earth-bare', 'floor-cobble', 'floor-cobble-mossy', 'floor-grass-worn'], ['hut-farm-farmyard', 'hut-yard', 'hut-farmstead-grounds'], '#6fae5c', {'outdoor': True}),
]
HEAD = ("    # >>> type:hut  Farmstead (2026-10-11): sixteen rooms from the library as it stood (no new mesh, no exclusive tier); the cottage and\n"
        "    # the loft are wealth 'poor' (the type's default look), the farmhouse rooms 'common'; five are outdoor rooms; walls half-timber\n"
        "    # (wattle and daub), rough-timber and fieldstone, rolled per room (walls.js FAMILY_ODDS in the type:hut block).\n"
        "    # Source: experiments/2026-10-11-types/hut/integration/room_types.py\n")
def block():
    out = [HEAD]
    for k, l, prog, fam, cells, floors, rec, col, extra in ROOMS:
        out.append('    ' + repr({'key': k, 'label': l, 'program': prog, 'family': fam, 'cells': cells, 'floors': floors, 'recipes': rec, 'color': col, 'group': 'Farmstead', 'tiers': ['hut'], **extra}) + ',\n')
    out.append("    # <<< type:hut\n"); return ''.join(out)
if __name__ == '__main__':
    p = T / "build_data.py"; s = p.read_text(); pat = re.compile(r"    # >>> type:hut.*?    # <<< type:hut\n", re.S); anchor = ']\nSHELL = "any-shell"'
    if pat.search(s): s = pat.sub(lambda m: block(), s)
    else: assert s.count(anchor) == 1; s = s.replace(anchor, block() + anchor)
    p.write_text(s); print("build_data.py: type:hut block,", len(ROOMS), "rooms")
