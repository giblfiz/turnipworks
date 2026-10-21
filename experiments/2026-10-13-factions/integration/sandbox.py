#!/usr/bin/env python3
"""Link immutable main binaries into Task C; copy mutable flat outputs, never share write targets."""
import argparse, pathlib, shutil, subprocess, os
p=argparse.ArgumentParser();p.add_argument('--main',default='<repo>');p.add_argument('--target',default=str(pathlib.Path(__file__).resolve().parents[3]));a=p.parse_args()
source=pathlib.Path(a.main).resolve();target=pathlib.Path(a.target).resolve()
if source==target: raise SystemExit('Refusing sandbox setup in main')
count=0
# Ignore lists include binary assets/plates. Tracked source and generated metadata come from Git.
for sub in ['experiments','tools/spawn-tuner/assets','tools/spawn-tuner/js/vendor','engine/client/data']:
    files=subprocess.check_output(['git','-C',str(source),'ls-files','--others','--ignored','--exclude-standard','-z','--',sub]).decode().split('\0')
    for name in filter(None,files):
        src=source/name;dst=target/name
        if dst.exists() or dst.is_symlink() or not src.is_file():continue
        dst.parent.mkdir(parents=True,exist_ok=True)
        if name.startswith('tools/spawn-tuner/assets/flat/'):
            shutil.copy2(src,dst) # prep/flats.py rewrites all flats; symlinks here would write into main
        else: dst.symlink_to(src)
        count+=1
for sub in ['engine/node_modules','node_modules','tools/spawn-tuner/prep/node_modules']:
    src=source/sub;dst=target/sub
    if src.exists() and not dst.exists(): dst.symlink_to(src,target_is_directory=True)
print(f'Sandbox: {count} binary references/copies prepared; no main files modified')
