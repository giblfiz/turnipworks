#!/usr/bin/env python3
"""Build the Import Lab's test fixture for the STL path (git-ignored binary; nothing to download).

  python3 prep/make_fixtures.py

Writes test/fixtures/bumpy-ball.stl: a subdivided icosahedron (5 levels, 20,480 triangles) with the same small bumps
as the page's built-in "Bumpy ball" (testShape in js/main.js), as a binary STL with no shared vertices, so the lab's
weld has real work to do. Generated here, so it is ours. (Until 2026-10-21 the fixture was a reduced Stanford Dragon;
it was replaced because the Stanford scans are not for commercial use.)
"""
import pathlib
import struct

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent.parent


def icosphere(levels):
    p = (1 + 5 ** 0.5) / 2
    v = [(-1, p, 0), (1, p, 0), (-1, -p, 0), (1, -p, 0), (0, -1, p), (0, 1, p), (0, -1, -p), (0, 1, -p),
         (p, 0, -1), (p, 0, 1), (-p, 0, -1), (-p, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
         (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
         (8, 6, 7), (9, 8, 1)]
    v = [np.array(x, float) / np.linalg.norm(x) for x in v]
    for _ in range(levels):
        mid, nf = {}, []
        def m(a, b):
            k = (min(a, b), max(a, b))
            if k not in mid:
                c = v[a] + v[b]; v.append(c / np.linalg.norm(c)); mid[k] = len(v) - 1
            return mid[k]
        for a, b, c in f:
            ab, bc, ca = m(a, b), m(b, c), m(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nf
    return np.array(v), np.array(f)


def bumpy(v):  # the same bump field as testShape('ball') in js/main.js
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    b = 1 + 0.035 * np.sin(x * 23) * np.sin(y * 23) * np.sin(z * 23) + 0.02 * np.sin(y * 61 + x * 7)
    return v * b[:, None]


def write_stl(path, v, t, label):
    tri = v[t].astype("<f4")
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-20)
    rec = np.zeros(len(t), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
    rec["n"], rec["v"] = n, tri
    with open(path, "wb") as f:
        f.write(label.encode().ljust(80, b" ")); f.write(struct.pack("<I", len(t))); f.write(rec.tobytes())


if __name__ == "__main__":
    v, t = icosphere(5)
    v = bumpy(v)
    out = HERE / "test/fixtures/bumpy-ball.stl"
    out.parent.mkdir(parents=True, exist_ok=True)
    write_stl(out, v, t, "turnip-works import-lab test fixture (generated bumpy ball)")
    print(out, len(v), "verts", len(t), "tris")
