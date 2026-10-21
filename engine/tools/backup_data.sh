#!/usr/bin/env bash
# A copy of the saved campaigns (engine/data: every snapshot and journal) BEFORE the relay restarts.   (2026-10-06)
# Why: a restart loads every campaign with whatever code is in the tree and may rewrite its snapshot (the hit points ->
# damage conversion of 2026-10-06 did, with no copy taken first). The journals are the record, but replaying an old
# journal with new code is not byte-identical to the snapshot it sat behind, so the snapshots are worth keeping too.
#
#   engine/tools/backup_data.sh [label]     -> prints the copy's path; exit 1 (and no restart) when the copy is not good
#
# One file per copy: <dir>/data-YYYYmmdd-HHMMSS[-label].tar.zst  (about 6 MB for 260 campaigns, 150 MB unpacked).
# Where: TW_BACKUP_DIR, else /mnt/usb/turnip-works/relay-data-backups (the root disk is nearly full), else, when the
# USB disk is not there, ~/tw-relay-data-backups. The last KEEP (30) copies are kept; older ones are removed.
# Not copied: data/secret and data/admin-key (the key that signs seat tokens, the key for operator notices: it does not change in a deploy and should not sit on a
# world-readable disk).
# Feedback tickets (2026-10-19, relay/tickets.js): data/tickets/tickets.jsonl is in every copy; the screenshots
# (data/tickets/shots/, files that never change once written) are mirrored instead, added to <dir>/ticket-shots/ and never
# deleted there, so 72 hourly copies do not each carry every picture. Not copied: tickets/triage.key (like the secret)
# and tickets/test-sandbox/ (test writes).
# Restore one campaign:  tar --zstd -xf <copy> -C /some/dir data/cmp_XXXX   then stop the relay, put the folder back, start it.
set -euo pipefail
ENGINE="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${DATA_DIR:-$ENGINE/data}"
KEEP="${TW_BACKUP_KEEP:-30}"
LABEL="${1:+-$(printf '%s' "$1" | tr -c 'A-Za-z0-9._' '-')}"
if [[ -n "${TW_BACKUP_DIR:-}" ]]; then DIR="$TW_BACKUP_DIR"
elif mkdir -p /mnt/usb/turnip-works/relay-data-backups 2>/dev/null && [[ -w /mnt/usb/turnip-works/relay-data-backups ]]; then DIR=/mnt/usb/turnip-works/relay-data-backups
else DIR="$HOME/tw-relay-data-backups"; echo "backup: /mnt/usb is not available; copying to $DIR on the root disk" >&2; fi
mkdir -p "$DIR"
[[ -d "$DATA" ]] || { echo "backup: no data directory at $DATA" >&2; exit 1; }
DATA="$(cd "$DATA" && pwd -P)"   # (a worktree's engine/data is a link to the live one)
WANT=$(find "$DATA" -maxdepth 2 -path '*/cmp_*/journal.jsonl' | wc -l)
OUT="$DIR/data-$(date +%Y%m%d-%H%M%S)$LABEL.tar.zst"
# (the relay is still running: a journal may grow while it is read, which tar reports with exit 1; a snapshot is
# replaced by rename, so it is always whole)
B="$(basename "$DATA")"
set +e; tar -C "$(dirname "$DATA")" --exclude="$B/secret" --exclude="$B/admin-key" --exclude="$B/tickets/shots" --exclude="$B/tickets/test-sandbox" --exclude="$B/tickets/triage.key" --warning=no-file-changed -cf - "$B" | zstd -q -3 -T0 -o "$OUT.part"; RC=("${PIPESTATUS[@]}"); set -e
[[ ${RC[0]} -le 1 && ${RC[1]} -eq 0 ]] || { rm -f "$OUT.part"; echo "backup: FAILED (tar ${RC[0]}, zstd ${RC[1]})" >&2; exit 1; }
GOT=$(tar --zstd -tf "$OUT.part" | grep -c '/cmp_[^/]*/journal\.jsonl$' || true)
SIZE=$(stat -c %s "$OUT.part")
# never go on with an empty or short copy
if [[ "$GOT" -lt "$WANT" || "$SIZE" -lt 64 || ( "$WANT" -eq 0 && "${TW_BACKUP_ALLOW_EMPTY:-}" != 1 ) ]]; then
  rm -f "$OUT.part"; echo "backup: FAILED: the copy holds $GOT campaigns, the data directory has $WANT" >&2; exit 1
fi
mv "$OUT.part" "$OUT"
if [[ -d "$DATA/tickets/shots" ]]; then
  mkdir -p "$DIR/ticket-shots"
  rsync -a --ignore-existing "$DATA/tickets/shots/" "$DIR/ticket-shots/" || { echo "backup: FAILED to mirror the ticket screenshots to $DIR/ticket-shots" >&2; exit 1; }
fi
ls -1t "$DIR"/data-*.tar.zst 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do rm -f "$old"; done
N=$(ls -1 "$DIR"/data-*.tar.zst | wc -l)
echo "backup: $GOT campaigns, $(du -h "$OUT" | cut -f1) -> $OUT ($N copies kept, $(du -ch "$DIR"/data-*.tar.zst | tail -1 | cut -f1) in all, at most $KEEP)" >&2
echo "$OUT"
