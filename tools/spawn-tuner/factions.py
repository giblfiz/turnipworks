"""Faction picker contract; availability is derived from accepted library assets."""
SLOTS = ['flavor-altarpiece', 'flavor-idol', 'flavor-banner', 'flavor-relief', 'flavor-sigil',
         'flavor-censer', 'flavor-sculpture', 'flavor-buttress', 'flavor-corbel']
FACTIONS = [('sun', 'Sun', 'good'), ('moon', 'Moon', 'good'),
            ('devils', 'Devils', 'sinister'), ('spiders', 'Spiders', 'sinister'),
            ('dragons', 'Dragon', 'sinister'), ('skulls', 'Skulls & skeletons', 'sinister'),
            ('tentacles', 'Tentacles', 'sinister'), ('nature', 'Nature', 'good'),
            ('sword-shield', 'Sword & shield', 'good'), ('death', 'Respectable death', 'neutral'),
            ('scales-coin', 'Scales & coin', 'neutral'), ('forge-hammer', 'Forge & hammer', 'neutral'),
            ('sea-storm', 'Sea & storm', 'neutral')]

ALIASES = {'sun': ['solar'], 'moon': ['lunar'], 'devils': ['devil', 'demonic', 'infernal'], 'spiders': ['spider', 'arachnid']}
PIECE_LABELS = {'devils': 'Devil', 'spiders': 'Spider', 'skulls': 'Skeleton', 'tentacles': 'Tentacle'}

def faction_data(objects, tool):
    factions = []
    for fid, label, group in FACTIONS:
        slots = {role: [s['sku'] for s in objects.get(role, {}).get('skus', []) if s.get('shape') == fid] for role in SLOTS}
        emblem = f'assets/emblems/{fid}.webp'
        factions.append(dict(id=fid, label=label, group=group, pieceLabel=PIECE_LABELS.get(fid, label), aliases=ALIASES.get(fid, []),
                             emblem=emblem if (tool / emblem).exists() else None,
                             available=bool(slots['flavor-idol']), slots=slots,
                             emptySlots=[role for role, skus in slots.items() if not skus],
                             fallbacks={'flavor-censer': {'role': 'censer-hanging', 'place': 'ceiling'}} if not slots['flavor-censer'] else {}))
    return dict(version=1, slots=SLOTS, factions=factions)


def add_faction_assets(skus, root, mesh_id):
    """Ingest only gated manifests; replacement changes selectable SKU, never deletes files."""
    import csv
    import json
    batch = root / 'experiments/2026-10-13-factions'
    manifest = root / 'catalog/runs/factions-01/manifest.tsv'
    replacements_file = batch / 'integration/replacements.json'
    replacements = json.loads(replacements_file.read_text()) if replacements_file.exists() else {}
    if manifest.exists():
        for row in csv.DictReader(manifest.open(), delimiter='\t'):
            glb = batch / 'models' / f"{row.get('source') or row['sku']}.glb"
            if not glb.exists():
                continue
            sku = row['sku']
            if sku in skus:
                raise ValueError(f'Faction SKU already owned: {sku}')
            rec = dict(row, src='factions-01', glb=glb, piece='')
            if row.get('size'):
                rec['own_size'] = [float(v) for v in row['size'].split('x')]
            if sku in replacements:
                change = replacements[sku]
                old = skus.pop(change['oldSku'], None)
                if not old or 'glb' not in old:
                    raise ValueError(f'Missing predecessor for {sku}: {change["oldSku"]}')
                rec['was'] = [dict(mesh=mesh_id(old['src'], change['oldSku'], old['glb']),
                                   sku=change['oldSku'], until=change.get('until'))] + old.get('was', [])
            skus[sku] = rec
    # The flat manifest is the semantic/alpha acceptance boundary, not a glob of work in progress.
    flat_manifest = batch / 'integration/accepted-flats.json'
    for row in json.loads(flat_manifest.read_text()) if flat_manifest.exists() else []:
        sku = row['sku']
        if sku in skus:
            raise ValueError(f'Faction flat SKU already owned: {sku}')
        plate = batch / row['path']
        if not plate.exists():
            raise FileNotFoundError(plate)
        skus[sku] = dict(sku=sku, object=row['object'], shape=row['shape'], family='', tier='', piece='',
                         src='factions-flats-01', lane='2d', plate=plate, native_alpha=True,
                         **({'own_size': row['size']} if row.get('size') else {}))
