import json
from pathlib import Path
B=Path(__file__).resolve().parent
# Shared paintings use actual registry ids; grouped menu prefixes remain literal source keys.
items=[
('edit.rotate','Turn',['edit.rotate','room.rotate'],'An upright ochre wooden crate with ONE thick ivory horizontal elliptical arrow circling its base. Exactly one arrowhead.','An upright block on a round turntable, with one horizontal curved arrow.'),
('edit.resize','Resize',['edit.resize'],'A small solid ochre crate anchored at the lower left inside a much larger translucent teal ghost crate. Exactly ONE thick ivory diagonal arrow pointing up and right.',''),
('room.reroll','Re-roll',['room.reroll','roof.reroll','building.reroll'],'Two chunky ivory dice, black broad pips, one slightly above the other.',''),
('thing.replace','Replace',['thing.replace'],'Two separate blocks, one ochre and one teal, with two ivory exchange arrows above and below them pointing in opposite directions. No dice, no pips.',''),
('thing.tilt','Roll',['thing.tilt'],'An ochre wooden crate visibly tipped forty-five degrees onto its corner, with ONE thick ivory VERTICAL curved arrow arching over its top toward its right side. Exactly one arrowhead.',''),
('pawn.damage','Damage',['pawn.damage'],'A vivid red heart with a wide diagonal ivory slash cutting through it.','A blue steel shield with a large red sharp impact burst striking its right edge.'),
('thing.hide','Hide / reveal',['thing.hide','roof.hide'],'A large ivory eye with a thick red diagonal slash.','A heavy teal curtain being drawn across a small ivory eye.'),
('thing.lock','Lock / unlock',['thing.lock'],'One stout iron padlock, brass keyhole plate, closed shackle.','A chunky horizontal iron sliding door bolt in its brackets.'),
('room.walls.','Walls',['room.walls.'],'A chunky three-course stone brick wall with a clear staggered masonry silhouette.','A small roofless room corner: two thick stone walls meeting at a right angle.'),
('room.fog','Fog height',['room.fog'],'Three broad pale blue horizontal fog banks with one ivory vertical double-headed arrow at the right.','A small grey stone room partly filled by a low pale teal mist layer, an ivory vertical measuring stick beside it.'),
('room.height.','Height',['room.height.'],'Two thick horizontal stone slabs, floor and ceiling, with an ivory vertical double-headed arrow between them.','A stout stone wall beside a large ivory vertical measuring ruler.'),
('faction.set','Faction',['faction.set'],'Two overlapping stout pennant banners, one muted teal and one ochre, each on a short pole.','A stout shield divided into teal and ochre halves with a small ivory star in its center.'),
('thing.pin','Pin / keep through re-roll',['thing.pin'],'A large red pushpin, angled diagonally, short ivory point.','A wooden crate with a broad brass retaining strap and simple central clasp.'),
('edit.lift','Raise / lower',['edit.lift'],'One small ochre wooden crate floating above a short horizontal ground shadow, with a large ivory vertical double-headed arrow beside it.','An ivory pawn floating above a teal oval base, broad up and down arrows at the right.'),
('pawn.sheet','Sheet',['pawn.sheet'],'A warm ivory parchment page with a large teal pawn portrait and two thick horizontal dark writing strokes.','An open chunky cream book with a large teal pawn silhouette on one page.'),
('pawn.give','Give control',['pawn.give'],'A broad open ivory hand offering a small teal pawn.','Two simple pawn busts with one bold ivory arrow passing from the ochre bust to the teal bust.'),
('edit.duplicate','Duplicate',['edit.duplicate','pawn.duplicate'],'Two identical overlapping ochre wooden crates with a large ivory plus sign.','Two identical teal pawn silhouettes side by side with a large ivory plus sign above them.'),
('thing.open','Open / close',['thing.open'],'A chunky wooden door standing open in a simple stone frame, dark opening visible.',''),
('thing.light','Light / put out',['thing.light'],'One bold golden flame above a short red candle with a dark wick.',''),
('thing.rename','Rename',['thing.rename'],'One stout ochre pencil diagonally crossing a blank ivory name tag.',''),
('thing.upright','Stand upright',['thing.upright'],'An upright ochre crate resting flat on a thick ground line with a broad ivory up arrow beside it.',''),
('pawn.cond.','Conditions',['pawn.cond.'],'One bold ochre warning badge with a dark exclamation mark.','Three overlapping red, teal and ivory circular status badges.'),
('pawn.mark.','Indicators',['pawn.mark.'],'One large five-point gold star with broad matte painted facets.',''),
('pawn.travel','Send to area',['pawn.travel'],'An ivory pawn moving through a teal doorway, a bold ochre arrow pointing through the doorway.',''),
('roof.style.','Roof style',['roof.style.','building.roof.'],'One thick ochre pitched roof with broad teal shingles, no house beneath it.',''),
('building.storeys.','Storeys',['building.storeys.'],'Three thick stacked stone floor slabs separated by short dark supporting pillars.',''),
('room.height.taller','Taller',['room.height.taller'],'A thick stone ceiling slab with one large ivory upward arrow lifting it.',''),
('room.height.shorter','Shorter',['room.height.shorter'],'A thick stone ceiling slab with one large ivory downward arrow lowering it.',''),
('stair.flip','Stairs up / down',['stair.flip'],'Three broad stone stair steps with a thick ivory double-headed diagonal arrow following their slope.',''),
('cast.saveGroup','Save as group',['cast.saveGroup'],'Three small stout ivory pawns held together inside one broad teal circular bracket.',''),
('ring.menu','All options',['menu'],'Exactly three broad short horizontal ivory bars stacked evenly, simple hamburger menu symbol.','Exactly three large ivory dots arranged horizontally.'),
('ring.close','Close options',['ring.close'],'One bold ivory diagonal X made of two broad painted strokes.',''),
]
sets=[dict(id='charcoal',name='Charcoal paint',note='Heroic hand-painted, quiet charcoal ground, restrained slate rim, upper-left light.'),dict(id='parchment',name='Parchment & brass',note='Heroic hand-painted, warm parchment ground, restrained brass rim, upper-left light.')]
pics=[]
for id,title,actions,metaphor,alt in items:
 for s in sets:
  for a,m in [(0,metaphor)]+([(1,alt)] if alt and s['id']=='charcoal' else []):
   ground='dark charcoal circular ground, quiet thin slate rim' if s['id']=='charcoal' else 'warm pale parchment circular ground, quiet thin antique brass rim; ivory shapes instead dark slate for strong contrast'
   prompt=f'Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop UI pictogram: {m} Heroic hand-painted style D: chunky miniature-safe forms, broad soft bevels, matte painted gradients, restrained brushwork, no glossy plastic. Centered on a {ground}. Straight-on circular badge, subject fills 80 percent of the disc, outer disc fills 94 percent of square canvas. Light from upper left. Palette: warm ochre wood, muted teal, ivory, slate, red only for danger or pin. Must read at 31 pixels: extremely simple silhouette, thick features, generous negative space, no tiny detail. Transparent outside the circle, preserve actual alpha. No text, lettering, numbers, watermark, decorative flourishes, extra symbols, or scene. Text-only original design; no third-party references.'
   key=f"{s['id']}--{id}"+(f'--alt{a}' if a else '')
   pics.append(dict(id=id,title=title,actions=actions,set=s['id'],alt=a,metaphor=m,prompt=prompt,source=f'sources/{key}.png',refs=[]))
