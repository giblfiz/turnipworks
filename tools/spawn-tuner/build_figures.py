#!/usr/bin/env python3
"""The game's FIGURE library (pawns, not props), built from the published figure set. Safe to run again and again:
as more figures are published, run it, then deploy the tuner (tools/spawn-tuner/deploy.sh) the usual way.

    python3 tools/spawn-tuner/build_figures.py            build data/figures.json + assets/figures/
    python3 tools/spawn-tuner/build_figures.py --check    say what a build would change; write nothing
    ... --set DIR     the published set (manifest.json, tiers/, thumbs/); default experiments/2026-10-06-figures/set/published
    ... --keep        do not remove files in assets/figures/ that the new list no longer names

READS the set (never writes there). WRITES only:
    data/figures.json               one row per figure: what the bar searches, how it stands, which file it is
    assets/figures/<id>--<tier>-<sha8>.glb     ONE file per figure, the tier Harry chose for its kind (2026-10-06:
                                    heroes, bosses and large creatures about 20k triangles with a 1024 px picture;
                                    townsfolk and horde monsters about 8k with 512 px). A hard link when it can be.
    assets/figures/full/<id>-<sha8>.glb        the ORIGINAL mesh (about 50k triangles, 2048 px, 2.5 MB): a player's main
                                    pawn wears it. A COPY (the originals are on the USB disk; the game must not
                                    depend on that disk being mounted): about 1.5 GB for 518.
    assets/figures/thumbs/<id>-<sha8>.webp     the gallery's thumbnail, for the command bar's result rows
    (PACKS, 2026-11-07) a figure PACK made after the set (experiments/<lane>/set/published/manifest.json, the set's own
                                    published layout; the cyberpunk runners, modern NPCs and robots first) adds its rows
                                    the same way: every folder that matches PACK_GLOB, in the worktree or else the main
                                    checkout, in name order. Ids must not repeat across packs (refused). ... --no-packs
                                    A pack's row may carry `setting` (a room pack's setting code, engine/tools/build_types.py),
                                    `kin` (its heading), `genre`, `role` and `tile` (its tile's word), passed through: the
                                    Pawns menu files such a figure under its genre (client/pawntree.js `by: 'genre'`; the
                                    culture pawns, 2026-11-07). A flier whose fly SOURCE is gone but whose built files are in
                                    assets/figures/fly/ keeps its row as built (rebuilding main after the flying-pose lane's
                                    worktree went would have dropped all 29).
    assets/figures/fly/...                     a flier's FLYING pose (2026-11-06), the same three kinds of file, from
                                    experiments/2026-11-06-pawns/fly/manifest.json (... --fly DIR), or for a PACK's figure
                                    from that pack's own <pack>/fly/manifest.json (2026-11-07, the dinosaurs): the row gets
                                    `fly: { url, k, c, yaw, h, oh, span, tris, kb, full?, full_tris?, full_kb?, thumb? }`,
                                    at the standing figure's own tier. No fly manifest: no fly rows.
The sha in each name is the figure's own (the set's sha1 of its mesh): a figure re-made under the same id gets a new
address, so a browser or Cloudflare (which keeps files about four hours) can never show the old one.
Figures are NOT in data/library.json: room generation, the Build tray and "replace with similar" never see them.
The deploy gate (test/assets_check.py) checks every file this list names.
"""
import json, os, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
opt = lambda k, d=None: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
CHECK = '--check' in sys.argv; KEEP = '--keep' in sys.argv
REL = 'experiments/2026-10-06-figures/set/published'


def find_set():
    if opt('--set'): return Path(opt('--set')).resolve()
    here = ROOT / REL
    if (here / 'tiers').is_dir() and (here / 'manifest.json').exists(): return here
    try:  # a git worktree has no binaries: the set lives in the main checkout
        common = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', '--git-common-dir'], text=True).strip()
        main = (Path(common) if os.path.isabs(common) else ROOT / common).resolve().parent / REL
        if (main / 'manifest.json').exists(): return main
    except Exception:  # noqa: BLE001
        pass
    return here


FLY_REL = 'experiments/2026-11-06-pawns/fly'


