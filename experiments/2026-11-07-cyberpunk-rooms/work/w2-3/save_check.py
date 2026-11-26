import sys,shutil,json
from pathlib import Path
from PIL import Image
src,id,tries,visual,description=sys.argv[1:]
im=Image.open(src); w,h=im.size
alpha=im.getchannel('A') if 'A' in im.getbands() else None
corners=[alpha.getpixel(p) for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]] if alpha else []
result={'size':im.size,'mode':im.mode,'corners':corners,'bbox':alpha.getbbox() if alpha else None}
assert alpha and corners==[0]*4,result
shutil.copyfile(src,Path('plates')/(id+'.png'))
with open('LOG-w2-3.md','a') as f:f.write(f'{id} | tries={tries} | PASS alpha channel/corners=0; {visual} | {description} | {json.dumps(result)}\n')
print(result)
