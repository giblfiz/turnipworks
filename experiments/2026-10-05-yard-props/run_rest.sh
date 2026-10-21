#!/usr/bin/env bash
cd "$(dirname "$0")"
PY=python3
$PY gen.py . --group trees --workers 4 --rerolls 1 > gen-trees.log 2>&1
$PY gen.py . --group sib --workers 5 --rerolls 1 > gen-sib.log 2>&1
