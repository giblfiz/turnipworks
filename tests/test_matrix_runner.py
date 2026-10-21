"""The matrix must stay red after a child fails, aborts or times out."""
import contextlib
import importlib.util
import io
import json
import os
import signal
import socket
import subprocess
import time
from pathlib import Path
import sys
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('matrix', Path(__file__).resolve().parents[1] / 'tools/run_all_tests.py')
matrix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matrix)


class MatrixContract(unittest.TestCase):
    def child(self, program, *, timeout=10, asserting=True):
        with tempfile.TemporaryDirectory(prefix='tw-matrix-contract-') as directory:
            out=Path(directory)
            # No browser/expensive work here. The enclosing unittest suite uses
            # the real limiter; a pass-through fixture avoids nested slot locks.
            limiter=out/'slot';limiter.write_text('#!/bin/sh\nexec "$@"\n');limiter.chmod(0o755)
            args=SimpleNamespace(limiter=str(limiter),repeat=1)
            suite=dict(suite='probe.py',command=[sys.executable,'-c',program],timeout=timeout,asserting=asserting)
            with contextlib.redirect_stdout(io.StringIO()):
                result=matrix.run(suite,1,dict(web='',review=''),args,out)
            self.assertEqual(json.loads((out/'probe.py.1.json').read_text()),result)
            return result

    def test_successful_assertions_do_not_hide_later_failure(self):
        result=self.child("print('PASS initial assertion'); raise SystemExit(3)")
        self.assertEqual((result['status'],result['exit'],result['passed']),('FAIL',3,1))

    def test_zero_exit_does_not_hide_an_explicit_failed_assertion(self):
        result=self.child("print('PASS initial assertion'); print('FAIL required behavior')")
        self.assertEqual((result['status'],result['exit'],result['child_exit'],result['failed']),('FAIL',1,0,1))

    def test_zero_assertion_sweep_is_not_a_pass(self):
        result=self.child("print('TOTAL 0/0 pass; 0 XFAIL plans (0 assertions); same seed, different plan: 0')")
        self.assertEqual((result['status'],result['exit'],result['child_exit'],result['passed']),('FAIL',1,0,0))

    def test_timeout_is_not_a_pass(self):
        result=self.child("import time; print('PASS started',flush=True); time.sleep(60)",timeout=.1)
        self.assertEqual((result['status'],result['exit']),('FAIL',124))

    def test_measurement_is_not_an_assertion_pass(self):
        result=self.child("print('frame time: 8 ms')",asserting=False)
        self.assertEqual((result['status'],result['passed']),('MEASURED',None))

    def test_expected_contracts_are_not_double_counted_as_failed_plans(self):
        result=self.child("print('XFAIL contract one\\nXFAIL contract two\\nTOTAL 8/9 pass; 1 XFAIL plans (2 assertions); same seed, different plan: 0')")
        self.assertEqual((result['status'],result['passed'],result['failed'],result['expected_failures'],result['expected_assertions']),
                         ('XFAIL',8,0,1,2))

    def test_fixed_ports_serialize_distinct_suites_before_the_limiter(self):
        with tempfile.TemporaryDirectory(prefix='tw-port-contract-') as directory:
            root=Path(directory)
            with socket.socket() as a, socket.socket() as b:
                a.bind(('127.0.0.1',0));b.bind(('127.0.0.1',0))
                shared=a.getsockname()[1];independent=b.getsockname()[1]
            limiter=root/'slot'
            limiter.write_text('#!/bin/sh\n# Record admission before executing the cheap fixture.\necho admitted > "$ADMISSION"\nexec "$@"\n');limiter.chmod(0o755)
            driver=root/'driver.py'
            driver.write_text(f"""import importlib.util,json,signal,sys,threading
from pathlib import Path
from types import SimpleNamespace
spec=importlib.util.spec_from_file_location('matrix',{str(Path(matrix.__file__))!r})
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.ROOT=Path({str(root)!r})
name,port=sys.argv[1:];stop=threading.Event()
signal.signal(signal.SIGINT,lambda *_:stop.set())
program="from pathlib import Path; import time; Path('"+name+"-started').touch(); "
if name=='first': program+=chr(10)+"while not Path('release').exists(): time.sleep(.02)"
suite=dict(suite=name+'.py',ports=[int(port)],command=[sys.executable,'-c',program],env={{'ADMISSION':str(m.ROOT/(name+'-admitted'))}})
(m.ROOT/(name+'-driver')).touch()
row=m.run(suite,1,dict(web='',review=''),SimpleNamespace(limiter={str(limiter)!r},repeat=1),m.ROOT,stop)
(m.ROOT/(name+'-result')).write_text(json.dumps(row))
""")
            def wait_file(name):
                deadline=time.monotonic()+10
                while not (root/name).exists() and time.monotonic()<deadline: time.sleep(.02)
                self.assertTrue((root/name).exists(),name+' '+(root/'drivers.log').read_text())
            processes=[]
            with (root/'drivers.log').open('w') as log:
                def launch(name,port):
                    p=subprocess.Popen([sys.executable,str(driver),name,str(port)],cwd=root,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
                    processes.append(p);return p
                try:
                    first=launch('first',shared);wait_file('first-started')
                    second=launch('second',shared);wait_file('second-driver')
                    third=launch('independent',independent);wait_file('independent-started')
                    self.assertFalse((root/'second-admitted').exists(),'blocked suite consumed a limiter slot')
                    self.assertFalse((root/'second-started').exists())
                    cancelled=launch('cancelled',shared);wait_file('cancelled-driver')
                    os.kill(cancelled.pid,signal.SIGINT)
                    self.assertEqual(cancelled.wait(timeout=3),0)
                    self.assertEqual(json.loads((root/'cancelled-result').read_text()),None)
                    self.assertFalse((root/'cancelled-admitted').exists())
                    (root/'release').touch()
                    for p in (first,second,third):self.assertEqual(p.wait(timeout=15),0,(root/'drivers.log').read_text())
                    self.assertTrue((root/'second-started').exists())
                finally:
                    (root/'release').touch()
                    for p in processes:
                        if p.poll() is None: p.kill();p.wait()
            self.assertEqual(matrix.effective_ports({'ports':[1,2],'port_env':'TW_PORTS'},{'TW_PORTS':'32002,32001'}),[32001,32002])
            self.assertEqual(matrix.effective_ports({'ports':[1,2],'port_env':['TW_RP','TW_SP']},{'TW_RP':'32003'}),[2,32003])

    def test_unlocked_transient_listener_is_gone_before_suite_starts(self):
        with tempfile.TemporaryDirectory(prefix='tw-occupied-port-contract-') as directory:
            root=Path(directory)
            limiter=root/'slot';limiter.write_text('#!/bin/sh\nexec "$@"\n');limiter.chmod(0o755)
            with socket.socket() as listener:
                listener.bind(('127.0.0.1',0));listener.listen()
                port=listener.getsockname()[1]
                release=threading.Timer(.35,listener.close);release.start()
                try:
                    suite=dict(suite='transient.py',ports=[port],command=[sys.executable,'-c',"print('PASS child reached assertions')"])
                    with contextlib.redirect_stdout(io.StringIO()):
                        result=matrix.run(suite,1,dict(web='',review=''),SimpleNamespace(limiter=str(limiter),repeat=1),root)
                finally: release.join()
            self.assertEqual((result['status'],result['passed'],result['failed']),('PASS',1,0))
            self.assertGreaterEqual(result['port_wait_seconds'],.3)

    def test_ctrl_c_cleans_active_suite_and_never_starts_queued_suites(self):
        with tempfile.TemporaryDirectory(prefix='tw-cancel-contract-') as directory:
            root=Path(directory);out=root/'out';out.mkdir()
            (root/'tools/spawn-tuner').mkdir(parents=True)
            (root/'tools/spawn-tuner/placeholder').write_text('fixture')
            for command in (['git','init','-q'],['git','add','.'],
                            ['git','-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture']):
                subprocess.run(command,cwd=root,check=True,capture_output=True)
            limiter=root/'slot';limiter.write_text('#!/bin/sh\nexec "$@"\n');limiter.chmod(0o755)
            active=root/'active.py'
            active.write_text("from pathlib import Path\nimport time\ntry:\n Path('ready').write_text('ready')\n time.sleep(60)\nfinally:\n time.sleep(.3)\n Path('cleaned').write_text('cleaned')\n")
            driver=root/'driver.py'
            driver.write_text(f"""import importlib.util,sys,types
from pathlib import Path
spec=importlib.util.spec_from_file_location('matrix',{str(Path(matrix.__file__))!r})
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.ROOT=Path({str(root)!r})
class Site:
 url=game_url='unused'
 def __enter__(self): return self
 def __exit__(self,*args): (m.ROOT/'site-cleaned').write_text('cleaned')
site=types.ModuleType('tw_test_site');site.TestSite=Site;sys.modules['tw_test_site']=site
suites=[dict(suite='active.py',command=[sys.executable,{str(active)!r}])]
for name in ('queued-one','queued-two'):
 suites.append(dict(suite=name+'.py',command=[sys.executable,'-c',f"from pathlib import Path; Path('{{name}}').touch()"]))
m.inventory=lambda:dict(suites=suites,excluded={{}})
sys.argv=['matrix','--limiter',{str(limiter)!r},'--out',{str(out)!r},'--golden-ref','HEAD','--repeat','2']
sys.exit(m.main())
""")
            with (root/'driver.log').open('w') as log:
                proc=subprocess.Popen([sys.executable,str(driver)],cwd=root,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
                try:
                    deadline=time.monotonic()+10
                    while not (root/'ready').exists() and proc.poll() is None and time.monotonic()<deadline: time.sleep(.02)
                    self.assertTrue((root/'ready').exists(),(root/'driver.log').read_text())
                    os.kill(proc.pid,signal.SIGINT)
                    self.assertEqual(proc.wait(timeout=20),130,(root/'driver.log').read_text())
                finally:
                    if proc.poll() is None: proc.kill();proc.wait()
            self.assertTrue((root/'cleaned').exists(),'active Python finally did not complete')
            self.assertTrue((root/'site-cleaned').exists(),'test site was not cleaned')
            self.assertFalse((root/'queued-one').exists())
            self.assertFalse((root/'queued-two').exists())
            report=json.loads((out/'report.json').read_text())
            self.assertTrue(report['interrupted'])
            self.assertEqual(len(report['runs']),1)
            self.assertEqual((report['runs'][0]['status'],report['runs'][0]['exit']),('CANCELLED',130))
            self.assertEqual(len(report['not_started']),5,'queued suites and active repeat must not run')

    def test_new_executable_cannot_disappear_from_inventory(self):
        with tempfile.TemporaryDirectory(prefix='tw-inventory-contract-') as directory:
            root=Path(directory);(root/'tools').mkdir();(root/'tests').mkdir()
            (root/'tools/test_matrix.json').write_text(json.dumps({'suites':[],'excluded':{}}))
            with patch.object(matrix,'ROOT',root):
                self.assertEqual(matrix.inventory()['suites'],[])
                (root/'tests/new_check.py').write_text('assert False\n')
                with self.assertRaisesRegex(RuntimeError,'new_check.py'):matrix.inventory()


if __name__=='__main__':
    unittest.main()
