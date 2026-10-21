#!/usr/bin/env python3
"""DRAFT, not applied: the game's Build tray (Genre -> Type -> Room) for crypt, castle and mansion.

WHAT THE TRAY NEEDS, AND WHERE IT COMES FROM (nothing in engine/client is edited for a room to appear):
  types    engine/client/data/types.json, written by engine/tools/build_types.py (run by engine/deploy.sh) from
           catalog/out/by-setting/*.txt. CRY, CAS and NOB are already there with painted icons (type-CRY.png ...).
           A type is greyed out ("no room recipes yet") until a room joins it.
  rooms    engine/client/taxonomy.js joins a room type of the TUNER's data/rooms.json to every type whose code is the
           prefix of one of the room's `recipes` (cry-..., cas-..., nob-...). So a room appears the moment the tuner is
           deployed with the new ROOM_TYPES: the tray entry is the build_data.py hunk, not an engine edit.
           -> a recipe borrowed from another type (tav-kitchen on the mansion kitchen) would ALSO list the room under
              that type and let the inn's building tool pack it: room_types.py moves those to `borrow` (slots only).
           -> a room with no recipe of its own type's prefix is NOT listed under it: castle `chapel` (all tem-) and
              `dungeon` (all dun-) need a cas- recipe in catalog/rooms-castle.md.
  icons    engine/client/data/icons/room-<room key>.png, 64-px painted tile. engine/test/browser_build.py (ICONS) fails
           for any room without one. Copy from B/flats/icons/ (new files only).
  library  the room's "library area" in the PiP is built from the room's recipe slots (taxonomy.js furniture / objects,
           library.js sections anchor / furnish / store / light / dress / plants): automatic.
  hotkeys  assigned per sibling list from the label's letters: automatic.
THE ONLY EDITS:
  1. engine/tools/build_types.py LABELS: 'NOB': 'Manor' -> 'Mansion' (Harry asked for "mansion"); optional.   [PATCH below]
  2. engine/client/pack.js (the building tool): APART must list the rooms that are never packed INSIDE a building
     (outdoor rooms and corridors), else a dragged Castle gets its courtyard as an indoor cell.               [PATCH below]
  3. engine/test/core.test.mjs + browser_build.py: one block per type, modelled on the yard's (TESTS below).

    python3 build_types_patch.py --check <tuner dir> [--icons DIR ...]     what the tray will show, from that tuner's rooms.json
"""
import json, pathlib, re, sys
HERE = pathlib.Path(__file__).resolve().parent; B = HERE.parent; ROOT = B.parents[1]

LABELS_PATCH = ("    'TAV': 'Tavern & inn', 'NOB': 'Manor', 'CAS': 'Castle',", "    'TAV': 'Tavern & inn', 'NOB': 'Mansion', 'CAS': 'Castle',")
PACK_PATCH = (
    "const APART = new Set(['stable', 'barn', 'cellar', 'hallway', 'yard']); // (a yard is open ground beside the building, never a room inside it)",
    "const APART = new Set(['stable', 'barn', 'cellar', 'hallway', 'yard', // (a yard is open ground beside the building, never a room inside it)\n"
    "  'crypt-catacomb', 'courtyard', 'gatehouse', 'mansion-garden', 'mansion-cellar', 'mansion-conservatory']); // corridors, courts and gardens, the gate, what lies under or beside the house")