def find_fly():
    """THE FLYING POSES (2026-11-06; experiments/2026-11-06-pawns/fly): a second figure for a creature that flies, worn
    while the pawn is up in the air. Same worktree -> main-checkout fallback as the set; no manifest = no fly rows."""
    if opt('--fly'): return Path(opt('--fly')).resolve()
    here = ROOT / FLY_REL
    if (here / 'manifest.json').exists() and (here / 'tiers').is_dir(): return here
    try:
        common = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', '--git-common-dir'], text=True).strip()
        main = (Path(common) if os.path.isabs(common) else ROOT / common).resolve().parent / FLY_REL
        if (main / 'manifest.json').exists(): return main
    except Exception:  # noqa: BLE001
        pass
    return here


PACK_GLOB = 'experiments/*/set/published/manifest.json'


def find_packs():
    """THE PACKS (2026-11-07): each lane that makes figures keeps them in its OWN experiment folder (the set's published
    layout: manifest.json + tiers/ + thumbs/ + models/), so two lanes adding figures at once never touch one file.
    A pack's binaries are git-ignored: a folder here without tiers/ falls back to the same folder in the main checkout."""
    if '--no-packs' in sys.argv: return []
    roots = [ROOT]
    try:
        common = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', '--git-common-dir'], text=True).strip()
        mainroot = (Path(common) if os.path.isabs(common) else ROOT / common).resolve().parent
        if mainroot != ROOT: roots.append(mainroot)
    except Exception:  # noqa: BLE001
        pass
    found = {}
    for r in roots:
        for m in sorted(r.glob(PACK_GLOB)):
            rel = str(m.parent.relative_to(r))
            if rel == REL or rel in found and (found[rel] / 'tiers').is_dir(): continue
            found[rel] = m.parent
    return [found[k] for k in sorted(found)]


SET = find_set()
FLY = find_fly()
PACKS = find_packs()
fly_man = {f['id']: f for f in json.loads((FLY / 'manifest.json').read_text()).get('figures', [])} if (FLY / 'manifest.json').exists() else {}
# A PACK'S OWN FLYING POSES (2026-11-07, the dinosaurs' pterosaurs): <pack>/fly/manifest.json, the fly manifest's own row
# shape, its files relative to <pack>/fly/. Kept in the pack so a lane adding fliers never edits the fly lane's manifest.
pack_fly = {}
for P in PACKS:
    if (P / 'fly' / 'manifest.json').exists():
        for q in json.loads((P / 'fly' / 'manifest.json').read_text()).get('figures', []): pack_fly[q['id']] = (P / 'fly', q)
if not (SET / 'manifest.json').exists(): sys.exit(f'build_figures: no manifest.json in {SET}')
man = json.loads((SET / 'manifest.json').read_text())
OUT = HERE / 'assets' / 'figures'; DATA = HERE / 'data' / 'figures.json'
TIER = {'hero': '20k1024', 'horde': '8k512'}  # the set's two shipping tiers, by its own "recommended"
old = {f['id']: f for f in json.loads(DATA.read_text()).get('figures', [])} if DATA.exists() else {}


def put(src, dst):
    """dst becomes src's content: a hard link when the two are on one disk, else a copy. Never touches src."""
    if dst.exists() and dst.stat().st_size == src.stat().st_size and (dst.stat().st_ino == src.stat().st_ino or dst.stat().st_mtime >= src.stat().st_mtime): return False
    if CHECK: return True
    tmp = dst.with_name(dst.name + '.tmp')
    if tmp.exists(): tmp.unlink()
    try: os.link(src, tmp)
    except OSError: shutil.copy2(src, tmp)
    os.replace(tmp, dst); return True


figs, skipped, wrote, want = [], [], 0, set()
if not CHECK: (OUT / 'thumbs').mkdir(parents=True, exist_ok=True); (OUT / 'full').mkdir(parents=True, exist_ok=True)
rows, seen = [(SET, f) for f in man['figures']], {f['id']: REL for f in man['figures']}
for P in PACKS:
    for f in json.loads((P / 'manifest.json').read_text()).get('figures', []):
        if f['id'] in seen: sys.exit(f"build_figures: figure id {f['id']} is in both {seen[f['id']]} and {P} (ids must be unique across packs)")
        seen[f['id']] = str(P); rows.append((P, f))