# Extend only after the original 79 variants: source ordering is a generation contract.
inventory=json.loads((B/'inventory.json').read_text())
alias_groups={'pawn.cond.':'conditions','room.walls.':'walls','roof.style.':'roof-style','building.storeys.':'storeys','ring.close':'close','pawn.mark.':'mark-star'}
for pic in pics:
 group=alias_groups.get(pic['id'])
 if group:
  pic['actions']=list(dict.fromkeys(pic['actions']+[r['id'] for r in inventory if r['picture']==group]))
extra=[
 ('pawn.mark.circle','Circle indicator','mark-circle','One large solid orange circle.'),
 ('pawn.mark.diamond','Diamond indicator','mark-diamond','One large solid purple diamond with four clear corners.'),
 ('pawn.mark.triangle','Triangle indicator','mark-triangle','One large solid green equilateral triangle pointing upward.'),
 ('pawn.mark.moon','Moon indicator','mark-moon','One large pale icy blue crescent moon, broad curved body and clear dark crescent cutout.'),
 ('pawn.mark.square','Square indicator','mark-square','One large solid royal blue square with four clear corners.'),
 ('pawn.mark.cross','Cross indicator','mark-cross','One large bold red diagonal cross made of two wide strokes.'),
 ('pawn.mark.skull','Skull indicator','mark-skull','One chunky ivory skull silhouette with two broad dark eye sockets and simple square jaw.'),
 ('measure.start','Measure','measure','A stout ivory measuring ruler diagonally between two broad teal endpoint dots. Only three large dark tick marks.'),
 ('measure.keep','Keep','keep','One broad brass anchor planting a small teal circular spell disc firmly in place.'),
 ('measure.keepRounds','Keep for rounds','rounds','One chunky brass hourglass with ivory sand between two thick horizontal supports.'),
 ('measure.attach','Attach','attach','Two thick interlocking chain links, one ochre and one teal.'),
 ('measure.say','Say who is caught','say','One broad ivory speech bubble containing a single teal pawn silhouette.'),
 ('template.remove','Remove template','remove','One stout dark metal waste bin with an ivory lid and two broad ivory vertical slats.'),
 ('measure.shape.line','Line template','shape-line','One broad long teal rectangular spell strip receding slightly in perspective; clear rectangular silhouette.'),
 ('measure.shape.cone','Cone template','shape-cone','One broad teal fan-shaped spell wedge, a clear pointed origin and wide curved far edge.'),
 ('measure.shape.circle','Circle template','shape-circle','One thick teal circular ring lying flat on the ground as a broad ellipse with dark center.'),
 ('measure.shape.sphere','Sphere template','shape-sphere','One large teal sphere with a broad ivory equatorial band and one broad vertical curved meridian band.'),
 ('measure.shape.cube','Cube template','shape-cube','One large teal spell cube with three clearly distinct broad faces and thick ivory edges.'),
]
def extra_pic(id,title,actions,m,setid,alt=0):
 ground='dark charcoal circular ground, quiet thin slate rim' if setid=='charcoal' else 'warm pale parchment circular ground, quiet thin antique brass rim; ivory shapes instead dark slate for strong contrast'
 prompt=f'Use case: stylized-concept. Paint exactly ONE original Turnip Works fantasy tabletop UI pictogram: {m} Heroic hand-painted style D: chunky miniature-safe forms, broad soft bevels, matte painted gradients, restrained brushwork, no glossy plastic. Centered on a {ground}. Straight-on circular badge, subject fills 80 percent of the disc, outer disc fills 94 percent of square canvas. Light from upper left. Palette: warm ochre wood, muted teal, ivory, slate, red for danger; preserve explicitly specified marker shape colors. Must read at 31 pixels: extremely simple silhouette, thick features, generous negative space, no tiny detail. Transparent outside the circle, preserve actual alpha. No text, lettering, numbers, watermark, decorative flourishes, extra symbols, or scene. Text-only original design; no third-party references.'
 key=f"{setid}--{id}"+(f'--alt{alt}' if alt else '')
 pics.append(dict(id=id,title=title,actions=actions,set=setid,alt=alt,metaphor=m,prompt=prompt,source=f'sources/{key}.png',refs=[]))
