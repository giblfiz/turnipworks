"""One mesh file per sku, one owner per file.  (2026-10-12; no Blender imports: blender_runtime.py and plain python use it)

assets/m/ is ONE folder shared by every git worktree, and a batch's runtime build writes assets/m/<sku>.glb. When two
batches chose the same sku, one batch's build replaced the other's mesh and nobody was told. Each built file now has a
note beside it, <sku>.glb.owner, naming the batch folder its source model came from. A build whose source is in ANOTHER
batch folder is refused: the job is skipped and the refusal is recorded like any other failed job.

  refusal(job) -> None, or the sentence saying why this job may not write its output
  stamp(job)   -> write the note after a successful build
A job may carry "takeover": true when replacing another batch's mesh is the point (a deliberate re-generation); say why
in tools/tool-sweep/sku_guard_allow.json too, or build_data.py's gate will stop the build before it gets here.
Files built before 2026-10-12 got their notes from `python3 tools/tool-sweep/sku_guard.py --stamp`. A file with no
note is not protected. The pre-flight is tools/tool-sweep/sku_free.py; the gate is tools/tool-sweep/sku_guard.py.
"""
import json
from pathlib import Path


def owner_key(path):
    """'experiments/<batch folder>' of a source model, whatever worktree it was read from."""
    parts = Path(path).as_posix().split('/')
    if 'experiments' not in parts:
        return Path(path).parent.as_posix()
    i = len(parts) - 1 - parts[::-1].index('experiments')
    rest = parts[i:-1]
    while rest and rest[-1] in ('models', 'fal'):
        rest = rest[:-1]
    return '/'.join(rest)


def note_path(job):
    return Path(str(job['out']) + '.owner')


def refusal(job):
    p = note_path(job)
    if job.get('takeover') or not p.exists() or not Path(job['out']).exists():
        return None
    try:
        rec = json.loads(p.read_text())
    except Exception:  # noqa: BLE001  (an unreadable note protects nothing)
        return None
    mine = owner_key(job['src'])
    if rec.get('batch') and rec['batch'] != mine:
        return (f"REFUSED: {Path(job['out']).name} is {rec['batch']}'s mesh (source {rec.get('source')}); this job would replace it with "
                f"{mine}'s ({job['src']}). Two batches claim the sku '{job['sku']}': rename one (python3 tools/tool-sweep/sku_free.py), "
                f"or add \"takeover\": true to the job if replacing it is intended.")
    return None


def stamp(job):
    note_path(job).write_text(json.dumps({'batch': owner_key(job['src']), 'source': str(job['src']), 'by': 'blender_runtime.py'}) + '\n')
