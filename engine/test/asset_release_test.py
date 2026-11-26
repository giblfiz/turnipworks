#!/usr/bin/env python3
"""THE ASSETS PAGE'S PACK DOWNLOADS (2026-11-07; engine/tools/site_assets.py, docs/site/asset-release.json)

  python3 engine/test/asset_release_test.py            offline: the data, the page with and without the release, the gate
  python3 engine/test/asset_release_test.py --remote   and, with gh, every zip is on the release at its size and SHA-256

  DATA     asset-release.json names a repo, a tag and `published`; every pack on the page (the game's Build tree) has a game
           zip and an HD zip; the figures one game zip and an HD zip per group; file names unique, sizes and SHA-256 given
  BUILD    where the build's folder is on this machine (/mnt/usb/turnip-works/asset-packs/<tag>/): every zip named is in its
           SHA256SUMS with that SHA-256 and on disk at that size (else: skipped, said so)
  OFF      the page as built (published false): no link to the release anywhere, no download row, no release in the script
  ON       the page as published (build_site.py --assets-preview): every pack card has its downloads with sizes, every link
           is <repo>/releases/download/<tag>/<a file the release lists>, one "All packs" link to the release page, the
           page's script carries every pack's zips, and the JSON-LD lists them
  GATE     `published` is true only if `gh release view <tag>` says the release is not a draft (gh failing = fail)
  REMOTE   (--remote) every zip is an asset of the release (draft or not) at the same size and SHA-256 (GitHub's digest)
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(ENGINE, 'tools'))
import build_site, site_assets  # noqa: E402

REMOTE = '--remote' in sys.argv
GH_ENV = {**os.environ, 'GH_CONFIG_DIR': os.environ.get('GH_CONFIG_DIR', '~/.config/gh')}
results = []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

rel = json.load(open(site_assets.RELEASE, encoding='utf-8'))
d, metas = build_site.assets_data()
page = [p['slug'] for p in d['packs']]
zips = [z for zs in rel['packs'].values() for z in zs]
names = {z['file'] for z in zips}

print('DATA')
check(rel.get('repo') == 'giblfiz/turnipworks' and re.fullmatch(r'assets-\d{4}-\d\d-\d\d', rel.get('tag', '')) and isinstance(rel.get('published'), bool),
      'the release is named: repo, tag, published', f"{rel.get('repo')} {rel.get('tag')} published={rel.get('published')}")
check(set(rel['packs']) == set(page), 'one entry per pack on the page, no other', f"missing {sorted(set(page) - set(rel['packs']))}, extra {sorted(set(rel['packs']) - set(page))}")
props = [s for s in page if s != 'figures']
check(all(sum(z['edition'] == e for z in rel['packs'].get(s, [])) == 1 for s in props for e in ('game', 'hd')), 'every pack has one game zip and one HD zip', f'{len(props)} packs')
fz = rel['packs'].get('figures', []); groups = [r['key'] for r in next(p for p in d['packs'] if p['slug'] == 'figures')['rooms']]
check(sum(z['edition'] == 'game' for z in fz) == 1 and sorted(z.get('group') for z in fz if z['edition'] == 'hd') == sorted(g for g in groups if any(z.get('group') == g for z in fz)) and len([z for z in fz if z['edition'] == 'hd']) >= 5,
      'the figures: one game zip, an HD zip per group (each a group on the page)', [z.get('group') for z in fz if z['edition'] == 'hd'])
check(len(names) == len(zips) and all(re.fullmatch(r'turnipworks-[a-z0-9-]+-' + rel['tag'][7:] + r'\.zip', z['file']) for z in zips), 'file names unique and of this release', f'{len(zips)} zips')
check(all(z['bytes'] > 1000 and z['bytes'] < 2 * 1024 ** 3 and re.fullmatch(r'[0-9a-f]{64}', z['sha256']) for z in zips), 'every zip has its size (under GitHub\'s 2 GiB) and SHA-256')

print('BUILD')
built = f"/mnt/usb/turnip-works/asset-packs/{rel['tag']}"
if os.path.isfile(os.path.join(built, 'SHA256SUMS')):
    sums = dict(reversed(line.split(None, 1)) for line in open(os.path.join(built, 'SHA256SUMS')).read().splitlines() if line.strip())
    sums = {k.strip(): v for k, v in sums.items()}
    bad = [z['file'] for z in zips if sums.get(z['file']) != z['sha256'] or os.path.getsize(os.path.join(built, z['file'])) != z['bytes']]
    check(not bad, 'every zip named is in the build\'s SHA256SUMS, at that SHA-256 and size', ', '.join(bad[:5]) or f'{len(zips)} zips, {built}')
    check(set(sums) == names, 'and the build has no zip the page leaves out', sorted(set(sums) - names)[:5])
else:
    print(f'  (skipped: the build folder {built} is not on this machine)')

print('OFF')
mp = {p: build_site.front(open(os.path.join(build_site.SRC, p + '.md'), encoding='utf-8').read())[0] for p in build_site.NAV + build_site.HELP}
off = build_site.render('assets', mp)
saved = rel['published']
if saved:  # (the flag is true: render the page as if it were not, to check the gate's off side too)
    site_assets_release = site_assets.release
    site_assets.release = lambda path=None, force_published=False: site_assets_release(path, True) if force_published else None
    off = build_site.render('assets', mp)
    site_assets.release = site_assets_release
check('/releases/' not in off and 'class="pkdl"' not in off and '"release"' not in off and '<p class="rel">' not in off,
      'unpublished: the page has no release link, no download row, no release in its script')

print('ON')
on = build_site.render('assets', mp, preview=True)
dl = f"https://github.com/{rel['repo']}/releases/download/{rel['tag']}/"
hrefs = re.findall(r'href="(https://github\.com/[^"]+)"', on)
cards = re.findall(r'<li[^>]*><a class="pk" id="pack/([^"]+)".*?</li>', on)
rows = dict(re.findall(r'<a class="pk" id="pack/([^"]+)".*?(<span class="pkdl">.*?</span>)</li>', on))
check(len(cards) == len(page) and set(rows) == set(page), 'published: every pack card has a download row', f'{len(rows)}/{len(page)} cards')
def card_ok(s):
    zs = rel['packs'][s]; row = rows.get(s, '')
    game = [z for z in zs if z['edition'] == 'game']; hd = [z for z in zs if z['edition'] == 'hd']
    ok = all(f'href="{dl}{z["file"]}"' in row and site_assets.size(z['bytes']) in row for z in game)
    if len(hd) == 1: ok &= f'href="{dl}{hd[0]["file"]}"' in row and site_assets.size(hd[0]['bytes']) in row
    else: ok &= f'href="#pack/{s}"' in row and site_assets.size(sum(z['bytes'] for z in hd)) in row
    return ok
badc = [s for s in page if not card_ok(s)]
check(not badc, 'each card links its game and HD zips (the figures\' HD: to their view), with sizes', ', '.join(badc[:5]))
linked = [h for h in hrefs if h.startswith(dl)]
check(linked and all(h[len(dl):] in names for h in linked), 'every download link is a file the release lists', f'{len(linked)} links')
check(on.count(f'href="https://github.com/{rel["repo"]}/releases/tag/{rel["tag"]}"') == 1, 'one "All packs" link, to the release page')
cfg = json.loads(re.search(r'window\.TW_ASSETS = (\{.*?\});</script>', on).group(1).replace('<\\/', '</'))
check(cfg.get('release') and {z['url'][len(dl):] for v in cfg['release']['packs'].values() for z in v} == names, 'the script carries every pack\'s zips (the pack views draw them)')
ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', on).group(1).replace('<\\/', '</'))
check({x['contentUrl'][len(dl):] for x in ld['distribution'] if x['encodingFormat'] == 'application/zip'} == names, 'the JSON-LD lists every zip as a download')

print('GATE')
r = subprocess.run(['gh', 'release', 'view', rel['tag'], '-R', rel['repo'], '--json', 'isDraft,tagName'], capture_output=True, text=True, env=GH_ENV)
state = json.loads(r.stdout) if r.returncode == 0 else None
if rel['published']:
    check(state is not None and state.get('isDraft') is False, '`published` is true and gh says the release is published', state or r.stderr.strip()[:200])
else:
    check(True, '`published` is false: no link is shown', 'gh: ' + ('draft' if state and state.get('isDraft') else 'published, flip the flag' if state else 'release not visible as a tag (a draft, or gh unavailable)'))

if REMOTE:
    print('REMOTE')
    rs = json.loads(subprocess.run(['gh', 'api', f"repos/{rel['repo']}/releases?per_page=100"], capture_output=True, text=True, env=GH_ENV, check=True).stdout)
    mine = [x for x in rs if x['tag_name'] == rel['tag']]
    check(len(mine) == 1, 'exactly one release (draft or not) has the tag', len(mine))
    if mine:
        assets = {a['name']: a for a in json.loads(subprocess.run(['gh', 'api', '--paginate', f"repos/{rel['repo']}/releases/{mine[0]['id']}/assets?per_page=100"], capture_output=True, text=True, env=GH_ENV, check=True).stdout.replace('][', ','))}
        bad = [z['file'] for z in zips if z['file'] not in assets or assets[z['file']]['size'] != z['bytes'] or assets[z['file']].get('digest') != 'sha256:' + z['sha256'] or assets[z['file']].get('state') != 'uploaded']
        check(not bad, 'every zip is on the release at its size and SHA-256 (GitHub\'s digest)', ', '.join(bad[:5]) or f'{len(zips)} zips')
        check(mine[0]['draft'] == (not rel['published']) or rel['published'] is False, 'the flag agrees with the release', f"draft={mine[0]['draft']}")

print(f'\n{sum(results)}/{len(results)} passed')
sys.exit(0 if all(results) else 1)
