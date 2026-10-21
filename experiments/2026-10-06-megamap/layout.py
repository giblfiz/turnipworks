"""The megamap ladder's town plan: deterministic, in 5-ft cells.  (2026-10-06)

A town is a square-ish grid of lots (16 x 16 cells = 80 x 80 ft) with 15-ft streets between them. Each lot takes one
building from a fixed cycle of seven templates, so the mix is the same at every size:
  inn (flat, with a yard) · mansion (three storeys, cellar, garden) · crypt (mostly below ground) · castle (two storeys,
  dungeon, courtyard) · inn (two storeys, cellar, yard) · small houses row (flat) · mansion wing (flat, garden)
3 of the 7 templates have upper storeys (43% of buildings; asked: "about a third"), 4 of 7 have rooms below ground.
rooms(n) returns the first buildings of the spiral that hold about n rooms: [(type, x, z, w, d, seed, y, lot_index)].
"""
LOT, STREET = 16, 3
PITCH = LOT + STREET
# (type, dx, dz, w, d, y_feet)
T_INN = [('common', 0, 0, 6, 5, 0), ('kitchen', 6, 0, 4, 5, 0), ('guest', 0, 5, 5, 4, 0), ('guest', 5, 5, 5, 4, 0), ('yard', 10, 0, 6, 9, 0)]
T_INN2 = T_INN + [('cellar', 6, 0, 4, 5, -10), ('guest', 0, 5, 5, 4, 10), ('fine', 5, 5, 5, 4, 10), ('hallway', 0, 0, 6, 5, 10), ('stable', 0, 9, 6, 4, 0)]
T_MANSION = [('mansion-hall', 0, 0, 5, 6, 0), ('mansion-drawing', 5, 0, 5, 4, 0), ('mansion-dining', 10, 0, 6, 4, 0), ('mansion-library', 5, 4, 4, 4, 0),
             ('mansion-kitchen', 9, 4, 6, 5, 0), ('mansion-garden', 0, 9, 9, 6, 0), ('mansion-cellar', 5, 0, 5, 4, -10),
             ('mansion-bedroom', 5, 0, 5, 4, 10), ('mansion-ballroom', 10, 0, 6, 4, 10), ('mansion-bedroom', 5, 0, 5, 4, 20)]
T_CRYPT = [('crypt-antechamber', 0, 0, 4, 3, 0), ('crypt-chapel', 4, 0, 4, 7, 0), ('crypt-embalming', 8, 0, 4, 4, 0),
           ('crypt-vault', 0, 0, 5, 4, -10), ('crypt-ossuary', 5, 0, 4, 4, -10), ('crypt-catacomb', 0, 4, 10, 3, -10), ('crypt-relic', 9, 0, 3, 3, -10)]
T_CASTLE = [('great-hall', 0, 0, 10, 6, 0), ('throne-room', 10, 0, 5, 8, 0), ('armoury', 0, 6, 4, 4, 0), ('barracks', 4, 6, 6, 5, 0),
            ('gatehouse', 10, 8, 3, 5, 0), ('courtyard', 0, 11, 10, 5, 0), ('dungeon', 0, 0, 6, 5, -10), ('chapel', 10, 0, 5, 8, 10), ('castle-kitchen', 4, 6, 6, 5, 10)]
T_ROW = [('guest', 0, 0, 4, 4, 0), ('kitchen', 4, 0, 4, 4, 0), ('storeroom', 8, 0, 3, 4, 0), ('privy', 11, 0, 2, 2, 0), ('yard', 0, 4, 8, 6, 0), ('barn', 8, 4, 6, 5, 0)]
T_WING = [('mansion-conservatory', 0, 0, 5, 4, 0), ('mansion-library', 5, 0, 4, 4, 0), ('mansion-drawing', 9, 0, 5, 4, 0), ('mansion-garden', 0, 4, 7, 6, 0), ('desk', 7, 4, 3, 3, 0)]
CYCLE = [('inn', T_INN), ('mansion', T_MANSION), ('crypt', T_CRYPT), ('castle', T_CASTLE), ('inn2', T_INN2), ('row', T_ROW), ('wing', T_WING)]

def spiral():
    """lot coordinates from the middle outward, so every size is a compact town around the same centre"""
    x = z = 0; dx, dz = 1, 0; step = 1; yield (0, 0)
    while True:
        for _ in range(2):
            for _ in range(step): x += dx; z += dz; yield (x, z)
            dx, dz = -dz, dx
        step += 1

def rooms(n, origin=200):
    """about n rooms; origin (cells) keeps every coordinate positive"""
    out = []; sp = spiral(); i = 0; lots = []
    while len(out) < n:
        lx, lz = next(sp); name, tpl = CYCLE[i % len(CYCLE)]
        if len(out) + len(tpl) > n * 1.04 and len(out) >= n * 0.9: break
        ox, oz = origin + lx * PITCH, origin + lz * PITCH
        # ground rooms first, then cellars, then upper storeys in order (an upper room must stand on something)
        for j, (t, dx, dz, w, d, y) in enumerate(sorted(tpl, key=lambda r: (r[5] > 0, abs(r[5])))):
            out.append((t, ox + dx, oz + dz, w, d, 9000 + i * 20 + j, y, i))
        lots.append({'i': i, 'name': name, 'lot': [lx, lz], 'x': ox * 5, 'z': oz * 5}); i += 1
    return out, lots

def extent(rs):
    x0 = min(r[1] for r in rs) * 5; x1 = max(r[1] + r[3] for r in rs) * 5; z0 = min(r[2] for r in rs) * 5; z1 = max(r[2] + r[4] for r in rs) * 5
    return {'x0': x0, 'x1': x1, 'z0': z0, 'z1': z1, 'cx': (x0 + x1) / 2, 'cz': (z0 + z1) / 2, 'w': x1 - x0, 'd': z1 - z0}

if __name__ == '__main__':
    for n in (10, 25, 50, 100, 200, 400, 800):
        rs, lots = rooms(n); e = extent(rs)
        print(n, len(rs), 'rooms', len(lots), 'buildings', f"{e['w']:.0f} x {e['d']:.0f} ft", 'upper', sum(r[6] > 0 for r in rs), 'below', sum(r[6] < 0 for r in rs))
