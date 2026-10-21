import json
from pathlib import Path
B=Path(__file__).resolve().parent
rows=[
('blinded','pearl white and black','A single large human eye completely covered across its pupil by a broad opaque pearl-white cloth blindfold, with two short cloth tails at right. Black shadow behind the blindfold. No slash, no other face.',None),
('charmed','rose pink','One large rose-pink heart containing a small ivory spiral, with two tiny pink hearts floating at upper right. A warm magical enchantment pictogram, not a broken heart.',None),
('frightened','violet','A violet human face with huge white wide frightened eyes, open oval mouth, and both hands raised beside the cheeks in terror. Clear screaming frightened silhouette.',None),
('grappled','burnt orange','One large burnt-orange hand firmly gripping another ivory human wrist. The captured wrist extends upward, the gripping fingers wrap across it. A physical grab; no rope, no chain.','Two burnt-orange forearms locked together in a wrestling grip, thick fingers visibly clasping an opposing wrist. No ropes, chains or knots.'),
('invisible','pale cyan','A pale-cyan outline of a standing human silhouette fading away from left to right into three broad separated mist fragments; the dark or parchment badge ground shows through the empty body. No eye, no slash, no ghost face.','Two cyan footprints beneath an otherwise empty thin cyan human outline that fades completely above the knees. An invisible walker, no eye or slash.'),
('poisoned','acid green','A squat acid-green poison bottle with a broad black skull symbol on the face and one large green droplet above its open mouth. Simple thick neck and rounded bottom.',None),
('prone','earth brown','A full earth-brown human body lying FACE DOWN horizontally along a short ivory floor line, arms bent out beside the head, legs straight. Entire figure low and flat; visibly on the ground, not a portrait or sleeping face.','An earth-brown human figure falling forward flat toward a short ground line, full body horizontal with limbs spread; one broad downward arrow above the torso. No stars or moon.'),
('restrained','crimson red','A compact crimson-red torso with both arms pinned tightly to its sides by THREE thick ivory rope loops and one big front knot. Full bound torso silhouette, no gripping hand.','Two crimson-red wrists bound side by side with one thick ivory rope knot and short rope ends. Clear tied wrists, not a hand gripping a wrist.'),
('stunned','bright yellow gold','A bright-yellow human head with dazed uneven eyes, three large yellow stars circling above the crown along a short ivory arc. Head upright, mouth slightly open, no heart or moon.','One bright-yellow lightning bolt striking a simple upright head silhouette, with two broad gold impact stars over the crown. Shocked and dazed, not frightened.'),
('unconscious','deep indigo blue','A deep-indigo blue human head drooping sideways with both eyes fully closed and limp mouth, resting against one broad ivory crescent moon at upper right. No body, no stars, no blood.','A deep-indigo blue sleeping face in side profile with closed eye, cheek resting on an ivory pillow. Limp relaxed sleeping profile, no stars, no full-body figure.'),
('clear','clean mint','One broad mint-green hand broom sweeping away three small detached red, violet and green round condition badges, leaving a large clean ivory checkmark. Clear all status effects, not a single condition.',None),
]
blind='''This is an original small status icon for a tabletop pawn. View it at its supplied 31-pixel size. Which D&D condition does this icon show? First describe its visible silhouette and colours, then name your single best condition and confidence. If it instead depicts clearing conditions, say so. Do not infer anything from its filename. Be concise.'''
pics=[]
for name,color,base,alt in rows:
 for st in ['charcoal','parchment']:
  ground='dark charcoal circular ground with a quiet thin slate rim' if st=='charcoal' else 'pale warm parchment circular ground with a quiet thin antique brass rim; use dark outlines for strong contrast'
  for n,m in enumerate([base]+([alt] if alt else [])):
   id='pawn.cond.'+name
   prompt=f'Use case: stylized-concept. Paint exactly ONE original Turnip Works tabletop condition pictogram for {name}: {m} Dominant subject colour key: {color}; keep this colour strongly visible, not just a tiny accent. Heroic hand-painted style D, chunky matte painted forms, broad soft bevels, restrained brushwork. Center on a {ground}. Upper-left light. Straight-on circular badge; outer circle fills 94 percent of square canvas, pictogram fills 80 percent of disc. Readable at31px and smaller: bold silhouette, thick features, generous negative space, absolutely no tiny detail. Native transparent alpha outside the circle. No text, lettering, numbers, watermark, decorative flourishes or extra scene. Our own text-only design, no trademarked game iconography and no third-party references.'
   pics.append(dict(id=id,title='Clear all conditions' if name=='clear' else name.capitalize(),actions=[id],set=st,alt=n,metaphor=m,prompt=prompt,source='sources/'+st+'--'+id+('--alt1' if n else '')+'.png',refs=[],blind_prompt=blind,round=2,colour_key=color))
previous=json.loads((B/'round2-pictures.json').read_text()) if (B/'round2-pictures.json').exists() else []
combined=[p for p in previous if not p['id'].startswith('pawn.cond.')]+pics
(B/'round2-pictures.json').write_text(json.dumps(combined,indent=2)+'\n')
inv=json.loads((B/'inventory.json').read_text())
for r in inv:
 if r['id'] in {p['id'] for p in pics}:r['picture']=r['id'];r['note']='Distinct sibling condition picture; colour and silhouette keyed in round2-pictures.json.'
(B/'inventory.json').write_text(json.dumps(inv,indent=2)+'\n')
f=B/'make_plan.py';s=f.read_text();anchor='# Repaints are durable overlays; never lose a reviewed correction on regeneration.'
insert="""# Round2: siblings never share a picture. Additional plans replace their action aliases.
round2_path=B/'round2-pictures.json'
if round2_path.exists():
 additions=json.loads(round2_path.read_text())
 dedicated={a for pic in additions for a in pic['actions']}
 for pic in pics: pic['actions']=[a for a in pic['actions'] if a not in dedicated]
 pics=[pic for pic in pics if pic['actions']]+additions
"""
if insert not in s:s=s.replace(anchor,insert+anchor)
f.write_text(s)
print(len(pics),'condition variants')
