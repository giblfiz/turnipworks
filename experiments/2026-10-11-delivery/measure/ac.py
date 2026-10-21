"""Shared pieces of the asset-cost measurement (2026-10-11). Reuses the megamap harness (local relay + static client on
ports 18222 / 18849, GPU Chromium). Nothing here touches the live relay. Bulk output: /var/tmp/tw-asset-cost/out.
  stack:   python3 ac.py stack          (keeps a local relay + client server up; data in /var/tmp/tw-asset-cost/relay-data)
  scenes:  python3 ac.py build          (builds the test scenes through the relay's GET API; tokens -> /var/tmp/tw-asset-cost/scenes.json)
"""
import json, os, sys, time, urllib.parse, urllib.request
os.environ.setdefault('TW_MM_PORTS', '18232,18859')
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.environ.get('TW_MM_REPO') or '<repo>'
sys.path.insert(0, os.path.join(REPO, 'experiments', '2026-10-06-megamap'))
import mm, layout  # noqa
OUT = '/var/tmp/tw-delivery/out/' + os.environ.get('TW_AC_TAG', 'run'); os.makedirs(OUT, exist_ok=True); DATA = os.environ.get('TW_AC_DATA', '/var/tmp/tw-delivery/relay-data'); SCENES = '/var/tmp/tw-delivery/scenes.json'
R = mm.RELAY
def get(url, timeout=600): return json.loads(urllib.request.urlopen(url, timeout=timeout).read())
def scenes(): return json.load(open(SCENES)) if os.path.exists(SCENES) else {}

# (type, x, z, w, d, seed, y) in 5-ft cells
O = 200
def tpl(t, seed0=9100): return [(ty, O + dx, O + dz, w, d, seed0 + j, y) for j, (ty, dx, dz, w, d, y) in enumerate(sorted(t, key=lambda r: (r[5] > 0, abs(r[5]))))]
SCENE_DEFS = {
    'room': [('common', O, O, 6, 5, 9100, 0)],                 # one inn common room
    'inn': tpl(layout.T_INN2),                                   # a whole inn: two storeys, cellar, yard, stable (10 rooms)
    'mansion': tpl(layout.T_MANSION, 9300),                      # three storeys + cellar + garden (10 rooms)
    'town': [r[:7] for r in layout.rooms(200)[0]],               # the megamap's 203-room town
}
FIGS = ['hero-fighter-dragonborn-m', 'hero-bard-dragonborn-f', 'foe-goblin-club', 'foe-owlbear', 'beast-dog', 'foe-skeleton-sword']

def build(names):
    sc = scenes()
    for n in names:
        rs = SCENE_DEFS[n]; name = f'TEST asset-cost {n} (throwaway)'
        c = json.loads(urllib.request.urlopen(urllib.request.Request(f'{R}/campaigns', data=json.dumps({'name': name, 'gm': 'Fauna-assetcost'}).encode(), method='POST')).read())
        base = f"{R}/c/{c['campaign']}/a/{c['area']}/do"; tok = c['token']; failed = []; t0 = time.time()
        for i, r in enumerate(rs):
            q = {'cmd': 'room.spawn', 'type': r[0], 'x': r[1] * 5, 'z': r[2] * 5, 'w': r[3] * 5, 'd': r[4] * 5, 'seed': r[5], 'nonce': f'ac-{n}-{i}', 'seat': tok}
            if r[6]: q['y'] = r[6]
            try:
                res = get(base + '?' + urllib.parse.urlencode(q))
                if not res.get('ok'): failed.append([i, r[0], str(res)[:160]])
            except Exception as e: failed.append([i, r[0], str(e)[:160] + (e.read().decode()[:160] if hasattr(e, 'read') else '')])
        figs = []
        if n in ('room', 'inn'):
            for k, f in enumerate(FIGS):
                try:
                    res = get(base + '?' + urllib.parse.urlencode({'cmd': 'token.create', 'fig': f, 'x': (O + 1 + k % 3) * 5 + 2.5, 'z': (O + 1 + k // 3) * 5 + 2.5, 'nonce': f'ac-{n}-f{k}', 'seat': tok}))
                    figs.append([f, bool(res.get('ok')), str(res)[:200] if not res.get('ok') else ''])
                except Exception as e: figs.append([f, False, (e.read().decode()[:300] if hasattr(e, 'read') else str(e))])
        ext = layout.extent([(r[0], r[1], r[2], r[3], r[4]) for r in rs])
        sc[n] = {'token': tok, 'campaign': c['campaign'], 'area': c['area'], 'rooms': len(rs), 'failed': failed, 'figs': figs, 'extent': ext, 'build_s': round(time.time() - t0, 1)}
        print(n, json.dumps({k: v for k, v in sc[n].items() if k != 'token'})[:600], flush=True)
    json.dump(sc, open(SCENES, 'w'), indent=1)

if __name__ == '__main__':
    if sys.argv[1] == 'stack':
        mm.start_local(DATA); print('up', mm.RELAY, mm.page_url(), flush=True)
        try:
            while True: time.sleep(3600)
        finally: mm.stop()
    elif sys.argv[1] == 'build': build(sys.argv[2:] or list(SCENE_DEFS))

# ---------------------------------------------------------------- browser
import subprocess
def vram_free():
    try: u, t = subprocess.run(['nvidia-smi', '--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'], capture_output=True, text=True).stdout.strip().split(','); return int(t) - int(u)
    except Exception: return 99999
def wait_vram(need=3000, timeout=1200):
    """other agents' image models fill the card's memory, and a browser that cannot get memory LOSES ITS WEBGL CONTEXT
    (seen 2026-10-11: 11.1 of 12.3 GB in use). Wait for room. -> (free MB, waited s)"""
    t0 = time.time()
    while vram_free() < need and time.time() - t0 < timeout: time.sleep(5)
    return vram_free(), round(time.time() - t0)
def ctx_lost(pg): return pg.evaluate('window.__glw ? __glw.ctxLost : 0')
GLWRAP = open(os.path.join(HERE, 'glwrap.js')).read(); CENSUS = open(os.path.join(HERE, 'census.js')).read()
CAMS = {'room': (1015, 1012.5, 60), 'inn': (1040, 1032.5, 110), 'mansion': (1040, 1037.5, 110), 'town': (1040, 1040, 110)}  # x, z, distance (ft): table views
def open_scene(p, name, cam=True, uncapped=True, wrap=True, extra='', dpr=1, viewport=None, profile=False, args_extra=()):
    """a cold GPU browser on a built scene. -> dict(browser, pg, errors, reqs, cdp, t_ready, console)"""
    sc = scenes()[name]; free, waited = wait_vram(); mm.say(f'video memory free {free} MB (waited {waited} s), load {mm.load_now()[0]}')
    browser = p.chromium.launch(headless=True, args=mm.ARGS + (mm.UNCAPPED if uncapped else []) + list(args_extra))
    ctx = browser.new_context(viewport=viewport or mm.VIEWPORT, device_scale_factor=dpr)
    pg = ctx.new_page(); errors = []; reqs = []; console = []
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.on('console', lambda m: (errors.append(f'console: {m.text[:300]}') if m.type == 'error' else console.append(m.text[:400]) if m.text.startswith('tw ') else None))
    pg.on('crash', lambda *_: errors.append('TAB CRASHED'))
    def fin(r):
        try: reqs.append([r.url, r.sizes()['responseBodySize'], r.timing])
        except Exception: reqs.append([r.url, None, None])
    pg.on('requestfinished', fin)
    pg.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url[:200]}') if r.status >= 400 else None)
    mm.tw_sandbox.proxy(pg, mm.API); pg.set_default_timeout(120000)
    if wrap: pg.add_init_script(GLWRAP)
    try: cdp = ctx.new_cdp_session(pg)
    except Exception: cdp = None  # (Firefox)
    if profile and cdp: cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 400}); cdp.send('Profiler.start')
    t0 = time.time(); pg.goto(mm.page_url(extra + os.environ.get('TW_AC_EXTRA', '')) + '#s=' + sc['token'])
    pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=600000)
    pg.mouse.move(5, 5)
    if cam: pg.evaluate(mm.cam_js(*CAMS[name]))
    return dict(browser=browser, ctx=ctx, pg=pg, errors=errors, reqs=reqs, cdp=cdp, t0=t0, t_ready=time.time() - t0, console=console, scene=sc)

