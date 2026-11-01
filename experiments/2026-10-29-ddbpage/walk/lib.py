import subprocess, time
def xdo(*a): return subprocess.run(['xdotool', *map(str, a)], capture_output=True, text=True, env={'DISPLAY': ':102', 'PATH': '/usr/bin:/bin'}).stdout.strip()
def origin(pg):
    v = pg.evaluate('[screenX, screenY, outerHeight - innerHeight, outerWidth - innerWidth]'); return v[0] + v[3] // 2, v[1] + v[2]
def box(pg, loc):
    b = loc.bounding_box(); ox, oy = origin(pg); return {'x': ox + b['x'], 'y': oy + b['y'], 'w': b['width'], 'h': b['height']}
def click_el(pg, loc, snap=None):
    loc.scroll_into_view_if_needed(); time.sleep(0.4); r = box(pg, loc); x, y = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    xdo('mousemove', int(x), int(y)); time.sleep(0.4)
    if snap: shot(snap, r)
    xdo('click', 1); return r
TARGETS = {}
def shot(name, r=None):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'x11grab', '-video_size', '1600x900', '-i', ':102', '-frames:v', '1', f'/tmp/scratch/walk/shots/{name}.png'], check=True)
    if r is not None:
        import json, os; f = '/tmp/scratch/walk/targets.json'
        T = json.load(open(f)) if os.path.exists(f) else {}; T[name] = r; json.dump(T, open(f, 'w'), indent=1)
