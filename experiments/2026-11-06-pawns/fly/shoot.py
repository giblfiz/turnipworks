#!/usr/bin/env python3
"""Run render_fly.py in Blender for a flier (stills for the blind reads and for Harry).
    python3 shoot.py MODE ID [OUT] [--lift=10] [--tier=hero] [--test]      MODE table | pair | yaw<deg>
--test: draw the STANDING figure in the flying figure's place (checks the script before a flying mesh exists)."""
import json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE, SET, PUB, standing


def shoot(mode, i, out=None, lift=None, test=False, timeout=900):
    S = standing(); s = S[i]; q = None if test else json.loads((HERE / 'qa' / f'{i}.json').read_text())
    tier = s['recommended']; size = max(1, round(s['base_ft'] / 5))
    J = {'size': size, 'stand': str(PUB / s['files'][tier]), 'sk': s['scale'], 'sy0': s['y0'], 'sc': s['centre'], 'syaw': s['facing_deg'], 'sh': s.get('overall_ft') or s['height_ft']}
    if test: J.update(fly=J['stand'], k=s['scale'], y0=s['y0'], c=s['centre'], yaw=s['facing_deg'], h=s['height_ft'])
    else:
        f = HERE / 'tiers' / f"{i}-fly--{'20k1024' if tier == 'hero' else '8k512'}.glb"
        if not f.exists(): f = HERE / 'models' / f'{i}-fly.glb'
        J.update(fly=str(f), k=q['scale'], y0=q['y0'], c=q['centre'], yaw=q['facing_deg'], h=q['height_ft'])
    if lift is not None: J['lift'] = lift
    m = mode
    if mode.startswith('yaw'): J['view_deg'] = float(mode[3:]); J['dist'] = max(6, J['h'] * 2.2); m = 'yaw'
    out = Path(out or HERE / 'shots' / f'{i}-{mode}.png'); out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(['blender', '--background', '--python', str(HERE / 'render_fly.py'), '--', m, str(out), json.dumps(J)], capture_output=True, text=True, timeout=timeout)
    if not out.exists(): raise RuntimeError(r.stdout[-1500:] + r.stderr[-800:])
    return out


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    lift = next((float(x.split('=')[1]) for x in sys.argv if x.startswith('--lift=')), None)
    print(shoot(a[0], a[1], a[2] if len(a) > 2 else None, lift, '--test' in sys.argv))
