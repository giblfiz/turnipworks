"""Faction picker contract; availability is derived from accepted library assets."""
SLOTS = ['flavor-altarpiece', 'flavor-idol', 'flavor-banner', 'flavor-relief', 'flavor-sigil',
         'flavor-censer', 'flavor-sculpture', 'flavor-buttress', 'flavor-corbel', 'flavor-pillar',
         # the faiths' own roles (2026-11-07, experiments/2026-11-07-faith-factions/DESIGN.md): shown only in their rows
         'flavor-altar', 'flavor-mat', 'flavor-pulpit', 'flavor-stand', 'flavor-font', 'flavor-lamp', 'flavor-wheel', 'flavor-bell', 'flavor-gate']
FACTIONS = [('sun', 'Sun', 'good'), ('moon', 'Moon', 'good'),
            ('devils', 'Devils', 'sinister'), ('spiders', 'Spiders', 'sinister'),
            ('dragons', 'Dragon', 'sinister'), ('skulls', 'Skulls & skeletons', 'sinister'),
            ('tentacles', 'Tentacles', 'sinister'), ('nature', 'Nature', 'good'),
            ('sword-shield', 'Sword & shield', 'good'), ('death', 'Respectable death', 'neutral'),
            ('scales-coin', 'Scales & coin', 'neutral'), ('forge-hammer', 'Forge & hammer', 'neutral'),
            ('sea-storm', 'Sea & storm', 'neutral'),
            # real-world faiths (Harry 2026-11-07: "so people who want to build historical have no problem... Right there next
            # to spider cult"). Peers in the same menu; each a named regional tradition (DESIGN.md), reverent: never a cult room
            ('christian', 'Christian', 'faith'), ('buddhist', 'Buddhist', 'faith'), ('hindu', 'Hindu', 'faith'), ('muslim', 'Muslim', 'faith')]

# A faith's pieces carry their own names (never "<faith> idol"); `omit` = core slots it does not use (a blank, not a gap);
# `ownSlots` = roles only the faiths fill; `rite` = the hall arrangement the room generator gives it (solver2.js faith:solver2);
# `look` = the one tradition, place and period its pieces are drawn from.
FAITHS = {
    'christian': dict(look='Latin church, High Gothic, northern France and England, c. 1250-1400', aliases=['christianity', 'church', 'gothic church'],
        names={'flavor-idol': 'Crucifix', 'flavor-altarpiece': 'Altar cross and candlesticks', 'flavor-sculpture': 'Virgin and Child', 'flavor-censer': 'Pricket candlestick',
               'flavor-font': 'Baptismal font', 'flavor-stand': 'Thurible on its stand', 'flavor-banner': 'Processional banner', 'flavor-relief': 'Cross roundel', 'flavor-sigil': 'Pavement labyrinth'},
        omit=['flavor-corbel', 'flavor-buttress', 'flavor-pillar'], ownSlots=['flavor-font', 'flavor-stand']),
    'buddhist': dict(look='Tibetan monastery assembly hall, c. 1400-1800', aliases=['buddhism', 'tibetan buddhist'],
        names={'flavor-idol': 'Buddha statue', 'flavor-altar': 'Offering table', 'flavor-altarpiece': 'Vajra and bell', 'flavor-sculpture': 'Stupa', 'flavor-censer': 'Incense burner',
               'flavor-wheel': 'Prayer wheel', 'flavor-mat': 'Seating runner', 'flavor-banner': 'Thangka of the Buddha', 'flavor-relief': 'Dharma wheel roundel', 'flavor-sigil': 'Lotus floor design'},
        omit=['flavor-corbel', 'flavor-buttress', 'flavor-pillar'], ownSlots=['flavor-altar', 'flavor-wheel', 'flavor-mat']),
    'hindu': dict(look='North Indian Nagara temple, central and western India, c. 950-1100: a Ganesha sanctum', aliases=['hinduism', 'mandir'],
        names={'flavor-idol': 'Ganesha sanctum', 'flavor-altarpiece': 'Offering plate', 'flavor-censer': 'Brass oil lamp', 'flavor-bell': 'Temple bell', 'flavor-gate': 'Torana',
               'flavor-relief': 'Om roundel', 'flavor-sigil': 'Mandana floor design'},
        omit=['flavor-banner', 'flavor-sculpture', 'flavor-corbel', 'flavor-buttress', 'flavor-pillar'], ownSlots=['flavor-bell', 'flavor-gate']),
    'muslim': dict(look='Mamluk Cairo, 1250-1517 (aniconic: no figure anywhere)', aliases=['islam', 'islamic', 'mosque'],
        names={'flavor-idol': 'Mihrab', 'flavor-censer': 'Mosque candlestick', 'flavor-pulpit': 'Minbar', 'flavor-lamp': 'Mosque lamp', 'flavor-stand': 'Rehal',
               'flavor-font': 'Ablution fountain', 'flavor-corbel': 'Muqarnas corbel', 'flavor-mat': 'Prayer carpet', 'flavor-relief': 'Geometric panel', 'flavor-sigil': 'Marble floor inlay'},
        omit=['flavor-altarpiece', 'flavor-banner', 'flavor-sculpture', 'flavor-buttress', 'flavor-pillar'], ownSlots=['flavor-pulpit', 'flavor-lamp', 'flavor-stand', 'flavor-font', 'flavor-mat']),
}

