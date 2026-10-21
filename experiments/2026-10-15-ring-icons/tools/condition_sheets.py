"""Condition-only labelled contact sheets; preview compositing, never asset painting."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw
import process as pipeline
B=pipeline.BATCH
plan=json.loads((B/'plan.json').read_text())
for style in plan['sets']:
 rows=[p for p in plan['pictures'] if p['set']==style['id'] and p.get('round')==2 and p['id'].startswith('pawn.cond.')]
 for size in (31,128):
  cols=5;cw=210;ch=size+58
  im=Image.new('RGB',(cols*cw,55+math.ceil(len(rows)/cols)*ch),'#1c1f24');d=ImageDraw.Draw(im)
  d.text((16,12),f"Conditions — {style['name']} — actual {size}px",font=pipeline.font(21),fill='#eee8da')
  for n,p in enumerate(rows):
   x=(n%cols)*cw;y=55+(n//cols)*ch
   f=pipeline.ASSETS/style['id']/(pipeline.stem(p)+'.webp') if size==128 else pipeline.ASSETS/style['id']/'sizes'/str(size)/(pipeline.stem(p)+'.webp')
   if f.exists():
    with Image.open(f) as icon:im.paste(icon,(x+(cw-size)//2,y),icon)
   else:d.text((x+15,y),'Pending',font=pipeline.font(12),fill='#eee8da')
   label=p['title']+(' · alternate' if p['alt'] else '')
   d.text((x+8,y+size+6),label,font=pipeline.font(12),fill='#eee8da')
   d.text((x+8,y+size+23),p.get('colour_key',''),font=pipeline.font(11),fill='#bcb6aa')
  out=B/'sheets'/f"conditions-{style['id']}-{size}.png";im.save(out);print(out)
