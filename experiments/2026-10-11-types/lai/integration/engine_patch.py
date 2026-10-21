#!/usr/bin/env python3
"""The lair's engine-side edits, applied the same way every time (so a re-merge is one command). Each is a marked
`type:lai` line or block at an anchor no other type's block uses:
  engine/client/pack.js          the cave mouth and the two passages are never packed into a building's footprint
  engine/core/height.js          cut-rock takes a flat roof (the dungeon sets the same; whichever lands first)
  engine/test/core.test.mjs      the lair block, after the crypt's
  engine/test/browser_build.py   the LAIR block, before CASTLE
    python3 engine_patch.py --root <repo root> [--check]
"""
import argparse, pathlib, re, sys
ap = argparse.ArgumentParser(); ap.add_argument("--root", required=True); ap.add_argument("--check", action="store_true"); a = ap.parse_args()
R = pathlib.Path(a.root).resolve()
KEYS = ['lair-mouth', 'lair-passage', 'lair-warren', 'lair-beast', 'lair-spider', 'lair-larder', 'lair-pit', 'lair-hatchery', 'lair-trophy', 'lair-dragon']
CORE = """  { // type:lai  monster lair (2026-10-11): ten room types in cut-rock walls (the dungeon's family), no windows; the four dens share one skeleton
    const LAI = %s;
    for (const k of LAI) ok(rg.types.has(k), `the room engine knows ${k}`);
    const a = { id: 'room_rg0ldrag', type: 'lair-dragon', x: 200, z: 60, w: 8, d: 7, seed: 51 }, LD = rg.solve(t2.entities, a, 9);
    ok(LD.family === 'cut-rock' && LD.hash === rg.solve(t2.entities, a, 9).hash && LD.objects.some(o => o.rule === 'den-bed' && /^(treasure-hoard-heap|dun-treasure-hoard|coin-pile)$/.test(o.cat)), `a dragon's hoard solves, deterministically, the great heap for its bed (${LD.objects.length} objects)`);
    ok(LD.objects.filter(o => o.rule === 'den-hoard').length >= 4 && !LD.objects.some(o => /torch|brazier|lantern|candle/.test(o.cat)), 'the hoard rings the dragon\\'s hollow; the den is dark');
    const beds = { 'lair-spider': /^(web-funnel|egg-sacs-floor|eggs-monster|web-cocoon|rite-mummified-remains|bones-pile)$/, 'lair-beast': /^(nest-giant|nest-monster|hay-pile)$/ };
    for (const [k, re] of Object.entries(beds)) { const L = rg.solve({}, { id: 'room_rg0lden0', type: k, x: 200, z: 100, w: 6, d: 6, seed: 53 }, 3);
      ok(L.objects.some(o => o.rule === 'den-bed' && re.test(o.cat)) && L.objects.some(o => o.rule === 'den-feed') && L.objects.some(o => o.rule === 'den-sign'), `${k}: the same skeleton (bed, feeding spot, signs inside the door), its own dressing`, L.objects.length); }
    const wr = rg.solve({}, { id: 'room_rg0lwarr', type: 'lair-warren', x: 200, z: 140, w: 7, d: 6, seed: 55 }, 3);
    ok(wr.objects.some(o => o.rule === 'key-seat') && wr.objects.filter(o => o.rule === 'den-bed').length >= 2 && wr.objects.some(o => /torch/.test(o.cat)), 'the warren has the chieftain\\'s seat, beds and torches', wr.objects.length);
    const c = { id: 'room_rg0lpass', type: 'lair-passage', x: 200, z: 180, w: 8, d: 2, seed: 57 }, tc = applyArea(t2, 'room.spawn', { ...c, layout: rg.solve(t2.entities, c, 9) }), mine = [...rg.edges(tc.entities).edges.values()].filter(e => e.owner.room === c.id);
    ok(!mine.some(e => e.kind === 'window') && mine.filter(e => e.kind === 'door').length === 2, 'a lone cave passage has no windows and an opening at each end (the way on)', mine.filter(e => e.kind === 'door').length);
    for (const k of LAI.filter(k => k !== 'lair-mouth' && (k !== 'lair-hatchery' || rg.solve({}, { id: 'room_rg0lhatc', type: k, x: 0, z: 0, w: 5, d: 4, seed: 1 }, 1).objects.length))) { const r = { id: 'room_rg0laiilv', type: k, x: 240, z: 60, w: 6, d: 5, seed: 43, y: -10 }, L = rg.solve({}, r, 1), ys = L.objects.map(o => o.y || 0);
      ok(L.objects.length >= 4 && Math.min(...ys) >= -10 - 1e-6 && Math.max(...ys) < 0, `${k} below ground (y = -10): ${L.objects.length} things, all between its floor and its ceiling`, JSON.stringify([Math.min(...ys), Math.max(...ys)])); }
  }
""" % repr(KEYS).replace('"', "'")
BROWSER = """        print('LAIR')  # type:lai 2026-10-11: Fantasy -> Monster lair -> ten rooms, each with an icon and a library area
        la = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:LAI'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        LAI_KEYS = %s
        check(la and not la['disabled'] and all(any(r['key'] == k and r['things'] >= 3 for r in la['rooms']) for k in LAI_KEYS), 'Build menu: Fantasy -> Monster lair -> the 10 lair rooms, each with things for its library area', la)  # type:lai
""" % repr(KEYS)
BUILDING = """  // type:lai (2026-10-12). A lair is CARVED, one level, and it loops (a den's second door is its bolt hole). You arrive in the
  // warren (the tribe that keeps the way in); cave passages are the corridor; dens, larder and pit hang off them; the trophy
  // cave and the hatchery lie deep; the dragon's hoard is the reward, moved to the deepest dead end by the pacing rule, one
  // door. The cave mouth is the ground outside: drawn before the entrance, not laid by the carved solver (it has no outside).
  LAI: { label: 'Monster lair', full: 120, dials: { loops: 0.45, pacing: 0.8, carved: 1 }, storeys: { def: 1, min: 1, max: 2, why: 'a lair is one level of cave; a second goes down' }, down: true, corridor: 2,
    hub: { key: 'lair-warren', w: [5, 6, 8], d: [4, 5, 7], share: 0.12 }, hall: 'lair-passage', spare: 'lair-beast',
    rooms: [
      { key: 'lair-beast', set: [4, 6, 4, 6], w: [4, 5, 6], weight: 2, max: 2 },
      { key: 'lair-spider', set: [5, 6, 5, 6], w: [5, 6, 6], weight: 2, max: 1 },
      { key: 'lair-larder', set: [3, 4, 3, 4], w: [3, 4, 4], weight: 1, max: 1 },
      { key: 'lair-pit', set: [4, 5, 4, 5], w: [4, 5, 5], ends: true, weight: 1, max: 1 },
      { key: 'lair-trophy', set: [5, 7, 3, 3], w: [5, 6, 7], weight: 1, max: 1 },
      { key: 'lair-hatchery', set: [4, 5, 4, 5], w: [4, 5, 5], one: true, priv: true, weight: 1, max: 1 },
      { key: 'lair-dragon', set: [6, 8, 5, 7], w: [6, 7, 8], one: true, priv: true, reward: true, weight: 1, max: 1 },
    ] }, // type:lai end
"""
EDITS = [
    ("engine/client/pack.js", "const REPEAT = 'guest'; // a big inn has many guest rooms\n", "after",
     "for (const k of ['lair-mouth', 'lair-passage', 'lair-trophy']) APART.add(k); // type:lai: the ground before a lair and its passages are drawn (or laid by the layout generator), never packed as cells\n"),
    ("engine/core/height.js", "export const ROOF_DEFAULT = 'thatch';\n", "after",
     "ROOF_BY_FAMILY['cut-rock'] ??= 'flat'; // type:lai (2026-10-11): a lair is under rock; cut-rock is shared with the dungeon, which sets the same\n"),
    ("engine/test/core.test.mjs", "  { // castle (2026-10-06): nine room types;", "before", CORE),
    ("engine/test/browser_build.py", "        print('CASTLE')", "before", BROWSER),
    ("tools/spawn-tuner/js/buildings.js", "  // TYPES ARRIVING (their rooms land on other branches today)", "before", BUILDING),
]
for rel, anchor, where, text in EDITS:
    p = R / rel; s = p.read_text()
    if text in s: print(f"  already there  {rel}"); continue
    if "type:lai" in s:  # an older version of our block: drop its lines / block, then insert again
        if rel.endswith("core.test.mjs"): s = re.sub(r"  \{ // type:lai .*?\n  \}\n", "", s, flags=re.S)
        elif rel.endswith("buildings.js"): s = re.sub(r"  // type:lai \(2026.*?// type:lai end\n", "", s, flags=re.S)
        elif rel.endswith("browser_build.py"): s = re.sub(r"        print\('LAIR'\).*?# type:lai\n", "", s, flags=re.S)
        else: s = "".join(l for l in s.splitlines(keepends=True) if "type:lai" not in l)
    if s.count(anchor) != 1: sys.exit(f"{rel}: anchor not found exactly once: {anchor[:50]!r}")
    i = s.index(anchor) + (len(anchor) if where == "after" else 0)
    print(f"  {'would write' if a.check else 'written'}    {rel}")
    if not a.check: p.write_text(s[:i] + text + s[i:])
