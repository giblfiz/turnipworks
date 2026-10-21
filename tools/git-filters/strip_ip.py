#!/usr/bin/env python3
"""git clean filter: drop "ip" keys from rating/write-back records (JSON or JSONL) before they are committed."""
import json, sys

def scrub(v):
    if isinstance(v, dict): return {k: scrub(x) for k, x in v.items() if k != 'ip'}
    if isinstance(v, list): return [scrub(x) for x in v]
    return v

text = sys.stdin.read()
try:  # one JSON document (latest.json)
    doc = json.loads(text)
    sys.stdout.write(json.dumps(scrub(doc), indent=1 if '\n ' in text[:200] else None, ensure_ascii=False) + ('\n' if text.endswith('\n') else ''))
except ValueError:  # JSONL
    out = []
    for line in text.splitlines():
        try: out.append(json.dumps(scrub(json.loads(line)), ensure_ascii=False) if line.strip() else line)
        except ValueError: out.append(line)
    sys.stdout.write('\n'.join(out) + ('\n' if text.endswith('\n') else ''))
