#!/usr/bin/env python3
"""REVIEW SET: re-encode every review copy from its master to fit the budget (tools/promo, 2026-10-22).

  python3 tools/promo/review.py [--budget-mb 60]

The review set (<review>/: the cuts, shots/<label>.mp4, manifest.json) must stay <= 60 MB, each file <= 12 MB. Masters
are untouched. Cuts: 1280x720 30 fps x264 slow CRF 25 (the 60 s cut CRF 26), labels of each beat burnt in. Shots: an
original 854x480 CRF 27; a variant (zoom, rug, stylised) 640x360 CRF 30; label (+rev) burnt in. If the set is still
over budget every CRF goes up by 2 and it is done again.
"""
import argparse, glob, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import library as L  # noqa: E402
import shoot  # noqa: E402

def enc(src, out, w, crf, vf_extra):
    vf = f"fps=30,scale={w}:-2:flags=lanczos,{vf_extra},format=yuv420p"
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], check=True)

def run(bump=0):
    R = L.load(); rv = shoot.REVIEW
    for lab, S in R['shots'].items():
        m = shoot.master_of(lab)
        if not os.path.exists(m): continue
        small = S.get('zoom', 'default') != 'default' or bool(S.get('variant'))
        enc(m, os.path.join(rv, 'shots', f'{lab}.mp4'), 640 if small else 854, (30 if small else 27) + bump, shoot.burn(L.tag(lab, S['rev'])))
    for p in glob.glob(os.path.join(shoot.ROOT, 'finals', '*.edl.json')):
        E = json.load(open(p)); m = E['master']
        dt = ','.join(f"drawtext=fontfile={shoot.FONT}:text='{b['tag']}':x=w*0.012:y=h*0.016:fontsize=h*0.024:fontcolor=white@0.92:box=1:boxcolor=black@0.55:boxborderw=6:enable='between(t,{b['at'][0]:.4f},{b['at'][1] - 0.001:.4f})'" for b in E['beats'])
        enc(m, os.path.join(rv, f"{E['name']}.mp4"), 1280, (26 if E['duration'] >= 60 else 25) + bump, dt)
    files = [p for p in glob.glob(os.path.join(rv, '**', '*.mp4'), recursive=True)]
    return sum(os.path.getsize(p) for p in files) / 1e6, max(os.path.getsize(p) for p in files) / 1e6

def run_only(cuts, labels, budget_file=8.0):
    """v3: only the named cuts and shots (what changed or is new), each re-encoded until it is under budget_file MB"""
    R = L.load(); rv = shoot.REVIEW; os.makedirs(os.path.join(rv, 'shots'), exist_ok=True); sizes = {}
    def fit(src, out, w, crf, vf):
        while True:
            enc(src, out, w, crf, vf); mb = os.path.getsize(out) / 1e6
            if mb <= budget_file or crf >= 40: return mb, crf
            crf += 2
    for lab in labels:
        S = R['shots'][lab]; sizes[f'shots/{lab}.mp4'] = fit(shoot.master_of(lab), os.path.join(rv, 'shots', f'{lab}.mp4'), 1280, 25, shoot.burn(L.tag(lab, S['rev'])))
    for name in cuts:
        E = json.load(open(os.path.join(shoot.ROOT, 'finals', f'{name}.edl.json')))
        dt = ','.join(f"drawtext=fontfile={shoot.FONT}:text='{b['tag']}':x=w*0.012:y=h*0.016:fontsize=h*0.024:fontcolor=white@0.92:box=1:boxcolor=black@0.55:boxborderw=6:enable='between(t,{b['at'][0]:.4f},{b['at'][1] - 0.001:.4f})'" for b in E['beats'])
        sizes[f'{name}.mp4'] = fit(E['master'], os.path.join(rv, f'{name}.mp4'), 1280, 26 if E['duration'] >= 60 else 24, dt)
    for k, (mb, crf) in sizes.items(): print(f'  {k}: {mb:.2f} MB (CRF {crf})')
    print(f'review set: {sum(v[0] for v in sizes.values()):.1f} MB in {len(sizes)} files')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--budget-mb', type=float, default=60); ap.add_argument('--cuts', nargs='*'); ap.add_argument('--shots', nargs='*'); A = ap.parse_args()
    if A.cuts is not None or A.shots is not None: return run_only(A.cuts or [], A.shots or [])
    bump = 0
    while True:
        tot, big = run(bump); print(f'review set: {tot:.1f} MB, largest {big:.1f} MB (CRF +{bump})')
        if (tot <= A.budget_mb - 1 and big <= 12) or bump >= 8: break
        bump += 2

if __name__ == '__main__': main()