GLNAMES = set('texImage2D texSubImage2D texStorage2D texImage3D texSubImage3D texStorage3D compressedTexImage2D generateMipmap bufferData bufferSubData compileShader linkProgram getProgramParameter getShaderParameter getProgramInfoLog getShaderInfoLog getUniformLocation getActiveUniform getActiveAttrib getAttribLocation useProgram drawElements drawArrays drawElementsInstanced drawArraysInstanced readPixels finish clientWaitSync uniform1i uniform1f uniform3fv uniformMatrix4fv bindTexture bindBuffer bindVertexArray bindFramebuffer activeTexture enable disable getParameter getExtension createShader shaderSource attachShader createProgram uniform2fv uniform4fv uniform1fv uniformMatrix3fv vertexAttribPointer enableVertexAttribArray framebufferTexture2D viewport scissor clear blitFramebuffer'.split())
def profile_table(prof, top=40):
    """self time by where it was spent. -> (categories ms, top functions [(ms, fn, file)])"""
    nodes = {n['id']: n for n in prof['nodes']}; self_us = {}
    for s, d in zip(prof['samples'], prof['timeDeltas']): self_us[s] = self_us.get(s, 0) + d
    cat = {}; fns = {}
    for nid, us in self_us.items():
        cf = nodes[nid]['callFrame']; fn = cf['functionName'] or '(anonymous)'; url = cf.get('url', ''); f = url.split('?')[0].rsplit('/', 1)[-1]
        if fn == '(idle)': c = 'idle'
        elif fn == '(program)': c = 'browser (program)'
        elif fn == '(garbage collector)': c = 'garbage collector'
        elif not url and fn in GLNAMES: c = 'WebGL call: ' + ('texture upload' if fn.startswith('tex') or fn == 'generateMipmap' else 'buffer upload' if fn.startswith('buffer') else 'shader compile/link' if fn in ('compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib', 'getAttribLocation') else 'draw' if fn.startswith('draw') else 'state/other')
        elif not url: c = 'native / builtins'
        elif 'GLTFLoader' in f or 'BufferGeometryUtils' in f: c = 'three: GLTFLoader (mesh parse)'
        elif f.startswith('three.'): c = 'three.js core (renderer, scene graph)'
        elif 'postprocessing' in f or 'n8ao' in f or 'godrays' in f: c = 'post-processing libs'
        elif '/tuner/' in url: c = 'look / fx code (tuner js): ' + f
        elif '/engine/' in url: c = 'game code: ' + f
        else: c = 'other: ' + f
        cat[c] = cat.get(c, 0) + us / 1000; fns[(fn, f)] = fns.get((fn, f), 0) + us / 1000
    return dict(sorted(((k, round(v, 1)) for k, v in cat.items()), key=lambda kv: -kv[1])), [(round(v, 1), k[0], k[1]) for k, v in sorted(fns.items(), key=lambda kv: -kv[1])[:top]]
