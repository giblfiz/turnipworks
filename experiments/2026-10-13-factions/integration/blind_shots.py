#!/usr/bin/env python3
"""Describe captured room views blind using neutral image names; never infers acceptance."""
import argparse,concurrent.futures,json,pathlib,shutil,subprocess,tempfile
p=argparse.ArgumentParser(description=__doc__);p.add_argument('directories',nargs='+',type=pathlib.Path);p.add_argument('--prompt',type=pathlib.Path);p.add_argument('--suffix',default='blind');a=p.parse_args()
PROMPT='These are views of a room in a fantasy tabletop game at the distance of players around a table. Describe what you can actually see first. What kind of place is this, and what repeated shapes or symbols distinguish it? Report uncertainty and visible problems; do not guess hidden detail.'
def one(record):
 out=record.with_name(record.stem+'-'+a.suffix+'.txt')
 if out.exists() and out.stat().st_size:return str(out)+' already read'
 info=json.loads(record.read_text())
 if 'images' not in info:return None
 with tempfile.TemporaryDirectory(prefix='tw-room-blind-') as td:
  td=pathlib.Path(td);prompt=td/'prompt.txt';prompt.write_text(a.prompt.read_text() if a.prompt else PROMPT);images=[]
  for n,r in enumerate(info['images']):
   q=td/f'view-{n+1}.png';shutil.copy2(record.parent/r['file'],q);images.append(str(q))
  r=subprocess.run(['~/fauna-tools/gemini-vision.py','gemini-3.8-flash',str(prompt),*images],capture_output=True,text=True)
  out.write_text(r.stdout+'\n'+r.stderr)
  if r.returncode:raise RuntimeError(f'{record}: vision failed; retained {out}')
 return str(out)
files=[p for d in a.directories for p in d.glob('*.json')]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for result in pool.map(one,files):
  if result:print(result,flush=True)
