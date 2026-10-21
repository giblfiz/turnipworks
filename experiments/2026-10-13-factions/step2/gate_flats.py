import json,pathlib,hashlib,subprocess,concurrent.futures
from PIL import Image
B=pathlib.Path(__file__).resolve().parent; R=B.parent
assets=json.loads((R/'step2-assets.json').read_text())['assets']; (B/'flat-qa').mkdir(exist_ok=True)
P=B/'flat-qa/prompt.txt'; P.write_text('Describe the visible symbol in this tiny image plainly, without guessing what someone intended. Name the motif and the kind of flat decoration. This is a small background wall/floor decoration seen at tabletop distance. Is it whole and readable? Ignore tiny detail. Give a best interpretation and an alternative only if uncertain.')
def run(a):
 src=B/'plates'/f"{a['id']}.png"; out=B/'flat-qa'/f"{a['id']}.json"
 if not src.exists() or out.exists():return
 neutral=B/'flat-qa'/a['id']/'candidate.png';neutral.parent.mkdir(exist_ok=True)
 im=Image.open(src).convert('RGBA');im.thumbnail((110,110),Image.Resampling.LANCZOS);im.save(neutral)
 r=subprocess.run(['python3','~/fauna-tools/gemini-vision.py','gemini-3.8-flash',str(P),str(neutral)],capture_output=True,text=True)
 rec={'id':a['id'],'generator':'OpenAI built-in imagegen','refs':[],'prompt':a['prompt'],'plate':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'blind_110':r.stdout,'error':r.stderr if r.returncode else None,'status':'needs-review' if r.returncode==0 else 'error'}
 out.write_text(json.dumps(rec,indent=2)+'\n');print(a['id'],r.stdout,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(run,[a for a in assets if a['lane']=='flat']))
