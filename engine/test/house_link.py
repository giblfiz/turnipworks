#!/usr/bin/env python3
"""The game uses the tuner's HOUSE look (Harry 2026-10-02: the look is data, chosen in the tuner).
Changes the house look through the same API the tuner's "Use in game" buttons call, reloads the live game, checks it
uses the new values. The write goes to the server's test sandbox (tests/tw_sandbox.py): only this test's own browser
sees it, and the test checks that a browser WITHOUT the test header, and the stored live records, are untouched.
  python3 engine/test/house_link.py [https://turnipworks.net/]"""
import asyncio, json, os, sys, urllib.request
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from playwright.async_api import async_playwright
GAME = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8180/'
API = 'http://127.0.0.1:8096'  # the ratings server behind /api/tw-ratings/
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NOTE = 'house link acceptance test (Fauna)'
results = []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
def api(path, body=None, sandboxed=True):
    if body is not None and not sandboxed: raise RuntimeError('a test never writes to the live house look')
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json', **(tw_sandbox.HEADERS if sandboxed else {})})
    with urllib.request.urlopen(req, timeout=10) as r: return json.loads(r.read())

async def game_house(p, sandboxed=True):
    b = await p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = await b.new_page(viewport={'width': 1100, 'height': 700})
    if not sandboxed: await tw_sandbox.live(pg.context)  # what every other player sees
    await pg.goto(GAME + ('&' if '?' in GAME else '?') + 'nopost&boxes&nointro')
    await pg.fill('#newCampaign input[name=name]', 'TEST house link ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await pg.click('#newCampaign button')
    await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
    info = await pg.evaluate('tw.houseInfo()')
    await b.close()
    return info

async def main():
    before_api, before_files = api('/tuner/house', sandboxed=False), tw_sandbox.fingerprint()
    async with async_playwright() as p:
        before = await game_house(p)
        anim = json.loads(json.dumps(before['anim'])); anim['name'] = 'house-link-test'; anim['in']['objects']['dur'] = 777
        light = dict(before['lighting'] or {}); light['name'] = 'light-house-link-test'
        r = api('/tuner', {'kind': 'house', 'name': 'house', 'note': NOTE, 'data': {'anim': anim, 'lighting': light}})
        check(r.get('ok') and r.get('sandbox') == tw_sandbox.SID, 'house look set through the tuner API (kind "house"), in the test sandbox', f"{r.get('at')} sandbox {r.get('sandbox')}")
        check((api('/tuner/house').get('anim') or {}).get('name') == 'house-link-test', 'the test session reads its own house look back')
        after = await game_house(p)
        check(after['anim']['name'] == 'house-link-test' and after['anim']['in']['objects']['dur'] == 777, 'the reloaded game spawns with the new house animation', f"{after['anim']['name']}, objects dur {after['anim']['in']['objects']['dur']} ms")
        check(after['lighting'] and after['lighting'].get('name') == 'light-house-link-test', 'the reloaded game lights with the new house lighting', (after['lighting'] or {}).get('name'))
        check(api('/tuner/house', sandboxed=False) == before_api, 'the live house look (no test header) is exactly what it was')
        check(tw_sandbox.fingerprint() == before_files, 'reviews/tuner/house.jsonl and the ratings files are byte-identical')
        others = await game_house(p, sandboxed=False)
        check(others['anim']['name'] == before['anim']['name'] and (others['lighting'] or {}).get('name') != 'light-house-link-test', 'a player without the test header still gets the previous house look', others['anim']['name'])
    print(f'house link: {sum(results)}/{len(results)} passed')
    sys.exit(0 if all(results) else 1)
asyncio.run(main())
