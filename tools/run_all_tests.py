#!/usr/bin/env python3
"""Run the inventoried matrix; retain logs/JSON and never hide a failed retry.

Defaults to one suite at a time. --jobs may use up to four limiter slots.
--match accepts a path substring; --repeat runs each selected suite N times.
--list validates inventory coverage without starting servers or tests.
"""
import argparse
import concurrent.futures
import contextlib
import datetime
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
LIMITER = '/tmp/scratch/tw-slot'
sys.path.insert(0, str(ROOT / 'tests'))
# This wrapper starts AFTER the limiter admits the command. Suite lock detection still
# sees the original *.py/*.mjs argument; there is no common wrapper filename to lock.
CHILD = '''import json,signal,subprocess,sys,time
# The suite receives group SIGINT; keep its supervisor alive to await cleanup.
signal.signal(signal.SIGINT, lambda *_: None)
start=time.time()
print('TW_MATRIX_START '+json.dumps({'at':start}),flush=True)
r=subprocess.run(sys.argv[1:])
print('TW_MATRIX_END '+json.dumps({'seconds':time.time()-start,'exit':r.returncode}),flush=True)
sys.exit(r.returncode)
'''

def inventory():
    data = json.loads((ROOT / 'tools/test_matrix.json').read_text())
    paths = [s['suite'] for s in data['suites']]
    if len(paths) != len(set(paths)):
        raise RuntimeError('Duplicate suite in tools/test_matrix.json')
    candidates = {p.relative_to(ROOT).as_posix() for folder in ('engine/test', 'tools/spawn-tuner/test', 'tests', 'tools/tool-sweep')
                  for p in (ROOT / folder).rglob('*') if p.suffix in ('.py', '.mjs', '.sh') and 'shots' not in p.parts and '__pycache__' not in p.parts}
    unknown = candidates - set(paths) - set(data['excluded'])
    missing = set(paths) - candidates
    if unknown or missing:
        raise RuntimeError(f'Update tools/test_matrix.json: unclassified={sorted(unknown)}, missing={sorted(missing)}')
    return data

def counts(text):
    # Common full-suite summaries take precedence over diagnostic PASS sub-lines.
    patterns = [r'(?im)^.*?(\d+)\s*/\s*(\d+)\s+(?:checks|passed|pass|tests)',
                r'(?im)^(?:PASS|FAIL)\s+[^\n:]*:\s*(\d+)\s*/\s*(\d+)',
                r'(?im)^\s*(\d+)\s+passed[,; ]+\s*(\d+)\s+failed']
    for i, pattern in enumerate(patterns):
        matches = re.findall(pattern, text)
        if matches:
            a,b = map(int,matches[-1]); return a, b if i == 2 else b-a
    # Node recipe suites and node:test use aggregate summaries, not PASS lines.
    aggregate = re.findall(r'(\d+)\s+(?:[a-z-]+\s+)?checks,\s+(\d+)\s+(?:failures|failed)', text)
    if aggregate:
        total, failed = map(int, aggregate[-1]); return total-failed, failed
    tap_pass = re.search(r'(?m)^# pass (\d+)$', text)
    tap_fail = re.search(r'(?m)^# fail (\d+)$', text)
    if tap_pass and tap_fail: return int(tap_pass[1]), int(tap_fail[1])
    aggregate = re.findall(r'(\d+)\s+(?:checks|assertions) passed', text)
    if aggregate: return int(aggregate[-1]), 0
    passed = len(re.findall(r'(?m)^\s*(?:PASS\b|ok\s)', text))
    failed = len(re.findall(r'(?m)^\s*FAIL\b', text))
    unit = re.search(r'Ran (\d+) tests? in', text)
    if unit and re.search(r'(?m)^OK$', text): return int(unit[1]),0
    return (passed or None),failed

def stop_group(proc):
    # A shell/limiter may exit before its children. Wait on the whole group,
    # preserving Python finally/atexit before escalating a stuck child.
    for sig, grace in ((signal.SIGINT,10),(signal.SIGTERM,5),(signal.SIGKILL,1)):
        try: os.killpg(proc.pid,sig)
        except ProcessLookupError: break
        deadline=time.monotonic()+grace
        while time.monotonic()<deadline:
            proc.poll()  # reap the group leader if it has exited
            try: os.killpg(proc.pid,0)
            except ProcessLookupError: break
            time.sleep(.05)
        else: continue
        break
    proc.wait()


