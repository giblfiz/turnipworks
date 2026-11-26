"""THE TUNNEL'S WEBSOCKET 404, AND NOTHING ELSE (2026-11-06; docs/NETCODE.md "Our Cloudflare zone refuses websocket upgrades").

A seat tries the websocket first and falls back to SSE (2026-11-02). Through Cloudflare (dev.turnipworks.net, --page
https://...) the upgrade is answered 404, and Chrome logs it as a console error, so a suite that counts console errors
(browser_dice_wall.py W7) failed on dev every run. This is the one line that may be passed over: the relay's own /ws
path, over TLS (the tunnel: a local relay is plain ws:// and serves the upgrade, so a 404 there is a real fault), code 404.

  is_tunnel_ws_404(text)   True only for that line, as Chrome writes it
Tested by engine/test/test_tunnel_noise.py.
"""
import re

_TUNNEL_WS_404 = re.compile(r"^WebSocket connection to 'wss://[^'/]+(?:/[^'/?#]+)*/ws' failed: Error during WebSocket handshake: Unexpected response code: 404$")

def is_tunnel_ws_404(text):
    return bool(_TUNNEL_WS_404.match(str(text).strip()))
