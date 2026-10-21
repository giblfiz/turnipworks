"""Shared pieces of the loading measurement (2026-10-07): a local relay + static client, campaigns built through the
relay's GET door (no browser), the page probe. The live relay is only ever used for ONE small throwaway campaign
(timeline.py --live), removed at exit by tests/tw_sandbox.py.
  TW_PORTS=relay,site (default 18231,18861)   TW_LOAD_REPO=<checkout to serve> (default: this one; main for "before")
"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.environ.get('TW_LOAD_REPO') or os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), 'tests')); import tw_sandbox  # noqa: E402  test writes go to a sandbox, never the live game
sys.path.insert(0, os.path.join(os.path.dirname(HERE), '2026-10-06-megamap')); import layout  # noqa: E402  the megamap town plan
RP, SP = (int(x) for x in os.environ.get('TW_PORTS', '18231,18861').split(','))
RELAY = f'http://127.0.0.1:{RP}'; API = 'http://127.0.0.1:8096'
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
FIREFOX = os.environ.get('TW_BROWSER', '').lower() == 'firefox'
procs = []; dirs = []
def say(*a): print(*a, file=sys.stderr, flush=True)

def relay_start(data):
    log = open(os.path.join(data, 'relay.log'), 'a')
    pr = subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT)
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'{RELAY}/health', timeout=1); break
        except Exception: pass
    return pr
def start_local():
    import socket
    for port in (RP, SP):
        with socket.socket() as so:
            so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: so.bind(('127.0.0.1', port))
            except OSError: sys.exit(f'port {port} is in use: stop it first')
    data = tempfile.mkdtemp(prefix='tw-loading-'); site = tempfile.mkdtemp(prefix='tw-loading-site-'); dirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(relay_start(data))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return data
def relay_restart(data, down_s=0.0):
    """kill the relay and bring it back on the same data (what a deploy does)"""
    procs[0].terminate(); procs[0].wait(10); time.sleep(down_s); procs[0] = relay_start(data)
def relay_stop(): procs[0].terminate(); procs[0].wait(10)
def page_url(extra=''): return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(RELAY) + '&nointro' + extra
def stop():
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    for pr in procs:
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in dirs: shutil.rmtree(d, ignore_errors=True)

def get(url, timeout=600): return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 tw-loading'}), timeout=timeout).read())
def make_campaign(relay, name):
    c = json.loads(urllib.request.urlopen(urllib.request.Request(f'{relay}/campaigns', data=json.dumps({'name': name, 'gm': 'Fauna-loading'}).encode(), method='POST', headers={'User-Agent': 'Mozilla/5.0 tw-loading'}), timeout=30).read())
    if not c.get('ok'): raise SystemExit(f'could not create: {c}')
    if '127.0.0.1' not in relay: tw_sandbox._made.append((relay, c['campaign'], c['token'], name))  # removed at exit (tw_sandbox.remove_campaigns)
    return c
def build_rooms(relay, c, n, area=None, tag='ld'):
    """about n rooms of the megamap town, furnished by the relay itself -> rooms made"""
    rs, lots = layout.rooms(n, origin=-8)  # (the first lot under the opening camera)
    base = f"{relay}/c/{c['campaign']}/a/{area or c['area']}/do"; ok = 0
    for i, r in enumerate(rs):
        q = {'cmd': 'room.spawn', 'type': r[0], 'x': r[1] * 5, 'z': r[2] * 5, 'w': r[3] * 5, 'd': r[4] * 5, 'seed': r[5], 'nonce': f'{tag}{n}-{i}', 'seat': c['token']}
        if r[6]: q['y'] = r[6]
        try: ok += bool(get(base + '?' + urllib.parse.urlencode(q)).get('ok'))
        except Exception as e: say('room failed', i, r[0], e)
    return ok, lots

# ---- the page probe: marks and main-thread gaps, from before the first script of the page ----
PROBE = r"""(() => { if (window.__tl) return;
  const P = window.__tl = { marks: {}, gaps: [], paints: {}, long: [], left: null, res: 0 };
  const mark = (k) => { if (P.marks[k] == null) P.marks[k] = Math.round(performance.now()); };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.paints[e.name] = Math.round(e.startTime); }).observe({ type: 'paint', buffered: true }); } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  let last = performance.now(), n = 0, fr = null, m4 = null, v3 = null;
  const beat = () => { const now = performance.now(); if (now - last > 80) P.gaps.push([Math.round(last), Math.round(now - last)]); last = now; try { poll(); } catch (e) { P.err = String(e); } last = performance.now(); };
  function poll() {
    const app = document.getElementById('app'), st = document.getElementById('start');
    if (document.body) mark('body');
    if (app && !app.hidden) mark('boot'); if (st && !st.hidden) mark('startForm');
    const tw = window.tw; if (!tw) return; mark('tw');
    if (tw.sync?.status === 'live') mark('welcome');
    if (!tw.ready?.()) return; mark('snap');
    if (tw.lastRenders?.some(r => r.view === 'main')) mark('frame1'); else return;
    if (P.marks.all_in != null || n++ % 5) return;
    const w = tw.worlds.get(tw.main.area), c = tw.main.camera, T = tw.THREE; if (!w?.loaded) return;
    let view = 0, all = 0;
    if (T) { fr ||= new T.Frustum(); m4 ||= new T.Matrix4(); v3 ||= new T.Vector3(); fr.setFromProjectionMatrix(m4.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)); }
    const seen = (x, y, z) => !T || fr.containsPoint(v3.set(x, y, z));
    for (const r of w.recs.values()) if (r.entity.kind === 'object' && r.entity.url && r.visual?.userData?.placeholder) { all++; if (seen(r.entity.x, r.entity.y || 0, r.entity.z)) view++; }
    for (const s of w.shell.values()) if (s.visual?.userData?.placeholder) { all++; if (seen(s.spec.x, s.spec.y || 0, s.spec.z)) view++; }
    P.left = [view, all]; P.things = w.recs.size + w.shell.size;
    if (!view) mark('view_in'); if (!all) mark('all_in');
  }
  setInterval(beat, 20);
})()"""
def gaps_between(tl, a, b, floor=80):
    """main-thread gaps (ms) that START inside [a, b): -> (count, total, longest)"""
    g = [d for (s, d) in tl['gaps'] if a <= s < b and d >= floor]
    return len(g), sum(g), max(g or [0])
