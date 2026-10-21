#!/usr/bin/env python3
"""Size generated ring art, retain provenance, and collect unlabelled blind reads.

Only deterministic packaging: no drawing, recolouring, masks, or alpha removal.
Run with browser-venv's Python (Pillow), --once or --follow. The latter watches
plan.json until interrupted. Read results are evidence, never automatic approval.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import time

from PIL import Image, ImageDraw, ImageFont

DEFAULT_SIZES = [18, 19, 22, 26, 31, 36, 38, 42, 44, 50, 52, 62, 84, 100, 128]
BATCH = Path(__file__).resolve().parents[1]
REPO = BATCH.parents[1]
ASSETS = REPO / 'tools/spawn-tuner/assets/ui-icons'
MODEL = 'gemini-3.1-pro-preview'
PYTHON = 'python3'
VISION = '~/fauna-tools/gemini-vision.py'
BLIND_PROMPT = '''This is one unlabelled button in the contextual menu around a selected piece
in a browser 3D virtual tabletop. View it at its supplied size.
What action does this button perform on the selected piece?
First describe the visible objects and marks, then give your single best action
interpretation and confidence (low/medium/high). If ambiguous, state why and one
plausible alternative. Do not assume any action from the filename. Be concise.'''


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def atomic_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')
    temporary.replace(path)


def safe(value):
    value = str(value)
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', value) or value in ('.', '..'):
        raise ValueError(f'Unsafe identifier: {value!r}')
    return value


def stem(pic):
    alt = int(pic.get('alt', 0))
    if alt < 0:
        raise ValueError('alt must be nonnegative')
    return safe(pic['id']) + (f'--alt{alt}' if alt else '')


def load_inventory(path):
    if not path.exists():
        return {}, DEFAULT_SIZES, '#1c1f24'
    inventory = json.loads(path.read_text())
    rows = inventory if isinstance(inventory, list) else inventory.get('actions', [])
    titles = ({key: row.get('title', key) for key, row in rows.items()}
              if isinstance(rows, dict) else
              {row.get('id', row.get('action')): row['title'] for row in rows})
    options = {} if isinstance(inventory, list) else inventory
    sizes = options.get('exportSizes', options.get('sizes', DEFAULT_SIZES))
    if not isinstance(sizes, list) or not all(isinstance(x, int) for x in sizes):
        sizes = DEFAULT_SIZES
    return titles, sorted(set(sizes + [31, 62, 128])), options.get('ringGround', '#1c1f24')


def source_path(pic):
    source = Path(pic['source'])
    if source.is_absolute():
        return source
    return REPO / source if (REPO / source).exists() else BATCH / source


def blind_prompt(pic):
    """Per-picture blind protocol, retaining the original prompt byte-for-byte by default."""
    prompt = pic.get('blind_prompt', pic.get('blindPrompt', BLIND_PROMPT))
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError(f"{pic.get('id')}: blind prompt must be a nonempty string")
    return prompt


def read_directory(pic, source_hash=None):
    """Current protocol evidence directory; source+prompt hashes prevent stale reads."""
    source_hash = source_hash or digest(source_path(pic))
    prompt_hash = hashlib.sha256(blind_prompt(pic).encode()).hexdigest()[:10]
    return BATCH / 'reads' / safe(pic['set']) / stem(pic) / f'{source_hash[:16]}-{prompt_hash}'


def prepare(pic, sizes, ground):
    set_id, name = safe(pic['set']), stem(pic)
    source = source_path(pic)
    if not source.is_file():
        return None
    sha = digest(source)
    provenance_path = BATCH / 'provenance' / set_id / f'{name}.json'
    previous = json.loads(provenance_path.read_text()) if provenance_path.exists() else {}
    with Image.open(source) as im:
        native = im.convert('RGBA')
    if native.getchannel('A').getextrema() == (255, 255):
        raise ValueError(f'{source}: generated source has no transparency; regenerate with alpha')
    # Preserve every generated pixel; only transparent padding for rectangular art.
    side = max(native.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.alpha_composite(native, ((side - native.width) // 2, (side - native.height) // 2))
    files, hashes = {}, {}
    for size in sizes:
        out = ASSETS / set_id / f'{name}.webp' if size == 128 else ASSETS / set_id / 'sizes' / str(size) / f'{name}.webp'
        out.parent.mkdir(parents=True, exist_ok=True)
        if previous.get('source_sha256') != sha or not out.exists():
            square.resize((size, size), Image.Resampling.LANCZOS).save(out, 'WEBP', lossless=True, exact=True)
        files[str(size)] = out.relative_to(ASSETS).as_posix()
        hashes[str(size)] = digest(out)
    read_dir = read_directory(pic, sha)
    read_dir.mkdir(parents=True, exist_ok=True)
    candidate = Image.new('RGBA', (67, 67), ground)
    with Image.open(ASSETS / files['31']) as icon:
        candidate.alpha_composite(icon.convert('RGBA'), (18, 18))
    candidate.convert('RGB').save(read_dir / 'candidate.png')
    (read_dir / 'prompt.txt').write_text(blind_prompt(pic) + '\n')
    prov = {'id': pic['id'], 'set': set_id, 'alt': int(pic.get('alt', 0)),
            'provider': 'OpenAI built-in image_gen', 'model': 'built-in image generation (tool-managed)',
            'prompt': pic['prompt'], 'references': pic.get('references', pic.get('refs', [])),
            'source': str(source.relative_to(REPO)) if source.is_relative_to(REPO) else str(source),
            'source_sha256': sha, 'source_size': list(native.size),
            'processing': 'Native alpha preserved; transparent square padding when needed; Lanczos resize; lossless WebP.',
            'files': files, 'sha256': hashes,
            'blind_model': MODEL, 'blind_prompt': blind_prompt(pic),
            'candidate_sha256': digest(read_dir / 'candidate.png'),
            'blind_prompt_sha256': hashlib.sha256(blind_prompt(pic).encode()).hexdigest(),
            'read_directory': read_dir.relative_to(BATCH).as_posix()}
    atomic_json(provenance_path, prov)
    return {'pic': pic, 'files': files, 'hashes': hashes,
            'read_dir': read_dir, 'provenance': provenance_path}


def gate(item, retry_errors=False):
    folder = item['read_dir']
    result_path = folder / 'result.json'
    if result_path.exists():
        result = json.loads(result_path.read_text())
        if result.get('returncode') == 0 or not retry_errors:
            return result
    stamp = datetime.now(timezone.utc).isoformat()
    try:
        # Model sees candidate.png only; path, intended action and prompt never go in.
        process = subprocess.run([PYTHON, VISION, MODEL, str(folder / 'prompt.txt'),
                                  str(folder / 'candidate.png')], capture_output=True,
                                 text=True, timeout=240)
        result = {'timestamp': stamp, 'model': MODEL, 'returncode': process.returncode,
                  'read': process.stdout.strip(), 'error': process.stderr.strip(),
                  'status': 'needs-review' if process.returncode == 0 else 'gate-error'}
    except subprocess.TimeoutExpired as exc:
        result = {'timestamp': stamp, 'model': MODEL, 'returncode': 124,
                  'read': str(exc.stdout or ''), 'error': 'Vision call timed out after 240 seconds',
                  'status': 'gate-error'}
    atomic_json(result_path, result)
    (folder / 'raw.txt').write_text(result['read'] + '\n' + result['error'])
    print(f"blind read: {item['pic']['set']}/{stem(item['pic'])}: {result['status']}", flush=True)
    return result


def font(size):
    path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    return ImageFont.truetype(path, size) if Path(path).exists() else ImageFont.load_default()


def sheets(items, sets, ground):
    destination = BATCH / 'sheets'
    destination.mkdir(exist_ok=True)
    for entry in sets:
        selected = [item for item in items if item['pic']['set'] == entry['id']]
        if not selected:
            continue
        for size in (31, 128):
            width, height, cols = 200, size + 64, 6
            canvas = Image.new('RGB', (width * cols, 55 + height * math.ceil(len(selected) / cols)), ground)
            draw = ImageDraw.Draw(canvas)
            draw.text((16, 12), f"{entry['name']} — {size}px, native display size", fill='#eee8da', font=font(20))
            for i, item in enumerate(selected):
                x, y = (i % cols) * width, 55 + (i // cols) * height
                with Image.open(ASSETS / item['files'][str(size)]) as icon:
                    canvas.paste(icon, (x + (width - size) // 2, y), icon)
                label = stem(item['pic'])
                # Break only labels; never scale preview art up.
                for j, line in enumerate([label[k:k+26] for k in range(0, len(label), 26)][:3]):
                    draw.text((x + 8, y + size + 7 + j * 14), line, fill='#eee8da', font=font(11))
            canvas.save(destination / f"{safe(entry['id'])}-{size}.png")
    # Pair the same primary metaphor across styles; alternate counts cannot shift rows.
    primary = {(item['pic']['id'], item['pic']['set']): item for item in items if not item['pic'].get('alt', 0)}
    picture_ids = list(dict.fromkeys(item['pic']['id'] for item in items if not item['pic'].get('alt', 0)))
    if picture_ids:
        for size in (31, 128):
            width, height, groups = 200, size + 64, 3
            cols = groups * len(sets)
            canvas = Image.new('RGB', (width * cols, 55 + height * math.ceil(len(picture_ids) / groups)), ground)
            draw = ImageDraw.Draw(canvas)
            draw.text((16, 12), f"Style comparison — identical primary pictures, {size}px", fill='#eee8da', font=font(20))
            for i, picture_id in enumerate(picture_ids):
                for j, entry in enumerate(sets):
                    x, y = ((i % groups) * len(sets) + j) * width, 55 + (i // groups) * height
                    item = primary.get((picture_id, entry['id']))
                    if item:
                        with Image.open(ASSETS / item['files'][str(size)]) as icon:
                            canvas.paste(icon, (x + (width - size) // 2, y), icon)
                    else:
                        draw.text((x + 50, y + size // 2), 'Pending', fill='#aaa49a', font=font(12))
                    draw.text((x + 8, y + size + 7), entry['name'], fill='#eee8da', font=font(11))
                    draw.text((x + 8, y + size + 22), picture_id, fill='#eee8da', font=font(11))
            canvas.save(destination / f'comparison-{size}.png')


def publish(items, plan, titles, ground):
    review_path = BATCH / 'review.json'
    reviews = json.loads(review_path.read_text()) if review_path.exists() else {}
    actions = {action: {'title': title, 'variants': []} for action, title in titles.items()}
    read_lines = ['# Blind reads at 31 px', '',
                  f'Model: `{MODEL}`. Each image is 31 px on a 67 px `{ground}` ground.',
                  'The model sees only `candidate.png` and the neutral prompt. Reads are evidence, not acceptance.', '']
    for item in items:
        pic = item['pic']
        result_path = item['read_dir'] / 'result.json'
        result = json.loads(result_path.read_text()) if result_path.exists() else {'status': 'not-read', 'read': ''}
        review = reviews.get(f"{pic['set']}/{stem(pic)}", {})
        if review.get('status') in ('accepted', 'learned', 'rejected') and result.get('returncode') == 0:
            result = {**result, 'status': review['status'], 'note': review.get('note', '')}
        variant = {'set': pic['set'], 'alt': int(pic.get('alt', 0)), 'file': item['files']['128'],
                   'metaphor': pic['metaphor'], 'sizes': item['files'], 'sha256': item['hashes']['128'],
                   'blindRead': {'status': result['status'], 'read': result.get('read', ''), 'note': result.get('note', ''),
                                 'evidence': item['read_dir'].relative_to(BATCH).as_posix(),
                                 'promptSha256': hashlib.sha256(blind_prompt(pic).encode()).hexdigest()}}
        for action in pic['actions']:
            actions.setdefault(action, {'title': titles.get(action, action), 'variants': []})['variants'].append(variant.copy())
        read_lines += [f"## {pic['set']} / {stem(pic)}", '',
                       f"Intended: {pic['metaphor']}. Actions: {', '.join(pic['actions'])}.", '',
                       f"Gate state: **{result['status']}**. {result.get('note', '')}", '', result.get('read', '') or result.get('error', 'Pending.'), '',
                       f"Evidence: `{item['read_dir'].relative_to(BATCH)}`.", '']
    atomic_json(ASSETS / 'manifest.json', {'sets': plan['sets'], 'actions': actions})
    (BATCH / 'READS.md').write_text('\n'.join(line.rstrip() for line in '\n'.join(read_lines).splitlines()) + '\n')
    sheets(items, plan['sets'], ground)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, default=BATCH / 'plan.json')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--follow', action='store_true')
    mode.add_argument('--once', action='store_true')
    parser.add_argument('--no-gates', action='store_true', help='Resize and build sheets/manifest only; never claim a blind read.')
    parser.add_argument('--retry-errors', action='store_true', help='Explicitly retry failed vision calls.')
    parser.add_argument('--interval', type=float, default=10)
    args = parser.parse_args()
    last_signature = None
    while True:
        if not args.plan.exists():
            if not args.follow:
                raise SystemExit(f'Missing plan: {args.plan}')
            time.sleep(args.interval)
            continue
        try:
            plan = json.loads(args.plan.read_text())
        except json.JSONDecodeError:
            if not args.follow:
                raise
            time.sleep(args.interval)
            continue
        signature = (digest(args.plan), [(p['source'], source_path(p).stat().st_mtime_ns)
                     for p in plan['pictures'] if source_path(p).exists()],
                     (BATCH / 'inventory.json').stat().st_mtime_ns if (BATCH / 'inventory.json').exists() else None,
                     (BATCH / 'review.json').stat().st_mtime_ns if (BATCH / 'review.json').exists() else None)
        if signature != last_signature or not args.follow:
            titles, sizes, ground = load_inventory(BATCH / 'inventory.json')
            items = [item for pic in plan['pictures'] if (item := prepare(pic, sizes, ground))]
            publish(items, plan, titles, ground)
            if not args.no_gates:
                with ThreadPoolExecutor(max_workers=3) as pool:
                    for future in as_completed([pool.submit(gate, item, args.retry_errors) for item in items]):
                        future.result()
                publish(items, plan, titles, ground)
            print(f"Packaged {len(items)}/{len(plan['pictures'])} pictures; sizes {sizes}", flush=True)
            last_signature = signature
        if not args.follow:
            break
        time.sleep(args.interval)


if __name__ == '__main__':
    main()
