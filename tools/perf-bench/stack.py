"""The light-use bench's own game stack (2026-11-06): a local relay and a static server, nothing shared.

  relay   node engine/relay/server.js on 127.0.0.1:RP, its data in a folder of ours (the bench's built maps, kept
          between runs so a map is built once: ~/.cache/tw-perf-bench/ by default, never the live game's data)
  site    127.0.0.1:SP serves /engine/ and /tuner/ from THIS checkout; a file this checkout does not have (meshes and
          textures are git-ignored, so a fresh worktree has none) is served read-only from the main checkout instead.
          The code is always this checkout's.
Ports 17631 / 17632 (TW_PERF_PORTS=relay,site to move them). Nothing here touches turnipworks.net, dev, or :8097/:8098.
"""
import functools, http.server, os, shutil, socket, subprocess, sys, tempfile, threading, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
MAIN = os.environ.get('TW_MAIN_CHECKOUT', '<repo>')  # where git-ignored assets are read from when this checkout lacks them
RP, SP = (int(x) for x in os.environ.get('TW_PERF_PORTS', '17631,17632').split(','))
CODE = os.environ.get('TW_PERF_CODE') or REPO  # (another tree's client to serve, for a true before / after: e.g. `git archive <commit> engine tools/spawn-tuner | tar -x -C DIR`; the relay stays this checkout's)
ROOTS = {'engine': [os.path.join(CODE, 'engine'), os.path.join(MAIN, 'engine')],
         'tuner': [os.path.join(CODE, 'tools', 'spawn-tuner'), os.path.join(MAIN, 'tools', 'spawn-tuner')]}


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
        parts = [x for x in p.split('/') if x and x not in ('.', '..')]
        if not parts or parts[0] not in ROOTS: return os.path.join(REPO, '__nothing__')
        rest = parts[1:]
        for root in ROOTS[parts[0]]:
            f = os.path.join(root, *rest)
            if os.path.exists(f): return f
        return os.path.join(ROOTS[parts[0]][0], *rest)
    def end_headers(self):
        # meshes and textures may be cached (they never change under a run); code never (each run is the checkout's)
        if self.path.split('?')[0].endswith(('.glb', '.webp', '.ktx2', '.png', '.jpg')): self.send_header('Cache-Control', 'max-age=86400')
        else: self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass


class Stack:
    def __init__(self, data):
        self.data = data; self.relay = None; self.server = None
    def __enter__(self):
        for port in (RP, SP):
            with socket.socket() as so:
                so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try: so.bind(('127.0.0.1', port))
                except OSError: raise SystemExit(f'port {port} is in use (a stale bench? TW_PERF_PORTS moves it)')
        os.makedirs(self.data, exist_ok=True)
        self.log = open(os.path.join(self.data, 'relay.log'), 'a')
        self.relay = subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': self.data, 'ORIENT_API': ''}, stdout=self.log, stderr=subprocess.STDOUT)
        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', SP), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        for _ in range(150):
            if self.relay.poll() is not None: self.__exit__(); raise SystemExit('the local relay exited: see ' + os.path.join(self.data, 'relay.log'))
            try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); break
            except Exception: time.sleep(0.1)
        return self
    def __exit__(self, *a):
        if self.server: self.server.shutdown(); self.server.server_close(); self.server = None
        if self.relay:
            self.relay.terminate()
            try: self.relay.wait(10)
            except Exception: self.relay.kill()
            self.relay = None
    @staticmethod
    def page_url(extra=''):
        return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&nointro' + extra
