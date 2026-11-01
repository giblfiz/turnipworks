#!/usr/bin/env python3
"""2026-10-29: the changes made after Codex's fairness pass (codex-fairness-r1.codex.log). Run once on docs/site/vtt-index.json."""
import json, os, re
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
F = os.path.join(REPO, 'docs', 'site', 'vtt-index.json')
d = json.load(open(F, encoding='utf-8'))
P = {p['id']: p for p in d['products']}
log = []
def setc(pid, k, v=None, note=None, src=None, verified=None, append=None):
    c = P[pid]['features'][k]; old = dict(c)
    if v is not None: c['v'] = v
    if note is not None: c['note'] = note
    if append: c['note'] = (c.get('note', '') + ' ' + append).strip()
    if src is not None: c['src'] = src
    if verified is not None: c['verified'] = verified
    log.append(f'{pid}.{k}: {old.get("v")} -> {c["v"]}')

# --- the rubric (glosses) ---
G = {c['id']: c for c in d['criteria']}
G['mapbuild']['gloss'] = "Making maps inside the product rather than only importing a picture made elsewhere. yes: building from tiles, assets or a generator. partial: drawing or shape tools only."
G['fog']['gloss'] = "Hiding the parts of the map the players have not discovered. yes: built in, revealed as tokens move or by vision. partial: masks the GM paints or reveals by hand, or through a third-party add-on."
G['lighting']['gloss'] = "Light sources and walls that decide what each player's character can see, worked out by the software as tokens move. partial: light sources or lighting effects without that per-character vision."
G['sheets']['gloss'] = "Character sheets and rules automation: the software knows the game's rules (attacks, damage, conditions) instead of only showing tokens. Trackers alone (hit points, initiative, condition markers) are noted but count as no."
G['opensource']['gloss'] = "Whether the source code is published under an open licence (named in the detail view). partial: some core parts only. Source published under a non-commercial licence, or open source promised but not yet published, counts as no (said in the note)."
G['ai']['gloss'] = "AI features inside the product (generating maps, art or text, an AI assistant at the table). This says only that they exist, not whether that is good. How a product was made (AI art, AI-written code) is in its note and summary, not this value."
for c in d['criteria']:
    if c['id'] in ('fog','lighting','mapbuild','levels','sheets','ddb','phone','offline','opensource','modding','ai','dice'):
        c['gloss'] += " Every value describes the product as people can get it now: planned or unreleased work (ours on our dev server included) goes in the note, not the value. An official first-party extension counts as built in; a third-party add-on counts as partial."
        break  # said once, in the first of these (fog); repeated in the page's "How to read it"
for c in d['criteria']:
    if 'n/a' not in c['values'] and c['values'] != ['note'] and c['id'] not in ('dims','platform','price','accounts','stage'):
        c['values'].insert(len(c['values']) - 1, 'n/a')

# --- our row: scored by what the live site has ---
setc('turnip-works', 'sheets', 'no', note="no character sheets or rules engine; pawns track damage, conditions and notes, with a link to your own sheet; initiative and turn order")
setc('turnip-works', 'ddb', 'no', note="not on the live site; Beyond20 support (rolls, hit points, conditions onto pawns) is built and on our dev server (not yet live)", src="https://turnipworks.net/llms.txt", verified=True)
setc('turnip-works', 'phone', 'no', note="live: not built for phones or touch (it may open); a phone pass (tap to place, two fingers to turn) is on our dev server (not yet live)")
setc('turnip-works', 'ai', 'no', note="no AI inside the game; an outside AI chat assistant can join a table as the GM's helper through the web API. The 3D art was generated with AI, then picked and fixed by hand; most code is written by AI coding agents")
setc('turnip-works', 'mapbuild', note="drop a building (tavern, crypt, tower...) and its rooms furnish themselves; rooms drawn by hand, floors painted (hills and caves are on dev, not yet live)")
setc('turnip-works', 'levels', note="buildings with several floors and stairs, and a cut-height view to see inside (hills and rooms below ground are on dev, not yet live)")
t = P['turnip-works']
t['summary'] = "A free 3D tabletop in a browser tab where buildings furnish themselves; players join from a link. Its 3D art is AI-generated and hand-fixed. We make it, so read this row with that in mind."
t['downsides'] = ["Alpha: new, changes weekly, and things can break",
                  "Needs a desktop browser with working 3D graphics; not built for phones yet",
                  "No character sheets, rules engine, music or sound yet",
                  "Hosted only: no offline mode or self-hosting guide yet"]

