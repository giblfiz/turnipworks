#!/usr/bin/env python3
"""Blind ten-way condition matching at actual 31px size, with hash-bound evidence.

Defaults to both sets, primary + each single-condition alternate substitution.
Only candidate.png and a neutral name-list prompt go to Gemini. The answer key
and source/export hashes stay local. Scores are evidence, not acceptance.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
from io import BytesIO
import json
from pathlib import Path
import random
import re
import time
from PIL import Image, ImageDraw
import process as pipeline


def configurations(plan, arcs, selected_sets=None):
    condition_ids = next(arc['co_visible_ids'] for arc in arcs['arcs'] if arc['id'] == 'conditions')
    if len(condition_ids) != 10 or len(set(condition_ids)) != 10:
        raise ValueError('Condition confusion test requires exactly ten distinct IDs')
    lookup = {(pic['set'], action, pic['alt']): pic for pic in plan['pictures']
              for action in pic['actions'] if action in condition_ids}
    sets = selected_sets or [entry['id'] for entry in plan['sets']]
    output = []
    for set_id in sets:
        if any((set_id, action, 0) not in lookup for action in condition_ids):
            raise ValueError(f'{set_id}: condition plan missing one or more primaries')
        alternatives = [(action, alt) for sid, action, alt in lookup if sid == set_id and alt != 0]
        variants = [('primary', {})] + [(f'{action}--alt{alt}', {action: alt}) for action, alt in sorted(alternatives)]
        for config, override in variants:
            members = [(action, lookup[(set_id, action, override.get(action, 0))]) for action in condition_ids]
            output.append((set_id, config, members))
    return output


def prepare(set_id, config, members, seed, titles, write=True):
    _, _, ground = pipeline.load_inventory(pipeline.BATCH / 'inventory.json')
    entries = []
    for action, pic in members:
        source = pipeline.source_path(pic)
        file = pipeline.ASSETS / set_id / 'sizes' / '31' / f'{pipeline.stem(pic)}.webp'
        provenance = pipeline.BATCH / 'provenance' / set_id / f'{pipeline.stem(pic)}.json'
        if not source.exists() or not file.exists() or not provenance.exists():
            return None
        sha = pipeline.digest(source)
        prov = json.loads(provenance.read_text())
        if prov.get('source_sha256') != sha or prov.get('sha256', {}).get('31') != pipeline.digest(file):
            return None  # Source changed; wait for packaging rather than read stale art.
        with Image.open(file) as im:
            if im.size != (31, 31):
                raise ValueError(f'{file}: expected 31x31')
        entries.append({'action': action, 'condition': titles.get(action, pic['title']),
                        'picture_id': pic['id'], 'set': set_id, 'alt': pic['alt'],
                        'source': str(source.relative_to(pipeline.REPO)), 'source_sha256': sha,
                        'file': file.relative_to(pipeline.ASSETS).as_posix(), 'file_sha256': pipeline.digest(file)})
    random.Random(f'{seed}:{set_id}:{config}').shuffle(entries)
    names = [entry['condition'] for entry in entries]
    random.Random(f'{seed}:{set_id}:{config}:names').shuffle(names)
    prompt = ('These are ten original status icons for tabletop pawns, shown at 31 pixels. '
              'Each is identified only by a letter A through J. Match each icon to exactly one '
              'D&D condition from this shuffled list, using every name exactly once: '
              + ', '.join(names) + '.\n'
              'Return only JSON of this exact shape: {"matches":{"A":"condition name",'
              '"B":"condition name","C":"condition name","D":"condition name",'
              '"E":"condition name","F":"condition name","G":"condition name",'
              '"H":"condition name","I":"condition name","J":"condition name"},'
              '"uncertain":["letters that were ambiguous"]}. '
              'Judge the visible silhouettes and colours. Do not infer meaning from filenames. '
              'Even if uncertain, give your best one-to-one matching and include that letter in uncertain.')
    for index, entry in enumerate(entries):
        entry['label'] = chr(ord('A') + index)
    identity = {'set': set_id, 'configuration': config, 'seed': seed, 'members': entries,
                'prompt': prompt, 'model': pipeline.MODEL, 'icon_size': 31, 'ground': ground}
    fingerprint = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:16]
    folder = pipeline.BATCH / 'confusion' / pipeline.safe(set_id) / pipeline.safe(config) / fingerprint
    if write:
        folder.mkdir(parents=True, exist_ok=True)
    canvas = Image.new('RGBA', (5 * 83, 2 * 96), ground)
    draw = ImageDraw.Draw(canvas)
    for i, entry in enumerate(entries):
        x, y = (i % 5) * 83, (i // 5) * 96
        with Image.open(pipeline.ASSETS / entry['file']) as icon:
            canvas.alpha_composite(icon.convert('RGBA'), (x + 26, y + 18))
        draw.text((x + 36, y + 60), entry['label'], fill='#eee8da', font=pipeline.font(14))
    candidate = folder / 'candidate.png'
    encoded = BytesIO()
    canvas.convert('RGB').save(encoded, format='PNG')
    identity['candidate_sha256'] = hashlib.sha256(encoded.getvalue()).hexdigest()
    identity['prompt_sha256'] = hashlib.sha256(prompt.encode()).hexdigest()
    if write:
        candidate.write_bytes(encoded.getvalue())
        (folder / 'prompt.txt').write_text(prompt + '\n')
        pipeline.atomic_json(folder / 'answer-key.json', identity)
    return {'read_dir': folder, 'pic': {'set': set_id, 'id': config, 'alt': 0}, 'key': identity}


def score(item, write=True):
    folder = item['read_dir']
    path = folder / 'result.json'
    if not path.exists():
        return {'status': 'not-read'}
    result = json.loads(path.read_text())
    if result.get('returncode') != 0:
        return {'status': 'gate-error', 'error': result.get('error')}
    raw = result.get('read', '').strip()
    if raw.startswith('```'):
        raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw)
    try:
        parsed = json.loads(raw)
        matches, uncertain = parsed['matches'], parsed.get('uncertain', [])
        key = {row['label']: row['condition'] for row in item['key']['members']}
        norm = lambda value: str(value).strip().casefold()
        labels_ok = set(matches) == set(key)
        names_ok = sorted(map(norm, matches.values())) == sorted(map(norm, key.values()))
        rows = [{'label': label, 'expected': name, 'predicted': matches.get(label),
                 'correct': norm(matches.get(label, '')) == norm(name), 'uncertain': label in uncertain}
                for label, name in key.items()]
        scored = {'status': 'scored' if labels_ok and names_ok else 'invalid-matching',
                  'correct': sum(row['correct'] for row in rows), 'total': 10,
                  'one_to_one': labels_ok and names_ok, 'uncertain': uncertain, 'matches': rows,
                  'candidate_sha256': item['key']['candidate_sha256'],
                  'note': 'Matching score is evidence only; no automatic acceptance.'}
    except (ValueError, KeyError, TypeError) as exc:
        scored = {'status': 'unparseable-response', 'error': str(exc), 'raw_read_retained': True}
    if write:
        pipeline.atomic_json(folder / 'score.json', scored)
    return scored


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--once', action='store_true')
    mode.add_argument('--follow', action='store_true')
    parser.add_argument('--set', dest='sets', action='append', help='Limit sets; default all plan sets.')
    parser.add_argument('--configuration', action='append', help='primary or a condition ID followed by --altN; default all.')
    parser.add_argument('--seed', type=int, default=20261015)
    parser.add_argument('--no-gates', action='store_true')
    parser.add_argument('--retry-errors', action='store_true')
    parser.add_argument('--allow-pending', action='store_true')
    parser.add_argument('--interval', type=float, default=15)
    args = parser.parse_args()
    while True:
        plan = json.loads((pipeline.BATCH / 'plan.json').read_text())
        arcs = json.loads((pipeline.BATCH / 'round2-arcs.json').read_text())
        titles, _, _ = pipeline.load_inventory(pipeline.BATCH / 'inventory.json')
        specs = configurations(plan, arcs, args.sets)
        if args.configuration:
            specs = [spec for spec in specs if spec[1] in args.configuration]
        if not specs:
            raise SystemExit('No matching confusion configurations')
        ready, pending = [], []
        for set_id, config, members in specs:
            item = prepare(set_id, config, members, args.seed, titles)
            if item is None:
                pending.append(f'{set_id}/{config}')
            else:
                ready.append(item)
        if not args.no_gates:
            with ThreadPoolExecutor(max_workers=3) as pool:
                for future in as_completed([pool.submit(pipeline.gate, item, args.retry_errors) for item in ready]):
                    future.result()
        summary = [{'set': item['key']['set'], 'configuration': item['key']['configuration'],
                    'evidence': item['read_dir'].relative_to(pipeline.BATCH).as_posix(), **score(item)} for item in ready]
        pipeline.atomic_json(pipeline.BATCH / 'confusion' / 'index.json', {'runs': summary, 'pending': pending})
        print(json.dumps({'ready': len(ready), 'pending': len(pending),
                          'scores': [(r['set'], r['configuration'], r.get('correct'), r['status']) for r in summary]}), flush=True)
        if not args.follow:
            return 0 if not pending or args.allow_pending else 2
        time.sleep(args.interval)


if __name__ == '__main__':
    raise SystemExit(main())