def effective_ports(suite, env):
    ports=list(suite.get('ports',[]))
    override=suite.get('port_env')
    if isinstance(override,str) and env.get(override):
        ports=[int(p) for p in env[override].split(',')]
        if len(ports)!=len(suite['ports']): raise ValueError('Port override count differs from manifest')
    elif isinstance(override,list):
        ports=[int(env.get(key,default)) for key,default in zip(override,ports)]
    if any(not 0<int(p)<65536 for p in ports): raise ValueError('Invalid fixed test port')
    return sorted(set(map(int,ports)))


@contextlib.contextmanager
def port_locks(ports, stop):
    # Shared with external baseline drivers. Lock ports before requesting a GPU
    # slot so colliding suites cannot occupy all slots while waiting on a port.
    with contextlib.ExitStack() as stack:
        for port in sorted(set(ports)):
            fd=stack.enter_context(open(f'/tmp/tw-test-port-{port}.lock','a'))
            last_report=time.monotonic()
            while not stop.is_set():
                if time.monotonic()-last_report>=30:
                    print(f'  waiting for shared test port {port}',flush=True);last_report=time.monotonic()
                try:
                    fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
                    break
                except BlockingIOError: stop.wait(.1)
            else:
                yield False
                return
        # Older and external test drivers may use the port without taking our
        # lock. A momentary listener must not turn a complete matrix red before
        # the child reaches its first assertion.
        deadline=time.monotonic()+120
        last_report=time.monotonic()
        while not stop.is_set():
            occupied=[]
            for port in ports:
                with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as probe:
                    probe.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
                    try: probe.bind(('127.0.0.1',port))
                    except OSError: occupied.append(port)
            if not occupied: break
            now=time.monotonic()
            if now-last_report>=30:
                print(f'  waiting for occupied test ports {occupied}',flush=True);last_report=now
            if now>=deadline:
                print(f'  test ports still occupied after 120s: {occupied}; child will report setup failure',flush=True)
                break
            stop.wait(.1)
        yield not stop.is_set()


def run(suite, attempt, variables, args, out, stop=None):
    stop = stop if stop is not None else threading.Event()
    env={**os.environ,**{k:v.format_map(variables) for k,v in suite.get('env',{}).items()}}
    ports=effective_ports(suite,env)
    waiting=time.monotonic()
    if ports: print(f'PORTS {suite["suite"]}: waiting for {ports}',flush=True)
    with port_locks(ports,stop) as acquired:
        if not acquired: return None
        waited=round(time.monotonic()-waiting,2)
        row=run_locked(suite,attempt,variables,args,out,stop)
        if row is not None:
            row['ports']=ports;row['port_wait_seconds']=waited
            row['wall_seconds']=round(row['wall_seconds']+waited,2)
            name=suite['suite'].replace('/','__')+f'.{attempt}.json'
            (out/name).write_text(json.dumps(row,indent=2)+'\n')
        return row


