#!/usr/bin/env python3
"""Task G's reproducible browser gate. Every browser takes the shared limiter."""
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SLOT='/tmp/scratch/tw-slot'
PYTHON='python3'
p=argparse.ArgumentParser();p.add_argument('--live',action='store_true');p.add_argument('--output',required=True);p.add_argument('--suites',default='fog,fogpass,ui,rooms,pawnring,pawnsmenu,two_tab,cut,cuts,followons,graphics');a=p.parse_args()
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);rows=[]
for suite in a.suites.split(','):
    cmd=[SLOT,PYTHON,'-u',f'engine/test/browser_{suite}.py']
    if suite!='fogpass':
        if a.live:
            cmd+=['--page','https://turnipworks.net/?relay=https%3A%2F%2Fturnipworks.net%2Fapi%2Ftw-relay' if suite=='cut' else 'https://turnipworks.net/']
            if suite in ('rooms','two_tab'):cmd+=['--relay','https://turnipworks.net/api/tw-relay']
            if suite=='two_tab':
                cmd+=['--restart','DATA_DIR=engine/data engine/tools/backup_data.sh fog-live-two-tab && sudo systemctl restart tw-relay']
        else:cmd+=['--local']
    if suite=='fog':cmd+=['--shots']
    start=time.monotonic();log=out/f'{suite}.log';print('START',suite,flush=True)
    with log.open('w') as stream:r=subprocess.run(cmd,cwd=ROOT,env={**os.environ,'TW_GPU':'1'},stdout=stream,stderr=subprocess.STDOUT)
    body=log.read_text();counts=re.findall(r'.*\d+/\d+.*(?:passed|checks).*',body)
    row={'suite':suite,'rc':r.returncode,'seconds':round(time.monotonic()-start,1),'counts':counts[-1:]};rows.append(row)
    (out/'summary.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
    if r.returncode:print(body[-6000:],flush=True);sys.exit(r.returncode)
