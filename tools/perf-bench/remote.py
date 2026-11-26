"""A browser on another machine, driven from here (2026-11-06): the front web server, the household's Intel HD 4600 box, standing in
for an old laptop (a 2012 MacBook's HD 4000 is the same family). wiki infrastructure/network/the front web server/.

One ssh connection carries everything, so the far browser only ever talks to OUR stack:
  -L CDP  the far Chromium's DevTools port, here (Playwright connect_over_cdp drives it: real mouse and key events)
  -R RP   the bench's relay, there on 127.0.0.1 (the page is told relay=http://127.0.0.1:RP)
  -R SP   the bench's static site, there on 127.0.0.1
the front web server is the public HTTP edge: the browser runs `nice`d, one at a time, its profile in a folder of ours that is
removed on exit, and it is killed by its own PID (never a pattern). It never sees turnipworks.net.
The flags are the ones that reach the GPU there (without them Chromium falls back to llvmpipe and the numbers are false):
  --headless=new --enable-gpu --ignore-gpu-blocklist --use-angle=vulkan --enable-features=Vulkan
"""
import json, os, subprocess, time, urllib.request
from stack import RP, SP

HOSTS = {'the front web server': 'fauna@<lan-ip>'}
CDP = int(os.environ.get('TW_PERF_CDP', '17633'))
FLAGS = ['--headless=new', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan', '--no-first-run', '--no-default-browser-check',
         '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
DIR = '$HOME/snap/chromium/common/twperf'  # (the snap's own writable folder: a confined Chromium cannot keep a profile elsewhere)


class Remote:
    def __init__(self, name, window=(1440, 900)):
        self.host = HOSTS[name]; self.name = name; self.window = window; self.ssh = None
    def _ssh(self, cmd, timeout=30):
        return subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', self.host, cmd], capture_output=True, text=True, timeout=timeout)
    def __enter__(self):
        try: urllib.request.urlopen(f'http://127.0.0.1:{CDP}/json/version', timeout=1); raise SystemExit(f'port {CDP} already answers: a stale tunnel? (TW_PERF_CDP moves it)')
        except SystemExit: raise
        except Exception: pass
        r = self._ssh(f'pgrep -u "$USER" -f "{DIR}/profile" || true')
        if r.stdout.strip(): raise SystemExit(f'a bench browser is already running on {self.name} (pids {r.stdout.split()}): one at a time')
        w, h = self.window
        cmd = (f'mkdir -p {DIR} && rm -rf {DIR}/profile && nice -n 10 chromium {" ".join(FLAGS)} --remote-debugging-port={CDP} --user-data-dir={DIR}/profile '
               f'--window-size={w},{h} about:blank > {DIR}/chrome.log 2>&1 & echo $! > {DIR}/pid; wait')
        self.ssh = subprocess.Popen(['ssh', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=15',
                                     '-L', f'{CDP}:127.0.0.1:{CDP}', '-R', f'{RP}:127.0.0.1:{RP}', '-R', f'{SP}:127.0.0.1:{SP}', self.host, cmd],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        for _ in range(60):
            if self.ssh.poll() is not None: raise SystemExit(f'ssh to {self.name} ended: {self.ssh.stderr.read()[-400:]}')
            try: self.version = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{CDP}/json/version', timeout=1).read()); return self
            except Exception: time.sleep(0.5)
        self.__exit__(); raise SystemExit(f'the browser on {self.name} never answered')
    def endpoint(self): return f'http://127.0.0.1:{CDP}'
    def load(self):
        """the far machine's load average and the browser's CPU, for the report"""
        try: return self._ssh('cat /proc/loadavg', 10).stdout.split()[:3]
        except Exception: return None
    def __exit__(self, *a):
        try: self._ssh(f'p=$(cat {DIR}/pid 2>/dev/null); [ -n "$p" ] && kill $p 2>/dev/null; sleep 2; [ -n "$p" ] && kill -9 $p 2>/dev/null; rm -rf {DIR}/profile {DIR}/pid; true', 30)
        except Exception: pass
        if self.ssh:
            try: self.ssh.terminate(); self.ssh.wait(10)
            except Exception: self.ssh.kill()
            self.ssh = None
        left = self._ssh(f'pgrep -u "$USER" -f "{DIR}/profile" || true').stdout.split()
        if left:  # (children that outlived the parent: by their own PIDs, found by the profile path only we use)
            self._ssh('kill -9 ' + ' '.join(left) + ' 2>/dev/null; true')
