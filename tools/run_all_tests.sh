#!/usr/bin/env bash
# Complete Turnip Works matrix; every child goes through the shared suite/GPU limiter.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "${TW_TEST_PYTHON:-python3}" "$ROOT/tools/run_all_tests.py" "$@"
