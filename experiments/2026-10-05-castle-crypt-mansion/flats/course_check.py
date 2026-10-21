#!/usr/bin/env python3
"""Roofing: MEASURE that the courses close at the top/bottom seam. Finds the course lines (rows where the mean
row-to-row step peaks: the overlap shadow under each course) in the tile stacked on itself, and prints the spacing
between successive lines: the spacing that spans the seam must be like the others (a short or long one = a broken course).
    python3 course_check.py sku,..."""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage, signal
HERE = os.path.dirname(os.path.abspath(__file__))
for n in sys.argv[1].split(','):
    a = np.asarray(Image.open(f'{HERE}/seamless/{n}.png').convert('RGB')).astype(float); N = a.shape[0]
    lum = a.mean(axis=2); g = np.abs(np.diff(np.vstack([lum, lum, lum[:1]]), axis=0)).mean(axis=1); g = ndimage.gaussian_filter1d(g, 2, mode='wrap')
    C = {'roofing-thatch': 3, 'roofing-tile-clay': 6, 'roofing-slate': 8, 'roofing-shingle-wood': 6}[n.split('--')[0]]   # courses per tile
    pk, _ = signal.find_peaks(g, distance=int(N / C * 0.6), prominence=(g.max() - np.median(g)) * 0.25)
    sp = np.diff(pk); span = [int(s) for p, s in zip(pk[:-1], sp) if p < N <= p + s]
    one = pk[pk < N]; med = float(np.median(sp)) if len(sp) else 0
    print(f'{n}: {len(one)} course lines per tile at rows {one.tolist()}; spacings {sp[:len(one)].tolist()} px (median {med:.0f}); across the seam {span} px -> ' + ('closes' if span and abs(span[0] - med) <= 0.15 * med else 'CHECK'))
