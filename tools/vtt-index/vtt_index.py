#!/usr/bin/env python3
"""THE VTT COMPARISON INDEX: keep docs/site/vtt-index.json honest.  (2026-10-29; how-to: docs/VTT_INDEX.md)

  python3 tools/vtt-index/vtt_index.py validate              the JSON against docs/site/vtt-index.schema.json, plus the
                                                             house rules (unique ids, values from each criterion's list)
  python3 tools/vtt-index/vtt_index.py stats                 rows per group, alive / dead / unknown
  python3 tools/vtt-index/vtt_index.py alive [--group indie] [--id x,y] [--dry-run] [--gap 2.5]
                                                             re-check whether each product's site is still up: robots.txt
                                                             first, then ONE GET of the product's page, one request at a
                                                             time, >= --gap seconds apart; writes alive {state, checked, how}
  python3 tools/vtt-index/vtt_index.py set ID FIELD VALUE [--note ...] [--src URL] [--unverified]
                                                             change one cell (e.g. our row when a feature lands on prod:
                                                             set turnip-works ddb yes --note "Beyond20 rolls ... (live)")
  python3 tools/vtt-index/vtt_index.py add ID "Name" --group indie|established --url URL [--kind vtt]
                                                             a new row with every cell "?" (fill it with set, then validate)
Every write bumps the file's "updated" date; set and add also the row's "last_checked" (the date its features were
last checked; alive only writes alive.checked). Then rebuild the page:
python3 engine/tools/build_site.py (engine/deploy.sh runs it).

alive: 2xx = alive (a Steam link that lands on the store's front page = dead: the app was removed); 404 / 410 / a name
that no longer resolves / a parked "domain for sale" page = dead; anything else (403, 5xx, timeouts, Discord-only or
Kickstarter links, robots.txt saying no) = unknown, with the reason in "how". Logs into nothing; sends no data.
"""
import argparse, datetime, json, os, re, socket, ssl, sys, time, urllib.error, urllib.parse, urllib.request, urllib.robotparser

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
DATA = os.environ.get('VTT_INDEX_JSON') or os.path.join(REPO, 'docs', 'site', 'vtt-index.json')  # (the env var: a copy to work on)
SCHEMA = os.path.join(REPO, 'docs', 'site', 'vtt-index.schema.json')
UA = 'TurnipWorksVTTIndex/1.0 (+https://turnipworks.net/vtt-index; checks only whether a product site is up)'
PARKED = re.compile(r'domain (name )?(is|may be) for sale|buy this domain|this domain is parked|parked free|domain has expired|hugedomains|sedoparking|dan\.com', re.I)
TODAY = datetime.date.today().isoformat()


def load():
    return json.load(open(DATA, encoding='utf-8'))


def save(d):
    d['updated'] = TODAY
    with open(DATA, 'w', encoding='utf-8') as f:
        json.dump(d, f, indent=1, ensure_ascii=False); f.write('\n')


def problems(d):
    out = []
    try:
        import jsonschema
        v = jsonschema.Draft202012Validator(json.load(open(SCHEMA, encoding='utf-8')))
        out += [f"schema: {'/'.join(map(str, e.path))}: {e.message[:200]}" for e in v.iter_errors(d)]
    except ImportError:
        out.append('schema: python3 -m pip install jsonschema to check the schema')
    crit = {c['id']: c for c in d.get('criteria', [])}
    seen = set()
    for p in d.get('products', []):
        if p['id'] in seen: out.append(f"{p['id']}: the id is used twice")
        seen.add(p['id'])
        for fid, cell in p.get('features', {}).items():
            c = crit.get(fid)
            if not c: out.append(f"{p['id']}.{fid}: no such criterion"); continue
            if c['values'] == ['note']: continue
            vals = cell['v'] if isinstance(cell['v'], list) else [cell['v']]
            if bool(c.get('multi')) != isinstance(cell['v'], list): out.append(f"{p['id']}.{fid}: {'a list' if c.get('multi') else 'one value'} expected")
            bad = [v for v in vals if v not in c['values']]
            if bad: out.append(f"{p['id']}.{fid}: {bad} is not one of {c['values']}")
        missing = [c for c in crit if c not in p.get('features', {})]
        if missing: out.append(f"{p['id']}: no cell for {missing}")
        if 'vibe' in json.dumps(p).lower(): out.append(f"{p['id']}: says 'vibe'")
    if sum(p['group'] == 'ours' for p in d.get('products', [])) != 1: out.append('exactly one row is ours')
    return out


