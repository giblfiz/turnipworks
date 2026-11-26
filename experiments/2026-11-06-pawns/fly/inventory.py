import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import *
S, A = standing(), spec()
for i in FLIERS:
    f = S[i]; a = A.get(i, {})
    d = a.get('prompt', '').split('Specific design:')[-1].strip()[:400]
    print(f"{i} | h {f['height_ft']} base {f['base_ft']} {f['recommended']} | BLIND: {(f.get('gemini') or {}).get('blind')} | SPEC: {d}\n")
