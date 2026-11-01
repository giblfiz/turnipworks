# cdp.py 'python snippet' : attach to the walk's Chrome (CDP :9333), run the snippet with `b` (browser), `pages()`
import sys, time
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    B_ = p.chromium.connect_over_cdp('http://[::1]:9333')
    def pages(): return [pg for c in B_.contexts for pg in c.pages]
    exec(sys.stdin.read())