# --- consistency: fog / lighting / mapbuild / planned / open source ---
for pid in ('shard-tabletop', 'adunata', 'lodestar', 'lazy-dm-companion-map-display'): setc(pid, 'fog', 'partial')
setc('owlbear-rodeo', 'fog', note="manual fog tools built in; the official Dynamic Fog extension reveals by vision; Forecast auto-detects rooms (paid tiers)")
setc('owlbear-rodeo', 'lighting', 'yes', note="through Owlbear's official Dynamic Fog extension (light, walls and vision), not the core app")
setc('owlbear-rodeo', 'opensource', 'no', note="the core app is closed; its extension SDK and several extensions (dice, music) are open source")
setc('owlbear-rodeo', 'phone', 'yes', note="the app is responsive and works on mobile and desktop, per the official guide", src="https://docs.owlbear.rodeo/docs/getting-started/", verified=True)
for pid in ('multiverse-designer', 'game-master-engine', 'terrablox', '16-vtt', 'realmweaver'):
    setc(pid, 'lighting', 'partial', append="(light sources; whether walls decide each character's sight isn't stated)")
setc('dungeon-doodler', 'mapbuild', 'partial')
setc('fantasy-grounds', 'mapbuild', 'yes', note="tiles, image brushes, layers and Quick Map (a playable map from an encounter)", src="https://www.fantasygrounds.com/vtt/fantasy-map-making", verified=True)
setc('fantasy-grounds', 'dims', '2D+3D', note="switches between 2D, a free 3D camera and a token's-eye 3D view of the map", src="https://www.fantasygrounds.com/vtt/fantasy-map-making", verified=True)
setc('tabletop-simulator', 'fog', 'yes', note="Fog of War zones conceal an area until a piece set to reveal it moves in; no wall-based vision", src="https://kb.tabletopsimulator.com/game-tools/zone-tools/", verified=True)
setc('talespire', 'ddb', 'partial', note="no official integration; a third-party browser extension (Beyond the Spire) bridges D&D Beyond rolls", src="https://addons.mozilla.org/en-US/firefox/addon/beyond-the-spire/", verified=False)
setc('adunata', 'phone', 'no', append="(not available yet)")
setc('adunata', 'levels', 'yes', append="(elevated terrain and overhangs count as height)")
setc('adunata', 'dice', 'roller', note="a Smart Dice roller; whether the dice are 3D isn't stated", verified=False)
for pid, k in (('20realms', 'sheets'), ('phroller', 'modding'), ('gamebox', 'sheets'), ('arcane-circle', 'fog')): setc(pid, k, 'no', append="(planned, not yet available)")
for pid in ('axstoria', 'eldritchvtt'): setc(pid, 'opensource', 'no', append="(promised, not yet published)")
for pid in ('dujahit', 'mini-vtt', 'dungeon-master-tool'): setc(pid, 'opensource', 'no', append="(source-available, not an open licence)")
for k in ('fog', 'lighting', 'mapbuild'): setc('tabletop-brama', k, '?', note="no map features listed in its post", verified=False)
setc('atlas-3d', 'offline', 'yes', append="(you can run it on your own Supabase server)")
for pid, k in (('game-master-engine', 'modding'), ('unnamed-steam-workshop-vtt', 'modding')):
    if P[pid]['features'][k]['v'] in ('yes', 'partial'): setc(pid, k, 'partial', append="(sharing content through Steam Workshop, not code add-ons)")
