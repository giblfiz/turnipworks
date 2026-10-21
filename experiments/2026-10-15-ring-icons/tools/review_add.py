"""Apply explicit human/agent judgments, never infer acceptance from a read."""
import json,sys
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'review.json';r=json.loads(p.read_text());r.update(json.load(sys.stdin));p.write_text(json.dumps(r,indent=2)+'\n')
