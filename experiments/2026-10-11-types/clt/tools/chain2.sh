#!/bin/sh
cd experiments/2026-10-11-types/clt
PY=python3
while kill -0 2680439 2>/dev/null; do sleep 20; done
for g in p1 sib1 sib2 p2; do $PY tools/gen.py . --group $g --workers 2 > gen-$g-b.log 2>&1; done
touch plates.done
