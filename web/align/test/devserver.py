"""Local dev server for the Alignment Bench: serves a staging root (align/ + tuner/ side by side, as deployed) and
proxies /api/tw-ratings/* to the ratings server (127.0.0.1:8096), so the bench runs against the working tree.
python3 web/align/test/devserver.py STAGE_ROOT [PORT]"""
import http.server, sys, urllib.request, functools
ROOT, PORT = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 8771
class H(http.server.SimpleHTTPRequestHandler):
    def _proxy(self):
        url = 'http://127.0.0.1:8096' + self.path[len('/api/tw-ratings'):]
        body = self.rfile.read(int(self.headers.get('Content-Length', 0) or 0)) if self.command == 'POST' else None
        req = urllib.request.Request(url, data=body, method=self.command, headers={'Content-Type': self.headers.get('Content-Type', 'application/json')})
        try: r = urllib.request.urlopen(req); code, data = r.status, r.read()
        except urllib.error.HTTPError as e: code, data = e.code, e.read()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        if self.path.startswith('/api/tw-ratings'): return self._proxy()
        return super().do_GET()
    def do_POST(self):
        if self.path.startswith('/api/tw-ratings'): return self._proxy()
        self.send_error(404)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=ROOT)).serve_forever()
