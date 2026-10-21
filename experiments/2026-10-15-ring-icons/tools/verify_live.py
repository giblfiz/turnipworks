#!/usr/bin/env python3
"""Fetch the public manifest and every unique delivered file; verify byte hashes."""
import concurrent.futures as cf
import hashlib,json,time,urllib.request
from pathlib import Path
B=Path(__file__).resolve().parents[1]
ROOT=B.parents[1]
BASE='https://implausible.enterprises/projects/turnip-works/tuner/assets/ui-icons/'
local=ROOT/'tools/spawn-tuner/assets/ui-icons'
def get(url):
 return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (TurnipWorks asset verification)'}),timeout=45).read()
manifest_bytes=get(BASE+'manifest.json?verify='+str(int(time.time())))
expected=(local/'manifest.json').read_bytes()
assert manifest_bytes==expected,'Public manifest differs from packaged manifest'
m=json.loads(manifest_bytes);files={v for a in m['actions'].values() for x in a['variants'] for v in x['sizes'].values()}
def fetch(name):
 for attempt in range(3):
  try:
   data=get(BASE+name)
   assert hashlib.sha256(data).digest()==hashlib.sha256((local/name).read_bytes()).digest(),f'hash mismatch {name}'
   return {'file':name,'ok':True,'bytes':len(data)}
  except Exception as e:
   if attempt==2:return {'file':name,'ok':False,'error':str(e)}
results=[]
with cf.ThreadPoolExecutor(12) as pool:
 for r in pool.map(fetch,sorted(files)):
  results.append(r)
  if len(results)%100==0:print(f'Checked {len(results)}/{len(files)} live files',flush=True)
report={'url':BASE+'manifest.json','manifest_sha256':hashlib.sha256(manifest_bytes).hexdigest(),'time':time.time(),'files':results,'ok':all(x['ok'] for x in results)}
(B/'validation/live.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'}),flush=True)
raise SystemExit(0 if report['ok'] else 1)