# not applicable: tools that are not shared tables
for pid in ('demiplane', 'dungeon-alchemist'):
    for k in ('fog', 'lighting', 'ddb', 'dice', 'sheets', 'phone'):
        c = P[pid]['features'][k]
        if c['v'] == 'no' and ('not a VTT' in c.get('note', '') or 'VTT' in c.get('note', '') or pid == 'dungeon-alchemist' and k in ('fog', 'dice', 'sheets', 'ddb')):
            setc(pid, k, 'n/a')
if P['atlas-3d']['features']['community'].get('note', '').find('0 GitHub stars') >= 0:
    P['atlas-3d']['features']['community']['note'] = re.sub(r';?\s*0 GitHub stars[^;.]*', '', P['atlas-3d']['features']['community']['note']).strip(' ;') or 'a young public project'

# --- upsides and downsides ---
def ups(pid, xs): P[pid]['upsides'] = xs; log.append(f'{pid}.upsides rewritten')
def downs(pid, xs): P[pid]['downsides'] = xs; log.append(f'{pid}.downsides rewritten')
downs('talespire', ["Map concealment is by manual hide volumes; no automatic fog of war yet", "Every player needs a copy or a GM-bought Seat", "Always online; no offline or LAN play"])
ups('talespire', ["Beautiful 3D scenes that are fast to build from tiles", "Builds copy as text (slabs) and share; whole adventures in community libraries", "Physical 3D dice everyone sees land"])
downs('polymancer', ["Not publicly accessible yet: a waitlist and a restricted closed alpha", "Pricing is marked preliminary", "Free GM tier is small (1 table, 3 scenes)"])
ups('polymancer', ["Generators for taverns, crypts and mazes, editable by hand", "Players join in a browser with no account", "Interactive scenes and a first-person view, with rules support announced"])
downs('dungeon-alchemist', ["Not a VTT: you still need one to play", "Early Access since 2021; 1.0 not out yet", "Desktop only"])
P['alchemy-rpg']['upsides'] = [u.replace('Everything is free; the paid tier only adds supporter perks', 'Core platform features are free; the paid tier adds supporter perks') for u in P['alchemy-rpg']['upsides']]
ups('alchemy-rpg', P['alchemy-rpg']['upsides'][:2] + ["Built-in voice and video, and a homebrew system builder"])
downs('alchemy-rpg', ["Fog of war is manual brushing only", "Fewer tactical-map tools than map-first VTTs (fog, lighting, walls)"])
ups('the-rpg-engine', P['the-rpg-engine']['upsides'][:2] + ["Steam Workshop worlds, characters, items and sheets to reuse"])
ups('multiverse-designer', P['multiverse-designer']['upsides'][:2] + ["Its own rules scripting ('Criteria') automates initiative and damage"])
downs('tabletop-simulator', ["A general tabletop sandbox: RPG rules need setup or scripting", "No wall-based vision or dynamic lighting", "Every player needs their own copy"])
downs('atlas-3d', ["Primitive props; no character sheets", "No published licence, so the public code is not open source", "Square grid only; tested mainly in Chromium browsers"])
gap = re.compile(r'not (yet )?(confirmed|documented|captured|stated|known)|unconfirmed|no official site captured|is unclear|in French|in Italian|commenter (found|thinks)|Commenter found|Users say|lighter than|as robust as|than Foundry|Licence not stated|price not stated|Price not stated|pricing not stated|Pro price not yet stated|Stage not stated|low-poly 3D only', re.I)
for p in d['products']:
    keep = [x for x in p['downsides'] if not gap.search(x)]
    if keep != p['downsides']: log.append(f'{p["id"]}.downsides: dropped {[x for x in p["downsides"] if gap.search(x)]}')
    p['downsides'] = keep
for pid in ('20realms', 'terraintale', 'stonebound', 'phroller', 'wizvtt', 'dungeon-display'): pass  # covered by the pattern above

# --- dates: a site check is not a feature check ---
for p in d['products']:
    if p['group'] == 'indie': p['last_checked'] = '2026-10-24'  # the features were read from posts and sites for the 2026-10-24 draft
open(F, 'w', encoding='utf-8').write(json.dumps(d, indent=1, ensure_ascii=False) + '\n')
print('\n'.join(log)); print(len(log), 'changes')
