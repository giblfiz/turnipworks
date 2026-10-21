import sys, numpy as np
from PIL import Image, ImageDraw
import detect as D
SRC = 'experiments/2026-10-05-castle-crypt-mansion/flats/seamless/roofing-%s.png'
P = {'thatch': ('thatch', 14, True, None), 'tile': ('tile-clay', 4, False, (70, 0.05)), 'slate': ('slate', 4, False, (90, 0.04)), 'shingle': ('shingle-wood', 5, True, (38, 0.05))}
out = Image.new('RGB', (2048, 2048))
for i, (st, (f, sx, rag, J)) in enumerate(P.items()):
    a = D.load(SRC % f); lum = a.mean(axis=2); lines, pk = D.lip_lines(lum, D.COURSES[st], sx, rag)
    im = Image.fromarray((a * 255).astype('uint8')); d = ImageDraw.Draw(im)
    for k, l in enumerate(lines):
        d.line([(x, float(l[x])) for x in range(1024)], fill=(0, 255, 255), width=2)
        if J:
            js = D.joints(lum, lines, k, *J); top = lines[(k - 1) % len(lines)] - (1024 if k == 0 else 0)
            for x in js: d.line([(x, float(top[x])), (x, float(l[x]))], fill=(255, 0, 255), width=2)
            print(st, k, 'rows', int(l.min()), int(l.max()), 'joints', len(js), np.diff(js).tolist())
        else: print(st, k, 'rows', int(l.min()), int(l.max()))
    out.paste(im, ((i % 2) * 1024, (i // 2) * 1024))
out.resize((1400, 1400)).save(sys.argv[1], quality=88)