for SRC, f in rows:
    tier = f.get('recommended') if f.get('recommended') in TIER else ('hero' if f.get('group') in ('hero', 'large') else 'horde')
    src = SRC / f['files'][tier]
    if not src.exists() or f.get('scale') is None or f.get('y0') is None: skipped.append(f"{f['id']} ({'no ' + tier + ' file' if not src.exists() else 'not measured'})"); continue
    sha = (f.get('sha1') or '0' * 8)[:8]
    url = f"assets/figures/{f['id']}--{TIER[tier]}-{sha}.glb"; want.add(Path(url).name); wrote += put(src, HERE / url)
    # the ORIGINAL mesh as published (about 50k triangles, 2048 px): what a player's MAIN pawn wears (Harry 2026-10-06)
    full = None; fsrc = SRC / f['files']['full'] if f['files'].get('full') else None
    if fsrc and fsrc.exists():
        full = f"assets/figures/full/{f['id']}-{sha}.glb"; want.add('full/' + Path(full).name); wrote += put(fsrc, HERE / full)
    thumb = None
    if f.get('thumb') and (SRC / f['thumb']).exists():
        thumb = f"assets/figures/thumbs/{f['id']}-{sha}.webp"; want.add('thumbs/' + Path(thumb).name); wrote += put(SRC / f['thumb'], HERE / thumb)
    base = f.get('base_ft') or 5
    figs.append({
        'id': f['id'], 'name': f['name'], 'group': f['group'],
        **{k: f[k] for k in ('cls', 'race', 'gender', 'family') if f.get(k)},   # (the Pawns menu's placing tree will be built from these)
        'tags': f.get('tags') or [], 'srd': f.get('srd') or [],
        'h': f['height_ft'], 'oh': f.get('overall_ft') or f['height_ft'],          # feet: the body, and to its highest point (a staff, a hat)
        'base': base, 'size': max(1, round(base / 5)),                           # feet across its square(s); squares a side
        'yaw': f.get('facing_deg') or 0, 'k': f['scale'], 'c': f.get('centre') or [0, 0],   # the mesh faces its own +Z after yaw; k: feet per mesh unit; c: its ground centre, feet
        'tier': tier, 'url': url, 'tris': f['tris'][tier], 'kb': f['kb'][tier], **({'thumb': thumb} if thumb else {}),
        **({'full': full, 'full_tris': f['tris']['full'], 'full_kb': f['kb']['full']} if full else {}),
        **({'reach': f['qa']['reach_ft']} if (f.get('qa') or {}).get('reach_ft') is not None else {}),
        **{k: f[k] for k in ('setting', 'kin', 'genre', 'role', 'tile') if f.get(k)},   # (a pack's: the Pawns menu's genre roots, client/pawntree.js; culture pawns 2026-11-07)
    })
    # ITS FLYING POSE, when it has one: the same tier as the standing figure, its own frame (k, c, yaw), height and span
    FD, q = pack_fly.get(f['id']) or (FLY, fly_man.get(f['id']))
    keep = (old.get(f['id']) or {}).get('fly')
    if q and not (FD / q['files'][tier]).exists() and keep and (HERE / keep['url']).exists():
        # ITS SOURCE IS GONE but its built files are here (2026-11-07: the flying poses' lane worktree was removed after
        # landing; only assets/figures/fly/ was copied into main): keep the row's fly object as built, and its files
        figs[-1]['fly'] = keep
        for u in (keep.get('url'), keep.get('full'), keep.get('thumb')):
            if u: want.add(str(Path(u).relative_to('assets/figures')))
    elif q and (FD / q['files'][tier]).exists():
        if not CHECK: (OUT / 'fly' / 'thumbs').mkdir(parents=True, exist_ok=True); (OUT / 'fly' / 'full').mkdir(parents=True, exist_ok=True)
        fsha = (q.get('sha1') or '0' * 8)[:8]
        furl = f"assets/figures/fly/{f['id']}--{TIER[tier]}-{fsha}.glb"; want.add('fly/' + Path(furl).name); wrote += put(FD / q['files'][tier], HERE / furl)
        ffull = None
        if q['files'].get('full') and (FD / q['files']['full']).exists():
            ffull = f"assets/figures/fly/full/{f['id']}-{fsha}.glb"; want.add('fly/full/' + Path(ffull).name); wrote += put(FD / q['files']['full'], HERE / ffull)
        fthumb = None
        if q.get('thumb') and (FD / q['thumb']).exists():
            fthumb = f"assets/figures/fly/thumbs/{f['id']}-{fsha}.webp"; want.add('fly/thumbs/' + Path(fthumb).name); wrote += put(FD / q['thumb'], HERE / fthumb)
        figs[-1]['fly'] = {'url': furl, 'k': q['scale'], 'c': q.get('centre') or [0, 0], 'yaw': q.get('facing_deg') or 0, 'h': q['height_ft'], 'oh': q.get('overall_ft') or q['height_ft'],
                           'span': q['span_ft'], 'tris': q['tris'][tier], 'kb': q['kb'][tier],
                           **({'full': ffull, 'full_tris': q['tris']['full'], 'full_kb': q['kb']['full']} if ffull else {}), **({'thumb': fthumb} if fthumb else {})}
