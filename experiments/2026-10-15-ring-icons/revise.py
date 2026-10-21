"""Preserve a failed native+spec before a targeted built-in repaint."""
import json, shutil, hashlib, sys
from pathlib import Path
B=Path(__file__).resolve().parent
key,new=sys.argv[1:3]
p=B/'plan.json';plan=json.loads(p.read_text())
x=next(x for x in plan['pictures'] if x['set']+'/'+x['id']+(f"--alt{x['alt']}" if x['alt'] else '')==key)
src=B/x['source'];sha=hashlib.sha256(src.read_bytes()).hexdigest()
a=B/'attempts'/key/sha[:16];a.mkdir(parents=True,exist_ok=True);shutil.copy2(src,a/'source.png');(a/'spec.json').write_text(json.dumps(x,indent=2)+'\n')
src.unlink()
x['prompt']=x['prompt'].replace(x['metaphor'],new);x['metaphor']=new
p.write_text(json.dumps(plan,indent=2)+'\n')
# Generator remains reproducible using persisted revision overlay.
rp=B/'revisions.json';rr=json.loads(rp.read_text()) if rp.exists() else {};rr[key]=new;rp.write_text(json.dumps(rr,indent=2)+'\n')
review=B/'review.json';r=json.loads(review.read_text());r.pop(key,None);review.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(x))
