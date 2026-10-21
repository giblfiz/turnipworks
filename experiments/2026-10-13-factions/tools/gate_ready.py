#!/usr/bin/env python3
"""Gate newly saved step2 mesh plates in bounded parallel; no imagegen or pod calls.
--follow scans every 10s, reports every 40s, exits when all are gated or GATE_STOP exists.
"""
import concurrent.futures as cf,json,subprocess,time,argparse
from pathlib import Path
B=Path(__file__).resolve().parent.parent
ap=argparse.ArgumentParser();ap.add_argument('--follow',action='store_true');a=ap.parse_args()
PY='python3'
active={}; attempted=set(); last=0
with cf.ThreadPoolExecutor(3) as ex:
 while True:
  spec=json.loads((B/'step2-assets.json').read_text())['assets']
  want=[x['id'] for x in spec if x.get('lane')=='3d']
  state=json.loads((B/'gate-manifest.json').read_text()).get('assets',{})
  for sku,f in list(active.items()):
   if f.done():
    rc=f.result(); print('GATED',sku,'exit',rc,flush=True);del active[sku]
  for sku in want:
   p=B/'step2/plates'/f'{sku}.png'
   if sku in attempted or sku in active or state.get(sku,{}).get('status') in ['accepted','rejected'] or not p.exists():continue
   if len(active)>=3:break
   # Generator writes must have settled.
   if time.time()-p.stat().st_mtime<3:continue
   def gate(sku=sku,p=p):
    log=B/'plate-qa'/f'{sku}.log';log.parent.mkdir(exist_ok=True)
    with log.open('w') as f:
     return subprocess.run([PY,str(B/'tools/ingest_plate.py'),sku,str(p),'--transparent','--spec',str(B/'step2-assets.json')],stdout=f,stderr=subprocess.STDOUT).returncode
   attempted.add(sku);active[sku]=ex.submit(gate);print('START',sku,flush=True)
  done=sum(state.get(s,{}).get('status') in ['accepted','rejected'] for s in want)
  if time.time()-last>40:
   print('STATUS',done,'of',len(want),'gated;',len(active),'active',flush=True);last=time.time()
  if (B/'GATE_STOP').exists() or (done==len(want) and not active) or (not a.follow and not active):break
  time.sleep(10)
