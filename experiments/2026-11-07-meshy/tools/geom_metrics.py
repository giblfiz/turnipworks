#!/usr/bin/env python3
"""Geometry numbers for every candidate, measured on the IN-GAME geometry (assets/lod/f10000, what the table draws) and
on the source GLB. axis_share: the share of surface area whose normal lies within 8 degrees of a box axis (straight
shelves, flat rack fronts and posts score high; melted or lumpy surfaces score low). shells_1pct: loose pieces holding
more than 1% of the area. Run with the browser venv's python (trimesh).
  python geom_metrics.py OUT.json
"""
import json, sys
from pathlib import Path
import numpy as np, trimesh

TU = Path(__file__).resolve().parents[3] / 'tools/spawn-tuner'
U = Path('/mnt/usb/turnip-works/lanes-2026-11-07/meshy')
SUBJ = ['store-shelving', 'server-rack', 'drinks-cooler', 'fence-chain-link', 'pallet-racking', 'antenna-mast']
SRC = {'tr2': lambda s: U / f'trellis/{s}--tr2.glb', 'mx7': lambda s: U / f'meshy/{s}--m7.glb', 'mxt': lambda s: U / f'meshy/{s}--t25.glb',
       'cur': lambda s: U / f'trellis/{s}--shipped-src.glb'}


def one(path):
    m = trimesh.load(path, force='mesh', process=True)
    m = trimesh.Trimesh(vertices=m.vertices, faces=m.faces, process=False); m.merge_vertices(digits_vertex=5)  # positions only: UV seams are not holes
    n = m.face_normals; a = m.area_faces; A = a.sum()
    ax = np.abs(n).max(axis=1) >= np.cos(np.radians(8))
    lab = trimesh.graph.connected_component_labels(m.face_adjacency, node_count=len(m.faces))
    area_by = np.bincount(lab, weights=a)
    big = int((area_by > 0.01 * A).sum())
    return dict(tris=int(len(m.faces)), axis_share=round(float(a[ax].sum() / A), 3), shells=int(len(area_by)), shells_1pct=big,
                open_edge_share=round(float((np.bincount(m.edges_unique_inverse) == 1).mean()), 3), nonmanifold_edges=int((np.bincount(m.edges_unique_inverse) > 2).sum()),
                bytes=path.stat().st_size)


out = {}
for s in SUBJ:
    for v in ['cur', 'tr2', 'mx7', 'mxt']:
        sku = s if v == 'cur' else f'{s}--{v}'
        rec = {}
        g = TU / f'assets/lod/f10000/{sku}.glb'
        if g.exists(): rec['game'] = one(g.resolve())
        src = SRC[v](s)
        if src.exists(): rec['src'] = one(src)
        rt = TU / f'assets/m/{sku}.glb'; tx = TU / f'assets/tex/t256/{sku}.webp'
        rec['runtime_glb_bytes'] = rt.resolve().stat().st_size if rt.exists() else None
        rec['lod10k_bytes'] = g.resolve().stat().st_size if g.exists() else None
        rec['tex256_bytes'] = tx.resolve().stat().st_size if tx.exists() else None
        out[f'{s}|{v}'] = rec
        print(s, v, json.dumps(rec), flush=True)
json.dump(out, open(sys.argv[1], 'w'), indent=1)