ALIASES = {'sun': ['solar'], 'moon': ['lunar'], 'devils': ['devil', 'demonic', 'infernal'], 'spiders': ['spider', 'arachnid']}
PIECE_LABELS = {'devils': 'Devil', 'spiders': 'Spider', 'skulls': 'Skeleton', 'tentacles': 'Tentacle'}

OWNED = {r for f in FAITHS.values() for r in f['ownSlots']}


def faction_data(objects, tool):
    factions = []
    for fid, label, group in FACTIONS:
        slots = {role: [s['sku'] for s in objects.get(role, {}).get('skus', []) if s.get('shape') == fid] for role in SLOTS}
        emblem = f'assets/emblems/{fid}.webp'
        faith = FAITHS.get(fid)
        factions.append(dict(id=fid, label=label, group=group, pieceLabel=PIECE_LABELS.get(fid, label), aliases=(faith or {}).get('aliases', ALIASES.get(fid, [])),
                             **({'reverent': True, 'rite': fid, 'look': faith['look'], 'names': faith['names'], 'omit': faith['omit'], 'ownSlots': faith['ownSlots']} if faith else {}),
                             emblem=emblem if (tool / emblem).exists() else None,
                             available=bool(slots['flavor-idol']), slots=slots,
                             emptySlots=[role for role, skus in slots.items() if not skus and not (faith and (role in faith['omit'] or (role in OWNED and role not in faith['ownSlots'])))],
                             fallbacks={'flavor-censer': {'role': 'censer-hanging', 'place': 'ceiling'}} if not slots['flavor-censer'] else {}))
    return dict(version=1, slots=SLOTS, factions=factions)


def add_faction_assets(skus, root, mesh_id):
    """Ingest only gated manifests; replacement changes selectable SKU, never deletes files."""
    import csv
    import json
    batch = root / 'experiments/2026-10-13-factions'
    replacements_file = batch / 'integration/replacements.json'
    replacements = json.loads(replacements_file.read_text()) if replacements_file.exists() else {}
    # factions-01: idols, corbels, altar pieces (2026-10-13); faction-pillars-01: the free-standing pillar of every faction
    # and the nine missing piers (2026-10-24, experiments/2026-10-24-faction-pillars). Same ingest rules for both.
    faiths = root / 'experiments/2026-11-07-faith-factions/fth'
    for src, folder in (('factions-01', batch), ('faction-pillars-01', root / 'experiments/2026-10-24-faction-pillars'), ('fth-01', faiths)):
        manifest = root / f'catalog/runs/{src}/manifest.tsv'
        if not manifest.exists():
            continue
        for row in csv.DictReader(manifest.open(), delimiter='\t'):
            glb = folder / 'models' / f"{row.get('source') or row['sku']}.glb"
            if not glb.exists():
                continue
            sku = row['sku']
            if sku in skus:
                raise ValueError(f'Faction SKU already owned: {sku}')
            rec = dict(row, src=src, glb=glb, piece='')
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
    flat_rows = []
    for base, src in ((batch, 'factions-flats-01'), (faiths, 'fth-flats-01')):  # faiths: fth/accepted-flats.json, paths relative to fth/
        f = base / ('integration/accepted-flats.json' if src == 'factions-flats-01' else 'accepted-flats.json')
        flat_rows += [(base, src, row) for row in (json.loads(f.read_text()) if f.exists() else [])]
    for batch, src, row in flat_rows:
        sku = row['sku']
        if sku in skus:
            raise ValueError(f'Faction flat SKU already owned: {sku}')
        plate = batch / row['path']
        if not plate.exists():
            raise FileNotFoundError(plate)
        skus[sku] = dict(sku=sku, object=row['object'], shape=row['shape'], family='', tier='', piece='',
                         src=src, lane='2d', plate=plate, native_alpha=True,
                         **({'own_size': row['size']} if row.get('size') else {}))
