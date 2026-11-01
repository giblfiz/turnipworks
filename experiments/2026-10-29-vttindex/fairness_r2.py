#!/usr/bin/env python3
"""2026-10-29: the changes made after Codex's second fairness pass (codex-fairness-r2.codex.log: MOSTLY FAIR)."""
import json, os, re
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
F = os.path.join(REPO, 'docs', 'site', 'vtt-index.json')
d = json.load(open(F, encoding='utf-8')); P = {p['id']: p for p in d['products']}; log = []
def setc(pid, k, v=None, note=None, append=None, verified=None, src=None):
    c = P[pid]['features'][k]; old = c['v']
    if v is not None: c['v'] = v
    if note is not None: c['note'] = note
    if append: c['note'] = (c.get('note', '') + ' ' + append).strip()
    if verified is not None: c['verified'] = verified
    if src is not None: c['src'] = src
    log.append(f'{pid}.{k}: {old} -> {c["v"]}')
G = {c['id']: c for c in d['criteria']}
d['disclosure'] = ("We make Turnip Works, one of the products in this table. The table is our own development checklist, so expect our row to fill up over time. "
                   "Our row is scored by the same rules as every other row, and every row is checked on the same schedule; a feature of ours that is built but only on our development server is mentioned in the note and does not count until it is live.")
G['sheets']['gloss'] = "Character sheets and rules automation: the software knows the game's rules (attacks, damage, conditions) instead of only showing tokens. yes: sheets with automation. partial: sheets without automation, or some automation. Trackers alone (hit points, initiative, condition markers) are noted but count as no."
G['ddb']['gloss'] = "Using D&D Beyond characters at the table. yes: an official integration by the VTT's maker or by D&D Beyond. partial: through a third-party bridge, such as Beyond20 (a free browser extension that sends D&D Beyond rolls to a VTT), or a one-way import."
G['dice']['gloss'] = "3D: physical 3D dice that tumble on screen. roller: a dice roller (text or 2D, or rolling whose look isn't stated). no: bring your own. 3D dice from a third-party add-on are in the note."
G['mapbuild']['gloss'] = "Making maps inside the product rather than only importing a picture made elsewhere. yes: a builder meant for making maps (tiles, assets, terrain or a generator). partial: drawing tools, or placing images on the map."
G['ai']['gloss'] = "AI features inside the product: generating maps, art or text, an AI assistant at the table, or machine-learning features such as automatic room or wall detection. This says only that they exist, not whether that is good. How a product was made (AI art, AI-written code) is in its note and summary, not this value."
G['modding']['gloss'] = "Extending it. yes: add-ons, modules or scripting that add features. partial: sharing content (such as a workshop), or an API that drives the table without adding features."
# Beyond20 and other third-party bridges are partial (one rule for every row)
for p in d['products']:
    c = p['features']['ddb']
    if c['v'] == 'yes' and re.search(r'Beyond20|DDB-Importer|third-party|community', c.get('note', ''), re.I): setc(p['id'], 'ddb', 'partial')
# trackers alone are not sheets; unusable sheets are not sheets
for pid in ('aporion-vtt', 'terrablox', 'unnamed-tablet-browser-vtt', 'dungeon-master-tool', 'realmkeeper', 'threshold'):
    if P[pid]['features']['sheets']['v'] == 'partial': setc(pid, 'sheets', 'no', append='(trackers only)')
setc('the-central-nexus', 'sheets', 'no', append='(not available at the table yet)')
# lighting without per-character vision; fog that is manual polygons
for pid in ('polymancer', 'one-more-multiverse'):
    if P[pid]['features']['lighting']['v'] == 'yes': setc(pid, 'lighting', 'partial', append="(per-character vision not confirmed)")
setc('dnd-beyond-maps', 'fog', 'partial', append='(drawn by the DM; automatic reveal not documented)')
# drawing or placed images = partial map building
setc('maptool', 'mapbuild', 'partial', append='(drawing and placing images)')
# rolling confirmed, look not stated = roller
for pid in ('terraintale', 'quest-portal', 'rpg-stories', 'virtual-battle-mat', 'freevtt', 'shard-tabletop', 'minimal-roleplay'):
    if P[pid]['features']['dice']['v'] == '?': setc(pid, 'dice', 'roller', append='(whether the dice are 3D is not stated)', verified=False)
setc('elder-realm', 'price', 'free', append='(free during the beta; a subscription is planned)')
setc('virtual-battle-mat', 'accounts', '?', append='(players join without an account; whether the GM registers is not stated)')
setc('magnus-laser', 'opensource', '?', note='open source said in the post title; no repository or licence found', verified=False)
setc('owlbear-rodeo', 'ai', 'yes', note='Forecast detects rooms on a map automatically (computer vision, paid tiers); no generative AI found', verified=False)
setc('turnip-works', 'community', note='brand new: a handful of alpha tables (our own count), no public reviews yet', verified=False)
P['multiverse-designer']['downsides'] = [x + ' (Oct 2025 post)' if not x.endswith(')') else x for x in P['multiverse-designer']['downsides']]
P['alchemy-rpg']['downsides'] = [x for x in P['alchemy-rpg']['downsides'] if not x.startswith('Fewer tactical')]
P['dungeon-alchemist']['downsides'] = ["Not a VTT: you still need one to play", "Still in Early Access (since March 2022)", "Desktop only"]
gap = re.compile(r'little public|little information|little detail|few concrete|very few public|unconfirmed|not a VTT: no map|No name or site yet|No site;|No website yet', re.I)
for p in d['products']:
    keep = [x for x in p['downsides'] if not gap.search(x)]
    if keep != p['downsides']: log.append(f'{p["id"]}.downsides: dropped {[x for x in p["downsides"] if gap.search(x)]}')
    p['downsides'] = keep
open(F, 'w', encoding='utf-8').write(json.dumps(d, indent=1, ensure_ascii=False) + '\n')
print('\n'.join(log)); print(len(log), 'changes')
