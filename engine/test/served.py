"""THE PAGE IS THIS CHECKOUT'S (2026-10-26). A static server left over from an older run that still holds a suite's port
serves an OLDER tree, and the suite then passes or fails on someone else's code (found 2026-10-26: a busy-check's
urlopen timed out on a large listing and let it through; "52/52" was 51/52). After start_local, a suite asks the page
server for a file this checkout has and compares the bytes:

    import served; served.check(SP, ENGINE)        # exits the suite with a message when they differ
"""
import os, sys, urllib.request


def check(port, engine, path='core/height.js'):
    mine = open(os.path.join(engine, path), 'rb').read()
    try: got = urllib.request.urlopen(f'http://127.0.0.1:{port}/engine/{path}', timeout=10).read()
    except Exception as e: sys.exit(f'served.check: the page server on port {port} did not answer ({e})')
    if got != mine: sys.exit(f'served.check: port {port} serves another checkout (its engine/{path} is not {engine}\'s): a stale test server? find it with ps and kill it by PID')
