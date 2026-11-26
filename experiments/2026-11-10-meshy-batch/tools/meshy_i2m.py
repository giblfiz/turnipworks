#!/usr/bin/env python3
"""Meshy Image-to-3D for the meshy lane (2026-11-07). The key comes in as MESHY_API_KEY and is never printed or written.

  meshy_i2m.py balance
  meshy_i2m.py submit PLATE.png NAME VARIANT --confirm-spend     (VARIANT: m7 | t25)
  meshy_i2m.py poll                                               (every submitted task in tasks.json; downloads finished ones)

Variants (docs.meshy.ai/en/api/image-to-3d and /pricing, read 2026-11-07):
  m7   Meshy 7.1 standard, should_remesh to ~20k triangles, one 2K base-colour map (no PBR): 30 credits
  t25  Smart Topology meshy-t2.5 (hard-surface topology), ~10k faces, one 2K base-colour map: 15 credits
Output: OUT/<name>--<variant>.glb, .thumb.png, .task.json (task record without signed URLs) under OUT (default USB).
"""
import base64, json, os, struct, sys, time, urllib.error, urllib.request
from pathlib import Path

API = 'https://api.meshy.ai'
HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get('MESHY_OUT', '/mnt/usb/turnip-works/lanes-2026-11-10/meshy-batch/meshy'))
TASKS = HERE.parent / 'work' / 'meshy-tasks.json'
VARIANTS = {
    'm7': dict(model_type='standard', ai_model='meshy-7.1', should_remesh=True, topology='triangle', target_polycount=20000,
               should_texture=True, enable_pbr=False, texture_resolution='2k', image_enhancement=False),
    't25': dict(model_type='smart-topology', ai_model='meshy-t2.5', target_polycount=10000,
                should_texture=True, enable_pbr=False, texture_resolution='2k'),
}
COMMON = dict(target_formats=['glb'], origin_at='bottom', moderation=False)


def key():
    k = os.environ.get('MESHY_API_KEY', '').strip()
    if not k: sys.exit('MESHY_API_KEY is not set')
    return k


def call(method, path, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    h = {'Authorization': f'Bearer {key()}'}
    if payload is not None: h['Content-Type'] = 'application/json'
    req = urllib.request.Request(API + path, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'Meshy HTTP {e.code} on {method} {path}: {e.read().decode(errors="replace")[:500]}')


def load():
    return json.loads(TASKS.read_text()) if TASKS.exists() else {}


def save(t):
    TASKS.parent.mkdir(parents=True, exist_ok=True); TASKS.write_text(json.dumps(t, indent=1))


def get(url):
    with urllib.request.urlopen(url, timeout=300) as r: return r.read()


def glb_tris(data):
    """triangle count, texture images and generator of a GLB (structure only)"""
    magic, ver, length = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and length == len(data), 'bad GLB'
    n = struct.unpack_from('<I', data, 12)[0]; j = json.loads(data[20:20 + n])
    tris = 0
    for m in j.get('meshes', []):
        for p in m['primitives']:
            if 'indices' in p: tris += j['accessors'][p['indices']]['count'] // 3
            else: tris += j['accessors'][p['attributes']['POSITION']]['count'] // 3
    return dict(tris=tris, images=len(j.get('images', [])), materials=len(j.get('materials', [])),
                generator=j.get('asset', {}).get('generator'), asset_extras=j.get('asset', {}).get('extras'),
                extensions=j.get('extensionsUsed', []))


def submit(plate, name, variant):
    t = load(); tag = f'{name}--{variant}'
    if tag in t and t[tag].get('status') not in ('FAILED', 'CANCELED'): sys.exit(f'{tag} already submitted: {t[tag]["id"]}')
    data = Path(plate).read_bytes(); uri = 'data:image/png;base64,' + base64.b64encode(data).decode()
    r = call('POST', '/openapi/v1/image-to-3d', {'image_url': uri, **VARIANTS[variant], **COMMON})
    t[tag] = {'id': r['result'], 'plate': str(plate), 'variant': variant, 'params': {**VARIANTS[variant], **COMMON},
              'submitted': time.time(), 'status': 'PENDING'}
    save(t); print(tag, r['result'])


def poll():
    t = load(); OUT.mkdir(parents=True, exist_ok=True); open_ = 0
    for tag, rec in t.items():
        if rec.get('downloaded') or rec.get('status') in ('FAILED', 'CANCELED'): continue
        r = call('GET', f'/openapi/v1/image-to-3d/{rec["id"]}')
        rec['status'] = r['status']; rec['progress'] = r.get('progress')
        if r['status'] == 'SUCCEEDED':
            glb = get(r['model_urls']['glb']); (OUT / f'{tag}.glb').write_bytes(glb)
            if r.get('thumbnail_url'): (OUT / f'{tag}.thumb.png').write_bytes(get(r['thumbnail_url']))
            tex = (r.get('texture_urls') or [{}])[0]
            rec.update(downloaded=True, credits=r.get('consumed_credits'), secs=round((r['finished_at'] - r['started_at']) / 1000),
                       wall_secs=round(r['finished_at'] / 1000 - rec['submitted']), glb_bytes=len(glb), maps=sorted(k for k, v in tex.items() if v),
                       **glb_tris(glb))
            keep = {k: v for k, v in r.items() if k not in ('model_urls', 'texture_urls', 'thumbnail_url', 'thumbnail_urls', 'alpha_thumbnail_url', 'texture_image_url')}
            (OUT / f'{tag}.task.json').write_text(json.dumps(keep, indent=1))
            print(f'DONE {tag}: {rec["tris"]} tris, {rec["images"]} images, {rec["glb_bytes"]} B, {rec["credits"]} cr, {rec["secs"]} s')
        elif r['status'] in ('FAILED', 'CANCELED'):
            rec['error'] = r.get('task_error'); print(f'{r["status"]} {tag}: {rec["error"]}')
        else:
            open_ += 1; print(f'.. {tag} {r["status"]} {r.get("progress")}%')
    save(t); print('open', open_)


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == 'balance': print(call('GET', '/openapi/v1/balance'))
    elif a[0] == 'submit':
        if '--confirm-spend' not in a: sys.exit('add --confirm-spend')
        submit(a[1], a[2], a[3])
    elif a[0] == 'poll': poll()
    else: sys.exit(__doc__)
