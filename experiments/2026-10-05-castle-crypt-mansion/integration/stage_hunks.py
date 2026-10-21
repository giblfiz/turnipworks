#!/usr/bin/env python3
"""Stage ONLY this integration's hunks of files that also hold someone else's uncommitted changes.

    python3 stage_hunks.py [--dry-run] FILE [FILE ...]          (run from the repo root)

How (what the yard commit 291ba21 did by hand): `git diff -U0 FILE` gives one hunk per changed run of lines. A hunk is
OURS when it lies wholly inside one of our appended `>>> ccm:` ... `<<< ccm:` blocks, or its added lines are exactly one
of the inserts / replaced lines apply.py writes (read from hunks/hunks.py, so nothing is guessed). Our hunks go to
`git apply --cached --unidiff-zero`; every other hunk stays unstaged in the working tree, untouched. Then
`git diff --cached FILE` shows exactly what will be committed and `git diff FILE` what was left for its owner.
A hunk that mixes our lines with someone else's (two edits with no unchanged line between them) is REFUSED and named:
resolve it by hand (`git add -p` is not available here; write the two-line patch yourself) rather than commit their work.
"""
import importlib.util, pathlib, re, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent

def known_blocks():
    """every insert / replacement apply.py writes, as a tuple of its stripped lines"""
    def load(path, name):
        spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
    H = load(HERE / "hunks/hunks.py", "hunks").hunks(load(HERE / "room_types.py", "room_types"))
    blocks = {tuple(l.strip() for l in (h.get("text") or h.get("new") or "").splitlines() if l.strip()) for h in H if h["kind"] != "tail"} - {()}
    # edits INSIDE a line (an <option> added to a select, the tail of a template string replaced): (old part, new part)
    inline = [(h.get("old", ""), h.get("new") or h.get("anchor", "") + h.get("text", "")) if h["kind"] == "replace" else (h["anchor"], h["anchor"] + h["text"] if h["kind"] == "after" else h["text"] + h["anchor"])
              for h in H if h["kind"] != "tail" and "\n" not in (h.get("text") or h.get("new") or "").rstrip("\n")]
    return blocks, inline

def tail_ranges(path):
    """line ranges (1-based, inclusive) of the `>>> ccm:` ... `<<< ccm:` blocks in the working file, with the blank line before each"""
    out, start = [], None
    for n, l in enumerate(pathlib.Path(path).read_text().splitlines(), 1):
        if ">>> ccm:" in l: start = n
        elif "<<< ccm:" in l and start: out.append((start - 1, n)); start = None
    return out

def main():
    dry = "--dry-run" in sys.argv; files = [a for a in sys.argv[1:] if not a.startswith("--")]
    blocks, inline = known_blocks(); rc = 0
    for f in files:
        d = subprocess.run(["git", "diff", "-U0", "--", f], capture_output=True, text=True, check=True).stdout
        if not d: print(f"{f}: no unstaged changes"); continue
        head, *hunks = re.split(r"(?m)^(?=@@ )", d)
        tails = tail_ranges(f); keep, left, mixed = [], [], []
        for h in hunks:
            m = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", h); n0, cnt = int(m.group(1)), int(m.group(2) or 1)
            added = tuple(l[1:].strip() for l in h.splitlines()[1:] if l.startswith("+") and l[1:].strip())
            in_tail = [any(a <= n <= b for a, b in tails) for n in range(n0, n0 + cnt)] if cnt else []
            if cnt and all(in_tail): keep.append(h)                       # wholly inside one of our appended blocks
            elif added in blocks: keep.append(h)                          # exactly one of our inserts / replaced lines
            elif len(body := h.splitlines()[1:]) == 2 and body[0].startswith("-") and body[1].startswith("+") and any(o.rstrip("\n") in body[0] and body[0][1:].replace(o.rstrip("\n"), n.rstrip("\n")) == body[1][1:] for o, n in inline): keep.append(h)  # one line, changed only by our in-line edit
            elif any(in_tail) or any(set(b) <= set(added) and len(b) < len(added) for b in blocks if len(b) > 0 and all(len(x) > 25 for x in b)): mixed.append(h)
            else: left.append(h)
        print(f"{f}: {len(keep)} hunks ours, {len(left)} left for their owner, {len(mixed)} MIXED")
        for h in mixed: print("  MIXED (not staged):", h.splitlines()[0]); rc = 1
        if keep and not dry:
            # the hunks we leave behind shift every later line: renumber the new side of ours for the index as it will be
            # (git places a zero-context insertion by its NEW line number, so the working-tree numbers would misplace it)
            out, delta = [], 0
            for h in keep:
                m = re.match(r"@@ -(\d+)(?:,(\d+))? \+\d+(?:,(\d+))? @@(.*)", h); a, ac, nc = int(m.group(1)), int(m.group(2) or 1), int(m.group(3) or 1)
                ns = a + delta + (1 if ac == 0 else 0) - (1 if nc == 0 and ac else 0)
                out.append(f"@@ -{a},{ac} +{ns},{nc} @@{m.group(4)}\n" + h.split("\n", 1)[1]); delta += nc - ac
            subprocess.run(["git", "apply", "--cached", "--unidiff-zero", "-"], input=head + "".join(out), text=True, check=True)
    sys.exit(rc)

if __name__ == "__main__":
    main()
