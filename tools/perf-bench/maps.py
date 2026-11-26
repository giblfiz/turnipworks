"""The bench's three maps (2026-11-06), built by the bench itself through the game's own room tool (tw.spawnRoom), on
the bench's own relay. Never live data. Fixed seeds, so every machine and every run measures the same map.

  inn    a furnished two-storey inn: common room, kitchen, two guest rooms, a stable and a yard on the ground; a cellar
         under the kitchen; a guest room, a fine room and a hallway upstairs (10 rooms), three pawns in the yard
  town   about 100 rooms: the megamap town plan (experiments/2026-10-06-megamap/layout.py), a fixed cycle of seven
         buildings (inns, mansions, a crypt, a castle, a row of houses, a mansion wing), three of seven with upper
         storeys and four with rooms below ground; three pawns in the middle building's first room
  cave   hill country: grass, three hills (one a 20 ft terrace on another), three caves under the closed ground (so
         the underground shows faintly through it from above), a hut on the ground, three pawns
All coordinates are in 5-ft squares (x, z, w, d), heights in feet (y), as tw.spawnRoom takes them (a hill's y is its TOP).
"""
LOT, STREET = 16, 3
PITCH = LOT + STREET
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
CYCLE = [T_INN, T_MANSION, T_CRYPT, T_CASTLE, T_INN2, T_ROW, T_WING]
order = lambda tpl: sorted(tpl, key=lambda r: (r[5] > 0, abs(r[5])))  # ground first, then cellars, then upper storeys in order (an upper room must stand on something)


def spiral():
    x = z = 0; dx, dz = 1, 0; step = 1; yield (0, 0)
    while True:
        for _ in range(2):
            for _ in range(step): x += dx; z += dz; yield (x, z)
            dx, dz = -dz, dx
        step += 1


def town(n=100, origin=200):
    out = []; sp = spiral(); i = 0
    while len(out) < n:
        lx, lz = next(sp); tpl = CYCLE[i % len(CYCLE)]
        if len(out) + len(tpl) > n * 1.04 and len(out) >= n * 0.9: break
        ox, oz = origin + lx * PITCH, origin + lz * PITCH
        for j, (t, dx, dz, w, d, y) in enumerate(order(tpl)): out.append(('room', t, ox + dx, oz + dz, w, d, 9000 + i * 20 + j, y))
        i += 1
    return out


def plan(name):
    """-> {'steps': [('room', type, x, z, w, d, seed, y) | ('ground', cat)], 'pawns': [(x_ft, z_ft)], 'camera': {...}}"""
    if name == 'inn':
        steps = [('room', t, 2 + dx, 2 + dz, w, d, 7100 + j, y) for j, (t, dx, dz, w, d, y) in enumerate(order(T_INN2))]
        return {'steps': steps, 'pawns': [(67.5, 22.5), (72.5, 27.5), (77.5, 22.5)], 'camera': {'x': 50, 'z': 35, 'dist': 85, 'pitch': 55, 'yaw': 0}}  # (the pawns stand in the yard: open sky, nothing upstairs over them)
    if name == 'town':
        steps = town(100); o = 200 * 5
        return {'steps': steps, 'pawns': [(o + 12.5, o + 12.5), (o + 17.5, o + 17.5), (o + 22.5, o + 12.5)], 'camera': {'x': o + 40, 'z': o + 40, 'dist': 110, 'pitch': 55, 'yaw': 0}}
    if name == 'cave':
        steps = [('ground', 'floor-grass'),
                 ('room', 'hill', 2, 2, 8, 6, 8101, 10), ('room', 'hill', 3, 3, 4, 3, 8102, 20), ('room', 'hill', 16, 10, 6, 6, 8103, 10),
                 ('room', 'cave', 0, 12, 7, 5, 8201, -10), ('room', 'cave', 10, 0, 6, 6, 8202, -10), ('room', 'cave', 9, 9, 6, 7, 8203, -10),
                 ('room', 'common', 22, 1, 5, 4, 8301, 0)]
        return {'steps': steps, 'pawns': [(57.5, 32.5), (62.5, 37.5), (122.5, 17.5)], 'camera': {'x': 62, 'z': 45, 'dist': 110, 'pitch': 55, 'yaw': 0}}
    raise KeyError(name)


MAPS = ['inn', 'town', 'cave']
