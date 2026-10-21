#!/usr/bin/env python3
"""Current reviewer keys and per-asset writes (October 2 score-and-advance contract).

Set TW_REVIEW_URL to a served web/review/ page. The API is intercepted and delayed
so changing selection while a save is in flight must still save to the right SKU.
"""
import json
import os
from pathlib import Path
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parent))
import tw_sandbox
from playwright.sync_api import sync_playwright

posts, ratings = [], {}
checks = 0

def check(ok, message):
    global checks
    assert ok, message
    checks += 1
    print('PASS ' + message, flush=True)

def ratings_route(route):
    if route.request.method == 'GET':
        route.fulfill(status=200, content_type='application/json', body=json.dumps(ratings))
        return
    payload = route.request.post_data_json
    time.sleep(.12)  # Deliberately keep the save in flight during navigation.
    posts.append(payload.copy())
    record = {**payload, 'at': 'test'}
    ratings[payload['key']] = record
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'record': record}))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1280, 'height':900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.route('**/api/tw-ratings/ratings', ratings_route)
    page.goto(os.environ.get('TW_REVIEW_URL', 'http://127.0.0.1:8877/review/'))
    page.wait_for_function('window.__tw && __tw.sku && window.__twDebug')
    def sku(): return page.evaluate('__twDebug.selected')
    def saved(key, predicate):
        deadline=time.monotonic()+10
        while not predicate(ratings.get(key,{})) and time.monotonic()<deadline:
            page.wait_for_timeout(20)
        return predicate(ratings.get(key,{}))
    first=sku()
    for key, score in [('4',4),('Numpad5',5)]:
        before=sku()
        page.keyboard.press(key)
        page.wait_for_function('s => __twDebug.selected !== s',arg=before)
        check(saved(f'inn-01/{before}/model',lambda r:r.get('stars')==score), f'{key}: saves the selected SKU with score {score} and advances')
    third=sku()
    page.keyboard.press('Shift+2');page.keyboard.press('Shift+Numpad3')
    check(sku()==third and f'inn-01/{third}/plate' not in ratings, 'Shift+digits do not score plates or navigate (retired binding)')
    page.locator('.rate[data-target=plate] button[data-stars="3"]').click()
    check(saved(f'inn-01/{third}/plate',lambda r:r.get('stars')==3), 'plate score is saved by its visible button')
    page.locator('body').click(position={'x':900,'y':80})
    page.keyboard.press('n')
    note=page.locator('.rate[data-target=model] textarea')
    check(note.evaluate('e => e === document.activeElement'), 'N focuses the model note')
    page.keyboard.type('Crooked leg 7')
    check(sku()==third and note.input_value()=='Crooked leg 7', 'digits in a note stay text and do not score or advance')
    page.keyboard.press('Enter')
    check(saved(f'inn-01/{third}/model',lambda r:r.get('note')=='Crooked leg 7'), 'Enter saves the note to its original SKU')
    page.keyboard.press('2');page.wait_for_function('s => __twDebug.selected !== s',arg=third)
    check(saved(f'inn-01/{third}/model',lambda r:r.get('stars')==2 and r.get('note')=='Crooked leg 7'), 'score-and-advance retains the note')
    page.keyboard.press('u');page.wait_for_function('s => __twDebug.selected === s',arg=third)
    check(saved(f'inn-01/{third}/model',lambda r:r.get('stars') is None and r.get('note')=='Crooked leg 7'), 'U restores previous score and note and selects that SKU')
    page.keyboard.press('Tab');page.wait_for_function('s => __twDebug.selected !== s',arg=third)
    page.keyboard.press('Shift+Tab');page.wait_for_function('s => __twDebug.selected === s',arg=third)
    check(sku()==third, 'Tab advances and Shift+Tab returns')
    page.keyboard.press('/')
    search=page.locator('#f-name')
    page.keyboard.type('apple 4')
    check(search.input_value()=='apple 4', '/ focuses search and digits remain search text')
    check(not errors, f'no page or console errors: {errors}')
    print(f'PASS reviewer_hotkeys: {checks}/{checks}')
    browser.close()
