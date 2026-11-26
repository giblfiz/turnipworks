#!/usr/bin/env python3
"""Review run `meshy-depth-1110` (2026-11-10): the 17 skus the Meshy batch gave up on at the size gate, plus cooling-unit
(passed the gate, reverted on a disputed "clips the wall" read), each as its SHIPPED mesh next to every Meshy attempt.
Presentation only: nothing here touches library.json or the game.

  build_review_depth.py   -> web/review-meshy-depth/{assets.json, meta.json, assets/models, assets/plates}
  then: REVIEW_SRC=web/review-meshy-depth REVIEW_KEEP_META=1 src/deploy_review.sh \
          /var/www/implausible-landing/projects/turnip-works/review-meshy-depth

Numbers are work/gate.json's (the gate scaled every mesh by the CATALOG object's largest side). Where the sku carries its
own size (the solver uses sku.size first: solver.js line 157), a second line gives the same mesh measured the way the game
would place it. Meshy meshes are the raw t25 GLBs the gate measured (USB meshy/); cooling-unit's re-plate also has the
runtime build that was dropped in and reverted (USB rejected-builds/)."""
import json, shutil, sys
from pathlib import Path
E = Path(__file__).resolve().parents[1]; R = E.parents[1]
sys.path.insert(0, str(E / 'tools')); from gate import glb_bounds, world  # noqa: E402
USB = Path('/mnt/usb/turnip-works/lanes-2026-11-10/meshy-batch')
OUT = R / 'web/review-meshy-depth'
RUN = 'meshy-depth-1110'
SKUS = ['bookshelf--fine--s1', 'bookshelf--fine--s2', 'bookshelf--fine--s3', 'bookshelf--arcane', 'bookshelf--arcane--s2',
        'bookcase-ladder', 'chn-bookcase', 'curio-shelf', 'alch-reagent-shelf-tall--s1', 'alch-reagent-shelf-tall--s2',
        'apothecary-drawers', 'apothecary-drawers--shop', 'cask-rack', 'cask-rack--s2', 'back-bar-shelves',
        'back-bar-shelves--s2', 'vending-machine', 'cooling-unit']
G = json.loads((E / 'work/gate.json').read_text())
T = json.loads((E / 'work/meshy-tasks.json').read_text())
L = json.loads((R / 'tools/spawn-tuner/data/library.json').read_text())['objects']
REC = {s['sku']: (o, s) for o in L.values() for s in o['skus']}
pc = lambda v: f"{v * 100:+.0f}%"


def ft_box(size):
    w, d, h = size
    return (w / 12, d / 12, h / 12)


def lines(g, rec_o, rec_s, glb, shipped=False):
    nW, nD, nH = g['shipped_WDH_ft'] if shipped else g['new_WDH_ft']
    sW, sD, sH = g['shipped_WDH_ft']; cW, cD = g['catalog_WD_ft']
    out = [f"W {nW:.2f} × D {nD:.2f} × H {nH:.2f} ft"]
    if not shipped:
        out.append(f"vs shipped ({sW:.2f}×{sD:.2f}×{sH:.2f}): W {pc(nW / sW - 1)}, D {pc(nD / sD - 1)}, H {pc(nH / sH - 1)}")
    out.append(f"vs catalog box ({cW:.2f}×{cD:.2f}): W {pc(nW / cW - 1)}, D {pc(nD / cD - 1)}")
    if not shipped:
        out.append(f"gate {'PASS' if g['pass_'] else 'FAIL'}: worst side {g['off_shipped'] * 100:.1f}% off shipped, "
                   f"{g['off_catalog'] * 100:.1f}% off catalog (pass = both W and D within 10% of either)")
    if rec_s.get('size') and rec_s['size'] != rec_o['size']:   # the game sizes this sku by its own box, not the object's
        sw, sd, sh = ft_box(rec_s['size']); W, D, H = world(glb_bounds(glb), (sw, sd, sh))
        out.append(f"in-game (sku box {max(sw, sd):.2f}×{min(sw, sd):.2f}×{sh:.2f}): W {W:.2f} × D {D:.2f} × H {H:.2f}, "
                   f"W {pc(W / max(sw, sd) - 1)}, D {pc(D / min(sw, sd) - 1)} vs that box")
    return out


def main():
    for sub in ('models', 'plates'):
        (OUT / 'assets' / sub).mkdir(parents=True, exist_ok=True)
    assets, meta, missing = [], {}, []
    for sku in SKUS:
        o, s = REC[sku]
        ship_glb = R / 'tools/spawn-tuner' / s['url']
        tries = [('shipped', 'shipped', ship_glb, None, G[sku]),
                 ('plate1', 'meshy plate 1', USB / f'meshy/{sku}--t25.glb', E / f'plates-ready/{sku}.png', G[sku]),
                 ('replate', 'meshy re-plate', USB / f'meshy/{sku}--r2--t25.glb', E / f'plates-ready/{sku}--r2.png', G.get(f'{sku}--r2'))]
        if sku == 'cooling-unit':
            tries.append(('replate-runtime', 'meshy re-plate, runtime build (dropped in, reverted)',
                          USB / 'rejected-builds/cooling-unit/assets/m/cooling-unit.glb', E / f'plates-ready/{sku}--r2.png', G[f'{sku}--r2']))
        for tag, label, glb, plate, g in tries:
            if not glb.exists() or g is None:
                missing.append(f'{sku} {label}: {glb}'); continue
            aid = f'{sku}~{tag}'
            shutil.copyfile(glb, OUT / f'assets/models/{aid}.glb')
            a = dict(sku=aid, group=sku, run=RUN, name=f'{sku} · {label}', priority=tag, material=s.get('tier') or o.get('id', ''),
                     placement=s['src'], rooms='', model=f'assets/models/{aid}.glb', bytes=glb.stat().st_size)
            if plate and plate.exists():
                shutil.copyfile(plate, OUT / f'assets/plates/{aid}.png'); a['plate'] = f'assets/plates/{aid}.png'
            else:
                a['plate'] = False
            a['hint'] = ' · '.join(lines(g, o, s, glb, shipped=tag == 'shipped'))
            if tag == 'replate-runtime':   # the gate measured the raw re-plate; this is the prepped file the game loaded
                W, D, H = world(glb_bounds(glb), ft_box(o['size']))
                a['hint'] = f'this runtime file measures W {W:.2f} × D {D:.2f} × H {H:.2f} ft; gate figures for its raw source: ' + a['hint']
            assets.append(a)
            tk = T.get(f"{sku}{'--r2' if tag.startswith('replate') else ''}--t25", {})
            meta[aid] = dict(domain='Meshy depth check', role=sku, themes=[],
                             gen=__import__('time').strftime('%Y-%m-%dT%H:%M-08:00', __import__('time').localtime(tk['submitted'])) if tk.get('submitted') else None)
    payload = dict(run=RUN, label='Meshy depth 11-10', complete=len(assets), expectedMeshes=len(assets), flatAssets=0, assets=assets)
    (OUT / 'assets.json').write_text(json.dumps(payload, indent=1, ensure_ascii=False))
    (OUT / 'meta.json').write_text(json.dumps(dict(settings={}, assets=meta), indent=1, ensure_ascii=False))
    import subprocess; subprocess.run(['chmod', '-R', 'o+rX', str(OUT)], check=True)   # nginx reads it through the symlink
    print(f'{len(assets)} assets over {len(SKUS)} skus -> {OUT}')
    for m in missing: print('MISSING', m)


if __name__ == '__main__':
    main()
