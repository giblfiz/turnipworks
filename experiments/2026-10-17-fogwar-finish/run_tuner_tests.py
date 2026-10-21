#!/usr/bin/env python3
import http.server, os, shutil, socket, subprocess, sys, tempfile, threading, time

WORKTREE = '<repo>'
TUNER_DIR = os.path.join(WORKTREE, 'tools/spawn-tuner')
PY = 'python3'
OUTDIR = os.environ.get('FOGWAR_OUT_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stills')

def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=TUNER_DIR, **kw)
    def log_message(self, *a):
        pass

def main():
    suites = sys.argv[1:] or ['fogwar_ui.py', 'house_buttons.py']
    http_port = free_port()
    api_port = free_port()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', http_port), QuietHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    tmp_reviews = tempfile.mkdtemp(prefix='tw-reviews-test-')
    try:
        # Copy live house.jsonl / latest.json read-only into tmp_reviews so tests see the real house look
        if os.path.exists('/var/lib/tw-ratings'):
            shutil.copytree('/var/lib/tw-ratings', tmp_reviews, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns('.server.lock', 'test-sandbox'))
        env = {**os.environ, 'TW_REVIEWS_DIR': tmp_reviews, 'TW_RATINGS_PORT': str(api_port), 'ATMOS_GPU': '1'}
        api_proc = subprocess.Popen([PY, os.path.join(WORKTREE, 'server/ratings_server.py')], env=env)
        time.sleep(0.6)
        base_url = f'http://127.0.0.1:{http_port}'
        api_url = f'http://127.0.0.1:{api_port}'
        rc = 0
        for suite in suites:
            path = os.path.join(TUNER_DIR, 'test', suite)
            args = [PY, path, base_url, OUTDIR, api_url] if suite != 'house_buttons.py' else [PY, path, base_url, api_url]
            print(f'=== Running {suite} ===', flush=True)
            r = subprocess.run(args, env=env)
            if r.returncode != 0:
                rc = r.returncode
        api_proc.terminate()
        sys.exit(rc)
    finally:
        shutil.rmtree(tmp_reviews, ignore_errors=True)

if __name__ == '__main__':
    main()
