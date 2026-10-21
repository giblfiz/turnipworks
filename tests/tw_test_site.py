"""Local repository site for browser suites; ratings writes still use tw_sandbox.

with TestSite() as site: run_suite(site.url + '/tuner/', site.game_url)
CLI: python tests/tw_test_site.py [--port PORT] [--relay-port PORT]
Ports default to OS-assigned ports. Stops its relay and removes its data on exit.
"""
import argparse
import functools
import http.server
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

REPO = Path(__file__).resolve().parents[1]

class TestSite:
    def __init__(self, root=REPO, port=0, relay_port=0, ratings='http://127.0.0.1:8096'):
        self.root, self.port, self.relay_port, self.ratings = Path(root), port, relay_port, ratings

    def __enter__(self):
        self.temp = tempfile.TemporaryDirectory(prefix='tw-matrix-')
        if not self.relay_port:
            with socket.socket() as s:
                s.bind(('127.0.0.1', 0)); self.relay_port = s.getsockname()[1]
        self.relay_url = f'http://127.0.0.1:{self.relay_port}'
        self.log = open(Path(self.temp.name) / 'relay.log', 'w')
        self.relay = subprocess.Popen(['node', str(self.root / 'engine/relay/server.js')], env={**os.environ, 'PORT': str(self.relay_port), 'DATA_DIR': self.temp.name, 'ORIENT_API': ''}, stdout=self.log, stderr=self.log)
        site = self
        class Handler(http.server.SimpleHTTPRequestHandler):
            def translate_path(self, path):
                for prefix, target in [('/tuner/', '/tools/spawn-tuner/'), ('/look/', '/tools/spawn-tuner/')]:
                    if path.startswith(prefix): path = target + path[len(prefix):]; break
                resolved = Path(super().translate_path(path))
                # Runtime source always comes from this worktree. Only ignored,
                # immutable delivery media may be borrowed from the deployed tree.
                if not resolved.exists() and path.startswith('/web/'):
                    suffix = resolved.suffix.lower()
                    if suffix in {'.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp', '.ktx2'} or resolved.name == 'canary.json':
                        media = Path('/var/www/implausible-landing/projects/turnip-works') / path[5:].split('?', 1)[0]
                        if media.is_file(): return str(media)
                return str(resolved)
            def do_GET(self):
                if self.path.startswith(('/api/tw-ratings', '/api/tw-relay')): return self.proxy()
                super().do_GET()
            def do_POST(self): self.proxy()
            def do_OPTIONS(self): self.proxy()
            def proxy(self):
                relay = self.path.startswith('/api/tw-relay')
                prefix = '/api/tw-relay' if relay else '/api/tw-ratings'
                base = site.relay_url if relay else site.ratings
                headers = {k:v for k,v in self.headers.items() if k.lower() not in ('host', 'content-length', 'connection', 'upgrade')}
                data = self.rfile.read(int(self.headers.get('Content-Length', 0))) if self.command == 'POST' else None
                req = urllib.request.Request(base + self.path[len(prefix):], data=data, headers=headers, method=self.command)
                try:
                    response = urllib.request.urlopen(req, timeout=120)
                except urllib.error.HTTPError as e: response = e
                except Exception as e: self.send_error(502, str(e)); return
                with response:
                    self.send_response(response.status)
                    for k,v in response.headers.items():
                        if k.lower() not in ('connection','transfer-encoding'): self.send_header(k,v)
                    self.end_headers()
                    try:
                        while chunk := response.read1(65536): self.wfile.write(chunk); self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError): pass
            def log_message(self, *args): pass
        try:
            self.server = http.server.ThreadingHTTPServer(('127.0.0.1', self.port), functools.partial(Handler, directory=str(self.root)))
        except Exception:
            self.relay.terminate(); self.relay.wait(timeout=10)
            self.log.close(); self.temp.cleanup()
            raise
        self.url = f'http://127.0.0.1:{self.server.server_port}'
        self.game_url = self.url + '/engine/client/'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True); self.thread.start()
        for _ in range(100):
            if self.relay.poll() is not None: self.__exit__(None,None,None); raise RuntimeError('local relay exited; check dependencies')
            try:
                with urllib.request.urlopen(self.relay_url + '/health', timeout=1): return self
            except Exception: time.sleep(.1)
        self.__exit__(None,None,None); raise RuntimeError('local relay did not start')

    def __exit__(self, *args):
        self.server.shutdown(); self.server.server_close()
        self.relay.terminate()
        try: self.relay.wait(timeout=10)
        except subprocess.TimeoutExpired: self.relay.kill(); self.relay.wait()
        self.log.close(); self.temp.cleanup()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=0); parser.add_argument('--relay-port', type=int, default=0)
    args = parser.parse_args()
    with TestSite(port=args.port, relay_port=args.relay_port) as site:
        print(site.url, flush=True)
        try: threading.Event().wait()
        except KeyboardInterrupt: pass