for id,title,group,m in extra:
 actions=[r['id'] for r in inventory if r['picture']==group]
 for st in sets: extra_pic(id,title,actions,m,st['id'])
# Future-action states stay on the real command id, as variants; alt numbers do not imply a new command.
for id,title,m,alt in [
 ('thing.hide','Reveal to players','One large open ivory eye with a clear teal pupil and no slash, curtain or obstruction.',2),
 ('thing.lock','Unlock','One stout iron padlock with brass keyhole plate and a visibly open raised shackle.',2),
 ('thing.open','Close','A chunky wooden door fully closed within its simple stone frame, one large brass handle.',2),
 ('thing.pin','Unpin','A large red pushpin pulling away from a short teal ground line, with one thick ivory upward arrow.',2),
 ('thing.light','Put out','A stout red candle with a visibly black extinguished wick, one broad pale curling smoke trail and no flame.',2),
 ('stair.flip','Stairs up','Three broad stone stair steps with one thick ivory diagonal arrow pointing upward along the steps.',2),
 ('stair.flip','Stairs down','Three broad stone stair steps with one thick ivory diagonal arrow pointing downward along the steps.',3),
]:
 for st in sets: extra_pic(id,title,[id],m,st['id'],alt)
for id,title,m in [
 ('measure.start','Measure','Two stout ivory dividers spread apart over a short teal ground line, showing a measured distance.'),
 ('measure.keep','Keep','A large brass pushpin pinning a simple teal circular spell disc in place.'),
 ('measure.attach','Attach','One ivory pawn standing on a teal aura ring, joined to it by one stout brass chain link.'),
]:
 actions=next(v['actions'] for v in pics if v['id']==id)
 extra_pic(id,title,actions,m,'charcoal',1)
# Round2: siblings never share a picture. Additional plans replace their action aliases.
round2_path=B/'round2-pictures.json'
if round2_path.exists():
 additions=json.loads(round2_path.read_text())
 dedicated={a for pic in additions for a in pic['actions']}
 for pic in pics: pic['actions']=[a for a in pic['actions'] if a not in dedicated]
 pics=[pic for pic in pics if pic['actions']]+additions
# Repaints are durable overlays; never lose a reviewed correction on regeneration.
revisions_path=B/'revisions.json'
revisions=json.loads(revisions_path.read_text()) if revisions_path.exists() else {}
for pic in pics:
 key=pic['set']+'/'+pic['id']+(f"--alt{pic['alt']}" if pic['alt'] else '')
 if key in revisions:
  pic['prompt']=pic['prompt'].replace(pic['metaphor'],revisions[key])
  pic['metaphor']=revisions[key]
reference_edits_path=B/'reference-edits.json'
reference_edits=json.loads(reference_edits_path.read_text()) if reference_edits_path.exists() else {}
for pic in pics:
 key=pic['set']+'/'+pic['id']+(f"--alt{pic['alt']}" if pic['alt'] else '')
 if key in reference_edits: pic.update(reference_edits[key])
plan=dict(sets=sets,pictures=pics)
(B/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
missing={r['id'] for r in inventory}-{a for pic in pics for a in pic['actions']}
assert not missing,missing
assert len({(v['id'],v['set'],v['alt']) for v in pics})==len(pics)
print(len(items)+len(extra),'pictures',len(pics),'variants;',len(inventory),'inventory entries covered')
