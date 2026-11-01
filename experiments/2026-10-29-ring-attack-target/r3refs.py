"""References in the 10-15 form ({path, sha256, role}) for a round-2/3 picture: its style references, and for a
parchment picture made as an edit, the accepted charcoal source it was edited from."""
import hashlib
from pathlib import Path
REPO = Path(__file__).resolve().parents[2]
def refs_of(p):
    out = []
    for r in p.get('references') or p.get('refs') or []:
        if isinstance(r, dict): out.append(r); continue
        out.append({'path': r, 'sha256': hashlib.sha256((REPO / r).read_bytes()).hexdigest(), 'role': 'Style reference: our own earlier TW icon of this set (built-in image_gen input image).'})
    if p['set'] == 'parchment':
        c = REPO / p['source'].replace('/parchment--', '/charcoal--')
        if c.is_file() and not any(x['path'].endswith(c.name) for x in out):
            out.append({'path': str(c.relative_to(REPO)), 'sha256': hashlib.sha256(c.read_bytes()).hexdigest(), 'role': 'Edit source: our own accepted charcoal painting of this picture, turned into the parchment treatment.'})
    return out
