# Turn a `codex exec --json` transcript of a live trial into readable markdown, tokens redacted.
#   python3 experiments/2026-10-20-llm-api/transcript.py TRANSCRIPT.jsonl [THE_SEAT_TOKEN] > transcript-N.md
# A token in an address that is not the seat's own is shown as TOKEN(miscopied ...): the model got it wrong.
import json, re, sys
real = sys.argv[2] if len(sys.argv) > 2 else None
def tok(m):
    t = m.group(1)
    if real is None or t == real: return 'seat=TOKEN'
    at = next((i for i, (a, b) in enumerate(zip(t, real)) if a != b), min(len(t), len(real)))
    return f'seat=TOKEN(miscopied: {len(t)} of {len(real)} characters, first difference at {at})'
red = lambda s: re.sub(r'seat=([A-Za-z0-9_.-]{20,})', tok, s)
for line in open(sys.argv[1]):
    e = json.loads(line); it = e.get('item') or {}
    if e.get('type') != 'item.completed': continue
    if it.get('type') == 'command_execution':
        print(f"**fetch** `{red(it.get('command', ''))[:400]}`\n\n```\n{red(it.get('aggregated_output') or '')[:700]}\n```\n")
    elif it.get('type') == 'agent_message':
        print(f"**model:** {red(it.get('text') or '')}\n")
