#!/usr/bin/env bash
# One line: plates done, plates waiting, the exact Codex error text if the route is stopped, the last probe time.
exec python3 "$(dirname "$0")/gen.py" --status