def run_locked(suite, attempt, variables, args, out, stop=None):
    stop = stop if stop is not None else threading.Event()
    if stop.is_set(): return None
    render = lambda x: x.format_map(variables)
    cmd = [render(x) for x in suite['command']]
    env = {**os.environ, 'PYTHONUNBUFFERED':'1', 'TW_GPU':'1', 'TURNIP_WORKS_URL':variables['web'], 'TW_REVIEW_URL':variables['review'], 'TW_SHOTS':str(out), **{k:render(v) for k,v in suite.get('env',{}).items()}}
    name = suite['suite'].replace('/','__') + f'.{attempt}'
    log = out / (name + '.log')
    # Screenshot directories passed by manifest may not be created by older scripts.
    for a in cmd:
        if a.startswith(str(out)):
            p=Path(a); (p.parent if p.suffix else p).mkdir(parents=True,exist_ok=True)
    for key in ('TW_TEST_SHOTS','TW_SHOTS'):
        if env.get(key): Path(env[key]).mkdir(parents=True,exist_ok=True)
    started = time.monotonic(); admitted = None; timedout = False; cancelled = False
    print(f'RUN {suite["suite"]} [{attempt}/{args.repeat}]',flush=True)
    with log.open('w') as stream:
        if stop.is_set(): return None
        proc = subprocess.Popen([args.limiter,sys.executable,'-c',CHILD,*cmd],cwd=ROOT,env=env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
        last_report = started
        try:
            while proc.poll() is None:
                if stop.is_set(): cancelled=True; break
                now=time.monotonic()
                if admitted is None and 'TW_MATRIX_START ' in log.read_text(errors='replace'):
                    admitted=now
                if admitted is not None and now-admitted > suite.get('timeout',1800):
                    timedout=True; break
                if now-last_report >= 30:
                    print(f'  {suite["suite"]}: {"running" if admitted else "waiting for limiter"}, {int(now-started)}s elapsed',flush=True);last_report=now
                stop.wait(.5)
        finally:
            if proc.poll() is None or cancelled:
                stop_group(proc)
    text=log.read_text(errors='replace');tail=re.findall(r'(?m)^TW_MATRIX_END (.*)$',text)
    measured=json.loads(tail[-1]) if tail else {}
    passed,failed=counts(text);code=130 if cancelled else (124 if timedout else proc.returncode)
    xf=len(re.findall(r'(?m)^\s*XFAIL\b',text)); expected_assertions=None
    # The building matrix reports plans as its unit, while individual known
    # contracts are also logged. Do not count those twice or call XFAIL a failure.
    plans=re.search(r'(?m)^TOTAL (\d+)/(\d+) pass; (\d+) XFAIL plans \((\d+) assertions\)',text)
    if plans:
        passed,total,xf,expected_assertions=map(int,plans.groups());failed=total-passed-xf
    # Legacy scripts must not turn an explicit failed assertion green merely
    # because they forgot to propagate their result to the process exit code.
    if not code and suite.get('asserting',True) and failed: code=1
    # A broken invocation can do no work and still exit zero (the building
    # sweep once parsed a directory name as NaN and silently ran zero plans).
    if not code and suite.get('asserting',True) and passed == 0 and failed == 0 and xf == 0:
        code=1
        with log.open('a') as stream: stream.write('MATRIX_FAIL asserting suite reported zero checks\n')
    state='CANCELLED' if cancelled else 'FAIL' if code else ('XFAIL' if xf else ('PASS' if suite.get('asserting',True) else 'MEASURED'))
    row=dict(suite=suite['suite'],attempt=attempt,status=state,exit=code,child_exit=proc.returncode,passed=passed,failed=failed,expected_failures=xf,
             seconds=round(measured.get('seconds',time.monotonic()-(admitted or started)),2),wall_seconds=round(time.monotonic()-started,2),
             command=cmd,log=str(log),asserting=suite.get('asserting',True),expected_assertions=expected_assertions)
    (out/(name+'.json')).write_text(json.dumps(row,indent=2)+'\n')
    print(f'{state} {suite["suite"]} {passed if passed is not None else "—"} pass / {failed} fail / {xf} expected ({row["seconds"]}s)',flush=True)
    # tw-slot polls every five seconds; yield a full polling interval so a
    # waiting job is not starved by this worker immediately reacquiring a slot.
    stop.wait(5.1)
    return row

def execute_suites(suites, variables, args, out, stop):
    rows=[]
    def series(s):
        results=[]
        for i in range(1,args.repeat+1):
            if stop.is_set(): break
            row=run(s,i,variables,args,out,stop)
            if row is not None: results.append(row)
        return results
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs)
    futures={pool.submit(series,s) for s in suites if not stop.is_set()}
    pending=set(futures)
    try:
        while pending:
            if stop.is_set():
                for f in pending: f.cancel()
            done,pending=concurrent.futures.wait(pending,timeout=.1,return_when=concurrent.futures.FIRST_COMPLETED)
            for f in done:
                if not f.cancelled(): rows.extend(f.result())
            (out/'summary.json').write_text(json.dumps(rows,indent=2)+'\n')
    except BaseException:
        stop.set()
        raise
    finally:
        pool.shutdown(wait=True,cancel_futures=True)
    return rows