def cmd_validate(a):
    bad = problems(load())
    for b in bad: print('  ' + b)
    print(f"vtt-index.json: {'OK' if not bad else f'{len(bad)} problems'}")
    sys.exit(1 if bad else 0)


def cmd_stats(a):
    d = load(); P = d['products']
    for g in ('ours', 'established', 'indie'):
        rows = [p for p in P if p['group'] == g]
        al = {s: sum(p['alive']['state'] == s for p in rows) for s in ('alive', 'dead', 'unknown')}
        print(f"{g:<12} {len(rows):>4}   alive {al['alive']}  dead {al['dead']}  unknown {al['unknown']}")
    print(f"{'all':<12} {len(P):>4}   updated {d['updated']}")


_robots = {}
_last = [0.0]


def polite(gap):
    wait = _last[0] + gap - time.time()
    if wait > 0: time.sleep(wait)
    _last[0] = time.time()


def robots_ok(url, gap):
    u = urllib.parse.urlsplit(url); host = f'{u.scheme}://{u.netloc}'
    if host not in _robots:
        rp = urllib.robotparser.RobotFileParser(); polite(gap)
        try:
            req = urllib.request.Request(host + '/robots.txt', headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=15, context=ssl.create_default_context()) as r:
                rp.parse(r.read(200_000).decode('utf-8', 'replace').splitlines())
        except urllib.error.HTTPError as e:
            rp.parse([] if e.code in (404, 410) or e.code >= 500 else ['User-agent: *', 'Allow: /'])
        except Exception:
            rp = None  # no robots.txt to be had (the page fetch will tell us more)
        _robots[host] = rp
    rp = _robots[host]
    return True if rp is None else rp.can_fetch(UA, url)


