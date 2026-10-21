#!/usr/bin/env python3
"""Verify the deliverable contract against its plan, inventory and raw evidence.

--allow-pending tolerates absent generation/read/review work, never corrupted
files, rejected pictures, incorrect mappings or hashes. Stop the writer before
the strict final check so the snapshot cannot change underneath verification.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image
import process as pipeline


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'duplicate JSON key: {key}')
        result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(), object_pairs_hook=unique_object)


class Audit:
    def __init__(self):
        self.errors = []
        self.pending = []
        self.limitations = []
        self.counts = Counter()

    def check(self, condition, message):
        if not condition:
            self.errors.append(message)
        return condition

    def wait(self, message):
        self.pending.append(message)

    def image(self, path, size, transparent=True):
        if not self.check(path.is_file(), f'missing image: {path}'):
            return False
        try:
            with Image.open(path) as im:
                im.load()
                self.check(im.size == (size, size), f'{path}: size {im.size}, expected {size}')
                if transparent:
                    self.check(im.mode == 'RGBA', f'{path}: no RGBA alpha')
                    rgba = im.convert('RGBA')
                    alpha = rgba.getchannel('A')
                    self.check(alpha.getextrema()[0] == 0 and alpha.getextrema()[1] > 0,
                               f'{path}: missing transparent or visible pixels')
                    self.check(all(rgba.getpixel(p)[3] == 0 for p in
                                   [(0, 0), (im.width-1, 0), (0, im.height-1), (im.width-1, im.height-1)]),
                               f'{path}: corners are not fully transparent')
                self.counts['images_checked'] += 1
                return True
        except Exception as exc:
            self.errors.append(f'{path}: cannot decode: {exc}')
            return False


def check_sibling_arcs(audit, manifest):
    path = pipeline.BATCH / 'round2-arcs.json'
    if not path.exists():
        return set()
    data = read_json(path)
    condition_ids = set()
    for arc in data['arcs']:
        if arc['id'] == 'conditions':
            condition_ids.update(arc['co_visible_ids'])
        if arc.get('status') == 'runtime-gap':
            audit.limitations.append({'arc': arc['id'], 'note': arc['justification']})
            continue
        ids = list(dict.fromkeys(arc.get('co_visible_ids', []) + arc.get('requested_extra', [])))
        # These roof options use their actual swatches, ahead of static glyphs.
        # The finite painting audit cannot verify runtime precedence; retain that boundary.
        swatches = arc.get('swatch_paths', {})
        if swatches:
            audit.limitations.append({'arc': arc['id'], 'note': 'Listed runtime image swatches are exempt only while the consumer preserves image precedence.', 'swatches': swatches})
            ids = [action for action in ids if action not in swatches]
        if len(ids) < 2:
            continue
        audit.counts['sibling_arcs_checked'] += 1
        for set_entry in manifest['sets']:
            set_id = set_entry['id']
            file_actions, hash_actions = {}, {}
            for action in ids:
                variants = [v for v in manifest['actions'].get(action, {}).get('variants', []) if v['set'] == set_id]
                if not variants:
                    audit.wait(f"sibling arc {arc['id']}: no {set_id} picture for {action}")
                for variant in variants:
                    file_actions.setdefault(variant['file'], set()).add(action)
                    if variant.get('sha256'):
                        hash_actions.setdefault(variant['sha256'], set()).add(action)
            for file, actions in file_actions.items():
                audit.check(len(actions) == 1, f"sibling arc {arc['id']}/{set_id}: co-visible actions share file {file}: {sorted(actions)}")
            for sha, actions in hash_actions.items():
                audit.check(len(actions) == 1, f"sibling arc {arc['id']}/{set_id}: co-visible actions share identical picture bytes {sha[:12]}: {sorted(actions)}")
    return condition_ids


def check_condition_confusions(audit, plan):
    arcs_path = pipeline.BATCH / 'round2-arcs.json'
    if not arcs_path.exists():
        return
    import confusion
    arcs = read_json(arcs_path)
    reviews_path = pipeline.BATCH / 'confusion-review.json'
    reviews = read_json(reviews_path) if reviews_path.exists() else {}
    titles, _, _ = pipeline.load_inventory(pipeline.BATCH / 'inventory.json')
    specs = confusion.configurations(plan, arcs)
    audit.check(len(specs) == 14, f'expected fourteen condition confusion configurations, got {len(specs)}')
    for set_id, config, members in specs:
        item = confusion.prepare(set_id, config, members, 20261015, titles, write=False)
        if item is None:
            audit.wait(f'confusion {set_id}/{config}: current source/export not ready')
            continue
        folder = item['read_dir']
        evidence = folder.relative_to(pipeline.BATCH).as_posix()
        files = {name: folder / name for name in ('candidate.png', 'prompt.txt', 'answer-key.json', 'result.json', 'raw.txt', 'score.json')}
        if any(not path.exists() for path in files.values()):
            audit.wait(f'confusion {evidence}: missing evidence files')
            continue
        audit.check(read_json(files['answer-key.json']) == item['key'], f'confusion {evidence}: source-bound answer key mismatch')
        audit.check(pipeline.digest(files['candidate.png']) == item['key']['candidate_sha256'], f'confusion {evidence}: current-source candidate mismatch')
        audit.check(files['prompt.txt'].read_text() == item['key']['prompt'] + '\n', f'confusion {evidence}: current prompt mismatch')
        result = read_json(files['result.json'])
        audit.check(result.get('returncode') == 0 and result.get('model') == pipeline.MODEL and bool(result.get('read')), f'confusion {evidence}: failed/wrong model read')
        audit.check(files['raw.txt'].read_text() == result.get('read', '') + '\n' + result.get('error', ''), f'confusion {evidence}: raw transcript mismatch')
        scored = confusion.score(item, write=False)
        audit.check(read_json(files['score.json']) == scored, f'confusion {evidence}: stored score differs from raw answer')
        audit.check(scored.get('status') == 'scored' and scored.get('correct') == 10 and scored.get('total') == 10 and scored.get('one_to_one') and not scored.get('uncertain'), f'confusion {evidence}: requires ten correct unambiguous one-to-one matches')
        review = reviews.get(evidence)
        if review is None:
            audit.wait(f'confusion {evidence}: explicit reviewer decision pending')
        else:
            audit.check(review.get('status') == 'accepted' and bool(review.get('note', '').strip()), f'confusion {evidence}: explicit acceptance and note required')
        audit.counts['condition_confusions_checked'] += 1


def validate():
    audit = Audit()
    batch, assets = pipeline.BATCH, pipeline.ASSETS
    plan = read_json(batch / 'plan.json')
    inventory = read_json(batch / 'inventory.json')
    review_path = batch / 'review.json'
    reviews = read_json(review_path) if review_path.exists() else {}
    rows = inventory if isinstance(inventory, list) else inventory['actions']
    inventory_ids = [row['id'] for row in rows]
    audit.check(len(inventory_ids) == len(set(inventory_ids)), 'duplicate inventory action IDs')
    titles = {row['id']: row['title'] for row in rows}
    sets = [entry['id'] for entry in plan['sets']]
    audit.check(len(sets) == len(set(sets)), 'duplicate plan set IDs')
    audit.check(2 <= len(sets) <= 3, f'expected two or three complete style sets, found {len(sets)}')
    keys, expected, planned_files = set(), {}, set()
    for pic in plan['pictures']:
        key = (pic['set'], pic['id'], pic['alt'])
        audit.check(key not in keys, f'duplicate plan picture key: {key}')
        keys.add(key)
        audit.check(pic['set'] in sets, f'{key}: unknown set')
        audit.check(isinstance(pic['alt'], int) and pic['alt'] >= 0, f'{key}: invalid alt')
        audit.check(bool(pic['prompt'].strip()), f'{key}: empty generation prompt')
        audit.check(len(pic['actions']) == len(set(pic['actions'])) and pic['actions'], f'{key}: duplicate/empty action list')
        if pic['id'] == 'thing.hide' and pic['alt'] == 2:
            audit.check('roof.hide' not in pic['actions'], 'Reveal alternate incorrectly aliases roof.hide')
        name = pipeline.stem(pic)
        file = f"{pic['set']}/{name}.webp"
        audit.check(file not in planned_files, f'duplicate output filename: {file}')
        planned_files.add(file)
        for action in pic['actions']:
            audit.check(action in titles, f'{key}: action absent from inventory: {action}')
            variant_key = (pic['set'], pic['alt'])
            per_action = expected.setdefault(action, {})
            audit.check(variant_key not in per_action, f'duplicate planned variant: {action}/{variant_key}')
            per_action[variant_key] = pic
    for action in inventory_ids:
        for set_id in sets:
            audit.check((set_id, 0) in expected.get(action, {}), f'plan lacks primary {set_id} icon for {action}')
    manifest_path = assets / 'manifest.json'
    if not manifest_path.exists():
        audit.wait('manifest not built')
        return audit
    manifest = read_json(manifest_path)
    condition_ids = check_sibling_arcs(audit, manifest)
    audit.check(manifest['sets'] == plan['sets'], 'manifest set metadata differs from plan')
    audit.check(set(manifest['actions']) == set(inventory_ids), 'manifest action ID inventory mismatch')
    observed = {}
    for action, entry in manifest['actions'].items():
        audit.check(entry['title'] == titles.get(action), f'{action}: title mismatch')
        seen = set()
        for variant in entry['variants']:
            required = {'set', 'alt', 'file', 'metaphor', 'sizes', 'sha256', 'blindRead'}
            audit.check(required <= variant.keys(), f'{action}: missing regular variant fields')
            vk = (variant['set'], variant['alt'])
            audit.check(vk not in seen, f'{action}: duplicate manifest variant {vk}')
            seen.add(vk)
            pic = expected.get(action, {}).get(vk)
            if not audit.check(pic is not None, f'{action}/{vk}: unplanned manifest variant'):
                continue
            audit.check(variant['file'] == f"{pic['set']}/{pipeline.stem(pic)}.webp", f'{action}/{vk}: incorrect file mapping')
            audit.check(variant['metaphor'] == pic['metaphor'], f'{action}/{vk}: incorrect metaphor')
            image_key = (pic['set'], pic['id'], pic['alt'])
            if image_key in observed:
                audit.check(observed[image_key] == variant, f'{image_key}: shared actions have different variant records')
            observed[image_key] = variant
        for vk in expected.get(action, {}):
            if vk not in seen:
                audit.wait(f'{action}/{vk}: variant not packaged')
    _, sizes, ground = pipeline.load_inventory(batch / 'inventory.json')
    for pic in plan['pictures']:
        name = pipeline.stem(pic)
        key = f"{pic['set']}/{name}"
        image_key = (pic['set'], pic['id'], pic['alt'])
        source = pipeline.source_path(pic)
        variant = observed.get(image_key)
        if not source.exists():
            audit.wait(f'{key}: source not generated')
            audit.check(variant is None, f'{key}: manifest references picture with no source')
            continue
        if variant is None:
            audit.wait(f'{key}: source exists but packaging pending')
            continue
        audit.counts['pictures_packaged'] += 1
        provenance = batch / 'provenance' / pic['set'] / f'{name}.json'
        if not audit.check(provenance.exists(), f'{key}: missing provenance'):
            continue
        prov = read_json(provenance)
        source_hash = pipeline.digest(source)
        audit.check(prov['source_sha256'] == source_hash, f'{key}: source hash differs from provenance')
        provenance_source = Path(prov['source'])
        if not provenance_source.is_absolute():
            provenance_source = pipeline.REPO / provenance_source
        audit.check(provenance_source.resolve() == source.resolve(), f'{key}: incorrect provenance source path')
        audit.check(prov['prompt'] == pic['prompt'], f'{key}: exact prompt mismatch')
        audit.check(prov['references'] == pic.get('references', pic.get('refs', [])), f'{key}: reference mismatch')
        for ref in prov['references']:
            if not audit.check(isinstance(ref, dict) and {'path', 'sha256', 'role'} <= ref.keys(), f'{key}: reference lacks path/hash/role'):
                continue
            ref_path = Path(ref['path'])
            if not ref_path.is_absolute():
                ref_path = pipeline.REPO / ref_path
            audit.check(ref_path.exists() and pipeline.digest(ref_path) == ref['sha256'], f'{key}: own-reference image hash mismatch')
        audit.check(prov['provider'] == 'OpenAI built-in image_gen', f'{key}: incorrect generation provider')
        audit.check((prov['id'], prov['set'], prov['alt']) == (pic['id'], pic['set'], pic['alt']), f'{key}: provenance identity mismatch')
        audit.check(set(variant['sizes']) == {str(s) for s in sizes}, f'{key}: resolution inventory mismatch')
        audit.check(prov['files'] == variant['sizes'], f'{key}: provenance/manifest paths differ')
        audit.check(variant['file'] == variant['sizes'].get('128'), f'{key}: base file not 128px export')
        for size in sizes:
            file = variant['sizes'].get(str(size))
            if not file:
                continue
            path = assets / file
            audit.check(path.resolve().is_relative_to(assets.resolve()), f'{key}: file escapes assets directory')
            if audit.image(path, size):
                sha = pipeline.digest(path)
                audit.check(prov['sha256'].get(str(size)) == sha, f'{key}/{size}: output hash mismatch')
                if size == 128:
                    audit.check(variant['sha256'] == sha, f'{key}: manifest base hash mismatch')
        with Image.open(source) as src:
            audit.check(list(src.size) == prov['source_size'], f'{key}: source dimensions mismatch')
            audit.check('A' in src.getbands() and src.getchannel('A').getextrema()[0] == 0, f'{key}: source lacks native transparency')
        folder = pipeline.read_directory(pic, source_hash)
        audit.check(prov.get('read_directory') == folder.relative_to(batch).as_posix(), f'{key}: stale blind protocol evidence path')
        audit.check(variant['blindRead'].get('evidence') == folder.relative_to(batch).as_posix(), f'{key}: manifest blind evidence path mismatch')
        result_path = folder / 'result.json'
        candidate = folder / 'candidate.png'
        if audit.image(candidate, 67, transparent=False):
            audit.check(pipeline.digest(candidate) == prov['candidate_sha256'], f'{key}: blind-candidate hash mismatch')
            with Image.open(assets / variant['sizes']['31']) as icon:
                expected_image = Image.new('RGBA', (67, 67), ground)
                expected_image.alpha_composite(icon.convert('RGBA'), (18, 18))
            with Image.open(candidate) as actual:
                audit.check(actual.convert('RGB').tobytes() == expected_image.convert('RGB').tobytes(),
                            f'{key}: blind candidate differs from 31px export on game ground')
        prompt_path = folder / 'prompt.txt'
        audit.check(prompt_path.exists() and prompt_path.read_text() == pipeline.blind_prompt(pic) + '\n',
                    f'{key}: blind prompt missing or changed')
        prompt_hash = hashlib.sha256(pipeline.blind_prompt(pic).encode()).hexdigest()
        audit.check(prov.get('blind_prompt_sha256') == prompt_hash and variant['blindRead'].get('promptSha256') == prompt_hash, f'{key}: blind prompt hash mismatch')
        audit.check(prov['blind_prompt'] == pipeline.blind_prompt(pic) and prov['blind_model'] == pipeline.MODEL,
                    f'{key}: blind provenance prompt/model mismatch')
        if not result_path.exists():
            audit.wait(f'{key}: blind read pending')
            continue
        result = read_json(result_path)
        if not audit.check(result['returncode'] == 0 and bool(result.get('read', '').strip()), f'{key}: blind read failed/empty'):
            continue
        raw = folder / 'raw.txt'
        audit.check(raw.exists() and raw.read_text() == result['read'] + '\n' + result.get('error', ''), f'{key}: raw read transcript missing/mismatched')
        audit.counts['pictures_read'] += 1
        audit.check(result['model'] == pipeline.MODEL, f'{key}: wrong blind model')
        blind = variant['blindRead']
        if blind['status'] == 'not-read' and not blind['read']:
            audit.wait(f'{key}: completed raw read not yet published in manifest')
            continue
        audit.check(blind['read'] == result['read'], f'{key}: manifest blind read differs from raw evidence')
        review = reviews.get(key, {})
        if review.get('status') == 'rejected' or blind['status'] == 'rejected':
            audit.errors.append(f'{key}: REJECTED picture must be redone')
        elif review.get('status') not in ('accepted', 'learned'):
            audit.wait(f'{key}: reviewer decision pending')
        else:
            if blind['status'] == 'needs-review':
                audit.wait(f'{key}: reviewer decision not yet published in manifest')
                continue
            audit.check(blind['status'] == review['status'], f'{key}: review status not propagated')
            audit.check(blind.get('note') == review.get('note') and bool(review.get('note', '').strip()), f'{key}: review note missing/mismatched')
            if condition_ids.intersection(pic['actions']):
                audit.check(review['status'] == 'accepted', f'{key}: specific condition requires a correct blind read; learned is not a passing condition decision')
            audit.counts[review['status']] += 1
    for set_id in sets:
        has_pictures = any(key[0] == set_id for key in observed)
        for size in (31, 128):
            sheet = batch / 'sheets' / f'{set_id}-{size}.png'
            if has_pictures:
                audit.check(sheet.is_file(), f'{set_id}: missing {size}px contact sheet')
    for size in (31, 128):
        if observed:
            audit.check((batch / 'sheets' / f'comparison-{size}.png').exists(), f'missing {size}px style comparison')
    check_condition_confusions(audit, plan)
    audit.counts.update(actions=len(inventory_ids), sets=len(sets), planned_pictures=len(plan['pictures']),
                        planned_alternates=sum(pic['alt'] != 0 for pic in plan['pictures']))
    return audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allow-pending', action='store_true')
    parser.add_argument('--report', type=Path, help='Write the complete machine-readable audit report.')
    args = parser.parse_args()
    try:
        audit = validate()
    except (ValueError, KeyError, OSError, TypeError) as exc:
        audit = Audit()
        audit.errors.append(f'Cannot verify contract: {exc}')
    passed = not audit.errors and (args.allow_pending or not audit.pending)
    report = {'status': 'pass-partial' if passed and audit.pending else 'pass' if passed else 'fail',
              'counts': dict(audit.counts), 'errors': audit.errors, 'pending': audit.pending, 'limitations': audit.limitations}
    if args.report:
        pipeline.atomic_json(args.report, report)
    print(json.dumps({key: value for key, value in report.items() if key not in ('errors', 'pending')}, indent=2))
    print(f'{len(audit.errors)} errors, {len(audit.pending)} pending requirements')
    for error in audit.errors[:30]:
        print('ERROR:', error)
    if not args.allow_pending:
        for pending in audit.pending[:15]:
            print('PENDING:', pending)
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())
