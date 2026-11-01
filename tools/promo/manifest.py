#!/usr/bin/env python3
"""MANIFEST: the review set's index (tools/promo, 2026-10-22) -> <review>/manifest.json, and the set's size.

  python3 tools/promo/manifest.py

cuts: for each built cut (finals/<name>.edl.json) its ordered shots with their label + revision, in/out on the film and
in the shot, and captions. shots: every shot of the registry that has a master, grouped by family (an original first,
then its zoom variants, caption rugs and stylised versions), with revision, zoom, variant, description, duration, the
Gemini verdict, and the review clip's file. Fails if the review set is over 60 MB or any file over 12 MB.
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import library as L  # noqa: E402
import shoot  # noqa: E402

ABOUT_V4 = ("Turnip Works promo v4 (2026-10-23): feed-shape versions of the three cuts Harry approved on 2026-10-23 (15C, 30A, "
            "60A): 1:1 (1080x1080) and 4:5 (1080x1350). The same shots, order, in/out times, caption text and end card as the "
            "approved 16:9 masters; every shot is its own take framed for the shape (a new label in the shot's family; "
            "`shape_of` names the 16:9 shot), filmed on the engine the approved takes used (bea26e7e). Split screens are "
            "stacked (GM above the player). Labels burnt in top-left on these review copies only; the masters are clean "
            "(finals/<cut>-square.mp4, <cut>-4x5.mp4). Silent: no audio track.")

def main():
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument('--v4', action='store_true', help='the feed-shape review set: cuts with a shape, shots that are twins'); A = ap.parse_args()
    R = L.load(); cuts = {}
    for p in sorted(glob.glob(os.path.join(shoot.ROOT, 'finals', '*.edl.json'))):
        E = json.load(open(p))
        if not os.path.exists(os.path.join(shoot.REVIEW, f"{E['name']}.mp4")): continue  # (v3: only what this review set carries)
        if A.v4 and not E.get('shape'): continue
        C = json.load(open(os.path.join(HERE, 'cuts', f"{E.get('cut') or E['name']}.json")))
        cuts[E['name']] = {'title': E.get('title'), 'duration_s': E['duration'], 'captions': E.get('captions'), 'note': C.get('note', ''), 'file': f"{E['name']}.mp4",
                           **({'shape': E['shape'], 'size': E['size'], 'cut': E['cut']} if E.get('shape') else {}),
                           'shots': [{'label': b['shot'], **({'shape_of': b['shape_of']} if b.get('shape_of') else {}), 'rev': b['rev'], 'tag': b['tag'], 'film_in_s': b['at'][0], 'film_out_s': b['at'][1], 'shot_in_s': b['src_in'], 'shot_out_s': b['src_out'], 'caption': b.get('caption')} for b in E['beats']],
                           'end_card': {'film_in_s': E['end_at'], 'secs': E['end']['secs'], 'dissolve_s': E['end'].get('dissolve'), 'card': os.path.basename(E.get('card') or 'card-4.png')}}
    fams = {}
    for lab, S in R['shots'].items():
        if not os.path.exists(shoot.master_of(lab)) or not os.path.exists(os.path.join(shoot.REVIEW, 'shots', f'{lab}.mp4')): continue
        if A.v4 and not S.get('shape'): continue
        fams.setdefault(S.get('family', lab), []).append(lab)
    order = {'default': 0, 'tight': 1, 'edge': 2, 'spill': 3}
    shots = []
    for fam in sorted(fams, key=lambda f: list(R['shots']).index(f) if f in R['shots'] else 99):
        for lab in sorted(fams[fam], key=lambda l: (l != fam, bool(R['shots'][l].get('variant')), order.get(R['shots'][l].get('zoom', 'default'), 9))):
            S = R['shots'][lab]
            shots.append({'label': lab, 'rev': S['rev'], 'tag': L.tag(lab, S['rev']), 'family': fam, **({'shape': S['shape'], 'shape_of': S['shape_of']} if S.get('shape') else {}), 'zoom': S.get('zoom', 'default'), 'variant': S.get('variant'),
                          'framing': S.get('framing'), 'framing_why': S.get('framing_why'), 'description': S['desc'], 'scene': S.get('scene'), 'camera': S.get('camera'), 'duration_s': S.get('duration_s'), 'gemini_verdict': S.get('verdict'),
                          'file': f'shots/{lab}.mp4', 'master': shoot.master_of(lab)})
    M = {'_about': ABOUT_V4 if A.v4 else 'Turnip Works promo drafts v3 (2026-10-22): the 15/30/60 s cuts and W5 re-cut after Harry\'s v2 review (edge/spill framing, the join load crunched, large two-level captions naming each mechanic, end card C5, new demos FF2 handling + the ring, BX6 the fog walk). shots/ carries only the shots that are new or re-rendered in v3; the cuts also use v2 zoom variants unchanged (SY7, QP4, TZ5, UC3, RJ4: in v2\'s review set). Labels are burnt in top-left on these review copies only (with the revision above r1); the masters are clean (finals/). Silent: no audio track.',
         'cuts': cuts, 'shots': shots}
    json.dump(M, open(os.path.join(shoot.REVIEW, 'manifest.json'), 'w'), indent=1, ensure_ascii=False)
    files = [p for p in glob.glob(os.path.join(shoot.REVIEW, '**', '*'), recursive=True) if os.path.isfile(p)]
    tot = sum(os.path.getsize(p) for p in files); big = [(os.path.basename(p), os.path.getsize(p)) for p in files if os.path.getsize(p) > 8e6]
    print(f'manifest: {len(cuts)} cuts, {len(shots)} shots; review set {tot / 1e6:.1f} MB in {len(files)} files' + (f'; OVER 8 MB: {big}' if big else ''))
    if tot > 60e6 or big: sys.exit('review set over budget')

if __name__ == '__main__': main()
