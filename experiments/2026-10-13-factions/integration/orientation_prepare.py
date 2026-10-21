#!/usr/bin/env python3
"""Prepare a five-view orientation sweep + plane probes for harvested meshes; never chooses a yaw."""
import argparse,csv,hashlib,json,pathlib,subprocess
from PIL import Image,ImageDraw
ROOT=pathlib.Path(__file__).resolve().parents[3]
B=ROOT/'experiments/2026-10-13-factions';I=B/'integration';T=ROOT/'tools/spawn-tuner'
LIMIT='/tmp/scratch/tw-slot'
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--verify',action='store_true',help='Render measured decisions at final yaw; requires orientation.json');p.add_argument('--models',type=pathlib.Path,default=B/'models');p.add_argument('--out',type=pathlib.Path);p.add_argument('--skus',nargs='*');p.add_argument('--dry-run',action='store_true');a=p.parse_args()
manifest=ROOT/'catalog/runs/factions-01/manifest.tsv'
if a.skus:skus=a.skus
elif manifest.exists():skus=[r['sku'] for r in csv.DictReader(manifest.open(),delimiter='\t')]
else:raise SystemExit('Name harvested --skus before the accepted manifest exists')
models=a.models.resolve();out=a.out or B/'orientation'/('verified' if a.verify else 'raw');views=out/'views'
decisions=json.loads((I/'orientation.json').read_text()) if a.verify else {}
rows=[]
for sku in skus:
    src=models/(sku+'.glb')
    if not src.exists():raise SystemExit(f'Mesh not harvested: {src}')
    decision=decisions[sku] if a.verify else {'yaw':0}
    if a.verify and not decision.get('evidence'):raise SystemExit(f'No reviewed evidence: {sku}')
    if a.verify and decision.get('sourceSha256') != hashlib.sha256(src.read_bytes()).hexdigest():raise SystemExit(f'Orientation evidence is stale: {sku}')
    rows.append({'sku':sku,'path':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'yaw':decision['yaw']})
if a.dry_run:
    print(json.dumps({'models':len(rows),'output':str(out),'rows':rows},indent=2));raise SystemExit(0)
views.mkdir(parents=True,exist_ok=True)
prior=json.loads((out/'input.json').read_text()) if (out/'input.json').exists() else []
prior={r['sku']:r for r in prior}
for r in rows:
    if prior.get(r['sku'])!=r:
        for view in 'ABCDE':(views/(r['sku']+'__'+view+'.png')).unlink(missing_ok=True)
(out/'input.json').write_text(json.dumps(rows,indent=2));lst=out/'list.txt';lst.write_text(''.join(f"{r['path']} {r['yaw']}\n" for r in rows))
subprocess.run([LIMIT,'blender','--background','--python',str(I/'orientation_views.py'),'--',str(lst),str(views)],check=True)
cmd=['~/.local/share/tw-trimesh-venv/bin/python',str(I/'orientation_probe.py'),'--models',str(models),'--out',str(out/'measurements')]
for f in [B/'assets.json',B/'step2-assets.json']:
    if f.exists():cmd+=['--assets',str(f)]
if a.verify:
    for yaw in sorted({0,-90,180,90,*[r['yaw'] for r in rows]}):cmd+=['--yaw',str(yaw)]
cmd+=['--skus',*skus]
subprocess.run(cmd,check=True)
# Neutral sheet labels keep the motif judge blind. JSON maps row indices back to SKU.
for k in range(0,len(rows),4):
    chunk=rows[k:k+4];sheet=Image.new('RGB',(5*326+45,len(chunk)*326),(30,30,33));draw=ImageDraw.Draw(sheet)
    for row,rec in enumerate(chunk):
        draw.text((12,row*326+154),str(row+1),fill='white')
        for col,view in enumerate('ABCDE'):
            x=45+col*326;y=row*326;sheet.paste(Image.open(views/(rec['sku']+'__'+view+'.png')).convert('RGB'),(x,y));draw.rectangle((x,y,x+25,y+23),fill='black');draw.text((x+7,y+5),view,fill='white')
    tag=f'sheet-{k//4:03}';sheet.save(out/(tag+'.png'));(out/(tag+'.json')).write_text(json.dumps({str(n+1):r['sku'] for n,r in enumerate(chunk)},indent=2))
print('Orientation evidence ready:',out,'; review motif front and mounting planes before writing decisions.')
