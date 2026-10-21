"""Canary bench contract (the empty pre-canary page was retired 2026-09-30).

The catalogue supplies the expected cards; every card must load its own plate and
model. Set TURNIP_WORKS_URL to a site serving the repository's web/ directory.
"""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import tw_sandbox
from playwright.sync_api import sync_playwright


def main():
    errors, failed = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('requestfailed', lambda request: failed.append(request.url))
        page.goto(os.environ.get('TURNIP_WORKS_URL', 'http://127.0.0.1:4173/'), wait_until='domcontentloaded')
        assets = page.evaluate("fetch('canary/2026-09-30-inn/canary.json').then(r => { if (!r.ok) throw Error(r.status); return r.json(); })")
        assert assets, 'canary catalogue must not be empty'
        assert page.title() == 'Turnip Works — Asset Bench'
        page.wait_for_function('n => document.querySelectorAll("#bench article.asset").length === n', arg=len(assets))
        cards = page.locator('#bench article.asset')
        for i, asset in enumerate(assets):
            card = cards.nth(i)
            assert card.get_by_role('heading', name=asset['name'], exact=True).is_visible()
            viewer = card.locator('model-viewer')
            viewer.scroll_into_view_if_needed()
            viewer.evaluate("el => { el.loading = 'eager'; }")
            page.wait_for_function("id => { const e = [...document.querySelectorAll('#bench model-viewer')].find(e => e.src.includes('/'+id+'.glb')); return e && e.loaded; }", arg=asset['id'], timeout=90000)
            assert card.locator('.plate img').evaluate('img => img.complete && img.naturalWidth > 0'), asset['id']
            assert f"/{asset['id']}.glb" in viewer.get_attribute('src')
        assert page.get_by_role('link', name='Open the live inn-01 batch review →').get_attribute('href') == 'review/'
        assert not errors, errors
        assert not failed, failed
        print(f'PASS canary bench: {len(assets)} catalogue cards, plates and real loaded models; review link; no page/console/network errors')
        browser.close()


if __name__ == '__main__':
    main()
