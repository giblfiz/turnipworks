#!/usr/bin/env python3
"""Watch native icons; pad/resize only, individually blind-read at exactly 31px.
Run tw-birefnet-venv Python; --follow waits for all13. ICON_GATE_STOP stops.
"""
import argparse, concurrent.futures as cf,hashlib,json,subprocess,sys,time
from datetime import datetime,timezone
from pathlib import Path
from PIL import Image
B=Path(__file__).resolve().parent.parent;ROOT=B.parent.parent
sys.path.insert(0,str(ROOT/'src'));import plate_gate_batch as gate
p=argparse.ArgumentParser();p.add_argument('--follow',action='store_true');a=p.parse_args()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
QA=B/'icons/qa';RT=B/'icons/runtime';QA.mkdir(exist_ok=True);RT.mkdir(exist_ok=True)
def work(x):
 name=x['faction'];source=B/'icons'/f'{name}.png';q=QA/name;q.mkdir(exist_ok=True)
 # Preserve source unchanged, place it centrally on a transparent square with original margins.
 original=Image.open(source).convert('RGBA');side=max(original.size)
 square=Image.new('RGBA',(side,side));square.alpha_composite(original,((side-original.width)//2,(side-original.height)//2))
 for size in [31,128,256]:
  out=q/'candidate.png' if size==31 else RT/f'{name}{"@2x" if size==256 else ""}.png'
  square.resize((size,size),Image.Resampling.LANCZOS).save(out)
 prompt=q/'blind.txt';prompt.write_text('This is a tiny icon at its actual 31-pixel display size on a tabletop game interface. What symbol do you see? Give your best identification and a second guess if uncertain. Name only visible forms. Is the symbol recognizable at this small size? No context is supplied about what it is intended to mean.\n')
 r=subprocess.run(['python3','~/fauna-tools/gemini-vision.py','gemini-3.8-flash',str(prompt),str(q/'candidate.png')],check=True,capture_output=True,text=True)
 (q/'blind.txt.out').write_text(r.stdout)
 match,_=gate.vision([], 'A blind observer saw only a31pixel icon and said: '+r.stdout+'\nThe original icon prompt was: '+x['prompt']+'\nCompare the identifying SYMBOL only, not stylistic fine detail or exact counts. Does their identification convey the requested primary emblem? For combined emblems require the major defining components, e.g. sword and shield or scales and coin. JSON {"ok":true|false,"reads_as":"short name","problems":[]}')
 rec={'id':x['id'],'faction':name,'status':'accepted' if match.get('ok') else 'rejected','original':str(source.relative_to(ROOT)),'sha256':sha(source),'prompt':x['prompt'],'prompt_sha256':hashlib.sha256(x['prompt'].encode()).hexdigest(),'refs':x.get('refs',[]),'resizing':'unchanged source centered on transparent square, Lanczos to31/128/256; no repaint','blind_31':r.stdout,'verdict':match,'runtime':str((RT/f'{name}.png').relative_to(ROOT)),'time':datetime.now(timezone.utc).isoformat()}
 (q/'verdict.json').write_text(json.dumps(rec,indent=2)+'\n')
 print(name,rec['status'],match.get('reads_as'),match.get('problems'),flush=True)
 return name
active={};attempted=set();last=0
with cf.ThreadPoolExecutor(3) as ex:
 while True:
  assets=json.loads((B/'icon-assets.json').read_text())['assets']
  for n,f in list(active.items()):
   if f.done():
    try:f.result()
    except Exception as e:print('ERROR',n,repr(e),flush=True)
    del active[n]
  done=0
  for x in assets:
   n=x['faction'];src=B/'icons'/f'{n}.png';record=QA/n/'verdict.json'
   if record.exists() and src.exists() and json.loads(record.read_text()).get('sha256')==sha(src):done+=1;continue
   if n in attempted or n in active or not src.exists() or time.time()-src.stat().st_mtime<3:continue
   if len(active)>=3:break
   attempted.add(n);active[n]=ex.submit(work,x);print('START',n,flush=True)
  if time.time()-last>40:print('ICON STATUS',done,'of',len(assets),'gated;',len(active),'active',flush=True);last=time.time()
  if (B/'ICON_GATE_STOP').exists() or done==len(assets) or (not a.follow and not active):break
  time.sleep(10)
