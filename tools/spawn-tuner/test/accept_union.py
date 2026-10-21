"""Run the complete acceptance suite, retaining failures and visible progress.

python accept_union.py URL [--attempts N] [--writeback]
An incomplete browser run may be retried, but a passing result requires every
applicable check in ONE complete run. Explicit FAIL results never get retried
away. Optional writeback checks apply only when --writeback is requested.
"""
import ast
from pathlib import Path
import re
import subprocess
import sys

url = sys.argv[1]
n = int(sys.argv[sys.argv.index('--attempts') + 1]) if '--attempts' in sys.argv else 1
writeback = '--writeback' in sys.argv
extra = ['--writeback'] if writeback else []
here = Path(__file__).resolve().parent

class Checks(ast.NodeVisitor):
    def __init__(self): self.names = set()
    def visit_If(self, node):
        if isinstance(node.test, ast.Name) and node.test.id == 'WRITEBACK':
            for child in node.body if writeback else node.orelse: self.visit(child)
        else: self.generic_visit(node)
    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id == 'check' and node.args and isinstance(node.args[0], ast.Constant):
            self.names.add(node.args[0].value.split()[0])
        self.generic_visit(node)

checks = Checks(); checks.visit(ast.parse((here / 'accept.py').read_text()))
want = checks.names
for attempt in range(1, n + 1):
    passed, failed = set(), set()
    print(f'acceptance attempt {attempt}/{n}: expecting {len(want)} checks', flush=True)
    child = subprocess.Popen([sys.executable, '-u', str(here / 'accept.py'), url, *extra], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in child.stdout:
        print(line, end='', flush=True)
        match = re.match(r'(PASS|FAIL) (A[0-9]+[a-z]?) ', line)
        if match: (passed if match[1] == 'PASS' else failed).add(match[2])
    code = child.wait()
    missing = sorted(want - passed)
    print(f'attempt {attempt}: {len(passed)}/{len(want)} passed, {len(failed)} failed, exit {code}, missing {missing}', flush=True)
    if failed: sys.exit(1)
    if code == 0 and not missing: sys.exit(0)
sys.exit(1)