figs.sort(key=lambda x: x['id'])
doc = {'note': 'built by tools/spawn-tuner/build_figures.py from the published figure set; do not edit by hand', 'source_updated': man.get('updated'), 'expected_total': man.get('expected_total'), 'count': len(figs), 'figures': figs}
new = [f['id'] for f in figs if f['id'] not in old]; changed = [f['id'] for f in figs if f['id'] in old and old[f['id']] != f]; gone = [i for i in old if i not in {f['id'] for f in figs}]
stale = [] if not OUT.exists() else [p for p in list(OUT.glob('*.glb')) + list((OUT / 'thumbs').glob('*.webp')) + list((OUT / 'full').glob('*.glb')) + list((OUT / 'fly').glob('*.glb')) + list((OUT / 'fly/thumbs').glob('*.webp')) + list((OUT / 'fly/full').glob('*.glb'))
                                     if str(p.relative_to(OUT)) not in want]
if not CHECK:
    DATA.write_text(json.dumps(doc, separators=(',', ':')).replace('{"id"', '\n{"id"') + '\n')
    if not KEEP:
        for p in stale: p.unlink()
from collections import Counter
mb = sum(f['kb'] for f in figs) / 1024
print(f"{'would build' if CHECK else 'built'} {len(figs)} figures of about {man.get('expected_total', '?')} from {SET}")
for P in PACKS: print(f"  + pack {P}: {sum(1 for S, _ in rows if S == P)} figures")
print(f"  by group: {dict(Counter(f['group'] for f in figs))}; by tier: {dict(Counter(f['tier'] for f in figs))}; large (10-ft base): {sum(f['size'] > 1 for f in figs)}")
print(f"  originals for main pawns: {sum(1 for f in figs if f.get('full'))} of {len(figs)} ({sum(f.get('full_kb', 0) for f in figs) / 1048576:.2f} GB)")
kept = sum(1 for f in figs if f.get('fly') and f['id'] not in pack_fly and f['fly'] == (old.get(f['id']) or {}).get('fly') and not (FLY / fly_man.get(f['id'], {}).get('files', {}).get(f['tier'], '-')).exists())
print(f"  flying poses: {sum(1 for f in figs if f.get('fly'))} of {len(fly_man) + len(pack_fly)} ({len(fly_man)} in {FLY}{f', {len(pack_fly)} in packs' if pack_fly else ''}){'' if fly_man else ' (no manifest: none)'}{f' ({kept} kept as built: their source is gone)' if kept else ''}")
print(f"  {len(new)} new, {len(changed)} changed, {len(gone)} gone; {wrote} files {'to write' if CHECK else 'written'}; {len(stale)} stale files {'left' if (KEEP or CHECK) else 'removed'}; {mb:.0f} MB of meshes in all")
if skipped: print(f"  skipped {len(skipped)}: {', '.join(skipped[:8])}{' ...' if len(skipped) > 8 else ''}")
if not CHECK: print(f"  wrote {DATA.relative_to(ROOT)} ({DATA.stat().st_size // 1024} KB). Next: tools/spawn-tuner/deploy.sh (the gate checks every file named)")
