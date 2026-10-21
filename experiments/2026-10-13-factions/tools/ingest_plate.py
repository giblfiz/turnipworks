#!/usr/bin/env python3
"""Gate one native OpenAI generated plate; never generates images or spends GPU rental.
Run with tw-birefnet-venv Python. CLI: ID IMAGE [--transparent] [--prepare-only].
Native alpha is preserved; opaque plates use the established BiRefNet + mask gate.
"""
import argparse, fcntl, hashlib, json, shutil, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image
B = Path(__file__).resolve().parent.parent
ROOT = B.parent.parent
sys.path.insert(0, str(ROOT/'src'))
p = argparse.ArgumentParser()
p.add_argument('id'); p.add_argument('image',type=Path)
p.add_argument('--spec',type=Path,default=B/'assets.json')
p.add_argument('--transparent',action='store_true'); p.add_argument('--prepare-only',action='store_true')
a=p.parse_args()
asset=next(x for x in json.loads(a.spec.read_text())['assets'] if x['id']==a.id)
if 'gate' not in asset: raise ValueError('Asset missing gate specification; add desc/must/must_not before calling vision')
for d in ['inputs','prompts','work','masked','plate-qa']: (B/d).mkdir(exist_ok=True)
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
original=B/'inputs'/f'{a.id}.png'
if original.exists() and sha(original)!=sha(a.image):
 shutil.copy2(original, B/'inputs'/f'{a.id}.{sha(original)[:12]}.png')
if a.image.resolve()!=original.resolve(): shutil.copy2(a.image,original)
(B/'prompts'/f'{a.id}.md').write_text(asset['prompt']+'\n')
rec={'id':a.id,'status':'prepared','time':datetime.now(timezone.utc).isoformat(),'generator':'OpenAI built-in imagegen','prompt':asset['prompt'],'prompt_sha256':hashlib.sha256(asset['prompt'].encode()).hexdigest(),'plate':str(original.relative_to(ROOT)),'sha256':sha(original),'refs':[{'path':r,'sha256':sha(Path(r))} for r in asset.get('refs',[])]}
im=Image.open(original).convert('RGBA'); im.thumbnail((110,110),Image.Resampling.LANCZOS)
small=B/'work'/f'{a.id}.110.png'; im.save(small)
blind=B/'work'/f'{a.id}.blind.txt'
blind.write_text('Describe this object plainly, without guessing what someone wanted. This is a small background prop viewed from an elevated tabletop-game camera, at actual table scale. What object and bold symbol do you see? Give a best name and an alternative if uncertain. Is it whole and readable? Do not judge tiny detail. State if the view is not elevated enough to judge the top.\n')
if not a.prepare_only:
 # Neutral basename prevents filenames from priming the blind observer.
 neutral=B/'work'/a.id/'candidate.png'; neutral.parent.mkdir(exist_ok=True); shutil.copy2(small,neutral)
 r=subprocess.run(['python3','~/fauna-tools/gemini-vision.py','gemini-3.8-flash',str(blind),str(neutral)],capture_output=True,text=True,check=True)
 rec['blind_110']=r.stdout
 import plate_gate_batch as gate
 table,_=gate.vision([], 'An unprimed observer at 110 pixels described a tabletop prop: '+r.stdout+'\nRequested object and emblem: '+asset['gate']['desc']+'\nDoes the silhouette identify the requested object AND motif at table distance? Ignore small decorative details. JSON {"ok":true|false,"problems":[]}')
 rec['table_gate']=table
 sem,_=gate.semantic_gate(asset,original); rec['semantic']=sem
 rec['status']='rejected'
 if table.get('ok') and sem.get('ok'):
  rgba=B/'work'/f'{a.id}.rgba.png'
  if a.transparent:
   raw=Image.open(original).convert('RGBA'); alpha=raw.getchannel('A')
   if alpha.getextrema()[0]==255: raise ValueError('Requested native alpha but image is opaque')
   raw.save(rgba); rec['matte']='native-alpha'
  else: rec['matte']=gate.birefnet(original,rgba)
  mg,_=gate.mask_gate(asset,original,gate.composite(rgba,B/'work'/f'{a.id}.comp.jpg')); rec['mask_gate']=mg
  if mg.get('ok'):
   shutil.copy2(rgba,B/'masked'/f'{a.id}.png'); rec['status']='accepted'
 if rec['status']!='accepted': (B/'masked'/f'{a.id}.png').unlink(missing_ok=True)
(B/'plate-qa'/f'{a.id}.json').write_text(json.dumps(rec,indent=2)+'\n')
with (B/'gate-manifest.lock').open('w') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 path=B/'gate-manifest.json'; state=json.loads(path.read_text()) if path.exists() else {'assets':{}}
 state['assets'][a.id]=rec; temp=path.with_suffix('.tmp');temp.write_text(json.dumps(state,indent=2)+'\n');temp.replace(path)
print(a.id,rec['status'],rec.get('blind_110',''))