def main():
    stop=threading.Event()
    previous=signal.getsignal(signal.SIGINT)
    def interrupt(*_):
        if not stop.is_set(): print('\nCancelling matrix; allowing active suite cleanup...',flush=True)
        stop.set()
    signal.signal(signal.SIGINT,interrupt)
    try: return main_with_stop(stop)
    finally: signal.signal(signal.SIGINT,previous)


def main_with_stop(stop):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--list',action='store_true');ap.add_argument('--match',action='append',default=[])
    ap.add_argument('--repeat',type=int,default=1);ap.add_argument('--jobs',type=int,choices=range(1,5),default=1)
    ap.add_argument('--out',type=Path);ap.add_argument('--limiter',default=os.environ.get('TW_TEST_LIMITER',LIMITER))
    ap.add_argument('--golden-ref',default='origin/main',help='Exact layout reference; never rewrites goldens.')
    args=ap.parse_args()
    if args.repeat<1:ap.error('--repeat must be positive')
    data=inventory();suites=[s for s in data['suites'] if not args.match or any(q in s['suite'] for q in args.match)]
    if not suites:ap.error('No suites match')
    if args.list:
        for s in suites:print(s['suite'], '(measurement)' if not s.get('asserting',True) else '')
        print(f'{len(suites)} suites; {len(data["excluded"])} explicitly classified helpers/utilities');return 0
    if not Path(args.limiter).is_file():ap.error('Shared limiter missing; set TW_TEST_LIMITER to its installed path')
    stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    out=(args.out or Path.home()/'.cache/turnip-works/test-matrix'/stamp).resolve();out.mkdir(parents=True,exist_ok=True)
    start=time.monotonic()
    source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    golden_commit=subprocess.check_output(['git','rev-parse',args.golden_ref],cwd=ROOT,text=True).strip()
    source_dirty=subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=ROOT,text=True).splitlines()
    from tw_test_site import TestSite
    with tempfile.TemporaryDirectory(prefix='tw-golden-') as tmp,TestSite() as site:
        golden=Path(tmp)
        archive=golden/'source.tar'
        with archive.open('wb') as f:subprocess.run(['git','archive',golden_commit,'tools/spawn-tuner'],cwd=ROOT,stdout=f,check=True)
        with tarfile.open(archive) as f:f.extractall(golden,filter='data')
        variables=dict(python=sys.executable,tuner=site.url+'/tuner',game=site.game_url,out=str(out),golden=str(golden/'tools/spawn-tuner'),
                       web=site.url+'/web/',review=site.url+'/web/review/')
        rows=execute_suites(suites,variables,args,out,stop)
    rows.sort(key=lambda r:(r['suite'],r['attempt']))
    print('\nSuite | Run | Result | Pass | Fail | Xfail | Seconds\n'+'-'*100)
    for r in rows:print(f'{r["suite"]} | {r["attempt"]} | {r["status"]} | {r["passed"] if r["passed"] is not None else "—"} | {r["failed"]} | {r["expected_failures"]} | {r["seconds"]:.2f}')
    elapsed=round(time.monotonic()-start,2)
    meta=dict(commit=source_commit,end_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
              tracked_changes_at_start=source_dirty,golden_ref=args.golden_ref,golden_commit=golden_commit,
              runtime_seconds=elapsed,runs=rows,excluded=data['excluded'],interrupted=stop.is_set(),
              not_started=[dict(suite=s['suite'],attempt=i) for s in suites for i in range(1,args.repeat+1)
                           if (s['suite'],i) not in {(r['suite'],r['attempt']) for r in rows}])
    (out/'report.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(f'\n{len(rows)} runs in {elapsed:.2f}s wall time. Evidence: {out}/report.json')
    return 130 if stop.is_set() else int(any(r['exit'] for r in rows))

if __name__=='__main__':
    try:sys.exit(main())
    except (RuntimeError,subprocess.CalledProcessError) as e:print(f'MATRIX ERROR: {e}',file=sys.stderr);sys.exit(2)
