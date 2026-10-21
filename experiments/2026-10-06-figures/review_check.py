#!/usr/bin/env python3
"""Small live acceptance check for the figures-01 asset-review queue."""

import json
import os
import sys
import urllib.request

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2] / "tests"))
import tw_sandbox  # noqa: E402  (keeps the score below out of Harry's records)
from playwright.sync_api import sync_playwright  # noqa: E402


BASE = sys.argv[1] if len(sys.argv) > 1 else "https://implausible.enterprises/projects/turnip-works/review-figures/"


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1600, "height": 950})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until="networkidle", timeout=90_000)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle", timeout=90_000)
    page.wait_for_function("window.__tw && window.__tw.sku", timeout=90_000)

    payload = page.evaluate("fetch('assets.json').then(r => r.json())")
    assert payload["run"] == "figures-01"
    assert len(payload["assets"]) == 518
    first = page.evaluate("window.__tw.sku")
    assert first in {asset["sku"] for asset in payload["assets"]}
    assert page.locator("#runlabel").inner_text() == "figures-01"
    assert "tris" in page.locator("#meta").inner_text()
    assert page.locator("#plate").evaluate("img => img.complete && img.naturalWidth > 0")
    assert page.evaluate("__twDebug.VIEWS.every(v => v.pivot.children.length === 1)")
    assert not errors, errors

    page.keyboard.press("4")
    page.wait_for_function(f"window.__tw.sku !== {json.dumps(first)}", timeout=20_000)
    request = urllib.request.Request(
        "http://127.0.0.1:8096/ratings", headers=tw_sandbox.HEADERS
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        ratings = json.load(response)
    assert ratings[f"figures-01/{first}/model"]["stars"] == 4

    shot = "/tmp/turnip-works-figures-review.png"
    page.screenshot(path=shot, full_page=False)
    browser.close()
    print(f"PASS figures-01: 518 assets; {first} loaded in three views; sandboxed 4 saved; {shot}")
