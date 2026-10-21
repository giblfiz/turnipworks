#!/usr/bin/env python3
"""Tier (e): 20k triangles with the original's fine shape BAKED into a normal map, made by the project's Import Lab
exactly as a player's import would be (meshoptimizer simplify, box unwrap, bake by ray-casting to the original with
three-mesh-bvh), run headless in Chromium against the live Import Lab page. Nothing is uploaded: the page converts in
the browser and this script saves the GLB it offers for download.
    browser-venv/bin/python bake_tier.py [ids...]      -> tier/<id>--20kbake.glb and tier/bake-stats.json"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent
LAB = 'https://implausible.enterprises/projects/turnip-works/import-lab/'
ids = sys.argv[1:] or ['fig-fighter', 'fig-wizard', 'fig-goblin', 'fig-wolf', 'fig-goblin-b', 'fig-wolf-b']
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
IDLE = "window.__lab && window.__lab.current && !window.__lab.busy && window.__lab.current.key === `${window.__lab.S.budget}|${window.__lab.S.bake ? window.__lab.S.tex : 0}`"
sf = HERE / 'tier/bake-stats.json'; stats = json.loads(sf.read_text()) if sf.exists() else {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS)
    for i in ids:
        pg = b.new_page(viewport={'width': 1680, 'height': 950}, accept_downloads=True); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto(LAB + '?capture=1&sample=cube&budget=5000'); pg.wait_for_function(IDLE, timeout=180000)
        src = HERE / 'fal-trellis2/models' / f'{i}.glb'
        pg.set_input_files('#file', str(src)); pg.wait_for_function(f"window.__lab.model && window.__lab.model.name === '{src.name}' && window.__lab.current && !window.__lab.busy", timeout=300000)
        pg.click('#budget button[data-v="20000"]'); pg.wait_for_function(IDLE, timeout=300000)
        if not pg.evaluate('window.__lab.S.bake'): pg.click('#bake'); pg.wait_for_function(IDLE, timeout=300000)
        if str(pg.evaluate('window.__lab.S.tex')) != '1024': pg.click('#tex button[data-v="1024"]'); pg.wait_for_function(IDLE, timeout=300000)
        t0 = time.time()
        with pg.expect_download(timeout=120000) as dl: pg.click('#download')
        out = HERE / 'tier' / f'{i}--20kbake.glb'; dl.value.save_as(str(out))
        st = pg.evaluate('JSON.parse(JSON.stringify(window.__lab.current.stats))'); st['S'] = pg.evaluate('({budget: window.__lab.S.budget, bake: window.__lab.S.bake, tex: window.__lab.S.tex, up: window.__lab.S.up})'); st['bytes'] = out.stat().st_size; st['readout'] = pg.inner_text('#readout')[:600]
        stats[i] = st; print(i, out.stat().st_size, json.dumps({k: v for k, v in st.items() if k != 'readout'})[:500], errs[:2], flush=True)
        pg.close()
    b.close()
sf.write_text(json.dumps(stats, indent=1) + '\n')
