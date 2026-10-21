# Usage: python tests/review_fast_accept.py https://implausible.enterprises/projects/turnip-works/review/  (its ratings go to the server test sandbox: tests/tw_sandbox.py)
"""Acceptance for the fast review page. Writes only fauna-test/* keys (?run=fauna-test)."""
import sys, time, json, math, urllib.request
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '.')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]
OUT = os.environ.get("TW_SHOTS", os.path.expanduser("~/.cache/turnip-works/review-fast/" + tw_sandbox.SID)).rstrip("/") + "/"
os.makedirs(OUT, exist_ok=True)
LATEST = os.path.join(tw_sandbox.REVIEWS, "latest.json")
res = []
def check(name, ok, info=""):
    res.append((name, bool(ok))); print(("PASS " if ok else "FAIL ") + name, info)
def latest():  # what the server holds FOR THIS TEST SESSION (the live latest.json plus this run's sandboxed ratings)
    import urllib.request
    with urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8096/ratings", headers=tw_sandbox.HEADERS), timeout=10) as r: return json.load(r)
LIVE_BEFORE = open(LATEST, "rb").read()
def ang(q): return 2*math.degrees(math.acos(min(1, abs(q[3]))))
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1600, "height": 950})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    posts = []
    pg.on("request", lambda r: posts.append(r.post_data) if r.method == "POST" else None)
    # The real queue may be complete; that is a valid empty state, not a load failure.
    pg.goto(BASE); pg.evaluate("localStorage.clear()"); pg.reload()
    pg.wait_for_function(r'window.__twDebug && /^\d+ match/.test(document.getElementById("count").textContent)', timeout=90000)
    assets = pg.evaluate("fetch('assets.json').then(r=>r.json())")["assets"]
    L = latest()
    def touched(r): return bool(r) and (isinstance(r.get("stars"), int) or bool(r.get("tags")) or bool((r.get("note") or "").strip()))
    def rv(run, sku): return touched(L.get(f"{run}/{sku}/model")) or touched(L.get(f"{run}/{sku}/plate"))
    first_unrev = next((a["sku"] for a in assets if not rv("inn-01", a["sku"])), None)
    n_rev = sum(rv("inn-01", a["sku"]) for a in assets)
    q = pg.evaluate("document.getElementById('queue').textContent")
    check("reviewed = any score/flag/note; header count matches ratings data", q.startswith(f"{n_rev} / {len(assets)} reviewed"), f"{q!r} vs {n_rev}")
    pg.select_option("#f-status", value="unreviewed")
    check("unreviewed filter count = assets - reviewed", len(pg.evaluate("__twDebug.filtered")) == len(assets) - n_rev, len(pg.evaluate("__twDebug.filtered")))
    def fills(w, h):
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(1500)
        m = pg.evaluate("""() => { const v = document.getElementById('views').getBoundingClientRect(), c = document.getElementById('gl');
          const cells = [...document.querySelectorAll('.view')].map(e => e.getBoundingClientRect());
          return {bottom: v.bottom, w: v.width, h: v.height, sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth,
            cw: c.width / Math.min(devicePixelRatio, 2), ch: c.height / Math.min(devicePixelRatio, 2), VP: JSON.parse(JSON.stringify(__twDebug.VP)),
            cells: cells.map(r => [Math.round(r.width), Math.round(r.height)])}; }""")
        aspects_ok = all(abs(m["VP"][n][2] - m["VP"][n][0] / m["VP"][n][1]) < 0.01 for n in ("front", "top", "side"))
        cells_ok = sorted(m["cells"]) == sorted([m["VP"][n][:2] for n in ("front", "top", "side")])
        ok = (h - m["bottom"]) <= 14 and m["sh"] <= h and m["sw"] <= w and abs(m["cw"] - m["w"]) <= 1 and abs(m["ch"] - m["h"]) <= 1 and aspects_ok and cells_ok
        check(f"ports fill window {w}x{h}, no scroll, renderer/scissor/aspect follow", ok, {k: m[k] for k in ("bottom", "w", "h", "sh", "cw", "ch")} | {"VP": m["VP"]})
    for w, h in ((1600, 950), (1920, 1080), (1280, 720), (1000, 700), (1600, 950)):
        fills(w, h)
    pg.select_option("#f-status", value="unreviewed")
    if first_unrev is not None:
        pg.wait_for_function("s => window.__tw && __tw.sku === s", arg=first_unrev, timeout=90000)
        check("live run opens on first unreviewed", pg.evaluate("__tw.sku") == first_unrev, first_unrev)
    else:
        check("fully reviewed live queue shows its completion state", pg.locator("#done").is_visible() and pg.evaluate("__twDebug.selected === null && __twDebug.filtered.length === 0"))
    check("no POST on open", not posts)
    pg.goto(BASE + "?run=fauna-test")
    pg.wait_for_function("window.__tw && window.__tw.sku", timeout=90000)
    s0 = pg.evaluate("__tw.sku")
    L = latest()
    exp0 = next(a["sku"] for a in assets if not rv("fauna-test", a["sku"]))
    check("test run opens on its first unreviewed", s0 == exp0, (s0, exp0))
    # rotation
    pg.evaluate("__twDebug.VIEWS.forEach(v=>{v.pivot.quaternion.identity(); v.spun=0})")
    time.sleep(2)
    a1 = pg.evaluate("[__twDebug.VIEWS.map(v=>v.spun), __twDebug.VIEWS.map(v=>v.pivot.quaternion.toArray())]")
    rates = [ang(a1[1][i]) / a1[0][i] for i in range(3)]
    check("all three views spin at 6 rpm (36 deg/s of spin time)", all(abs(r - 36) < 1 for r in rates), [round(r,2) for r in rates])
    axes = [max(range(3), key=lambda k: abs(q[k])) for q in a1[1]]
    check("three different axes (y, x, z)", axes == [1, 0, 2], axes)
    pg.wait_for_timeout(1000)
    pg.screenshot(path=OUT + "desk.png")
    # preload
    pg.wait_for_function("__twDebug.cache.size >= 4", timeout=60000)
    cached = pg.evaluate("[...__twDebug.cache.keys()]")
    check("next assets preloaded", len(cached) >= 4, cached)
    # drag front view
    box = pg.locator('.view[data-view="0"]').bounding_box()
    pg.keyboard.press("Space")  # pause to isolate drag
    q_before = pg.evaluate("__twDebug.VIEWS[0].pivot.quaternion.toArray()")
    pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2); pg.mouse.down()
    pg.mouse.move(box["x"]+box["width"]/2+5, box["y"]+box["height"]/2+80, steps=6); pg.mouse.up()
    q_after = pg.evaluate("__twDebug.VIEWS[0].pivot.quaternion.toArray()")
    check("drag turns the view off its spin axis", abs(q_after[0]) > 0.1, [round(x,3) for x in q_after])
    pg.keyboard.press("r"); pg.keyboard.press("Space")
    check("R resets views", pg.evaluate("__twDebug.VIEWS.every(v=>Math.abs(v.pivot.quaternion.w)>0.95)"))
    # score with key 3 → POST + advance
    next_expected = pg.evaluate("__twDebug.filtered[1]")
    t0 = time.time()
    pg.keyboard.press("3")
    pg.wait_for_function(f"window.__tw.sku === '{next_expected}'", timeout=20000)
    adv = pg.evaluate("__tw.loadedAt - __twKeyAt")
    check("key 3 advances to next asset, model on screen <100 ms (preloaded)", adv < 100, f"{adv:.1f}ms (wall {time.time()-t0:.2f}s headless) -> {next_expected}")
    pg.wait_for_timeout(1500)
    r = latest().get(f"fauna-test/{s0}/model", {})
    check("key 3 wrote stars=3 to server latest.json", r.get("stars") == 3, r)
    check("rated asset left the unreviewed list", s0 not in pg.evaluate("__twDebug.filtered"))
    # masking + note + score 1
    s1 = pg.evaluate("__tw.sku")
    pg.keyboard.press("m")
    pg.keyboard.press("n"); pg.keyboard.type("fauna test note 12345"); pg.keyboard.press("Enter")
    pg.keyboard.press("1")
    pg.wait_for_function(f"window.__tw.sku !== '{s1}'", timeout=20000)
    pg.wait_for_timeout(2000)
    r = latest().get(f"fauna-test/{s1}/model", {})
    check("M + N note + 1 saved together", r.get("stars") == 1 and r.get("tags") == ["masking"] and "12345" in r.get("note", ""), r)
    # undo
    s2 = pg.evaluate("__tw.sku")
    pg.keyboard.press("u")
    pg.wait_for_function(f"window.__tw.sku === '{s1}'", timeout=20000)
    pg.wait_for_timeout(1500)
    r = latest().get(f"fauna-test/{s1}/model", {})
    check("U undoes the last score and goes back", r.get("stars") is None, r)
    # back / next keys
    pg.keyboard.press("j"); pg.wait_for_function(f"window.__tw.sku !== '{s1}'", timeout=20000)
    pg.keyboard.press("k"); pg.wait_for_function(f"window.__tw.sku === '{s1}'", timeout=20000)
    check("J next / K back", True)
    # filters
    pg.keyboard.press("/"); pg.keyboard.type("apple"); pg.wait_for_timeout(500); pg.keyboard.press("Escape")
    names = pg.evaluate("__twDebug.filtered")
    check("name filter: typing 'apple' shows only matches", names and all("apple" in s for s in names), names)
    check("selection jumps into filtered set", pg.evaluate("__tw.sku") in names or pg.evaluate("__twDebug.selected") in names)
    pg.keyboard.press("Shift+C")
    pg.select_option("#f-role", index=3)
    rl = pg.evaluate("document.getElementById('f-role').selectedOptions[0].textContent")
    n_role = len(pg.evaluate("__twDebug.filtered"))
    check("role filter narrows", 0 < n_role < len(assets), f"{rl}: {n_role}")
    pg.select_option("#f-role", index=0)
    pg.select_option("#f-theme", value="DUN")
    n_th = len(pg.evaluate("__twDebug.filtered"))
    check("theme filter narrows", 0 < n_th < len(assets), n_th)
    pg.select_option("#f-theme", index=0)
    pg.select_option("#f-date", index=1)
    n_d = len(pg.evaluate("__twDebug.filtered"))
    check("date filter narrows", 0 < n_d < len(assets), n_d)
    pg.select_option("#f-date", index=0)
    pg.select_option("#f-score", value="3")
    st = pg.evaluate("document.getElementById('f-status').value")
    fl = pg.evaluate("__twDebug.filtered")
    check("score filter (auto status=all) finds the 3", s0 in fl and st == "all", (st, fl))
    pg.select_option("#f-status", value="reviewed"); pg.select_option("#f-score", value="")
    check("reviewed filter (undone score keeps its note+flag, so still reviewed)", s0 in pg.evaluate("__twDebug.filtered") and s1 in pg.evaluate("__twDebug.filtered"), pg.evaluate("__twDebug.filtered"))
    pg.keyboard.press("Shift+C")
    check("no page errors", not errs, errs)
    b.close()
    # phone
    b = p.chromium.launch(args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.goto(BASE + "?run=fauna-test"); pg.wait_for_function("window.__tw && window.__tw.sku", timeout=90000)
    pg.wait_for_timeout(800)
    sw = pg.evaluate("document.documentElement.scrollWidth")
    check("phone: no horizontal scroll", sw <= 390, sw)
    pg.screenshot(path=OUT + "phone.png", full_page=True)
    b.close()
check("the live reviews/latest.json holds no fauna-test/ rating (test ratings stay in the sandbox)", not [k for k in json.load(open(LATEST)) if k.startswith("fauna-test/")], "byte-identical" if open(LATEST, "rb").read() == LIVE_BEFORE else "changed by someone else meanwhile")
print(f"{sum(o for _, o in res)}/{len(res)} passed")

sys.exit(0 if all(ok for _, ok in res) else 1)
