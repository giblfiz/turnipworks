#!/usr/bin/env python3
"""Pixel difference of one scene between variants of the page's address (same campaign, same camera).
  pixdiff.py <scene> <tag> name=extra name=extra ...   e.g.  old='&nodelivery&imgtex' new=''   (each also with &nofx)
Each variant is shot twice per camera in separate cold browsers ('.a', '.b'): a variant against ITSELF is the noise floor.
-> /var/tmp/tw-delivery/out/<TW_AC_TAG>/pix-<scene>-<tag>.json + PNGs"""
import json, sys, time, itertools, numpy as np, ac
from PIL import Image
from playwright.sync_api import sync_playwright
mm = ac.mm
name, tag = sys.argv[1], sys.argv[2]; variants = [a.split('=', 1) for a in sys.argv[3:]]
x, z, d = ac.CAMS[name]; CAMS = {'table': (x, z, 110 if name != 'room' else 60, 55, 0), 'lean': (x, z, 40 if name != 'room' else 28, 55, 30), 'low': (x, z, 22, 28, 200)}
import os
FX = [f for f in [('nofx', '&nofx'), ('look', '')] if f[0] in os.environ.get('PIX_FX', 'nofx,look')]
shots = {}
def shoot(p, vname, extra, fxname, fxq, rep):
    S = ac.open_scene(p, name, wrap=False, uncapped=False, extra=extra + fxq); pg = S['pg']
    mm.wait_settled(pg, timeout=900); mm.wait_seated(pg, timeout=600); pg.wait_for_timeout(1500)
    info = pg.evaluate("(() => { const L = tw.assets.look, g = [...L.glbCache.keys()]; return { glb: g.length, tex: tw.T?.look?.textureStats || null }; })()")
    for cam, c in CAMS.items():
        pg.evaluate(mm.cam_js(c[0], c[1], c[2], c[3], c[4])); pg.wait_for_timeout(1200)
        f = f'{ac.OUT}/pix-{name}-{tag}-{vname}-{fxname}-{cam}.{rep}.png'; pg.screenshot(path=f); shots[(vname, fxname, cam, rep)] = f
    errs = S['errors'][:5]; S['browser'].close(); return {**info, 'page_errors': errs}
def diff(a, b):
    A = np.asarray(Image.open(a).convert('RGB')).astype(np.int16); B = np.asarray(Image.open(b).convert('RGB')).astype(np.int16); D = np.abs(A - B).max(axis=2)
    return {'mean': round(float(D.mean()), 3), 'max': int(D.max()), 'pct_over_8': round(float((D > 8).mean() * 100), 3), 'pct_over_16': round(float((D > 16).mean() * 100), 3), 'pct_over_32': round(float((D > 32).mean() * 100), 3)}
out = {'scene': name, 'variants': dict(variants), 'info': {}, 'diff': {}}
with sync_playwright() as p:
    for fxname, fxq in FX:
        for rep in ('a', 'b'):
            for vname, extra in variants: out['info'][f'{vname}/{fxname}/{rep}'] = shoot(p, vname, extra, fxname, fxq, rep)
for fxname, _ in FX:
    for cam in CAMS:
        for vname, _ in variants: out['diff'][f'{fxname} {cam}: {vname} vs itself (noise)'] = diff(shots[(vname, fxname, cam, 'a')], shots[(vname, fxname, cam, 'b')])
        for (va, _), (vb, _) in itertools.combinations(variants, 2): out['diff'][f'{fxname} {cam}: {va} vs {vb}'] = diff(shots[(va, fxname, cam, 'a')], shots[(vb, fxname, cam, 'a')])
json.dump(out, open(f'{ac.OUT}/pix-{name}-{tag}.json', 'w'), indent=1)
for k, v in out['info'].items(): print(k, v)
for k, v in out['diff'].items(): print(k.ljust(48), v)
