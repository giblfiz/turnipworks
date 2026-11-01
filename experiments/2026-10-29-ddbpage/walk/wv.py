# wv.py 'js expression' : evaluate in the Beyond20 options webview (raw CDP over its websocket); prints the JSON result
import asyncio, json, sys, urllib.request
import websockets
async def main(expr):
    ts = json.loads(urllib.request.urlopen('http://[::1]:9333/json/list', timeout=5).read())
    t = [t for t in ts if t['type'] == 'webview' and 'options.html' in t['url']][0]
    async with websockets.connect(t['webSocketDebuggerUrl'], max_size=2**24) as ws:
        await ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True, 'awaitPromise': True}}))
        while True:
            m = json.loads(await ws.recv())
            if m.get('id') == 1: print(json.dumps(m.get('result', {}).get('result', {}).get('value', m))); return
asyncio.run(main(sys.argv[1]))