# what a building of each type needs first (pack.js PRIORITY is the inn's list; other types fall back to recipe order =
# the order of ROOM_TYPES, which is why room_types.py keeps the designers' order: the important rooms come first)
CORE_TEST = r"""
  { // crypt (2026-10-05): seven room types, crypt-stone walls, no windows; a room solves, deterministically, and is lit
    for (const k of ['crypt-antechamber', 'crypt-vault', 'crypt-ossuary', 'crypt-catacomb', 'crypt-chapel', 'crypt-embalming', 'crypt-relic']) ok(rg.types.has(k), `the room engine knows ${k}`);
    const a = { id: 'room_rg0crypt', type: 'crypt-chapel', x: 40, z: 0, w: 4, d: 5, seed: 21 }, LC = rg.solve(t2.entities, a, 9);
    const tc = applyArea(t2, 'room.spawn', { ...a, layout: LC }), EC = rg.edges(tc.entities), mine = [...EC.edges.values()].filter(e => e.owner.room === a.id);
    ok(LC.family === 'crypt-stone' && LC.hash === rg.solve(t2.entities, a, 9).hash, `a crypt chapel solves, deterministically (${LC.objects.length} objects)`);
    ok(LC.objects.some(o => o.cat === 'altar-stone') && LC.objects.some(o => /torch|candle|lamp/.test(o.cat)), 'the chapel has its altar and a light');
    ok(!mine.some(e => e.kind === 'window') && mine.some(e => e.kind === 'door' && /^(crypt-gate-iron|door-crypt)$/.test(e.doorType)), 'crypt walls have no windows; its door is the iron gate');
    ok(rg.families.includes('crypt-stone'), 'crypt-stone is in the wall family list');
  }
"""
BROWSER_TEST = r"""
        print('CRYPT')  # 2026-10-05: Fantasy -> Crypt & tomb -> seven rooms, each with a painted icon and a library area
        cn = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:CRY'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(cn and not cn['disabled'] and len(cn['rooms']) == 7 and all(r['things'] >= 6 and r['hot'] for r in cn['rooms']), 'Build menu: Fantasy -> Crypt & tomb -> 7 rooms, each with things for its library area and a hotkey', cn)
        inn = await gm.evaluate("tw.taxonomy.get('t:TAV').children.map(id => tw.taxonomy.get(id).roomKey)")
        check(not any(k.startswith(('crypt-', 'mansion-', 'castle-')) or k in ('chapel', 'dungeon', 'barracks') for k in inn), 'no crypt, castle or mansion room is listed under Tavern & inn', inn)
"""

def check(tuner, icon_dirs):
    rooms = json.loads((pathlib.Path(tuner) / "data/rooms.json").read_text())
    types = json.loads((ROOT / "engine/client/data/types.json").read_text())["types"]
    icons = set()
    for d in [ROOT / "engine/client/data/icons", B / "flats/icons", *map(pathlib.Path, icon_dirs)]:
        icons |= {p.stem for p in d.glob("*.png")} if d.exists() else set()
    new = [r for r in rooms if r.get("group")]
    print(f"{len(rooms)} room types in {tuner}, {len(new)} of them new")
    for t in types:
        mine = [r for r in rooms if any(x.startswith(t["code"].lower() + "-") for x in r.get("recipes", []))]
        if not any(r.get("group") for r in mine): continue
        print(f"\n{t['label']} ({t['code']}), type icon {'ok' if 'type-' + t['code'] in icons else 'MISSING'}: {len(mine)} rooms")
        for r in mine:
            foreign = "" if (r.get("group") or "Inn")[:3].upper() in (t["code"], {"CRY": "CRY", "CAS": "CAS", "NOB": "MAN"}.get(t["code"], "")) or (t["code"] == "TAV" and not r.get("group")) else f"   <- a {r.get('group') or 'inn'} room listed here (symlink by recipe prefix)"
            things = sum(len(v) for k, v in r["slots"].items() if k != "sets")
            print(f"   {r['key']:22s} {r['label']:24s} {r['cells'][0]}x{r['cells'][1]}  {things:3d} things  icon {'ok' if 'room-' + r['key'] in icons else 'MISSING room-' + r['key'] + '.png'}{foreign}")
    code = {"Crypt": "cry", "Castle": "cas", "Mansion": "nob"}
    lost = [r["key"] for r in new if not any(x.startswith(code.get(r["group"], "?") + "-") for x in r["recipes"])]
    if lost: print(f"\nNOT under their own type (no recipe with its prefix): {', '.join(lost)}")

if __name__ == "__main__":
    if "--check" in sys.argv:
        i = sys.argv.index("--check"); check(sys.argv[i + 1], [a for a in sys.argv[i + 2:] if not a.startswith("--")])
    else: print(__doc__)
