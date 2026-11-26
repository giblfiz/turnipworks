import sys,shutil
from PIL import Image
p=sys.argv[1]; im=Image.open(p); a=im.getchannel('A') if 'A' in im.getbands() else None
print({'path':p,'size':im.size,'mode':im.mode,'bbox':a.getbbox() if a else None,'solid_bbox':a.point(lambda x:255 if x>127 else 0).getbbox() if a else None,'corners':[a.getpixel(x) for x in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]] if a else None})
if len(sys.argv)>2:shutil.copy2(p,sys.argv[2])
