# search placement rules H at (x,y) if (a*x+b*y) % m == r1, V if == r2, exact cover on an n x n torus, herringbone-like
n = 8
def check(H, V):
    cells = {}
    for i, (d, x, y) in enumerate([('H', *p) for p in H] + [('V', *p) for p in V]):
        for c in ((x, y), ((x + 1) % n, y) if d == 'H' else (x, (y + 1) % n)):
            if c in cells: return None
            cells[c] = (i, d)
    if len(cells) != n * n: return None
    for (x, y), (i, d) in cells.items():
        pass
    # no H stacked exactly on H, no V side by side with V
    for (x, y) in H:
        for dy in (1, -1):
            a, b = cells[(x, (y + dy) % n)], cells[((x + 1) % n, (y + dy) % n)]
            if a == b and a[1] == 'H': return None
    for (x, y) in V:
        for dx in (1, -1):
            a, b = cells[((x + dx) % n, y)], cells[((x + dx) % n, (y + 1) % n)]
            if a == b and a[1] == 'V': return None
    return cells
for m in (4, 8):
    for a in range(m):
        for b in range(m):
            for r1 in range(m):
                for r2 in range(m):
                    if r1 == r2: continue
                    H = [(x, y) for x in range(n) for y in range(n) if (a * x + b * y) % m == r1]
                    V = [(x, y) for x in range(n) for y in range(n) if (a * x + b * y) % m == r2]
                    if len(H) != len(V) or len(H) * 4 != n * n: continue
                    c = check(H, V)
                    if c:
                        print('rule', a, b, m, r1, r2)
                        g = [[' '] * n for _ in range(n)]
                        for (x, y), (i, d) in c.items(): g[y][x] = '-' if d == 'H' else '|'
                        print('\n'.join(''.join(r) for r in g)); raise SystemExit
print('none')