def check(url, gap):
    """-> (state, how)"""
    if not url or not re.match(r'^https?://', url): return 'unknown', 'no website to check'
    host = urllib.parse.urlsplit(url).netloc.lower()
    if re.search(r'(^|\.)(discord\.gg|discord\.com|reddit\.com|youtu\.be|youtube\.com|imgur\.com|testflight\.apple\.com)$', host): return 'unknown', f'only a {host} link: not checked'
    if re.search(r'(^|\.)kickstarter\.com$', host): return 'unknown', 'Kickstarter refuses scripted visits: not checked'
    try: socket.getaddrinfo(host.split(':')[0], None)
    except socket.gaierror: return 'dead', 'the site name no longer resolves (DNS)'
    if not robots_ok(url, gap): return 'unknown', "the site's robots.txt asks us not to check"
    polite(gap)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,*/*;q=0.5'})
        with urllib.request.urlopen(req, timeout=20, context=ssl.create_default_context()) as r:
            final, code, body = r.geturl(), r.status, r.read(64_000).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        if e.code in (404, 410): return 'dead', f'the page answers {e.code}'
        return 'unknown', f'the page answers {e.code}'
    except (urllib.error.URLError, socket.timeout, ssl.SSLError, ConnectionError, OSError) as e:
        why = getattr(e, 'reason', e)
        return 'unknown', f'no answer ({str(why)[:80]})'
    if 'store.steampowered.com/app/' in url and '/app/' not in final: return 'dead', 'the Steam page now lands on the store front (removed)'
    if 'itch.io' in host and re.search(r"We couldn't find your page|404 Not Found", body): return 'dead', 'itch.io says the page is gone'
    if PARKED.search(body) and len(body) < 40_000: return 'dead', 'the domain shows a parked / for-sale page'
    return 'alive', f'answered {code}' + (f' (via {urllib.parse.urlsplit(final).netloc})' if urllib.parse.urlsplit(final).netloc != host else '')


def cmd_alive(a):
    d = load(); ids = set(a.id.split(',')) if a.id else None
    rows = [p for p in d['products'] if (not ids or p['id'] in ids) and (a.group in ('all', p['group'])) and p['group'] != 'ours']
    print(f'checking {len(rows)} sites, one at a time, >= {a.gap}s apart', file=sys.stderr)
    for i, p in enumerate(rows, 1):
        state, how = check(p.get('url'), a.gap)
        print(f'[{i}/{len(rows)}] {state:<8} {p["id"]:<34} {how}', flush=True)
        if not a.dry_run:
            p['alive'] = {'state': state, 'checked': TODAY, 'how': how}  # (a site check, not a feature check: last_checked stays)
            save(d)  # after every row: an interrupted run keeps what it learned
    if not a.dry_run: print('written: docs/site/vtt-index.json (now: python3 engine/tools/build_site.py)', file=sys.stderr)


def cmd_set(a):
    d = load(); p = next((p for p in d['products'] if p['id'] == a.id), None)
    if not p: sys.exit(f'no row {a.id}')
    crit = {c['id']: c for c in d['criteria']}
    if a.field not in crit: sys.exit(f'no criterion {a.field}: one of {", ".join(crit)}')
    v = [x.strip() for x in a.value.split(',')] if crit[a.field].get('multi') else a.value
    cell = p['features'].get(a.field, {})
    cell = {'v': v, 'note': a.note if a.note is not None else cell.get('note', ''), 'src': a.src if a.src is not None else cell.get('src'), 'verified': not a.unverified}
    p['features'][a.field] = cell; p['last_checked'] = TODAY
    bad = problems(d)
    if bad: sys.exit('not written:\n  ' + '\n  '.join(bad))
    save(d); print(f'{a.id}.{a.field} = {json.dumps(cell, ensure_ascii=False)}')


def cmd_add(a):
    d = load()
    if any(p['id'] == a.id for p in d['products']): sys.exit(f'{a.id} exists')
    feats = {c['id']: ({'v': ['?'] if c.get('multi') else ('note' if c['values'] == ['note'] else '?'), 'note': ''}) for c in d['criteria']}
    d['products'].append({'id': a.id, 'name': a.name, 'maker': None, 'group': a.group, 'kind': a.kind, 'url': a.url, 'summary': a.summary or '',
                          'alive': {'state': 'unknown', 'checked': TODAY, 'how': 'not yet checked'}, 'last_checked': TODAY, 'licence': None,
                          'features': feats, 'upsides': [], 'downsides': [], 'sources': [{'url': a.url, 'label': 'Official site'}] if a.url else []})
    bad = problems(d)
    if bad: sys.exit('not written:\n  ' + '\n  '.join(bad))
    save(d); print(f'added {a.id}: now fill its cells with `set`, its upsides/downsides by hand, then `alive --id {a.id}`')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('validate').set_defaults(f=cmd_validate)
    sub.add_parser('stats').set_defaults(f=cmd_stats)
    s = sub.add_parser('alive'); s.add_argument('--group', default='indie', choices=['indie', 'established', 'all']); s.add_argument('--id'); s.add_argument('--dry-run', action='store_true'); s.add_argument('--gap', type=float, default=2.5); s.set_defaults(f=cmd_alive)
    s = sub.add_parser('set'); s.add_argument('id'); s.add_argument('field'); s.add_argument('value'); s.add_argument('--note'); s.add_argument('--src'); s.add_argument('--unverified', action='store_true'); s.set_defaults(f=cmd_set)
    s = sub.add_parser('add'); s.add_argument('id'); s.add_argument('name'); s.add_argument('--group', required=True, choices=['indie', 'established']); s.add_argument('--url'); s.add_argument('--kind', default='vtt'); s.add_argument('--summary'); s.set_defaults(f=cmd_add)
    a = ap.parse_args(); a.f(a)


if __name__ == '__main__':
    main()
