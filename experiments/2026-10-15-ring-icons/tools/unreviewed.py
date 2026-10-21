import json
import process as p
plan=json.loads((p.BATCH/'plan.json').read_text());reviews=json.loads((p.BATCH/'review.json').read_text())
print('Sources',sum(p.source_path(x).exists() for x in plan['pictures']))
for x in plan['pictures']:
 key=x['set']+'/'+p.stem(x)
 if key in reviews or not p.source_path(x).exists():continue
 f=p.read_directory(x)/'result.json'
 if f.exists():
  r=json.loads(f.read_text());print('\n'+key+'\nPrompt: '+p.blind_prompt(x)+'\n'+r.get('read',r.get('error','')))
